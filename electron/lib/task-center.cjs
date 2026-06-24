// Task center: replay scripts, multi-device task queue, and execution history.

const { app } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const ctx = require('./app-context.cjs');
const vip = require('./vip.cjs');
const inspection = require('./inspection.cjs');
const performanceMonitor = require('./performance-monitor.cjs');

const BUNDLED_ADB_PATH = path.join(__dirname, '../../scrcpy-win64/adb.exe');
const SCRIPTS_FILE = 'task-center-scripts.json';
const HISTORY_FILE = 'task-center-history.json';
const ARTIFACT_DIR = 'task-center-artifacts';
const DEFAULT_TIMEOUT_MS = 30000;
const LONG_TIMEOUT_MS = 120000;
const MAX_HISTORY = 100;
const MAX_OUTPUT_CHARS = 12000;
const DEVICE_TEMP_SCREEN = '/sdcard/task-center-screen.png';

const activeTasks = new Map();
let scriptsCache = null;
let historyCache = null;

const DEFAULT_SCRIPT = {
  id: 'default-smoke-test',
  name: '基础复现脚本',
  description: '采集设备型号、截图和一次性能快照，用于快速验证设备链路。',
  continueOnError: true,
  steps: [
    { id: 'model', type: 'shell', label: '读取设备型号', command: 'getprop ro.product.model', timeoutMs: 15000 },
    { id: 'screenshot', type: 'screenshot', label: '保存当前截图', timeoutMs: 30000 },
    { id: 'perf', type: 'perfSnapshot', label: '采集性能快照', timeoutMs: 30000 }
  ],
  createdAt: 'builtin',
  updatedAt: 'builtin'
};

