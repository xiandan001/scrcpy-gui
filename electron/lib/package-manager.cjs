// $XBH_AI_PATCH_START
// App package management backend: package list/detail plus VIP-gated mutating actions.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const vip = require('./vip.cjs');

const DEFAULT_TIMEOUT_MS = 20000;
const LONG_TIMEOUT_MS = 60000;
const BUNDLED_ADB_PATH = path.join(__dirname, '../../scrcpy-win64/adb.exe');

function register(ipcMain) {
  ipcMain.handle('package:list', async (event, args) => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    if (!deviceId) return { ok: false, error: 'device_required' };
    try {
      const packages = await listPackages(deviceId);
      return { ok: true, packages };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('package:detail', async (event, args) => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    const packageName = normalizePackageName(args?.packageName);
    if (!deviceId || !packageName) return { ok: false, error: 'device_or_package_required' };
    try {
      const detail = await getPackageDetail(deviceId, packageName);
      return { ok: true, detail };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('package:permissions', async (event, args) => withVip(async () => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    const packageName = normalizePackageName(args?.packageName);
    if (!deviceId || !packageName) return { ok: false, error: 'device_or_package_required' };
    const detail = await getPackageDetail(deviceId, packageName);
    return { ok: true, permissions: detail.permissions || [] };
  }));

  ipcMain.handle('package:exportApk', async (event, args) => withVip(async () => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    const packageName = normalizePackageName(args?.packageName);
    const localPath = String(args?.localPath || '').trim();
    if (!deviceId || !packageName || !localPath) return { ok: false, error: 'device_package_or_path_required' };
    const detail = await getPackageDetail(deviceId, packageName);
    const sourcePath = detail.apkPath || detail.path;
    if (!sourcePath) return { ok: false, error: 'apk_path_not_found' };
    const pull = await runAdb(['-s', deviceId, 'pull', sourcePath, localPath], LONG_TIMEOUT_MS);
    if (!pull.ok) return { ok: false, error: pull.error || pull.stderr || 'export_failed' };
    return { ok: true, localPath, sourcePath };
  }));

  ipcMain.handle('package:uninstall', async (event, args) => withVip(async () => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    const packageName = normalizePackageName(args?.packageName);
    if (!deviceId || !packageName) return { ok: false, error: 'device_or_package_required' };
    const res = await runAdb(['-s', deviceId, 'shell', 'pm', 'uninstall', '--user', '0', packageName], LONG_TIMEOUT_MS);
    return adbMutationResult(res);
  }));

  ipcMain.handle('package:clearData', async (event, args) => withVip(async () => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    const packageName = normalizePackageName(args?.packageName);
    if (!deviceId || !packageName) return { ok: false, error: 'device_or_package_required' };
    const res = await runAdb(['-s', deviceId, 'shell', 'pm', 'clear', packageName], LONG_TIMEOUT_MS);
    return adbMutationResult(res);
  }));

  ipcMain.handle('package:forceStop', async (event, args) => withVip(async () => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    const packageName = normalizePackageName(args?.packageName);
    if (!deviceId || !packageName) return { ok: false, error: 'device_or_package_required' };
    const res = await runAdb(['-s', deviceId, 'shell', 'am', 'force-stop', packageName], DEFAULT_TIMEOUT_MS);
    return adbMutationResult(res);
  }));

  ipcMain.handle('package:setEnabled', async (event, args) => withVip(async () => {
    const deviceId = normalizeDeviceId(args?.deviceId);
    const packageName = normalizePackageName(args?.packageName);
    const enabled = args?.enabled === true;
    if (!deviceId || !packageName) return { ok: false, error: 'device_or_package_required' };
    const verb = enabled ? 'enable' : 'disable-user';
    const res = await runAdb(['-s', deviceId, 'shell', 'pm', verb, packageName], DEFAULT_TIMEOUT_MS);
    return adbMutationResult(res);
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

async function listPackages(deviceId) {
  let res = await runAdb(['-s', deviceId, 'shell', 'cmd', 'package', 'list', 'packages', '-f', '-U', '--show-versioncode'], LONG_TIMEOUT_MS);
  if (!res.ok || !res.stdout.trim()) {
    res = await runAdb(['-s', deviceId, 'shell', 'pm', 'list', 'packages', '-f'], LONG_TIMEOUT_MS);
  }
  if (!res.ok) throw new Error(res.error || res.stderr || 'package_list_failed');
  return res.stdout
    .split(/\r?\n/)
    .map(line => parsePackageLine(line))
    .filter(Boolean)
    .sort((a, b) => a.packageName.localeCompare(b.packageName));
}

async function getPackageDetail(deviceId, packageName) {
  const list = await listPackages(deviceId);
  const basic = list.find(item => item.packageName === packageName) || { packageName };
  const res = await runAdb(['-s', deviceId, 'shell', 'dumpsys', 'package', packageName], LONG_TIMEOUT_MS);
  if (!res.ok) throw new Error(res.error || res.stderr || 'package_detail_failed');
  const text = res.stdout || '';
  const detail = {
    ...basic,
    versionName: firstMatch(text, /versionName=([^\s]+)/),
    versionCode: firstMatch(text, /versionCode=(\d+)/) || basic.versionCode,
    userId: firstMatch(text, /userId=(\d+)/) || basic.uid,
    firstInstallTime: firstMatch(text, /firstInstallTime=([^\n]+)/),
    lastUpdateTime: firstMatch(text, /lastUpdateTime=([^\n]+)/),
    installer: firstMatch(text, /installerPackageName=([^\s]+)/),
    enabled: parsePackageEnabled(text),
    enabledState: parsePackageEnabledState(text),
    system: basic.system || /pkgFlags=\[[^\]]*\bSYSTEM\b/i.test(text) || String(basic.path || '').startsWith('/system'),
    apkPath: firstMatch(text, /codePath=([^\n]+)/) || basic.path,
    permissions: parsePermissions(text),
    raw: text
  };
  return detail;
}

function parsePackageLine(line) {
  const raw = String(line || '').trim();
  if (!raw.startsWith('package:')) return null;
  const match = raw.match(/^package:(.*?)=([^\s]+)(.*)$/);
  if (!match) return null;
  const [, apkPath, packageName, rest] = match;
  const uid = firstMatch(rest, /uid:(\d+)/);
  const versionCode = firstMatch(rest, /versionCode:(\d+)/);
  return {
    packageName,
    path: apkPath,
    apkName: path.basename(apkPath || ''),
    uid: uid || '',
    versionCode: versionCode || '',
    system: String(apkPath || '').startsWith('/system') || String(apkPath || '').startsWith('/product') || String(apkPath || '').startsWith('/vendor'),
    enabled: true
  };
}

function parsePackageEnabled(text) {
  const state = normalizeEnabledState(parsePackageEnabledState(text));
  if (!state) return true;
  return !new Set(['2', '3', '4', 'false', 'disabled', 'disabled-user', 'disabled_until_used', 'disabled-until-used']).has(state);
}

function parsePackageEnabledState(text) {
  const lines = String(text || '').split(/\r?\n/);
  const userStateLine = lines.find(line => /^User\s+\d+:/i.test(line.trim()) && /\benabled=/i.test(line));
  const state = firstMatch(userStateLine || '', /\benabled=([^\s]+)/i);
  if (state) return state;
  return firstMatch(text, /\benabled=([^\s]+)/i);
}

function normalizeEnabledState(value) {
  return String(value || '').trim().replace(/[,\]]+$/, '').toLowerCase();
}

function parsePermissions(text) {
  const permissions = [];
  const lines = String(text || '').split(/\r?\n/);
  let inRequested = false;
  let inInstall = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'requested permissions:') {
      inRequested = true;
      inInstall = false;
      continue;
    }
    if (trimmed === 'install permissions:' || trimmed === 'runtime permissions:') {
      inRequested = false;
      inInstall = true;
      continue;
    }
    if (!trimmed || /^[a-zA-Z].*:$/.test(trimmed)) {
      if (!trimmed.startsWith('android.permission.')) {
        inRequested = false;
        inInstall = false;
      }
      continue;
    }
    if (inRequested && /^[\w.]+$/.test(trimmed)) {
      permissions.push({ name: trimmed, granted: null, source: 'requested' });
    } else if (inInstall) {
      const perm = firstMatch(trimmed, /^([\w.]+):/);
      if (perm) permissions.push({ name: perm, granted: /granted=true/.test(trimmed), source: 'install' });
    }
  }
  return permissions;
}

function adbMutationResult(res) {
  if (res.ok) return { ok: true, output: res.stdout || res.stderr || '' };
  return { ok: false, error: res.error || res.stderr || res.stdout || 'adb_failed' };
}

function runAdb(args, timeoutMs) {
  return new Promise((resolve) => {
    const adbCommand = fs.existsSync(BUNDLED_ADB_PATH) ? BUNDLED_ADB_PATH : 'adb';
    const proc = execFile(adbCommand, args, { windowsHide: true, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, stdout: stdout || '', stderr: stderr || '', error: stderr || error.message, code: error.code });
      } else {
        resolve({ ok: true, stdout: stdout || '', stderr: stderr || '', code: 0 });
      }
    });
    proc.stdin?.end?.();
  });
}

function normalizeDeviceId(value) {
  return String(value || '').trim();
}

function normalizePackageName(value) {
  const name = String(value || '').trim();
  return /^[A-Za-z0-9_.]+$/.test(name) ? name : '';
}

function firstMatch(text, regex) {
  const match = String(text || '').match(regex);
  return match ? String(match[1] || '').trim() : '';
}

module.exports = { register, listPackages, getPackageDetail };

// $XBH_AI_PATCH_END
