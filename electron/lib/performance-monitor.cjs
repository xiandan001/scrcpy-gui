// $XBH_AI_PATCH_START
// 性能监控后端：采集设备 CPU/内存/磁盘/电池/温度/进程快照，并通过 IPC 推送给渲染进程。

const { app } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const ctx = require('./app-context.cjs');
const vip = require('./vip.cjs');

const BUNDLED_ADB_PATH = path.join(__dirname, '../../scrcpy-win64/adb.exe');
const DEFAULT_INTERVAL_MS = 5000;
const VIP_MIN_INTERVAL_MS = 1000;
const FREE_HISTORY_LIMIT = 60;
const VIP_HISTORY_LIMIT = 720;
const COMMAND_TIMEOUT_MS = 15000;
const EXPORT_DIR = 'performance-monitor';
const THRESHOLDS_FILE = 'performance-thresholds.json';

const monitors = new Map();
const historyByDevice = new Map();
const cpuTicksByDevice = new Map();
let thresholdCache = null;

const DEFAULT_THRESHOLDS = {
  cpu: 85,
  memory: 85,
  batteryTemp: 45,
  dataUsed: 90
};

function register(ipcMain) {
  ipcMain.handle('perf:start', async (event, args) => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    if (!deviceId) return { ok: false, error: 'device_required' };
    const status = await vip.getStatusAsync();
    const isVip = status.activated === true;
    const intervalMs = normalizeInterval(args?.intervalMs, isVip);
    stopMonitor(deviceId);
    const monitor = {
      deviceId,
      sender: event.sender,
      intervalMs,
      includeProcesses: isVip && args?.includeProcesses !== false,
      running: true,
      // $XBH_AI_PATCH_START
      // 防止 ADB 响应慢时 setInterval 重叠触发多批采样命令。
      inFlight: false
      // $XBH_AI_PATCH_END
    };
    monitors.set(deviceId, monitor);
    // $XBH_AI_PATCH_START
    // $XBH_AI_PATCH_MODIFY: 采样统一走串行 tick，避免命令堆积造成卡顿或资源泄漏。
    await runMonitorTick(monitor);
    monitor.timer = setInterval(() => {
      runMonitorTick(monitor);
    }, intervalMs);
    // $XBH_AI_PATCH_END
    return { ok: true, deviceId, intervalMs, vip: isVip };
  });

  ipcMain.handle('perf:stop', async (event, args) => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    if (!deviceId) return { ok: false, error: 'device_required' };
    const stopped = stopMonitor(deviceId);
    return { ok: true, stopped };
  });

  ipcMain.handle('perf:snapshot', async (event, args) => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    if (!deviceId) return { ok: false, error: 'device_required' };
    const status = await vip.getStatusAsync();
    const snapshot = await collectSnapshot(deviceId, status.activated === true);
    appendHistory(deviceId, snapshot, status.activated === true);
    return { ok: true, snapshot };
  });

  ipcMain.handle('perf:history', async (event, args) => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    if (!deviceId) return { ok: false, error: 'device_required' };
    return { ok: true, history: historyByDevice.get(deviceId) || [] };
  });

  ipcMain.handle('perf:export', async (event, args) => withVip(async () => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    if (!deviceId) return { ok: false, error: 'device_required' };
    const history = historyByDevice.get(deviceId) || [];
    if (history.length === 0) return { ok: false, error: 'no_history' };
    const outputPath = await writeExport(deviceId, history, args?.outputPath);
    return { ok: true, path: outputPath, count: history.length };
  }));

  ipcMain.handle('perf:getThresholds', async () => {
    return { ok: true, thresholds: readThresholds() };
  });

  ipcMain.handle('perf:setThresholds', async (event, args) => withVip(async () => {
    const next = {
      ...readThresholds(),
      ...sanitizeThresholds(args?.thresholds || {})
    };
    writeThresholds(next);
    return { ok: true, thresholds: next };
  }));
}