function register(ipcMain) {
  ipcMain.handle('task-center:scripts:list', async () => {
    return { ok: true, scripts: readScripts() };
  });

  ipcMain.handle('task-center:scripts:save', async (event, args) => {
    try {
      const script = normalizeScript(args?.script);
      const scripts = readScripts();
      const now = new Date().toISOString();
      const existing = scripts.find(item => item.id === script.id);
      const nextScript = {
        ...script,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };
      const next = existing
        ? scripts.map(item => item.id === nextScript.id ? nextScript : item)
        : [nextScript, ...scripts];
      writeScripts(next);
      return { ok: true, script: nextScript, scripts: next };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('task-center:scripts:delete', async (event, args) => {
    const id = String(args?.id || '').trim();
    if (!id) return { ok: false, error: 'script_id_required' };
    const next = readScripts().filter(item => item.id !== id);
    writeScripts(next);
    return { ok: true, scripts: next };
  });

  ipcMain.handle('task-center:run', async (event, args) => {
    try {
      const devices = normalizeDeviceIds(args?.deviceIds);
      if (devices.length === 0) return { ok: false, error: '请至少选择一台在线设备' };
      const script = args?.scriptId ? readScripts().find(item => item.id === args.scriptId) : normalizeScript(args?.script);
      if (!script) return { ok: false, error: 'script_not_found' };
      const task = createTask(script, devices, event.sender, args || {});
      activeTasks.set(task.id, task);
      broadcastState();
      runTask(task).catch(error => {
        task.status = 'failed';
        task.error = error.message;
        task.endedAt = new Date().toISOString();
        finishTask(task);
      });
      return { ok: true, task: publicTask(task) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('task-center:cancel', async (event, args) => {
    const taskId = String(args?.taskId || '').trim();
    const task = activeTasks.get(taskId);
    if (!task) return { ok: false, error: 'task_not_found' };
    task.cancelled = true;
    task.status = 'cancelled';
    killCurrentProcess(task);
    broadcastTask(task);
    return { ok: true, task: publicTask(task) };
  });

  ipcMain.handle('task-center:history', async () => {
    return { ok: true, history: readHistory() };
  });

  ipcMain.handle('task-center:history:clear', async () => {
    writeHistory([]);
    broadcastState();
    return { ok: true, history: [] };
  });

  ipcMain.handle('task-center:state', async () => {
    return {
      ok: true,
      activeTasks: Array.from(activeTasks.values()).map(publicTask),
      history: readHistory()
    };
  });
}

async function runTask(task) {
  task.status = 'running';
  task.startedAt = new Date().toISOString();
  appendTaskLog(task, '任务开始');
  broadcastTask(task);

  const concurrency = Math.max(1, Math.min(Number(task.concurrency) || 1, 4));
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, task.deviceRuns.length) }, async () => {
    while (!task.cancelled) {
      const run = task.deviceRuns[nextIndex];
      nextIndex += 1;
      if (!run) return;
      await runDevice(task, run);
    }
  });

  await Promise.all(workers);

  if (task.cancelled) {
    task.status = 'cancelled';
  } else if (task.deviceRuns.some(run => run.status === 'failed')) {
    task.status = 'failed';
  } else {
    task.status = 'success';
  }
  task.endedAt = new Date().toISOString();
  appendTaskLog(task, task.status === 'success' ? '任务完成' : task.status === 'cancelled' ? '任务已取消' : '任务存在失败项');
  finishTask(task);
}

async function runDevice(task, run) {
  run.status = 'running';
  run.startedAt = new Date().toISOString();
  broadcastTask(task);

  for (let i = 0; i < task.script.steps.length; i += 1) {
    if (task.cancelled) break;
    const step = task.script.steps[i];
    const stepRun = createStepRun(step, i);
    run.steps.push(stepRun);
    stepRun.status = 'running';
    stepRun.startedAt = new Date().toISOString();
    appendTaskLog(task, `[${run.deviceId}] ${stepRun.label} 开始`);
    broadcastTask(task);

    try {
      const result = await executeStep(task, run.deviceId, step);
      stepRun.status = result.ok ? 'success' : 'failed';
      stepRun.output = trimOutput(result.output || result.stdout || '');
      stepRun.error = result.error || '';
      stepRun.artifact = result.artifact || '';
      stepRun.endedAt = new Date().toISOString();
      if (result.ok) {
        task.completedSteps += 1;
        appendTaskLog(task, `[${run.deviceId}] ${stepRun.label} 完成`);
      } else {
        task.failedSteps += 1;
        appendTaskLog(task, `[${run.deviceId}] ${stepRun.label} 失败：${stepRun.error || '未知错误'}`);
        if (!task.continueOnError && !step.continueOnError) {
          run.status = 'failed';
          break;
        }
      }
    } catch (error) {
      stepRun.status = task.cancelled ? 'cancelled' : 'failed';
      stepRun.error = error.message;
      stepRun.endedAt = new Date().toISOString();
      task.failedSteps += 1;
      appendTaskLog(task, `[${run.deviceId}] ${stepRun.label} 异常：${error.message}`);
      if (!task.continueOnError && !step.continueOnError) {
        run.status = 'failed';
        break;
      }
    } finally {
      broadcastTask(task);
    }
  }

  if (task.cancelled) {
    run.status = 'cancelled';
  } else if (run.status !== 'failed') {
    run.status = run.steps.some(step => step.status === 'failed') ? 'failed' : 'success';
  }
  run.endedAt = new Date().toISOString();
  broadcastTask(task);
}

async function executeStep(task, deviceId, step) {
  const type = step.type;
  if (type === 'shell') {
    const command = String(step.command || '').trim();
    if (!command) return { ok: false, error: 'shell_command_required' };
    return runAdb(task, ['-s', deviceId, 'shell', command], step.timeoutMs || DEFAULT_TIMEOUT_MS);
  }
  if (type === 'installApk') {
    const localPath = String(step.localPath || '').trim();
    if (!localPath) return { ok: false, error: 'apk_path_required' };
    const res = await runAdb(task, ['-s', deviceId, 'install', '-r', '-d', localPath], step.timeoutMs || LONG_TIMEOUT_MS);
    return { ...res, ok: res.ok && /Success/i.test(res.stdout || res.output || '') };
  }
  if (type === 'pushFile') {
    const localPath = String(step.localPath || '').trim();
    const remotePath = String(step.remotePath || '').trim();
    if (!localPath || !remotePath) return { ok: false, error: 'local_or_remote_path_required' };
    return runAdb(task, ['-s', deviceId, 'push', localPath, remotePath], step.timeoutMs || LONG_TIMEOUT_MS);
  }
  if (type === 'screenshot') {
    return captureScreenshot(task, deviceId, step);
  }
  if (type === 'perfSnapshot') {
    return capturePerformance(task, deviceId, step);
  }
  if (type === 'inspection') {
    return captureInspectionSummary(task, deviceId, step);
  }
  if (type === 'waitLog') {
    return waitForLog(task, deviceId, step);
  }
  if (type === 'delay') {
    await sleepWithCancel(task, Math.max(100, Math.min(Number(step.durationMs) || 1000, 600000)));
    return { ok: true, output: '等待完成' };
  }
  return { ok: false, error: `unsupported_step_type:${type}` };
}

async function captureScreenshot(task, deviceId, step) {
  const artifactDir = await ensureTaskArtifactDir(task, 'screenshots');
  const filePath = step.localPath
    ? path.resolve(String(step.localPath))
    : path.join(artifactDir, `${sanitizeName(deviceId)}-${formatStamp(new Date())}.png`);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const cap = await runAdb(task, ['-s', deviceId, 'shell', 'screencap', '-p', DEVICE_TEMP_SCREEN], step.timeoutMs || DEFAULT_TIMEOUT_MS);
  if (!cap.ok) return { ok: false, error: cap.error || cap.stderr || 'screencap_failed' };
  const pull = await runAdb(task, ['-s', deviceId, 'pull', DEVICE_TEMP_SCREEN, filePath], step.timeoutMs || DEFAULT_TIMEOUT_MS);
  await runAdb(task, ['-s', deviceId, 'shell', 'rm', '-f', DEVICE_TEMP_SCREEN], DEFAULT_TIMEOUT_MS).catch(() => {});
  return {
    ok: pull.ok && fs.existsSync(filePath),
    output: pull.output || pull.stdout || '',
    error: pull.ok ? '' : pull.error,
    artifact: filePath
  };
}

async function capturePerformance(task, deviceId, step) {
  const artifactDir = await ensureTaskArtifactDir(task, 'performance');
  const status = await vip.getStatusAsync();
  const snapshot = await performanceMonitor.collectSnapshot(deviceId, status.activated === true);
  const filePath = path.join(artifactDir, `performance-${sanitizeName(deviceId)}-${formatStamp(new Date())}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify({ deviceId, capturedAt: new Date().toISOString(), snapshot }, null, 2), 'utf8');
  const summary = [
    `CPU: ${snapshot.cpu?.usage ?? '-'}`,
    `Memory: ${snapshot.memory?.usage ?? '-'}`,
    `Warnings: ${(snapshot.warnings || []).map(item => item.label).join(', ') || '-'}`
  ].join('\n');
  return { ok: true, output: summary, artifact: filePath };
}

async function captureInspectionSummary(task, deviceId, step) {
  const status = await vip.getStatusAsync();
  if (!status.activated) {
    return { ok: false, error: '设备巡检为会员专属功能，请先开通会员', code: 'vip_required' };
  }
  const outputBaseDir = String(step.outputBaseDir || '').trim() || await ensureTaskArtifactDir(task, 'inspection');
  const inspectionTask = createLinkedInspectionTask(task, deviceId);
  const result = await inspection.runInspection(inspectionTask, {
    deviceId,
    deviceLabel: deviceId,
    includeBugreport: step.includeBugreport === true,
    includeAiSummary: step.includeAiSummary === true,
    outputBaseDir
  });
  const findings = result.analysis?.findings || [];
  const output = [
    result.cancelled ? '巡检已取消，已生成部分结果' : result.ok ? '完整巡检已完成' : '巡检未完整完成',
    `报告：${result.reportPath || '-'}`,
    `证据包：${result.zipPath || result.zipError || '-'}`,
    `健康结论：${result.analysis?.summary || '-'}`,
    findings.length > 0 ? `风险项：${findings.map(item => `${item.label}(${item.severity})`).join(', ')}` : '风险项：无'
  ].join('\n');
  return {
    ok: result.ok === true || result.cancelled === true,
    output,
    artifact: result.zipPath || result.reportPath || ''
  };
}

function createLinkedInspectionTask(task, deviceId) {
  const linked = {
    id: `${task.id}-${sanitizeName(deviceId)}`,
    deviceId,
    sender: task.sender
  };
  Object.defineProperties(linked, {
    cancelled: {
      get() { return task.cancelled; },
      set(value) { task.cancelled = value; }
    },
    currentProc: {
      get() { return task.currentProc; },
      set(value) { task.currentProc = value; }
    }
  });
  return linked;
}

async function waitForLog(task, deviceId, step) {
  const keyword = String(step.keyword || '').trim();
  const regexText = String(step.regex || '').trim();
  if (!keyword && !regexText) return { ok: false, error: 'keyword_or_regex_required' };
  const regex = regexText ? new RegExp(regexText) : null;
  const timeoutMs = Math.max(1000, Math.min(Number(step.timeoutMs) || DEFAULT_TIMEOUT_MS, 300000));
  const intervalMs = Math.max(1000, Math.min(Number(step.intervalMs) || 2000, 10000));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (task.cancelled) return { ok: false, error: '用户取消' };
    const res = await runAdb(task, ['-s', deviceId, 'logcat', '-d', '-v', 'threadtime'], Math.min(15000, timeoutMs));
    const text = res.output || res.stdout || '';
    const matched = regex ? regex.test(text) : text.includes(keyword);
    if (matched) {
      const line = text.split(/\r?\n/).find(item => regex ? regex.test(item) : item.includes(keyword)) || '';
      return { ok: true, output: line || '已匹配日志' };
    }
    await sleepWithCancel(task, intervalMs);
  }
  return { ok: false, error: `等待日志超时：${keyword || regexText}` };
}

function runAdb(task, args, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return runProcess(task, getAdbCommand(), args, timeoutMs);
}

function runProcess(task, command, args, timeoutMs) {
  return new Promise((resolve) => {
    if (task.cancelled) {
      resolve({ ok: false, error: '用户取消', output: '' });
      return;
    }
    const proc = execFile(command, args, { windowsHide: true, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (task.currentProc === proc) task.currentProc = null;
      if (error) {
        resolve({ ok: false, stdout: stdout || '', stderr: stderr || '', output: trimOutput(`${stdout || ''}${stderr || ''}`), error: stderr || error.message });
      } else {
        resolve({ ok: true, stdout: stdout || '', stderr: stderr || '', output: trimOutput(stdout || stderr || '') });
      }
    });
    task.currentProc = proc;
    proc.stdin?.end?.();
  });
}

function createTask(script, deviceIds, sender, args) {
  const id = `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    script: normalizeScript(script),
    scriptName: script.name,
    sender,
    status: 'queued',
    createdAt: new Date().toISOString(),
    startedAt: '',
    endedAt: '',
    cancelled: false,
    error: '',
    currentProc: null,
    continueOnError: args.continueOnError ?? script.continueOnError ?? true,
    concurrency: args.concurrency || 1,
    completedSteps: 0,
    failedSteps: 0,
    totalSteps: deviceIds.length * (script.steps?.length || 0),
    logs: [],
    deviceRuns: deviceIds.map(deviceId => ({
      deviceId,
      status: 'queued',
      startedAt: '',
      endedAt: '',
      steps: []
    }))
  };
}

function finishTask(task) {
  killCurrentProcess(task);
  activeTasks.delete(task.id);
  const record = publicTask(task);
  const history = [record, ...readHistory().filter(item => item.id !== task.id)].slice(0, MAX_HISTORY);
  writeHistory(history);
  broadcastTask(task);
  broadcastState();
}

function publicTask(task) {
  return {
    id: task.id,
    scriptName: task.scriptName,
    status: task.status,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    endedAt: task.endedAt,
    error: task.error || '',
    continueOnError: task.continueOnError,
    concurrency: task.concurrency,
    completedSteps: task.completedSteps,
    failedSteps: task.failedSteps,
    totalSteps: task.totalSteps,
    logs: (task.logs || []).slice(-80),
    deviceRuns: (task.deviceRuns || []).map(run => ({
      deviceId: run.deviceId,
      status: run.status,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      steps: (run.steps || []).map(step => ({ ...step }))
    }))
  };
}

function createStepRun(step, index) {
  return {
    id: step.id || `step-${index}`,
    index,
    type: step.type,
    label: step.label || getStepTypeLabel(step.type),
    status: 'queued',
    startedAt: '',
    endedAt: '',
    output: '',
    error: '',
    artifact: ''
  };
}

function normalizeScript(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const steps = Array.isArray(source.steps) ? source.steps.map(normalizeStep).filter(Boolean) : [];
  if (steps.length === 0) throw new Error('脚本至少需要一个步骤');
  return {
    id: String(source.id || `script-${Date.now()}-${Math.random().toString(16).slice(2)}`).trim(),
    name: String(source.name || '未命名脚本').trim().slice(0, 80),
    description: String(source.description || '').trim().slice(0, 500),
    continueOnError: source.continueOnError !== false,
    steps
  };
}

function normalizeStep(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || 'shell').trim();
  return {
    id: String(raw.id || `step-${Date.now()}-${index ?? 0}-${Math.random().toString(16).slice(2)}`),
    type,
    label: String(raw.label || getStepTypeLabel(type)).trim().slice(0, 80),
    command: String(raw.command || ''),
    localPath: String(raw.localPath || ''),
    remotePath: String(raw.remotePath || ''),
    keyword: String(raw.keyword || ''),
    regex: String(raw.regex || ''),
    outputBaseDir: String(raw.outputBaseDir || ''),
    includeBugreport: raw.includeBugreport === true,
    includeAiSummary: raw.includeAiSummary !== false,
    timeoutMs: clampNumber(raw.timeoutMs, 1000, 600000, DEFAULT_TIMEOUT_MS),
    intervalMs: clampNumber(raw.intervalMs, 500, 60000, 2000),
    durationMs: clampNumber(raw.durationMs, 100, 600000, 1000),
    continueOnError: raw.continueOnError === true
  };
}

function readScripts() {
  if (scriptsCache) return scriptsCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(getDataPath(SCRIPTS_FILE), 'utf8'));
    const scripts = Array.isArray(parsed?.scripts) ? parsed.scripts : [];
    scriptsCache = scripts.length > 0 ? scripts : [DEFAULT_SCRIPT];
  } catch {
    scriptsCache = [DEFAULT_SCRIPT];
  }
  return scriptsCache;
}

function writeScripts(scripts) {
  scriptsCache = scripts;
  writeJson(getDataPath(SCRIPTS_FILE), { version: 1, scripts });
}

function readHistory() {
  if (historyCache) return historyCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(getDataPath(HISTORY_FILE), 'utf8'));
    historyCache = Array.isArray(parsed?.history) ? parsed.history.slice(0, MAX_HISTORY) : [];
  } catch {
    historyCache = [];
  }
  return historyCache;
}

