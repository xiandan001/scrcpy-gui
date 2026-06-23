# VIP 会员体系设计文档（v3.0.0）

- 日期：2026-06-22
- 分支：`develop-vip`
- 版本：`3.0.0`
- 状态：待实现

## 1. 背景与目标

当前应用（scrcpy-gui）所有功能对所有用户完全开放。本次需要引入"基础版 / 会员版"双档位机制：

- **基础版（免费）**：保留核心可用性，但功能受限，作为体验入口与会员转化抓手。
- **会员版（付费）**：解锁全部能力。

目标：在不引入账号系统、不依赖后端服务器的前提下，实现**离线激活 + 机器绑定 + 不可伪造 + 不可分享**的会员授权。

## 2. 关键约束（已与用户确认）

| 维度 | 决策 |
|------|------|
| 后端 / 分销 | 完全无后端，纯离线；用户私下转账，开发者本地手动签发激活码 |
| 授权范围 | 绑定 PC 机器码（CPU + 主板 + 磁盘 + MachineGuid 四源融合） |
| 有效期 | v3.0.0 仅做终身买断；数据结构预留订阅字段，未来可平滑扩展 |
| 载体方案 | 方案 A：Ed25519 签名激活码，复制粘贴即用 |
| 绑定强度 | 强绑定（4 源融合），重装系统 / 换机需重新签发 |

## 3. 防破解模型（诚实的天花板）

纯离线桌面应用无法做到 100% 不可破解（校验逻辑在本机运行，理论可被 patch）。本方案建立三道防线：

| 防线 | 能力 | 天花板 |
|------|------|--------|
| ① 防伪造授权 | Ed25519 非对称签名，私钥只签发工具持有，公钥内嵌 App | 无人能伪造合法激活码 |
| ② 防盗用分享 | 激活码绑定本机机器码，换机失效，不可直接拷贝 | 无法直接分享 |
| ③ 防逻辑 patch | 多点 fail-closed 校验，永不信任单独布尔标志 | 抬高成本；未来可选用 bytenode 编译 `.jsc` 进一步加固 |

**结论**：伪造与分享可彻底堵死；仅"硬改源码"无法根除——这是所有离线软件的共同上限（WinRAR / Sublime / Navicat 等），可接受。

## 4. 密码学方案

- **算法**：Ed25519（Node.js `crypto` 原生支持，零新依赖）。
- **私钥**：开发者离线保存，仅 `tools/license-generator.cjs` 使用，**永不进仓库**（已加入 `.gitignore`）。
- **公钥**：硬编码进 `electron/lib/vip.cjs`，用于运行时验签。

### 4.1 激活码格式（类 JWT，紧凑）

```
<base64url(payload)>.<base64url(signature)>
```

payload（紧凑字段名，减小体积）：

| 字段 | 含义 | 取值 |
|------|------|------|
| `m` | machineId | 机器码 SHA-256 hex（64 字符） |
| `s` | scope | `"vip"` |
| `t` | type | `"lifetime"` \| `"subscription"` |
| `i` | issuedAt | 签发时间戳（秒） |
| `e` | expiresAt | 过期时间戳（秒），终身版为 `null` |

## 5. 机器码（Windows，四源融合）

### 5.1 数据来源

| 源 | 读取方式 | 说明 |
|----|----------|------|
| CPU | `Get-CimInstance Win32_Processor \| Select ProcessorId` | 处理器 ID |
| 主板 | `Get-CimInstance Win32_BaseBoard \| Select SerialNumber` | 主板序列号 |
| 磁盘 | `Get-CimInstance Win32_DiskDrive \| Select SerialNumber` | 主磁盘序列号 |
| 系统 | `reg query "HKLM\SOFTWARE\Microsoft\Cryptography" /v MachineGuid` | Windows 安装唯一标识 |

### 5.2 算法

1. 依次采集 4 源，规范化（去空白、转大写）。
2. 任一源读取失败则跳过该源；**至少保留 2 源**才生成有效机器码，否则上报错误。
3. 拼接为 `cpu|board|disk|guid` 字符串，取 SHA-256 hex。
4. 用户可见机器码即该 64 位 hex（可一键复制）。

### 5.3 容错与稳定性

- 单源缺失（如虚拟机无磁盘序列号）不影响生成。
- 用户更换 CPU / 主板 / 磁盘 / 重装系统均会改变机器码 → 需重新签发。
- 机器码读取失败时，UI 明确提示"无法获取硬件指纹"，而非静默失败。

### 5.4 模块

新增 `electron/lib/machine-id.cjs`：
- `getMachineId()` → `{ success, machineId?, error?, sources? }`。
- 内部缓存，避免重复执行子进程。

