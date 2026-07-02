const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const TOOL_NAMES = {
  adb: 'adb.exe',
  scrcpy: 'scrcpy.exe',
  fastboot: 'fastboot.exe'
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uniqueExistingDirs(dirs) {
  const seen = new Set();
  const result = [];
  for (const dir of dirs) {
    if (!dir) continue;
    let resolved;
    try {
      resolved = path.resolve(dir);
    } catch {
      continue;
    }
    const key = resolved.toLowerCase();
    if (seen.has(key) || !fs.existsSync(resolved)) continue;
    seen.add(key);
    result.push(resolved);
  }
  return result;
}

function getBundledToolDirs() {
  return uniqueExistingDirs([
    path.join(__dirname, '../../scrcpy-win64'),
    process.resourcesPath ? path.join(process.resourcesPath, '..', 'scrcpy-win64') : '',
    process.execPath ? path.join(path.dirname(process.execPath), 'scrcpy-win64') : ''
  ]);
}

function findExecutable(name, dirs = getBundledToolDirs()) {
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile() && stat.size > 0) return candidate;
    } catch {
      // Ignore missing candidates.
    }
  }
  return null;
}

function runFile(command, args, timeoutMs) {
  return new Promise(resolve => {
    const child = execFile(command, args, { windowsHide: true, timeout: timeoutMs }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        error: error ? error.message : '',
        stdout: stdout || '',
        stderr: stderr || ''
      });
    });
    child.stdin?.end?.();
  });
}

function runPowerShell(script, timeoutMs) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return runFile('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-EncodedCommand',
    encoded
  ], timeoutMs);
}

async function stopProcessesInDirs(names, dirs) {
  if (process.platform !== 'win32' || dirs.length === 0 || names.length === 0) {
    return { ok: true, skipped: true };
  }

  const payload = JSON.stringify({ names, dirs });
  const script = `
$payload = @'
${payload}
'@ | ConvertFrom-Json
$names = @($payload.names)
$dirs = @($payload.dirs)
$procs = Get-CimInstance Win32_Process | Where-Object {
  $path = $_.ExecutablePath
  $name = $_.Name
  if (-not $path -or -not $name) { return $false }
  if ($names -notcontains $name) { return $false }
  foreach ($dir in $dirs) {
    $prefix = $dir.TrimEnd('\\\\') + '\\\\'
    if ($path.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }
  return $false
}
foreach ($proc in $procs) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}
Write-Output ($procs | Measure-Object).Count
`;
  return runPowerShell(script, 5000);
}

async function cleanupAndroidToolProcesses(options = {}) {
  const {
    includeScrcpy = false,
    includeFastboot = false,
    stopAdbServer = false,
    settleMs = 350
  } = options;

  const dirs = getBundledToolDirs();
  const names = [TOOL_NAMES.adb];
  if (includeScrcpy) names.push(TOOL_NAMES.scrcpy);
  if (includeFastboot) names.push(TOOL_NAMES.fastboot);

  if (stopAdbServer) {
    const adbPath = findExecutable(TOOL_NAMES.adb, dirs);
    if (adbPath) {
      await runFile(adbPath, ['kill-server'], 2500);
    }
  }

  const result = await stopProcessesInDirs(names, dirs);
  if (settleMs > 0) await sleep(settleMs);
  return { ...result, dirs, names };
}

module.exports = {
  cleanupAndroidToolProcesses,
  getBundledToolDirs,
  findExecutable
};
