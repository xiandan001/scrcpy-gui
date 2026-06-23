// electron/lib/vip.cjs
// VIP 授权运行时：Ed25519 验签 + 机器码绑定 + fail-closed
// XBH_AI_PATCH: VIP 会员体系
// 性能优化：全部异步化，机器码采集不阻塞 main 进程

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getMachineIdAsync, getMachineIdSync, preloadMachineId } = require('./machine-id.cjs');

// 应用内嵌公钥（对应开发者本地保存的私钥，用于验签）
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAaf5YkO6Yb4Oz7mcVQNAmx+pb5hiSEzCy9pRYzzR8pEs=
-----END PUBLIC KEY-----`;

const TOKEN_FILE = 'vip-token.txt';

function getTokenPath() {
  return path.join(app.getPath('userData'), TOKEN_FILE);
}

// 返回 free 基线状态（携带本机机器码）
function freeBaseStatus(mid, reason) {
  return {
    activated: false,
    scope: 'free',
    type: null,
    issuedAt: null,
    expiresAt: null,
    machineId: mid?.machineId || null,
    reason
  };
}

// 验证一个 token 字符串（不依赖文件），返回 { valid, payload, error }
function verifyToken(token) {
  const parts = String(token).trim().split('.');
  if (parts.length !== 2) return { valid: false, error: 'bad_format' };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch (e) {
    return { valid: false, error: 'bad_payload' };
  }

  let sig;
  try {
    sig = Buffer.from(parts[1], 'base64url');
  } catch (e) {
    return { valid: false, error: 'bad_signature' };
  }

  // Ed25519 必须使用 crypto.verify(null, data, key, sig)，不支持 createVerify(null)
  let valid;
  try {
    valid = crypto.verify(null, Buffer.from(parts[0]), PUBLIC_KEY, sig);
  } catch (e) {
    return { valid: false, error: 'bad_signature' };
  }
  if (!valid) return { valid: false, error: 'bad_signature' };
  return { valid: true, payload };
}

// 异步解析并验证 token：读文件 → 验签 → 比对机器码 → 过期判断
async function computeStatusAsync() {
  // 1. 取机器码（异步，不阻塞 main 进程）
  const mid = await getMachineIdAsync();
  if (!mid.success) {
    return { ...freeBaseStatus(null, 'machine_id_failed'), error: mid.error };
  }

  // 2. 读 token
  let token;
  try {
    token = fs.readFileSync(getTokenPath(), 'utf8').trim();
  } catch (e) {
    return freeBaseStatus(mid, 'no_token');
  }

  // 3. 验签
  const { valid, payload, error } = verifyToken(token);
  if (!valid) return freeBaseStatus(mid, error);

  // 4. 比对机器码
  if (payload.m !== mid.machineId) {
    return freeBaseStatus(mid, 'machine_mismatch');
  }

  // 5. 过期检查（订阅制预留）
  if (payload.t === 'subscription' && payload.e) {
    if (Math.floor(Date.now() / 1000) > payload.e) {
      return freeBaseStatus(mid, 'expired');
    }
  }

  // 6. 全部通过
  return {
    activated: true,
    scope: payload.s === 'vip' ? 'vip' : 'free',
    type: payload.t,
    issuedAt: payload.i,
    expiresAt: payload.e,
    machineId: mid.machineId,
    reason: null
  };
}

function register(ipcMain) {
  // 返回当前会员状态（异步，不阻塞）
  ipcMain.handle('vip:getStatus', async () => {
    return computeStatusAsync();
  });

  // 返回本机机器码（异步）
  ipcMain.handle('vip:getMachineId', async () => {
    return getMachineIdAsync();
  });

  // 激活：验签并持久化 token
  ipcMain.handle('vip:activate', async (event, token) => {
    if (!token || typeof token !== 'string') {
      return { success: false, error: 'token_empty' };
    }
    const { valid, payload, error } = verifyToken(token);
    if (!valid) return { success: false, error };

    const mid = await getMachineIdAsync();
    if (!mid.success) return { success: false, error: 'machine_id_failed' };
    if (payload.m !== mid.machineId) {
      return { success: false, error: 'machine_mismatch' };
    }
    if (payload.t === 'subscription' && payload.e &&
        Math.floor(Date.now() / 1000) > payload.e) {
      return { success: false, error: 'expired' };
    }

    // 持久化
    try {
      fs.writeFileSync(getTokenPath(), String(token).trim(), 'utf8');
    } catch (e) {
      return { success: false, error: 'write_failed', detail: e.message };
    }
    return { success: true, status: await computeStatusAsync() };
  });

  // 解绑（预留换机）
  ipcMain.handle('vip:deactivate', async () => {
    try {
      fs.unlinkSync(getTokenPath());
    } catch (e) { /* 文件不存在无碍 */ }
    return { success: true, status: await computeStatusAsync() };
  });
}

// 供其他 main 进程模块同步调用的状态查询（使用缓存，不阻塞）
// 注意：首次调用时缓存可能未就绪，返回 free 状态
function getStatus() {
  const mid = getMachineIdSync();
  if (!mid.success) {
    return { ...freeBaseStatus(null, 'not_ready') };
  }
  let token;
  try {
    token = fs.readFileSync(getTokenPath(), 'utf8').trim();
  } catch (e) {
    return freeBaseStatus(mid, 'no_token');
  }
  const { valid, payload, error } = verifyToken(token);
  if (!valid) return freeBaseStatus(mid, error);
  if (payload.m !== mid.machineId) return freeBaseStatus(mid, 'machine_mismatch');
  if (payload.t === 'subscription' && payload.e &&
      Math.floor(Date.now() / 1000) > payload.e) {
    return freeBaseStatus(mid, 'expired');
  }
  return {
    activated: true, scope: 'vip', type: payload.t,
    issuedAt: payload.i, expiresAt: payload.e,
    machineId: mid.machineId, reason: null
  };
}

// 启动预采集（在 app.whenReady 中异步调用）
function preload() {
  return preloadMachineId();
}

module.exports = {
  register,
  getStatus,
  // $XBH_AI_PATCH_START
  // 供新增巡检模块使用异步会员状态，避免机器码缓存未就绪时误判为基础版
  getStatusAsync: computeStatusAsync,
  // $XBH_AI_PATCH_END
  verifyToken,
  preload
};
