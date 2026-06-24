// $XBH_AI_PATCH_START
// 性能监控后端：采集设备 CPU/内存/磁盘/电池/温度/FPS/进程快照，并通过 IPC 推送给渲染进程。

const { app } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const ctx = require('./app-context.cjs');
const vip = require('./vip.cjs');

const BUNDLED_ADB_PATH = path.join(__dirname, '../../scrcpy-win64/adb.exe');
// $XBH_AI_PATCH_START
// 默认 3 秒采样，减少性能面板数值延后感；1 秒高频仍由会员权限控制。
const DEFAULT_INTERVAL_MS = 3000;
// $XBH_AI_PATCH_END
const VIP_MIN_INTERVAL_MS = 1000;
const FREE_HISTORY_LIMIT = 60;
const VIP_HISTORY_LIMIT = 720;
const COMMAND_TIMEOUT_MS = 15000;
// $XBH_AI_PATCH_START
// FPS 采样依赖 dumpsys，单独缩短超时，避免帧率命令拖慢基础指标。
const FPS_COMMAND_TIMEOUT_MS = 8000;
const SURFACE_LAYER_CACHE_MS = 10000;
// $XBH_AI_PATCH_END
const EXPORT_DIR = 'performance-monitor';
const THRESHOLDS_FILE = 'performance-thresholds.json';

const monitors = new Map();
const historyByDevice = new Map();
const cpuTicksByDevice = new Map();
// $XBH_AI_PATCH_START
// 保存帧率上一次采样点，用差值计算当前窗口内 FPS。
const gfxFrameStatsByDevice = new Map();
const surfaceFrameStatsByDevice = new Map();
const surfaceLayerCacheByDevice = new Map();
const fpsDisplayByMetric = new Map();
// $XBH_AI_PATCH_END
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
  const [cpu, meminfo, df, battery, thermal, top, fps] = await Promise.all([
    runAdb(['-s', deviceId, 'shell', 'cat', '/proc/stat']),
    runAdb(['-s', deviceId, 'shell', 'cat', '/proc/meminfo']),
    runAdb(['-s', deviceId, 'shell', 'df', '-k']),
    runAdb(['-s', deviceId, 'shell', 'dumpsys', 'battery']),
    runAdb(['-s', deviceId, 'shell', 'dumpsys', 'thermalservice']),
    includeProcesses ? runTop(deviceId) : Promise.resolve({ ok: true, stdout: '' }),
    // $XBH_AI_PATCH_START
    // FPS 采样失败不影响基础性能指标。
    collectFps(deviceId).catch(error => buildEmptyFps(error.message))
    // $XBH_AI_PATCH_END
  ]);
  const snapshot = {
    timestamp: Date.now(),
    deviceId,
    cpu: parseCpu(deviceId, cpu.stdout),
    memory: parseMeminfo(meminfo.stdout),
    disk: parseDisk(df.stdout),
    battery: parseBattery(battery.stdout),
    thermal: parseThermal(thermal.stdout),
    fps,
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

// $XBH_AI_PATCH_START
// 采集前台应用 FPS 与 SurfaceFlinger 合成 FPS。
async function collectFps(deviceId) {
  const foreground = await getForegroundApp(deviceId);
  const [foregroundFps, surfaceFlingerFps] = await Promise.all([
    collectForegroundFps(deviceId, foreground),
    collectSurfaceFlingerFps(deviceId, foreground)
  ]);
  return {
    foreground: foregroundFps,
    surfaceFlinger: surfaceFlingerFps
  };
}

function buildEmptyFps(error) {
  return {
    foreground: { fps: null, packageName: '', activityName: '', error: error || '' },
    surfaceFlinger: { fps: null, layer: '', refreshRate: null, error: error || '' }
  };
}

async function getForegroundApp(deviceId) {
  const res = await runAdb(['-s', deviceId, 'shell', 'dumpsys', 'window'], FPS_COMMAND_TIMEOUT_MS);
  if (!res.ok) return { packageName: '', activityName: '', component: '', error: res.error || res.stderr || '' };
  return parseForegroundWindow(res.stdout);
}

function parseForegroundWindow(text) {
  const lines = String(text || '').split(/\r?\n/);
  const preferred = [
    /mCurrentFocus=.*?([A-Za-z0-9_.]+)\/([A-Za-z0-9_.$]+)\b/,
    /topResumedActivity=.*?([A-Za-z0-9_.]+)\/([A-Za-z0-9_.$]+)\b/,
    /mFocusedApp=.*?([A-Za-z0-9_.]+)\/([A-Za-z0-9_.$]+)\b/
  ];
  for (const regex of preferred) {
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const packageName = match[1];
        const activityName = normalizeActivityName(packageName, match[2]);
        return { packageName, activityName, component: `${packageName}/${activityName}` };
      }
    }
  }
  return { packageName: '', activityName: '', component: '' };
}

