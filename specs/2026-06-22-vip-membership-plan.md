# VIP 会员体系实现计划（v3.0.0）

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 scrcpy-gui 引入基础版/会员版双档位，基于 Ed25519 离线签名激活码 + PC 机器码绑定实现纯离线授权。

**Architecture:** 后端（Electron main 进程）负责机器码采集与验签，所有信任决策在 main 进程完成；前端（React 渲染进程）只做展示与门控提示。fail-closed：任何异常降级为非会员，永不信任缓存布尔标志。

**Tech Stack:** Electron main（Node.js `crypto` Ed25519，零新依赖）、React 渲染层、现有深色 #202124 配色系统。

**Spec:** [specs/2026-06-22-vip-membership-design.md](./2026-06-22-vip-membership-design.md)

---

## 文件结构总览

### 新增文件（进仓库）
| 文件 | 职责 |
|------|------|
| `electron/lib/machine-id.cjs` | 采集 Windows 硬件指纹，输出 SHA-256 机器码 |
| `electron/lib/vip.cjs` | 验签/激活/状态管理/IPC 注册（内嵌公钥） |
| `src/components/MemberCenter.jsx` | 会员中心 UI（状态卡 + 激活区 + 功能对比表） |

### 新增文件（不进仓库，开发者本地）
| 文件 | 职责 |
|------|------|
| `tools/keypair-gen.cjs` | 生成 Ed25519 密钥对 |
| `tools/license-generator.cjs` | 签发激活码 |
| `tools/private-key.pem` | 私钥 |

### 修改文件
| 文件 | 改动 |
|------|------|
| `electron/preload.cjs` | 暴露 vip 系列 API |
| `electron/main.cjs` | 注册 vip 模块 |
| `electron/lib/mcp-server.cjs` | MCP 启动入口加入会员校验 |
| `src/App.jsx` | 会员中心 tab + 设备/历史门控 + vipStatus 状态 |
| `src/components/LogAnalyzer.jsx` | AI 分析/智能搜索/MCP 门控 |
| `src/components/DeviceCard.jsx` | （无需改，门控在 App.jsx 数据层处理） |

---

## Task 1: 开发者密钥对生成工具

**Files:**
- Create: `tools/keypair-gen.cjs`（本地，已被 .gitignore）

- [ ] **Step 1: 创建密钥对生成脚本**

```js
// tools/keypair-gen.cjs
// 用法：node tools/keypair-gen.cjs
// 生成 Ed25519 密钥对，私钥写入 tools/private-key.pem，公钥打印到控制台
const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const pubPem = publicKey.export({ type: 'spki', format: 'pem' });

const toolsDir = path.dirname(__filename);
fs.writeFileSync(path.join(toolsDir, 'private-key.pem'), privPem);
console.log('私钥已保存到 tools/private-key.pem（切勿提交到仓库）');
console.log('\n=== 公钥（粘贴到 electron/lib/vip.cjs 的 PUBLIC_KEY 常量）===\n');
console.log(pubPem.trim());
```

- [ ] **Step 2: 运行生成密钥对**

Run: `node tools/keypair-gen.cjs`
Expected: 打印出 PEM 公钥块，并生成 `tools/private-key.pem`。

- [ ] **Step 3: 保存打印的公钥**

将控制台打印的 `-----BEGIN PUBLIC KEY----- ... -----END PUBLIC KEY-----` 公钥内容**记下来**，Task 3 创建 `vip.cjs` 时填入 `PUBLIC_KEY` 常量。

- [ ] **Step 4: 验证私钥已被 git 忽略**

Run: `git check-ignore tools/private-key.pem`
Expected: 输出 `tools/private-key.pem`（表示已被忽略）。

---

## Task 2: 机器码采集模块

**Files:**
- Create: `electron/lib/machine-id.cjs`

- [ ] **Step 1: 创建机器码采集模块**

```js
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
    sources.guid = normalize(safeExec(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid'
    ).replace(/.*MachineGuid\s+REG_SZ\s+/i, ''));
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
```

- [ ] **Step 2: 验证机器码采集**

Run: `node -e "const m=require('./electron/lib/machine-id.cjs'); console.log(m.getMachineId())"`
Expected: 输出 `{ success: true, machineId: '<64位hex>', sources: { cpu:..., board:..., disk:..., guid:... } }`

- [ ] **Step 3: 提交**

```bash
git add electron/lib/machine-id.cjs
git commit -m "feat(vip): 新增机器码采集模块（CPU+主板+磁盘+MachineGuid 四源融合）"
```

---

## Task 3: VIP 授权运行时（验签/激活/IPC）

**Files:**
- Create: `electron/lib/vip.cjs`
- Modify: `electron/main.cjs`（注册模块）
- Modify: `electron/preload.cjs`（暴露 API）

- [ ] **Step 1: 创建 vip.cjs（内嵌 Task 1 生成的公钥）**

