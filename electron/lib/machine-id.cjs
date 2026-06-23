// electron/lib/machine-id.cjs
// 采集 Windows 硬件指纹（CPU + 主板 + 磁盘 + MachineGuid），输出 SHA-256 机器码
// XBH_AI_PATCH: VIP 会员体系 - 机器码绑定
// 性能优化：异步采集 + 并行执行 + 启动预缓存，避免 execSync 阻塞 main 进程

const { exec } = require('child_process');
const crypto = require('crypto');

let cachedMachineId = null;
let cachedSources = null;
let pendingPromise = null;

// 异步执行命令，返回 Promise<string>
function execAsync(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { encoding: 'utf8', timeout: 8000 }, (err, stdout) => {
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

// 异步并行采集所有硬件源
async function collectSourcesAsync() {
  const [cpu, board, disk, regOut] = await Promise.all([
    execAsync('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).ProcessorId"'),
    execAsync('powershell -NoProfile -Command "(Get-CimInstance Win32_BaseBoard).SerialNumber"'),
    execAsync('powershell -NoProfile -Command "(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber"'),
    execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid')
  ]);
  const match = regOut.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/i);
  return {
    cpu: normalize(cpu),
    board: normalize(board),
    disk: normalize(disk),
    guid: normalize(match ? match[1] : '')
  };
}

// 异步生成机器码（并行采集 + 缓存）
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
        pendingPromise = null;
        return {
          success: false,
          error: 'hardware_fingerprint_insufficient',
          message: '无法采集足够的硬件指纹（至少需要 2 个源）',
          sources
        };
      }
      const raw = ['cpu', 'board', 'disk', 'guid']
        .map(k => sources[k] || '')
        .join('|');
      cachedMachineId = crypto.createHash('sha256').update(raw).digest('hex');
      cachedSources = sources;
      pendingPromise = null;
      return { success: true, machineId: cachedMachineId, sources: cachedSources };
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