async function collectForegroundFps(deviceId, foreground) {
  if (!foreground.packageName) return { fps: null, ...foreground, source: 'window' };
  const res = await runAdb(['-s', deviceId, 'shell', 'dumpsys', 'gfxinfo', foreground.packageName, 'framestats'], FPS_COMMAND_TIMEOUT_MS);
  if (!res.ok) {
    return { fps: null, ...foreground, source: 'gfxinfo', error: res.error || res.stderr || '' };
  }
  return {
    ...parseGfxInfoFps(deviceId, foreground.packageName, res.stdout),
    ...foreground,
    source: 'gfxinfo'
  };
}

function parseGfxInfoFps(deviceId, packageName, text) {
  const totalFrames = firstNumber(text, /Total frames rendered:\s*(\d+)/i);
  const jankyFrames = firstNumber(text, /Janky frames:\s*(\d+)/i);
  const key = `${deviceId}:${packageName}`;
  const rows = parseGfxFrameRows(text);
  const targetFrameNs = getTargetFrameNs(rows);
  const targetFps = targetFrameNs ? framePeriodToFps(targetFrameNs) : null;
  const prev = gfxFrameStatsByDevice.get(key);
  const newestFrameNs = rows.reduce((max, row) => Math.max(max, row.completed || row.intended || 0), 0);
  let windowRows = [];
  let state = 'initial';
  let deltaFrames = 0;
  let deltaJankyFrames = 0;
  if (prev?.lastFrameNs && newestFrameNs) {
    windowRows = rows.filter(row => (row.completed || row.intended || 0) > prev.lastFrameNs);
    state = windowRows.length > 0 ? 'active' : 'idle';
  }
  if (prev && totalFrames != null && totalFrames >= prev.totalFrames) {
    deltaFrames = totalFrames - prev.totalFrames;
    deltaJankyFrames = Math.max(0, (jankyFrames || 0) - (prev.jankyFrames || 0));
    if (deltaFrames > 0 && state === 'idle') state = 'active';
  }
  if (newestFrameNs) {
    gfxFrameStatsByDevice.set(key, { lastFrameNs: newestFrameNs, targetFrameNs, totalFrames, jankyFrames });
  }
  // $XBH_AI_PATCH_START
  // 前台 FPS 主值按累计帧/卡顿帧折算。framestats 单帧耗时会把轻微滑动误判成 30/40 FPS，
  // 但用户实际看到的是流畅动画；只有 janky frames 明确增加时才降低主显示。
  const rawFps = state === 'active' && deltaFrames > 0
    ? estimateEffectiveFpsFromFrameDelta(deltaFrames, deltaJankyFrames, targetFps)
    : targetFps;
  // $XBH_AI_PATCH_END
  const fps = smoothFpsValue(`foreground:${key}`, rawFps, targetFps, state);
  return {
    fps: roundFps(fps ?? targetFps),
    rawFps: roundFps(rawFps ?? targetFps),
    targetFps,
    frames: state === 'active' ? (windowRows.length || deltaFrames) : 0,
    state,
    totalFrames,
    jankyFrames,
    jankPercent: totalFrames ? Number(((jankyFrames || 0) / totalFrames * 100).toFixed(1)) : null
  };
}

function parseGfxFrameRows(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const headerIndex = lines.findIndex(line => line.startsWith('Flags,') && line.includes('IntendedVsync'));
  if (headerIndex < 0) return [];
  const header = lines[headerIndex].split(',');
  const intendedIndex = header.indexOf('IntendedVsync');
  const completedIndex = header.indexOf('FrameCompleted');
  const intervalIndex = header.indexOf('FrameInterval');
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (line.startsWith('---PROFILEDATA---')) break;
    const parts = line.split(',');
    const flags = Number(parts[0]);
    if (flags !== 0) continue;
    const completed = Number(parts[completedIndex]);
    const intended = Number(parts[intendedIndex]);
    const frameInterval = Number(parts[intervalIndex]);
    if (Number.isFinite(intended) && intended > 0) {
      rows.push({
        intended,
        completed: Number.isFinite(completed) && completed > 0 ? completed : 0,
        frameInterval: Number.isFinite(frameInterval) && frameInterval > 0 ? frameInterval : null
      });
    }
  }
  return rows;
}