```js
// electron/lib/vip.cjs
// VIP 授权运行时：Ed25519 验签 + 机器码绑定 + fail-closed
// XBH_AI_PATCH: VIP 会员体系

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getMachineId } = require('./machine-id.cjs');

// 【重要】替换为 Task 1 生成的公钥（PEM 格式，整块粘贴）
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
（在此粘贴 Task 1 生成的公钥内容）
-----END PUBLIC KEY-----`;

const TOKEN_FILE = 'vip-token.txt';

function getTokenPath() {
  return path.join(app.getPath('userData'), TOKEN_FILE);
}

// 解析并验证 token：读文件 → 验签 → 比对机器码 → 过期判断
// 每次调用都做完整流程，不信任任何缓存
function computeStatus() {
  const fallback = {
    activated: false,
    scope: 'free',
    type: null,
    issuedAt: null,
    expiresAt: null,
    machineId: null,
    reason: 'no_token'
  };

  // 1. 取机器码
  const mid = getMachineId();
  if (!mid.success) {
    return { ...fallback, reason: 'machine_id_failed', error: mid.error };
  }
  const baseStatus = { ...fallback, machineId: mid.machineId };

  // 2. 读 token
  let token;
  try {
    token = fs.readFileSync(getTokenPath(), 'utf8').trim();
  } catch (e) {
    return { ...baseStatus, reason: 'no_token' };
  }

  // 3. 解析 + 验签
  const parts = token.split('.');
  if (parts.length !== 2) return { ...baseStatus, reason: 'bad_format' };
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch (e) {
    return { ...baseStatus, reason: 'bad_payload' };
  }
  let sig;
  try {
    sig = Buffer.from(parts[1], 'base64url');
  } catch (e) {
    return { ...baseStatus, reason: 'bad_signature' };
  }

  const verify = crypto.createVerify(null);
  verify.update(parts[0]);
  verify.end();
  let valid;
  try {
    valid = verify.verify(PUBLIC_KEY, sig);
  } catch (e) {
    return { ...baseStatus, reason: 'bad_signature' };
  }
  if (!valid) return { ...baseStatus, reason: 'bad_signature' };

  // 4. 比对机器码
  if (payload.m !== mid.machineId) {
    return { ...baseStatus, reason: 'machine_mismatch' };
  }

  // 5. 过期检查（订阅制预留）
  if (payload.t === 'subscription' && payload.e) {
    if (Math.floor(Date.now() / 1000) > payload.e) {
      return { ...baseStatus, reason: 'expired' };
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

// 签发时使用的 payload 编码（供 license-generator 生成 parts[0]）
function encodePayload(machineId, opts = {}) {
  const payload = {
    m: machineId,
    s: opts.scope || 'vip',
    t: opts.type || 'lifetime',
    i: Math.floor(Date.now() / 1000),
    e: opts.expiresAt || null
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function register(ipcMain) {
  // 返回当前会员状态（每次都重新验签）
  ipcMain.handle('vip:getStatus', async () => {
    return computeStatus();
  });

  // 返回本机机器码
  ipcMain.handle('vip:getMachineId', async () => {
    return getMachineId();
  });

  // 激活：验签并持久化 token
  ipcMain.handle('vip:activate', async (event, token) => {
    if (!token || typeof token !== 'string') {
      return { success: false, error: 'token_empty' };
    }
    // 临时写入再校验，或直接在校验逻辑里传入 token
    const parts = String(token).trim().split('.');
    if (parts.length !== 2) {
      return { success: false, error: 'bad_format' };
    }
    let payload;
    try {
      payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    } catch (e) {
      return { success: false, error: 'bad_payload' };
    }
    const verify = crypto.createVerify(null);
    verify.update(parts[0]);
    verify.end();
    let valid;
    try {
      valid = verify.verify(PUBLIC_KEY, Buffer.from(parts[1], 'base64url'));
    } catch (e) {
      return { success: false, error: 'bad_signature' };
    }
    if (!valid) return { success: false, error: 'bad_signature' };

    const mid = getMachineId();
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
    return { success: true, status: computeStatus() };
  });

  // 解绑（预留换机）
  ipcMain.handle('vip:deactivate', async () => {
    try {
      fs.unlinkSync(getTokenPath());
    } catch (e) { /* 文件不存在无碍 */ }
    return { success: true, status: computeStatus() };
  });
}

// 供其他 main 进程模块同步调用的状态查询
function getStatus() {
  return computeStatus();
}

module.exports = { register, getStatus, encodePayload };
```

- [ ] **Step 2: 用 Task 1 的公钥替换 PUBLIC_KEY 占位**

将 `vip.cjs` 中 `PUBLIC_KEY` 常量的占位文字替换为 Task 1 打印的公钥（保留 `-----BEGIN/END-----` 行）。

- [ ] **Step 3: 在 main.cjs 注册 vip 模块**

修改 `electron/main.cjs`：
- 在 require 区（第 21 行 `smartSearch` 后）新增：
```js
const vip = require('./lib/vip.cjs');
```
- 在 `app.whenReady()` 内的注册区（第 96 行 `smartSearch.register(ipcMain);` 后）新增：
```js
  vip.register(ipcMain);
```

- [ ] **Step 4: 在 preload.cjs 暴露 vip API**

修改 `electron/preload.cjs`，在最后一个 `smartSearchComplete`（约 197 行）后，把结尾的 `}` 改为先加逗号再追加 vip 方法：

```js
  // XBH_AI_PATCH_START
  // VIP 会员体系
  vipGetStatus: () => ipcRenderer.invoke('vip:getStatus'),
  vipGetMachineId: () => ipcRenderer.invoke('vip:getMachineId'),
  vipActivate: (token) => ipcRenderer.invoke('vip:activate', token),
  vipDeactivate: () => ipcRenderer.invoke('vip:deactivate'),
  // XBH_AI_PATCH_END
```

- [ ] **Step 5: 提交**

```bash
git add electron/lib/vip.cjs electron/main.cjs electron/preload.cjs
git commit -m "feat(vip): 新增授权运行时（Ed25519验签+机器码绑定+IPC）"
```

---

## Task 4: 签发工具

**Files:**
- Create: `tools/license-generator.cjs`（本地，已被 .gitignore）

- [ ] **Step 1: 创建签发脚本**

```js
// tools/license-generator.cjs
// 用法：node tools/license-generator.cjs --machine <机器码> [--type lifetime|subscription] [--expire <YYYY-MM-DD>]
// 输出激活码字符串（发给用户）
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : null;
}

const machine = getArg('machine');
const type = getArg('type') || 'lifetime';
const expireStr = getArg('expire');

if (!machine) {
  console.error('用法: node tools/license-generator.cjs --machine <64位机器码> [--type lifetime|subscription] [--expire YYYY-MM-DD]');
  process.exit(1);
}

const privPemPath = path.join(__dirname, 'private-key.pem');
if (!fs.existsSync(privPemPath)) {
  console.error('未找到 tools/private-key.pem，请先运行 node tools/keypair-gen.cjs');
  process.exit(1);
}
const privPem = fs.readFileSync(privPemPath, 'utf8');

let expiresAt = null;
if (type === 'subscription' && expireStr) {
  expiresAt = Math.floor(new Date(expireStr + 'T23:59:59+08:00').getTime() / 1000);
}

const payload = {
  m: machine,
  s: 'vip',
  t: type,
  i: Math.floor(Date.now() / 1000),
  e: expiresAt
};
const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

const signer = crypto.createSign(null);
signer.update(payloadB64);
signer.end();
const sig = signer.sign(privPem);
const sigB64 = sig.toString('base64url');

const token = payloadB64 + '.' + sigB64;
console.log('=== 激活码（发给用户）===');
console.log(token);
console.log('\n类型:', type, expiresAt ? '| 过期: ' + expireStr : '| 终身');
```

- [ ] **Step 2: 自测签发+验签闭环**

Run:
```bash
node tools/license-generator.cjs --machine <你的真实机器码>
```
将输出的激活码记下来，启动 app 后在会员中心粘贴验证。

- [ ] **Step 3: 验证签发工具已被忽略**

Run: `git check-ignore tools/license-generator.cjs`
Expected: 输出 `tools/license-generator.cjs`

---

## Task 5: MCP 后端会员校验

**Files:**
- Modify: `electron/lib/mcp-server.cjs`

- [ ] **Step 1: 在 mcp-server.cjs 顶部引入 vip 模块**

在 `electron/lib/mcp-server.cjs` 第 15 行 `const aiAnalyze = require('./ai-analyze.cjs');` 后新增：

```js
const vip = require('./vip.cjs');
```

- [ ] **Step 2: MCP 启动入口加入会员校验**

在 `register` 函数内（约第 639 行 `ipcMain.handle('mcp:start', ...)`），将整个 handler 替换为：

```js
  ipcMain.handle('mcp:start', async () => {
    try {
      // XBH_AI_PATCH: VIP 校验 - 非会员拒绝启动 MCP
      const status = vip.getStatus();
      if (!status.activated) {
        return { ok: false, running: false, error: 'VIP 会员专属功能，请先开通会员', code: 'vip_required' };
      }
      if (!mcpServerInstance) initMcpServer();
      return { ok: true, running: true };
    } catch (e) {
      return { ok: false, running: false, error: e.message };
    }
  });
```

- [ ] **Step 3: 提交**

```bash
git add electron/lib/mcp-server.cjs
git commit -m "feat(vip): MCP 后端加入会员校验，非会员拒绝启动"
```

---

## Task 6: App.jsx 状态层 - vipStatus 与会员中心 Tab

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 新增 vipStatus 状态与初始化**

在 `src/App.jsx` 顶部 import 处（第 2 行）加入 `Crown` 图标：

```jsx
import { RefreshCw, Smartphone, Settings, Camera, RotateCcw, Wifi, Loader2, FolderOpen, Download, Folder, Package, Copy, X, Palette, History, Video, Bot, DownloadCloud, CheckCircle2, AlertCircle, Crown } from 'lucide-react';
```

在 import 区（第 6 行 `import DeviceCard from './components/DeviceCard';` 后）新增：

```jsx
import MemberCenter from './components/MemberCenter';
```

在状态声明区（约第 104 行 `const [terminalCommandHistory, setTerminalCommandHistory] = useState([]);` 后）新增：

```jsx
  // XBH_AI_PATCH_START
  // VIP 会员状态
  const [vipStatus, setVipStatus] = useState({
    activated: false, scope: 'free', type: null,
    issuedAt: null, expiresAt: null, machineId: null, reason: 'loading'
  });
  const refreshVipStatus = async () => {
    if (window.electronAPI?.vipGetStatus) {
      const s = await window.electronAPI.vipGetStatus();
      setVipStatus(s);
    }
  };
  // XBH_AI_PATCH_END
```

- [ ] **Step 2: 启动时初始化 vipStatus**

在 `useEffect(() => { fetchDevices(); ... }, [])`（约第 210 行）的末尾、`}, []);`（约第 273 行）之前新增：

```jsx
    // XBH_AI_PATCH_START
    // 初始化 VIP 状态
    refreshVipStatus();
    // XBH_AI_PATCH_END
```

- [ ] **Step 3: 添加会员中心侧边栏导航项**

在 `src/App.jsx` 侧边栏 nav 区，AI 日志助手按钮（约第 1101 行 `</button>` 之后、`{/* XBH_AI_PATCH_END */}` 之前）新增会员中心导航项：

```jsx
          {/* XBH_AI_PATCH_START 会员中心 */}
          <button
            onClick={() => {
              setActiveTab('member');
              refreshVipStatus();
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'member' ? `${t.primary === 'cyan' || t.primary === 'blue' ? 'bg-cyan-500/20 text-cyan-400' : t.primary === 'pink' ? 'bg-pink-500/20 text-pink-400' : t.primary === 'green' ? 'bg-green-500/20 text-green-400' : t.primary === 'orange' ? 'bg-orange-500/20 text-orange-400' : 'bg-amber-500/20 text-amber-400'}` : 'hover:bg-[#2D2F33]'}`}
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <Crown size={20} />
            <span className="font-medium">会员中心</span>
          </button>
          {/* XBH_AI_PATCH_END */}
```

- [ ] **Step 4: Header 标题支持 member tab**

在 header 区（约第 1131 行 `<h2>` 标签内容）扩展：

```jsx
              {activeTab === 'devices' ? '已连接设备' : activeTab === 'history' ? '连接历史' : activeTab === 'member' ? '会员中心' : '全局设置'}
```

在 header 副标题（约第 1134 行 `<p>` 内容）扩展：

```jsx
              {activeTab === 'devices' ? '管理并投屏您的 Android 设备' : activeTab === 'history' ? '查看无线连接历史记录' : activeTab === 'member' ? '管理您的会员权益与激活' : '配置 Scrcpy 及 ADB 相关偏好'}
```

- [ ] **Step 5: 在 main 内容区渲染 MemberCenter**

在 `activeTab === 'settings'` 块（约第 1353 行 `{activeTab === 'settings' && (` 之前）新增：

```jsx
          {activeTab === 'member' && (
            <MemberCenter
              theme={theme}
              vipStatus={vipStatus}
              onActivated={refreshVipStatus}
              showToast={showToast}
            />
          )}

```

- [ ] **Step 6: 暂不提交（等 MemberCenter 组件创建后一起提交）**

---

## Task 7: MemberCenter 组件

**Files:**
- Create: `src/components/MemberCenter.jsx`

- [ ] **Step 1: 创建 MemberCenter 组件**

```jsx
// src/components/MemberCenter.jsx
// 会员中心：状态卡 + 激活区 + 功能对比表
// XBH_AI_PATCH: VIP 会员体系

import { useState } from 'react';
import { Crown, Copy, Check, Lock, Sparkles, Zap, ShieldCheck, Brain, Server, Loader2 } from 'lucide-react';

const FEATURES = [
  {
    icon: Smartphone,
    name: '同时管理设备数量',
    free: '1 台',
    vip: '不限'
  },
  {
    icon: History,
    name: '连接历史记录',
    free: '5 条',
    vip: '不限'
  },
  {
    icon: ShieldCheck,
    name: 'AI 自动诊断',
    free: '可用',
    vip: '可用'
  },
  {
    icon: Sparkles,
    name: 'AI 深度分析',
    free: '不可用',
    vip: '可用'
  },
  {
    icon: Brain,
    name: '自然语言搜索日志',
    free: '不可用',
    vip: '可用'
  },
  {
    icon: Server,
    name: 'MCP 服务集成',
    free: '不可用',
    vip: '可用'
  }
];

// 补齐未导入图标（防 JSX 解析报错）
import Smartphone from 'lucide-react/dist/esm/icons/smartphone';
import History from 'lucide-react/dist/esm/icons/history';

const ERROR_TEXT = {
  bad_signature: '激活码无效（签名校验失败），请检查是否复制完整',
  machine_mismatch: '机器码不匹配，请复制本机机器码联系开发者重新签发',
  expired: '激活码已过期，请联系开发者续费',
  bad_format: '激活码格式错误，请检查是否复制完整',
  no_token: '',
  loading: ''
};

export default function MemberCenter({ theme, vipStatus, onActivated, showToast }) {
  const t = theme || { primary: 'tech' };
  const isDark = t.primary === 'tech';
  const isVip = vipStatus.activated;
  const [tokenInput, setTokenInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');
  const [copied, setCopied] = useState(false);

  const copyMachineId = async () => {
    if (!vipStatus.machineId) return;
    try {
      await navigator.clipboard.writeText(vipStatus.machineId);
      setCopied(true);
      showToast?.('机器码已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      showToast?.('复制失败');
    }
  };

  const handleActivate = async () => {
    const token = tokenInput.trim();
    if (!token) {
      setActivateError('请粘贴激活码');
      return;
    }
    setActivating(true);
    setActivateError('');
    try {
      const res = await window.electronAPI.vipActivate(token);
      if (res.success) {
        setTokenInput('');
        showToast?.('会员激活成功，感谢支持！');
        await onActivated?.();
      } else {
        setActivateError(ERROR_TEXT[res.error] || ('激活失败：' + res.error));
      }
    } catch (e) {
      setActivateError('激活异常：' + e.message);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 状态卡片 */}
      <div className={`p-6 rounded-xl border shadow-sm ${isVip ? 'border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50' : isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isVip ? 'bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/30' : isDark ? 'bg-[#3E4145]' : 'bg-slate-200'}`}>
              {isVip ? <Crown size={28} className="text-white" /> : <Lock size={26} className={isDark ? 'text-[#9AA0A6]' : 'text-slate-500'} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-xl font-bold ${isVip ? 'text-amber-700' : isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>
                  {isVip ? '会员版' : '基础版'}
                </h3>
                {isVip && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-700 border border-amber-400/30">
                    {vipStatus.type === 'lifetime' ? '终身' : '订阅'}
                  </span>
                )}
              </div>
              <p className={`text-sm mt-1 ${isVip ? 'text-amber-600' : isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
                {isVip
                  ? vipStatus.type === 'lifetime' ? '永久有效，感谢您的支持' : `有效期至 ${new Date((vipStatus.expiresAt || 0) * 1000).toLocaleDateString('zh-CN')}`
                  : '升级会员解锁全部功能'}
              </p>
            </div>
          </div>
        </div>

        {/* 机器码 */}
        <div className={`mt-5 pt-5 border-t ${isVip ? 'border-amber-200' : isDark ? 'border-[#3E4145]' : 'border-slate-100'}`}>
          <div className={`text-xs mb-1.5 ${isDark ? 'text-[#80868B]' : 'text-slate-500'}`}>本机机器码</div>
          <div className="flex items-center gap-2">
            <code className={`flex-1 px-3 py-2 rounded-lg font-mono text-xs break-all ${isDark ? 'bg-[#3E4145]/60 text-[#E8EAED]' : 'bg-slate-50 text-slate-700'}`}>
              {vipStatus.machineId || '获取中…'}
            </code>
            <button
              onClick={copyMachineId}
              disabled={!vipStatus.machineId}
              className={`shrink-0 p-2.5 rounded-lg transition-colors disabled:opacity-50 ${isDark ? 'bg-[#3E4145] hover:bg-slate-600 text-[#E8EAED]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              title="复制机器码"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* 激活区（仅非会员） */}
      {!isVip && (
        <div className={`p-6 rounded-xl border shadow-sm ${isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>激活会员</h3>
          <p className={`text-sm mb-4 ${isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
            复制上方机器码发送给开发者，获取激活码后粘贴到下方激活。
          </p>
          <textarea
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="在此粘贴激活码…"
            rows={3}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none ${isDark ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED] placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
          />
          {activateError && (
            <div className="mt-2 px-3 py-2 rounded-lg text-xs bg-red-500/10 text-red-500 border border-red-500/20">
              {activateError}
            </div>
          )}
          <button
            onClick={handleActivate}
            disabled={activating || !tokenInput.trim()}
            className="mt-3 w-full sm:w-auto px-6 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
          >
            {activating ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />激活中…</span> : '立即激活'}
          </button>
        </div>
      )}

      {/* 功能对比表 */}
      <div className={`p-6 rounded-xl border shadow-sm ${isDark ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-[#E8EAED]' : 'text-slate-800'}`}>功能对比</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'text-[#9AA0A6]' : 'text-slate-500'}>
                <th className="text-left font-medium pb-3">功能</th>
                <th className="text-center font-medium pb-3 px-4">
                  <div className="flex flex-col items-center gap-1">
                    <Lock size={16} />
                    <span>基础版</span>
                  </div>
                </th>
                <th className="text-center font-medium pb-3 px-4">
                  <div className="flex flex-col items-center gap-1 text-amber-500">
                    <Crown size={16} />
                    <span>会员版</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                const freeOk = f.free === '可用';
                const vipOk = f.vip === '可用' || f.vip === '不限';
                return (
                  <tr key={i} className={i < FEATURES.length - 1 ? (isDark ? 'border-b border-[#3E4145]/50' : 'border-b border-slate-100') : ''}>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} className={isDark ? 'text-[#80868B]' : 'text-slate-400'} />
                        <span className={isDark ? 'text-[#E8EAED]' : 'text-slate-700'}>{f.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-3">
                      <span className={freeOk ? 'text-emerald-500 font-medium' : isDark ? 'text-[#80868B]' : 'text-slate-400'}>
                        {freeOk ? <span className="inline-flex items-center gap-1"><Check size={14} />可用</span> : f.free}
                      </span>
                    </td>
                    <td className="text-center py-3">
                      <span className="text-amber-500 font-medium">
                        {f.vip === '可用' ? <span className="inline-flex items-center gap-1"><Check size={14} />可用</span> : f.vip}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 修正图标 import（统一从主入口导入）**

上方 Step 1 的代码中末尾有两个从 `lucide-react/dist/esm/icons/...` 导入的 `Smartphone` / `History`，**删除这两个 import**，改为在文件顶部第一个 import 中一并引入。将第一个 import 行改为：

```jsx
import { Crown, Copy, Check, Lock, Sparkles, Zap, ShieldCheck, Brain, Server, Loader2, Smartphone, History } from 'lucide-react';
```

并删除文件中部多余的：
```jsx
import Smartphone from 'lucide-react/dist/esm/icons/smartphone';
import History from 'lucide-react/dist/esm/icons/history';
```

- [ ] **Step 3: 提交 Task 6 + Task 7**

```bash
git add src/App.jsx src/components/MemberCenter.jsx
git commit -m "feat(vip): 新增会员中心 UI + 侧边栏导航 + vipStatus 状态层"
```

---

## Task 8: 设备列表与连接历史门控

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 设备列表门控（非会员仅显示 1 台）**

在 `src/App.jsx` 设备列表渲染区（约第 1195 行 `devices.map(device => (` 之前），把 `devices.map` 改为基于门控的可见设备列表。找到：

```jsx
                  devices.map(device => (
```

替换为（限制可见数量 + 追加锁定占位卡）：

```jsx
                  (() => {
                    const FREE_DEVICE_LIMIT = 1;
                    const visibleDevices = vipStatus.activated ? devices : devices.slice(0, FREE_DEVICE_LIMIT);
                    const lockedCount = vipStatus.activated ? 0 : Math.max(0, devices.length - FREE_DEVICE_LIMIT);
                    return (
                      <>
                        {visibleDevices.map(device => (
```

然后把对应的闭合 `))}`（DeviceCard 的 `/>` 后的 `))}`）替换为：

```jsx
                        ))}
                        {/* XBH_AI_PATCH: 非会员锁定占位卡 */}
                        {lockedCount > 0 && (
                          <div className={`col-span-full flex items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed ${t.primary === 'tech' ? 'border-[#3E4145] bg-slate-800/40' : 'border-slate-300 bg-slate-50'} `}>
                            <Lock size={20} className="text-amber-400" />
                            <span className={`text-sm ${t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
                              还有 {lockedCount} 台设备已连接，<button onClick={() => setActiveTab('member')} className="text-amber-400 hover:underline font-medium">开通会员</button>解锁全部
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()
```

（此替换需精准定位 DeviceCard 的 `/>` 后原本的 `))}` 并改为上面的完整块。）

- [ ] **Step 2: 连接历史门控（非会员仅显示 5 条）**

在连接历史渲染区（约第 1293 行 `{connectionHistory.map((item) => (`），改为限制可见数量。找到：

```jsx
                    {connectionHistory.map((item) => (
```

替换为：

```jsx
                    {(() => {
                      const FREE_HISTORY_LIMIT = 5;
                      const visibleHistory = vipStatus.activated ? connectionHistory : connectionHistory.slice(0, FREE_HISTORY_LIMIT);
                      const lockedHistoryCount = vipStatus.activated ? 0 : Math.max(0, connectionHistory.length - FREE_HISTORY_LIMIT);
                      return (
                        <>
                          {visibleHistory.map((item) => (
```

找到对应历史卡片的闭合（`)})` 即 map 结束 + grid div），在其后、`</div>`（grid 闭合）之前，追加锁定提示：

```jsx
                          ))}
                          {lockedHistoryCount > 0 && (
                            <div className={`col-span-full flex items-center justify-center gap-3 p-5 rounded-xl border-2 border-dashed ${t.primary === 'tech' ? 'border-[#3E4145] bg-slate-800/40' : 'border-slate-300 bg-slate-50'}`}>
                              <Lock size={18} className="text-amber-400" />
                              <span className={`text-sm ${t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-slate-500'}`}>
                                还有 {lockedHistoryCount} 条历史记录，<button onClick={() => setActiveTab('member')} className="text-amber-400 hover:underline font-medium">开通会员</button>查看全部
                              </span>
                            </div>
                        )}
                      </>
                    );
                  })()}
```

（需把原 `{connectionHistory.map((item) => (` 对应的闭合 `))}` 删掉，改为上面的完整 IIFE 块。）

- [ ] **Step 3: 提交**

```bash
git add src/App.jsx
git commit -m "feat(vip): 设备列表限 1 台、连接历史限 5 条门控（非会员）"
```

---

## Task 9: LogAnalyzer 门控（AI 分析/智能搜索/MCP）

**Files:**
- Modify: `src/components/LogAnalyzer.jsx`

- [ ] **Step 1: 组件接收 vipStatus prop**

修改 `src/components/LogAnalyzer.jsx` 第 67 行函数签名：

```jsx
export default function LogAnalyzer({ theme, vipStatus }) {
```

并在组件内（约第 88 行 `const [mcpRunning, setMcpRunning] = useState(false);` 后）派生：

```jsx
  // XBH_AI_PATCH: VIP 门控
  const isVip = vipStatus?.activated === true;
  const [vipBlockMsg, setVipBlockMsg] = useState('');
  const showVipBlock = (featureName) => setVipBlockMsg(featureName);
  const dismissVipBlock = () => setVipBlockMsg('');
```

- [ ] **Step 2: 智能搜索入口门控**

在第二行工具栏（约第 1320 行），把整个智能搜索 `<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border ...">` 用条件包裹。在该 `<div>` 前加：

```jsx
            {/* XBH_AI_PATCH: 智能搜索 - 非会员隐藏 */}
            {isVip ? (
```

并在该 `<div>` 闭合（到 MCP 按钮 `<div>` 之前）后加：

```jsx
            ) : null}
```

即：非会员时整块智能搜索区域不渲染。

- [ ] **Step 3: AI 分析按钮门控**

在 AI 分析按钮处（约第 1393 行），把 `onClick` 改为带门控。找到：

```jsx
              setAiPanelOpen(!aiPanelOpen);
```

替换为：

```jsx
              if (!isVip) { showVipBlock('AI 深度分析'); return; }
              setAiPanelOpen(!aiPanelOpen);
```

- [ ] **Step 4: MCP 按钮门控**

在 MCP 按钮（约第 1460 行 `onClick` 处），找到：

```jsx
            onClick={() => { /* MCP 开关逻辑 */ }}
```

定位到 MCP 按钮的 `onClick` 内（toggleMcp 相关逻辑，约第 788 行 `toggleMcp` 函数）。在该函数最前面加：

```jsx
      // XBH_AI_PATCH: MCP - 非会员阻止
      if (!vipStatus?.activated) {
        setNote('MCP 服务为会员专属功能，请在会员中心开通');
        return;
      }
```

同时在 MCP 按钮 UI 上（约第 1459 行 `<button`），加条件渲染：非会员时整个 MCP 按钮 + 标签不渲染。在 `<button` 前加 `{isVip ? (` ，在闭合 `</button>` 后加 `) : null}`。

- [ ] **Step 5: 自动诊断内的 AI 分析弹窗门控**

在自动诊断 alert 内的 AI 分析按钮（约第 1870 行 `{hasIssues && (` 内的 `onClick={onAutoDiagnoseConfirm}`），把该 `onClick` 改为：

```jsx
                      onClick={() => {
                        if (!isVip) { showVipBlock('AI 深度分析'); return; }
                        onAutoDiagnoseConfirm();
                      }}
```

- [ ] **Step 6: 新增 VIP 拦截弹窗**

在 LogAnalyzer 组件 JSX 末尾（最后一个 `</div>` 前，约 AI 全屏面板之后）新增 VIP 拦截弹窗：

```jsx
      {/* XBH_AI_PATCH: VIP 拦截弹窗 */}
      {vipBlockMsg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
          <div className="p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 bg-[#2D2F33] border border-[#3E4145]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Lock size={20} className="text-amber-400" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-[#E8EAED]">会员专属功能</h4>
                <p className="text-xs text-[#9AA0A6] mt-0.5">{vipBlockMsg} 仅会员可用</p>
              </div>
            </div>
            <p className="text-sm text-[#9AA0A6] mb-5">当前为基础版，开通会员即可解锁全部 AI 能力与 MCP 服务。</p>
            <div className="flex justify-end gap-2">
              <button onClick={dismissVipBlock} className="px-4 py-2 text-sm rounded-lg bg-[#3E4145] text-[#E8EAED] hover:bg-slate-600 transition-colors">知道了</button>
              <button
                onClick={() => {
                  dismissVipBlock();
                  if (window.electronAPI?.logAnalyzerClose) window.electronAPI.logAnalyzerClose();
                }}
                className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-medium transition-all"
              >
                去开通
              </button>
            </div>
          </div>
        </div>
      )}
```

并在顶部 import（第 5 行）追加 `Lock`（如未存在）。

- [ ] **Step 7: App.jsx 传 vipStatus 给 LogAnalyzer**

LogAnalyzer 是在独立窗口（log-analyzer.html）渲染，需通过 IPC 或 query 传递 vipStatus。**简化方案**：LogAnalyzer 内挂载时主动拉取。在 LogAnalyzer 的 `useEffect` 初始化区（约第 311 行 `setMcpRunning(info.running);` 所在的 getInfo 调用块）末尾追加：

```jsx
        // XBH_AI_PATCH: 拉取 VIP 状态
        try {
          if (window.electronAPI?.vipGetStatus) {
            const vs = await window.electronAPI.vipGetStatus();
            setVipStatusState(vs);
          }
        } catch (e) { /* 静默 */ }
```

并在组件顶部（Step 1 派生之后）新增状态：

```jsx
  const [vipStatusState, setVipStatusState] = useState(null);
  const effectiveVipStatus = vipStatus || vipStatusState;
  const isVip = effectiveVipStatus?.activated === true;
```

把所有 `vipStatus` 引用改为 `effectiveVipStatus`。

- [ ] **Step 8: 提交**

```bash
git add src/components/LogAnalyzer.jsx
git commit -m "feat(vip): LogAnalyzer AI分析/智能搜索/MCP 门控 + VIP拦截弹窗"
```

---

## Task 10: 端到端验证

- [ ] **Step 1: 确认公钥已正确填入 vip.cjs**

打开 `electron/lib/vip.cjs`，确认 `PUBLIC_KEY` 是 Task 1 生成的真实公钥，不是占位文字。

- [ ] **Step 2: 开发模式启动**

Run: `npm run electron:dev`
Expected: 应用正常启动，侧边栏出现"会员中心"。

- [ ] **Step 3: 验证非会员状态**

- 进入会员中心：显示"基础版"，机器码可见且可复制。
- 设备列表：连接 2+ 设备时只显示 1 台 + 锁定提示。
- 连接历史：超过 5 条时只显示 5 条 + 锁定提示。
- AI 日志助手：智能搜索区域不显示；点击 AI 分析 → 弹出 VIP 拦截弹窗；MCP 按钮不显示；自动诊断可用但点 AI 分析 → 弹拦截。

- [ ] **Step 4: 签发并激活**

```bash
node tools/license-generator.cjs --machine <复制会员中心的机器码>
```
把激活码粘贴到会员中心激活 → 提示成功 → 状态变为"会员版 终身"。

- [ ] **Step 5: 验证会员状态**

- 设备列表/历史不再受限。
- 智能搜索、AI 分析、MCP 全部可用。

- [ ] **Step 6: 防破解验证**

- 复制激活码到另一台 PC 激活 → 应失败，提示"机器码不匹配"。
- 手动篡改 token 字符 → 应失败，提示"签名校验失败"。

- [ ] **Step 7: 最终提交并打 tag**

```bash
git add -A
git commit -m "v3.0.0: VIP 会员体系完成"
git tag v3.0.0
```

---

## Self-Review（计划完成后自检）

**Spec 覆盖：**
- 密码学方案（Ed25519）→ Task 1, 3, 4 ✓
- 机器码四源融合 → Task 2 ✓
- 授权运行时（fail-closed / 多点校验）→ Task 3 ✓
- 功能门控矩阵 6 项 → Task 5, 8, 9 ✓
- 会员中心 UI（状态卡/激活区/对比表）→ Task 7 ✓
- MCP 后端校验 → Task 5 ✓
- 订阅字段预留 → Task 3 payload 结构已含 ✓
- 签发流程文档化 → Task 1, 4 ✓

**无占位符：** Task 3 Step 2 的 PUBLIC_KEY 替换是必要的运行时步骤，非占位符。

**类型一致：** IPC channel 名（`vip:getStatus` 等）在 vip.cjs / preload.cjs / MemberCenter.jsx / LogAnalyzer.jsx 中一致。`vipStatus` 结构（activated/scope/type/issuedAt/expiresAt/machineId/reason）在各文件一致。
