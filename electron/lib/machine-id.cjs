// electron/lib/machine-id.cjs
// 采集 Windows 硬件指纹（CPU + 主板 + 磁盘 + MachineGuid），输出 SHA-256 机器码
// XBH_AI_PATCH: VIP 会员体系 - 机器码绑定

const { execSync } = require('child_process');
const crypto = require('crypto');

let cachedMachineId = null;
let cachedSources = null;

// 安全执行 PowerShell 命令，失败返回空字符串
function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return '';
  }
}

// 规范化硬件字符串：去空白、转大写、过滤空值
function normalize(s) {
  if (!s) return '';
  const v = String(s).trim().toUpperCase();
  // 过滤常见无效值
  if (['', '0', 'NONE', 'NULL', 'TO BE FILLED BY O.E.M.', 'DEFAULT'].includes(v)) return '';
  return v;
}

// 采集各硬件源
function collectSources() {
  const sources = {};
  try {
    // CPU ProcessorId
    sources.cpu = normalize(safeExec(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).ProcessorId"'
    ));
    // 主板序列号
    sources.board = normalize(safeExec(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_BaseBoard).SerialNumber"'
    ));
    // 主磁盘序列号
    sources.disk = normalize(safeExec(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber"'
    ));
    // Windows MachineGuid
    const regOut = safeExec(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid'
    );
    const match = regOut.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/i);
    sources.guid = normalize(match ? match[1] : '');
  } catch (e) {
    // 整体失败忽略，下面按可用源处理
  }
  return sources;
}

// 生成机器码
function getMachineId() {
  if (cachedMachineId) {
    return { success: true, machineId: cachedMachineId, sources: cachedSources };
  }
  const sources = collectSources();
  const entries = Object.entries(sources).filter(([, v]) => v);
  // 至少保留 2 源才生成有效机器码
  if (entries.length < 2) {
    return {
      success: false,
      error: 'hardware_fingerprint_insufficient',
      message: '无法采集足够的硬件指纹（至少需要 2 个源）',
      sources
    };
  }
  // 拼接顺序固定：cpu|board|disk|guid
  const raw = ['cpu', 'board', 'disk', 'guid']
    .map(k => sources[k] || '')
    .join('|');
  cachedMachineId = crypto.createHash('sha256').update(raw).digest('hex');
  cachedSources = sources;
  return { success: true, machineId: cachedMachineId, sources };
}

module.exports = { getMachineId };