function estimateEffectiveFpsFromFrameDelta(frames, jankyFrames, targetFps) {
  if (!targetFps || frames <= 0) return targetFps;
  const goodFrames = Math.max(0, frames - Math.max(0, jankyFrames || 0));
  return targetFps * goodFrames / frames;
}

async function collectSurfaceFlingerFps(deviceId, foreground) {
  const layer = await getSurfaceLayer(deviceId, foreground);
  if (!layer) {
    const res = await runAdb(['-s', deviceId, 'shell', 'dumpsys', 'SurfaceFlinger', '--latency'], FPS_COMMAND_TIMEOUT_MS);
    const framePeriodNs = parseFramePeriod(res.stdout);
    const refreshRate = framePeriodToFps(framePeriodNs);
    return {
      fps: refreshRate,
      layer: '',
      refreshRate,
      framePeriodMs: framePeriodNs ? Number((framePeriodNs / 1e6).toFixed(2)) : null,
      state: 'refresh_rate',
      source: 'surfaceflinger'
    };
  }
  const res = await runAdb(['-s', deviceId, 'shell', 'dumpsys', 'SurfaceFlinger', '--latency', layer], FPS_COMMAND_TIMEOUT_MS);
  if (!res.ok) {
    return { fps: null, layer, refreshRate: null, source: 'surfaceflinger', error: res.error || res.stderr || '' };
  }
  return parseSurfaceLatency(deviceId, layer, res.stdout);
}

async function getSurfaceLayer(deviceId, foreground) {
  const packageName = foreground.packageName || '';
  const cached = surfaceLayerCacheByDevice.get(deviceId);
  if (cached && cached.packageName === packageName && Date.now() - cached.updatedAt < SURFACE_LAYER_CACHE_MS) {
    return cached.layer;
  }
  const res = await runAdb(['-s', deviceId, 'shell', 'dumpsys', 'SurfaceFlinger', '--list'], FPS_COMMAND_TIMEOUT_MS);
  if (!res.ok) return '';
  const layer = pickSurfaceLayer(parseSurfaceLayers(res.stdout), foreground);
  surfaceLayerCacheByDevice.set(deviceId, { packageName, layer, updatedAt: Date.now() });
  return layer;
}