async function withVip(action) {
  const status = await vip.getStatusAsync();
  if (!status.activated) {
    return { ok: false, code: 'vip_required', error: 'VIP 会员专属功能，请先开通会员' };
  }
  try {
    return await action(status);
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function collectAndPush(monitor) {
  if (!monitor.running) return;
  const status = await vip.getStatusAsync();
  const snapshot = await collectSnapshot(monitor.deviceId, status.activated === true && monitor.includeProcesses);
  // $XBH_AI_PATCH_START
  // $XBH_AI_PATCH_MODIFY: 采样期间若用户停止/切换设备，丢弃已过期结果，避免旧数据回写界面。
  if (!monitor.running || monitors.get(monitor.deviceId) !== monitor) return;
  // $XBH_AI_PATCH_END
  appendHistory(monitor.deviceId, snapshot, status.activated === true);
  broadcastUpdate(monitor.deviceId, { ok: true, snapshot });
}

// $XBH_AI_PATCH_START
// 串行执行单次性能采样；上一轮未结束时跳过本轮，保护 ADB 和渲染进程。
async function runMonitorTick(monitor) {
  if (!monitor.running || monitor.inFlight) return;
  monitor.inFlight = true;
  try {
    await collectAndPush(monitor);
  } catch (error) {
    if (monitor.running && monitors.get(monitor.deviceId) === monitor) {
      broadcastUpdate(monitor.deviceId, { ok: false, error: error.message, timestamp: Date.now() });
    }
  } finally {
    monitor.inFlight = false;
  }
}
// $XBH_AI_PATCH_END

async function collectSnapshot(deviceId, includeProcesses) {
  const [cpu, meminfo, df, battery, thermal, top] = await Promise.all([
    runAdb(['-s', deviceId, 'shell', 'cat', '/proc/stat']),
    runAdb(['-s', deviceId, 'shell', 'cat', '/proc/meminfo']),
    runAdb(['-s', deviceId, 'shell', 'df', '-k']),
    runAdb(['-s', deviceId, 'shell', 'dumpsys', 'battery']),
    runAdb(['-s', deviceId, 'shell', 'dumpsys', 'thermalservice']),
    includeProcesses ? runTop(deviceId) : Promise.resolve({ ok: true, stdout: '' })
  ]);
  const snapshot = {
    timestamp: Date.now(),
    deviceId,
    cpu: parseCpu(deviceId, cpu.stdout),
    memory: parseMeminfo(meminfo.stdout),
    disk: parseDisk(df.stdout),
    battery: parseBattery(battery.stdout),
    thermal: parseThermal(thermal.stdout),
    processes: includeProcesses ? parseTop(top.stdout) : [],
    warnings: []
  };
  snapshot.warnings = buildWarnings(snapshot, readThresholds());
  return snapshot;
}

async function runTop(deviceId) {
  const preferred = await runAdb(['-s', deviceId, 'shell', 'top', '-b', '-n', '1', '-m', '12']);
  if (preferred.ok && preferred.stdout.trim()) return preferred;
  return runAdb(['-s', deviceId, 'shell', 'toybox', 'top', '-b', '-n', '1', '-m', '12']);
}

function parseCpu(deviceId, text) {
  const line = String(text || '').split(/\r?\n/).find(item => item.startsWith('cpu '));
  if (!line) return { usage: null };
  const parts = line.trim().split(/\s+/).slice(1).map(value => Number(value) || 0);
  const idle = (parts[3] || 0) + (parts[4] || 0);
  const total = parts.reduce((sum, value) => sum + value, 0);
  const prev = cpuTicksByDevice.get(deviceId);
  cpuTicksByDevice.set(deviceId, { idle, total });
  if (!prev) return { usage: null };
  const totalDelta = total - prev.total;
  const idleDelta = idle - prev.idle;
  const usage = totalDelta > 0 ? Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)) : null;
  return { usage: usage == null ? null : Number(usage.toFixed(1)) };
}