## 6. 授权运行时（vip.cjs）

新增 `electron/lib/vip.cjs`：

### 6.1 状态

```js
let vipStatus = {
  activated: false,      // 是否已激活会员
  scope: 'free',         // 'free' | 'vip'
  type: null,            // 'lifetime' | 'subscription' | null
  issuedAt: null,
  expiresAt: null,
  machineId: null,
  reason: null           // 未激活原因（供调试/展示）
};
```

### 6.2 启动流程

1. `getMachineId()` 取本机机器码（失败 → 保持 free，`reason='machine_id_failed'`）。
2. 读取 `userData/vip-token.txt`（不存在 → free）。
3. 公钥验签（失败 → free，`reason='bad_signature'`）。
4. 比对 payload.m === 本机机器码（不符 → free，`reason='machine_mismatch'`）。
5. 过期检查（`type=subscription` 且已过期 → free，`reason='expired'`）。
6. 全部通过 → `activated=true, scope='vip'`，缓存状态。

### 6.3 fail-closed 原则

- 任何异常（文件损坏、验签异常、机器码异常）一律降级为 free。
- **永不缓存"已激活"布尔标志作为信任依据**：`vipStatus` 仅作展示快照；所有门控决策点（前端进入功能、后端启动 MCP）均通过 `vip:getStatus` / `vip.getStatus()` 触发一次完整的"读 token 文件 → 验签 → 比对机器码 → 过期判断"流程，不信任上一次缓存的布尔结果。Ed25519 验签为微秒级，性能可接受。
- 进入门控功能时再做一次校验（多点校验）。

### 6.4 IPC 接口

| Channel | 方向 | 作用 |
|---------|------|------|
| `vip:getStatus` | renderer → main | 返回当前 `vipStatus` |
| `vip:getMachineId` | renderer → main | 返回本机机器码（供展示/复制） |
| `vip:activate` | renderer → main | 传入 token，验签+绑定，成功则写入 token 文件并刷新状态 |
| `vip:deactivate` | renderer → main | 清除 token（预留换机解绑；v3.0.0 可不开放给用户） |

### 6.5 MCP 后端联动

`mcp-server.cjs` 启动入口处调用 `vip.getStatus()`：非会员则拒绝启动并返回错误，保证 MCP 在后端层也无法绕过。

## 7. 功能门控矩阵

| 功能 | 落点文件 | 非会员 | 会员 |
|------|----------|--------|------|
| 设备列表 | `src/App.jsx`（devices 渲染区） | 仅显示 1 台，其余以"锁定占位卡"提示 | 全部显示 |
| 连接历史 | `src/App.jsx`（history 卡片区） | 仅显示 5 条，其余锁定 | 全部显示 |
| 自动诊断 | `src/components/LogAnalyzer.jsx` | 可用 | 可用 |
| AI 分析 | `src/components/LogAnalyzer.jsx` | 点击 → 提示"会员专属"弹窗，引导去会员中心 | 可用 |
| 自然语言搜索 | `src/components/LogAnalyzer.jsx` | 入口锁定 | 可用 |
| MCP 服务 | `LogAnalyzer.jsx` + `mcp-server.cjs` | 隐藏入口 + 后端拒绝启动 | 可用 |

### 7.1 门控原则

- 前端门控为"体验层"（隐藏/锁定/提示），**不可作为安全边界**。
- 后端门控（MCP 启动拒绝）才是真正的安全边界。
- 关键门控点每次操作都读取最新 `vipStatus`，避免状态过期。

## 8. 会员中心 UI

### 8.1 位置

侧边栏"AI 日志助手"下方新增导航项"会员中心"（`activeTab === 'member'`）。

### 8.2 组件

新增 `src/components/MemberCenter.jsx`，接收 `theme` 与 `vipStatus` props。

### 8.3 布局

1. **状态卡片（顶部）**
   - 套餐徽章：`免费版`（灰）/ `会员版 · 终身`（金，带皇冠图标）。
   - 机器码：等宽字体显示，旁附"复制"按钮。
   - 到期信息：终身版显示"永久有效"；订阅版显示到期日。

2. **激活区（仅非会员显示）**
   - 多行 textarea：粘贴激活码。
   - "立即激活"按钮。
   - 错误提示：区分"激活码无效"（签名错误）、"机器码不匹配"（提示复制正确机器码联系开发者）、"已过期"。