function parseSurfaceLayers(text) {
  return String(text || '').split(/\r?\n/)
    .map(line => line.trim())
    .map(line => {
      const requested = line.match(/^RequestedLayerState\{(.+?#[0-9]+)/);
      return requested ? requested[1].trim() : line;
    })
    .filter(Boolean);
}

function pickSurfaceLayer(layers, foreground) {
  const packageName = String(foreground.packageName || '').toLowerCase();
  const activityName = String(foreground.activityName || '').toLowerCase();
  const activitySimple = activityName.split('.').filter(Boolean).pop() || '';
  let best = { layer: '', score: 0 };
  layers.forEach(layer => {
    const lower = layer.toLowerCase();
    let score = 0;
    if (packageName && lower.includes(packageName)) score += 60;
    if (activityName && lower.includes(activityName)) score += 30;
    if (activitySimple && lower.includes(activitySimple)) score += 10;
    if (!/\s/.test(layer)) score += 8;
    if (/inputsink|activityrecord|statusbar|navigationbar|taskbar|wallpaper|sprite/i.test(layer)) score -= 40;
    if (score > best.score) best = { layer, score };
  });
  return best.score > 0 ? best.layer : '';
}

function parseSurfaceLatency(deviceId, layer, text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const framePeriodNs = parseFramePeriod(text);
  const timestamps = lines.slice(1)
    .map(line => line.split(/\s+/).map(value => Number(value)))
    .filter(parts => parts.length >= 3)
    .map(parts => parts[1] || parts[0])
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const key = `${deviceId}:${layer}`;
  const prev = surfaceFrameStatsByDevice.get(key);
  let rawFps = null;
  let frames = 0;
  const refreshRate = framePeriodToFps(framePeriodNs);
  let state = 'estimate';
  if (prev && timestamps.length > 0) {
    const fresh = timestamps.filter(value => value > prev.lastPresentNs);
    frames = fresh.length;
    rawFps = fresh.length > 1 ? estimateEffectiveFpsFromPresentTimes(fresh, framePeriodNs) : refreshRate;
    state = fresh.length > 0 ? 'active' : 'idle';
  } else if (timestamps.length >= 2) {
    frames = 0;
    rawFps = refreshRate;
    state = 'initial';
  } else if (framePeriodNs) {
    rawFps = refreshRate;
    state = 'idle';
  }
  if (timestamps.length > 0) {
    surfaceFrameStatsByDevice.set(key, { lastPresentNs: timestamps[timestamps.length - 1] });
  }
  const fps = smoothFpsValue(`surface:${key}`, rawFps, refreshRate, state);
  return {
    fps: roundFps(fps ?? refreshRate),
    rawFps: roundFps(rawFps ?? refreshRate),
    frames,
    state,
    layer,
    refreshRate,
    framePeriodMs: framePeriodNs ? Number((framePeriodNs / 1e6).toFixed(2)) : null,
    source: 'surfaceflinger'
  };
}

function estimateEffectiveFpsFromPresentTimes(timestamps, framePeriodNs) {
  const refreshRate = framePeriodToFps(framePeriodNs);
  if (!framePeriodNs || timestamps.length < 2) return refreshRate;
  let intervals = 0;
  let slots = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const delta = timestamps[i] - timestamps[i - 1];
    if (!Number.isFinite(delta) || delta <= 0) continue;
    intervals += 1;
    slots += Math.max(1, Math.round(delta / framePeriodNs));
  }
  return slots > 0 ? refreshRate * intervals / slots : refreshRate;
}

function getTargetFrameNs(rows) {
  const values = rows.map(row => row.frameInterval).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!values.length) return null;
  return values[Math.floor(values.length / 2)];
}

function parseFramePeriod(text) {
  const first = String(text || '').split(/\r?\n/).map(line => line.trim()).find(Boolean);
  const value = Number(first);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function framePeriodToFps(framePeriodNs) {
  return framePeriodNs ? roundFps(1e9 / framePeriodNs) : null;
}

function roundFps(value) {
  if (!Number.isFinite(value)) return null;
  return Number(Math.max(0, Math.min(240, value)).toFixed(1));
}

function smoothFpsValue(key, rawFps, targetFps, state) {
  const target = Number.isFinite(targetFps) ? targetFps : null;
  const raw = Number.isFinite(rawFps) ? (target ? Math.min(rawFps, target) : rawFps) : target;
  if (!Number.isFinite(raw)) return null;
  if (state !== 'active') {
    fpsDisplayByMetric.set(key, { value: raw, lowCount: 0 });
    return raw;
  }
  const previous = fpsDisplayByMetric.get(key);
  const previousValue = typeof previous === 'object' ? previous.value : previous;
  const base = Number.isFinite(previousValue) ? previousValue : (target || raw);
  const alpha = raw < base ? 0.55 : 0.7;
  const next = base + (raw - base) * alpha;
  const maxStep = target ? Math.max(3, target * 0.18) : 20;
  const limited = Math.max(base - maxStep, Math.min(base + maxStep, next));
  const clamped = target ? Math.min(target, limited) : limited;
  fpsDisplayByMetric.set(key, { value: clamped, lowCount: 0 });
  return clamped;
}

function normalizeActivityName(packageName, activityName) {
  const value = String(activityName || '');
  return value.startsWith('.') ? `${packageName}${value}` : value;
}

function clearDeviceFpsState(deviceId) {
  const prefix = `${deviceId}:`;
  [gfxFrameStatsByDevice, surfaceFrameStatsByDevice, fpsDisplayByMetric].forEach(map => {
    Array.from(map.keys()).forEach(key => {
      if (key.startsWith(prefix)) map.delete(key);
    });
  });
  surfaceLayerCacheByDevice.delete(deviceId);
}
// $XBH_AI_PATCH_END

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
  // $XBH_AI_PATCH_START
  // 停止监控时清理该设备的 FPS 差值状态，避免下次启动使用过期采样点。
  clearDeviceFpsState(deviceId);
  // $XBH_AI_PATCH_END
  return true;
}

function cleanup() {
  Array.from(monitors.keys()).forEach(stopMonitor);
}

function runAdb(args, timeoutMs = COMMAND_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const adbCommand = fs.existsSync(BUNDLED_ADB_PATH) ? BUNDLED_ADB_PATH : 'adb';
    const adbArgs = Array.isArray(args) ? args : [];
    const proc = execFile(adbCommand, adbArgs, { windowsHide: true, timeout: timeoutMs }, (error, stdout, stderr) => {
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