function parseMeminfo(text) {
  const values = {};
  String(text || '').split(/\r?\n/).forEach(line => {
    const match = line.match(/^(\w+):\s+(\d+)/);
    if (match) values[match[1]] = Number(match[2]);
  });
  const total = values.MemTotal || 0;
  const available = values.MemAvailable || values.MemFree || 0;
  const used = Math.max(0, total - available);
  return {
    totalKb: total,
    usedKb: used,
    availableKb: available,
    usage: total ? Number((used / total * 100).toFixed(1)) : null
  };
}

function parseDisk(text) {
  const rows = String(text || '').split(/\r?\n/).slice(1).map(line => line.trim()).filter(Boolean);
  return rows.map(line => {
    const parts = line.split(/\s+/);
    const usedPct = firstPercent(parts);
    return {
      filesystem: parts[0] || '',
      sizeKb: Number(parts[1]) || 0,
      usedKb: Number(parts[2]) || 0,
      availableKb: Number(parts[3]) || 0,
      usage: usedPct,
      mount: parts[parts.length - 1] || ''
    };
  });
}

function parseBattery(text) {
  const level = firstNumber(text, /level:\s*(\d+)/i);
  const temperatureRaw = firstNumber(text, /temperature:\s*(\d+)/i);
  const present = /present:\s*true/i.test(String(text || ''));
  return {
    present,
    level: present ? level : null,
    status: firstText(text, /status:\s*(\d+)/i),
    plugged: firstText(text, /plugged:\s*(\d+)/i),
    health: firstText(text, /health:\s*(\d+)/i),
    temperature: present && temperatureRaw ? Number((temperatureRaw / 10).toFixed(1)) : null
  };
}

function parseThermal(text) {
  const sensors = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const status = firstNumber(line, /mStatus=(\d+)/);
    const value = firstNumber(line, /mValue=([0-9.]+)/);
    const name = firstText(line, /mName=([^,\]\s]+)/);
    if (value != null || name) sensors.push({ name: name || 'thermal', value, status });
  });
  const hottest = sensors.reduce((max, item) => item.value != null && item.value > max ? item.value : max, null);
  return { sensors: sensors.slice(0, 12), hottest };
}

function parseTop(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const headerIndex = lines.findIndex(line => /PID/i.test(line) && /CPU|%CPU/i.test(line));
  if (headerIndex < 0) return [];
  const header = lines[headerIndex].split(/\s+/);
  const cpuIndex = header.findIndex(item => /%?CPU/i.test(item));
  const memIndex = header.findIndex(item => /%?MEM/i.test(item));
  const pidIndex = header.findIndex(item => item === 'PID');
  return lines.slice(headerIndex + 1, headerIndex + 13).map(line => {
    const parts = line.split(/\s+/);
    return {
      pid: parts[pidIndex] || parts[0] || '',
      cpu: parseFloat(String(parts[cpuIndex] || '0').replace('%', '')) || 0,
      memory: parseFloat(String(parts[memIndex] || '0').replace('%', '')) || 0,
      name: parts.slice(Math.max(header.length - 1, 0)).join(' ') || parts[parts.length - 1] || ''
    };
  }).filter(item => item.pid);
}

function buildWarnings(snapshot, thresholds) {
  const warnings = [];
  if (snapshot.cpu.usage != null && snapshot.cpu.usage >= thresholds.cpu) warnings.push({ type: 'cpu', label: `CPU ${snapshot.cpu.usage}%` });
  if (snapshot.memory.usage != null && snapshot.memory.usage >= thresholds.memory) warnings.push({ type: 'memory', label: `内存 ${snapshot.memory.usage}%` });
  const temperature = snapshot.battery.temperature ?? snapshot.thermal.hottest;
  if (temperature != null && temperature >= thresholds.batteryTemp) warnings.push({ type: 'batteryTemp', label: `温度 ${temperature}°C` });
  const highDisk = snapshot.disk.find(item => item.mount === '/data' && item.usage >= thresholds.dataUsed);
  if (highDisk) warnings.push({ type: 'disk', label: `/data ${highDisk.usage}%` });
  return warnings;
}