function writeHistory(history) {
  historyCache = history.slice(0, MAX_HISTORY);
  writeJson(getDataPath(HISTORY_FILE), { version: 1, history: historyCache });
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function ensureTaskArtifactDir(task, subDir) {
  const dir = path.join(app.getPath('userData'), ARTIFACT_DIR, task.id, subDir);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

function getDataPath(fileName) {
  return path.join(app.getPath('userData'), fileName);
}

function getAdbCommand() {
  return fs.existsSync(BUNDLED_ADB_PATH) ? BUNDLED_ADB_PATH : 'adb';
}

function killCurrentProcess(task) {
  if (!task.currentProc) return;
  try { task.currentProc.kill(); } catch {}
  task.currentProc = null;
}

function appendTaskLog(task, message) {
  task.logs.push({ at: new Date().toISOString(), message });
  if (task.logs.length > 120) task.logs.splice(0, task.logs.length - 120);
}

function broadcastTask(task) {
  ctx.broadcastToAllWindows('task-center:update', {
    task: publicTask(task),
    activeTasks: Array.from(activeTasks.values()).map(publicTask),
    history: readHistory()
  });
}

function broadcastState() {
  ctx.broadcastToAllWindows('task-center:update', {
    activeTasks: Array.from(activeTasks.values()).map(publicTask),
    history: readHistory()
  });
}

function normalizeDeviceIds(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean)));
}

