// electron/lib/machine-id.cjs
// 采集 Windows 硬件指纹（CPU + 主板 + 磁盘 + MachineGuid），输出 SHA-256 机器码
// XBH_AI_PATCH: VIP 会员体系 - 机器码绑定
// 性能优化：4 个 PowerShell 合并为 1 次 JSON 输出，启动仅 1 个子进程（~2秒）

const { exec } = require('child_process');
const crypto = require('crypto');

let cachedMachineId = null;
let cachedSources = null;
let pendingPromise = null;

// 单次 PowerShell 脚本：一次性采集全部 4 源，输出 JSON（用 ConvertTo-Json 避免转义问题）
const PS_SCRIPT = `powershell -NoProfile -NonInteractive -Command "$ErrorActionPreference='SilentlyContinue'; [ordered]@{cpu=(Get-CimInstance Win32_Processor).ProcessorId;board=(Get-CimInstance Win32_BaseBoard).SerialNumber;disk=(Get-CimInstance Win32_DiskDrive|Select-Object -First 1).SerialNumber;guid=(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid} | ConvertTo-Json -Compress"`;

// 异步执行单条命令，返回 Promise<string>
function execAsync(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { encoding: 'utf8', timeout: 10000, windowsHide: true }, (err, stdout) => {
      resolve(err ? '' : stdout.trim());
    });
  });
}

// 规范化硬件字符串：去空白、转大写、过滤空值
function normalize(s) {
  if (!s) return '';
  const v = String(s).trim().toUpperCase();
  if (['', '0', 'NONE', 'NULL', 'TO BE FILLED BY O.E.M.', 'DEFAULT'].includes(v)) return '';
  return v;
}

// 异步采集所有硬件源（仅 1 个 PowerShell 进程）
async function collectSourcesAsync() {
  const out = await execAsync(PS_SCRIPT);
  if (!out) return { cpu: '', board: '', disk: '', guid: '' };
  let parsed = {};
  try {
    parsed = JSON.parse(out);
  } catch (e) {
    // JSON 解析失败，尝试正则提取
    const extract = (key) => {
      const m = out.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, 'i'));
      return m ? m[1] : '';
    };
    parsed = { cpu: extract('cpu'), board: extract('board'), disk: extract('disk'), guid: extract('guid') };
  }
  return {
    cpu: normalize(parsed.cpu),
    board: normalize(parsed.board),
    disk: normalize(parsed.disk),
    guid: normalize(parsed.guid)
  };
}

// 异步生成机器码（采集 + 缓存，仅 1 个子进程）
async function getMachineIdAsync() {
  if (cachedMachineId) {
    return { success: true, machineId: cachedMachineId, sources: cachedSources };
  }
  // 避免并发重复采集
  if (pendingPromise) return pendingPromise;

  pendingPromise = (async () => {
    try {
      const sources = await collectSourcesAsync();
      const entries = Object.entries(sources).filter(([, v]) => v);
      if (entries.length < 2) {
        const result = {
          success: false,
          error: 'hardware_fingerprint_insufficient',
          message: '无法采集足够的硬件指纹（至少需要 2 个源）',
          sources
        };
        pendingPromise = null;
        return result;
      }
      const raw = ['cpu', 'board', 'disk', 'guid']
        .map(k => sources[k] || '')
        .join('|');
      cachedMachineId = crypto.createHash('sha256').update(raw).digest('hex');
      cachedSources = sources;
      const result = { success: true, machineId: cachedMachineId, sources: cachedSources };
      pendingPromise = null;
      return result;
    } catch (e) {
      pendingPromise = null;
      return { success: false, error: 'collect_failed', message: e.message, sources: {} };
    }
  })();
  return pendingPromise;
}

// 同步版本：仅返回缓存（无缓存时返回 null，不阻塞）
function getMachineIdSync() {
  if (cachedMachineId) {
    return { success: true, machineId: cachedMachineId, sources: cachedSources };
  }
  return { success: false, error: 'not_ready', message: '机器码采集中，请稍后' };
}

// 启动时预采集（在 app.whenReady 中调用）
function preloadMachineId() {
  return getMachineIdAsync();
}

module.exports = { getMachineIdAsync, getMachineIdSync, preloadMachineId };