function appendHistory(deviceId, snapshot, isVip) {
  const history = historyByDevice.get(deviceId) || [];
  history.push(snapshot);
  const limit = isVip ? VIP_HISTORY_LIMIT : FREE_HISTORY_LIMIT;
  while (history.length > limit) history.shift();
  historyByDevice.set(deviceId, history);
}

function broadcastUpdate(deviceId, payload) {
  ctx.broadcastToAllWindows('performance:update', { deviceId, ...payload });
}

function stopMonitor(deviceId) {
  const monitor = monitors.get(deviceId);
  if (!monitor) return false;
  monitor.running = false;
  if (monitor.timer) clearInterval(monitor.timer);
  monitors.delete(deviceId);
  return true;
}

function cleanup() {
  Array.from(monitors.keys()).forEach(stopMonitor);
}

function runAdb(args) {
  return new Promise((resolve) => {
    const adbCommand = fs.existsSync(BUNDLED_ADB_PATH) ? BUNDLED_ADB_PATH : 'adb';
    const proc = execFile(adbCommand, args, { windowsHide: true, timeout: COMMAND_TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, stdout: stdout || '', stderr: stderr || '', error: stderr || error.message });
      } else {
        resolve({ ok: true, stdout: stdout || '', stderr: stderr || '' });
      }
    });
    proc.stdin?.end?.();
  });
}

function readThresholds() {
  if (thresholdCache) return thresholdCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(getThresholdPath(), 'utf8'));
    thresholdCache = { ...DEFAULT_THRESHOLDS, ...sanitizeThresholds(parsed) };
  } catch {
    thresholdCache = { ...DEFAULT_THRESHOLDS };
  }
  return thresholdCache;
}

function writeThresholds(thresholds) {
  thresholdCache = { ...DEFAULT_THRESHOLDS, ...sanitizeThresholds(thresholds) };
  fs.mkdirSync(path.dirname(getThresholdPath()), { recursive: true });
  fs.writeFileSync(getThresholdPath(), JSON.stringify(thresholdCache, null, 2), 'utf8');
}

function sanitizeThresholds(value) {
  const next = {};
  ['cpu', 'memory', 'batteryTemp', 'dataUsed'].forEach(key => {
    const n = Number(value[key]);
    if (Number.isFinite(n)) next[key] = Math.max(1, Math.min(100, n));
  });
  return next;
}

async function writeExport(deviceId, history, outputPath) {
  const baseDir = path.join(app.getPath('userData'), EXPORT_DIR);
  await fs.promises.mkdir(baseDir, { recursive: true });
  const filePath = outputPath && typeof outputPath === 'string'
    ? path.resolve(outputPath)
    : path.join(baseDir, `performance-${sanitizeName(deviceId)}-${formatStamp(new Date())}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify({ deviceId, exportedAt: new Date().toISOString(), history }, null, 2), 'utf8');
  return filePath;
}

function getThresholdPath() {
  return path.join(app.getPath('userData'), THRESHOLDS_FILE);
}

function normalizeInterval(value, isVip) {
  const requested = Number(value) || DEFAULT_INTERVAL_MS;
  const min = isVip ? VIP_MIN_INTERVAL_MS : DEFAULT_INTERVAL_MS;
  return Math.max(min, Math.min(60000, requested));
}

function normalizeDeviceId(value) {
  return String(value || '').trim();
}

function sanitizeName(value) {
  return String(value || '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80) || 'device';
}

function formatStamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function firstNumber(text, regex) {
  const match = String(text || '').match(regex);
  return match ? Number(match[1]) : null;
}

function firstText(text, regex) {
  const match = String(text || '').match(regex);
  return match ? String(match[1] || '').trim() : '';
}

function firstPercent(parts) {
  const value = parts.find(part => /%$/.test(part));
  return value ? Number(value.replace('%', '')) : null;
}

module.exports = { register, cleanup, collectSnapshot };

// $XBH_AI_PATCH_END