function getStepTypeLabel(type) {
  return {
    shell: '执行 Shell',
    installApk: '安装 APK',
    pushFile: '推送文件',
    screenshot: '截图',
    perfSnapshot: '性能采样',
    inspection: '设备巡检',
    waitLog: '等待日志',
    delay: '等待'
  }[type] || '执行步骤';
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function trimOutput(value) {
  const text = String(value || '');
  return text.length > MAX_OUTPUT_CHARS ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n...输出已截断` : text;
}

function sanitizeName(value) {
  return String(value || 'device').replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_').slice(0, 80) || 'device';
}

function formatStamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sleepWithCancel(task, durationMs) {
  return new Promise((resolve, reject) => {
    if (task.cancelled) {
      reject(new Error('用户取消'));
      return;
    }
    const timer = setTimeout(() => {
      clearInterval(check);
      resolve();
    }, durationMs);
    const check = setInterval(() => {
      if (!task.cancelled) return;
      clearTimeout(timer);
      clearInterval(check);
      reject(new Error('用户取消'));
    }, 200);
    check.unref?.();
  });
}

function cleanup() {
  for (const task of activeTasks.values()) {
    task.cancelled = true;
    task.status = 'cancelled';
    killCurrentProcess(task);
  }
  activeTasks.clear();
}

module.exports = { register, cleanup };