3. **功能对比表（核心转化区）**
   - 双列：基础版 vs 会员版。
   - 6 行对比项，带 ✓ / ✗ 图标与简短说明：
     1. 同时管理设备数量（1 台 / 不限）
     2. 连接历史记录（5 条 / 不限）
     3. AI 自动诊断（✓ / ✓）
     4. AI 深度分析（✗ / ✓）
     5. 自然语言搜索日志（✗ / ✓）
     6. MCP 服务集成（✗ / ✓）

### 8.4 交互与性能

- 激活码校验在后端 main 进程（验签不在渲染进程做，避免公钥/逻辑暴露后简化 patch）。
- 激活成功后立即刷新 `vipStatus`，所有门控点响应式更新（通过状态提升或事件广播）。
- 配色遵循现有深色 `#202124` + 主题色系统；会员徽章使用金色渐变突出。
- 复制机器码使用 `navigator.clipboard`，配合 toast 反馈。

## 9. 状态同步机制

`App.jsx` 持有 `vipStatus` 状态：

- 启动时调用 `window.electronAPI.vipGetStatus()` 初始化。
- 切换到会员中心或激活成功后刷新。
- 通过 props 向 `MemberCenter` / `LogAnalyzer` / 设备列表 / 历史区传递 `vipStatus`（或 `isVip` 派生值）。

preload.cjs 暴露：`vipGetStatus` / `vipGetMachineId` / `vipActivate` / `vipDeactivate`。

## 10. 订阅预留

激活码 payload 已含 `t` 与 `e` 字段：

- 终身版：`t='lifetime', e=null`。
- 订阅版（未来）：`t='subscription', e=<到期秒>`，运行时按当前时间判断过期。
- 数据结构、校验逻辑、UI 展示均无需改动，仅需签发工具支持新参数。

## 11. 文件清单

### 11.1 新增

| 文件 | 作用 | 是否进仓库 |
|------|------|------------|
| `electron/lib/machine-id.cjs` | 机器码采集 | 是 |
| `electron/lib/vip.cjs` | 验签 / 激活 / IPC（内嵌公钥） | 是 |
| `src/components/MemberCenter.jsx` | 会员中心 UI | 是 |
| `tools/license-generator.cjs` | 开发者本地签发激活码 | **否**（.gitignore） |
| `tools/keypair-gen.cjs` | 开发者本地生成 Ed25519 密钥对 | **否**（.gitignore） |
| `tools/private-key.pem` | Ed25519 私钥 | **否**（.gitignore） |

### 11.2 修改

| 文件 | 改动 |
|------|------|
| `package.json` | version `2.1.0` → `3.0.0`（已完成） |
| `src/data/changelogs.js` | 新增 `3.0.0` 条目（已完成） |
| `.gitignore` | 忽略 `tools/`、`*.pem`、`vip-license.cjs`（已完成） |
| `electron/preload.cjs` | 暴露 vip 系列 API |
| `electron/main.cjs` | 注册 vip 模块 IPC |
| `electron/lib/mcp-server.cjs` | 启动入口加入会员校验 |
| `src/App.jsx` | 新增会员中心 tab + 设备/历史门控 + vipStatus 状态 |

## 12. 开发者签发流程（文档化）

1. 首次使用：在本地（**仓库外**）执行
   ```bash
   node tools/keypair-gen.cjs   # 生成 keypair，私钥保存到 tools/private-key.pem
   ```
   将公钥粘贴进 `electron/lib/vip.cjs` 的 `PUBLIC_KEY` 常量。
2. 用户发来机器码（64 位 hex）。
3. 执行：
   ```bash
   node tools/license-generator.cjs --machine <用户机器码> --type lifetime
   ```
   输出激活码字符串。
4. 将激活码发给用户，用户在会员中心粘贴激活。

> `keypair-gen.cjs` 与 `license-generator.cjs` 均在 `tools/`，被 `.gitignore` 忽略；私钥永不进仓库。

## 13. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 用户重装系统/换机导致机器码变化 | 提供"解绑重签"流程：用户凭原激活记录联系开发者重新签发 |
| 用户误删 token 文件 | 重新粘贴原激活码即可恢复（token 可重复激活） |
| 虚拟机硬件序列号缺失 | 四源融合 + 至少 2 源即可生成，兼容虚拟机 |
| 校验逻辑被 patch | v3.0.0 采用多点 fail-closed；未来可加 bytenode 编译加固 |
| 公钥被替换攻击 | 公钥硬编码源码；若担心可结合在线指纹（超出 v3.0.0 范围） |

## 14. 不在本次范围（YAGNI）

- 在线激活 / 支付集成 / 账号系统。
- 订阅制的实际签发（仅预留数据结构）。
- bytenode 编译加固。
- 浮动授权 / 多机授权。
- 激活码吊销列表（离线场景意义有限）。
