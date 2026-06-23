// XBH_AI_PATCH_START
// 版本更新说明（changelog）- 每次发版时在这里添加对应版本的更新内容
// 格式：{ title, date, items: [{ type: 'feature'|'fix'|'improve', text }] }
// type 对应不同颜色标签：feature(绿色新增) fix(红色修复) improve(蓝色优化)
const CHANGELOGS = {
  '2.0.0': {
    title: 'v2.0.0 重大更新',
    date: '2026-06-18',
    items: [
      { type: 'feature', text: 'AI 日志助手：支持自然语言智能搜索、自动诊断异常、多缓冲区日志抓取' },
      { type: 'feature', text: 'MCP 服务集成：支持 Trae / Claude / Codex 等 AI 客户端调用日志分析工具' },
      { type: 'feature', text: 'OTA 自动更新：支持差分增量更新，无需重复下载完整安装包' },
      { type: 'feature', text: '终端全屏模式：Ctrl+滚轮缩放字体，结构化输出排版' },
      { type: 'improve', text: '全新深色系配色方案（#202124），统一边框/阴影/点击反馈' },
      { type: 'improve', text: '版本号统一管理，修改 package.json 一处即可同步全局' },
      { type: 'fix', text: '修复自动诊断状态丢失、智能搜索事件污染等多个问题' }
    ]
  },
  '2.0.1': {
    title: 'v2.0.1',
    date: '2026-06-18',
    items: [
      { type: 'fix', text: '修复部分错误' }
    ]
  },
  '2.0.2': {
    title: 'v2.0.2',
    date: '2026-06-18',
    items: [
      { type: 'fix', text: '修复部分错误' }
    ]
  },
  '2.0.3': {
    title: 'v2.0.3',
    date: '2026-06-18',
    items: [
      { type: 'improve', text: '优化用户体验' }
    ]
  },
  '2.0.4': {
    title: 'v2.0.4',
    date: '2026-06-18',
    items: [
      { type: 'feature', text: '新增侧边栏快捷安装更新入口，更新下载完成后左下角提示一键安装重启' }
    ]
  },
  '2.0.5': {
    title: 'v2.0.5',
    date: '2026-06-22',
    items: [
      { type: 'fix', text: '修复部分错误' },
      { type: 'improve', text: '优化用户体验' }
    ]
  },
  '2.0.6': {
    title: 'v2.0.6',
    date: '2026-06-22',
    items: [
      { type: 'fix', text: '修复更新说明弹窗未弹出的问题' },
      { type: 'fix', text: '修复检查更新未提示"当前已是最新版本"的问题' },
      { type: 'feature', text: '开启自动更新后，检测到新版本将自动下载并在左下角显示安装入口' }
    ]
  },
  '2.0.7': {
    title: 'v2.0.7',
    date: '2026-06-22',
    items: [
      { type: 'fix', text: '修复部分错误' },
      { type: 'improve', text: '优化用户体验' }
    ]
  },
  '2.0.8': {
    title: 'v2.0.8',
    date: '2026-06-22',
    items: [
      { type: 'fix', text: '修复更新说明弹窗未弹出的问题（改用拉取模式，渲染进程主动查询）' },
      { type: 'fix', text: '修复检查更新未提示"当前已是最新版本"的问题（直接使用 checkForUpdates 返回值）' },
      { type: 'fix', text: '修复自动更新下载后左下角安装入口未显示的问题（增强下载链路日志）' },
      { type: 'improve', text: '优化版本号语义比较，避免误判' }
    ]
  },
  '2.0.9': {
    title: 'v2.0.9',
    date: '2026-06-22',
    items: [
      { type: 'fix', text: '修复更新说明弹窗未弹出的问题（弹窗原在设置页条件块内，现移至组件顶层）' },
      { type: 'fix', text: '修复检查更新误显示"发现新版本"的问题（事件回调中加入版本号校验，防止事件覆盖）' },
      { type: 'fix', text: '修复自动下载链路状态同步问题，增强下载失败错误处理' }
    ]
  },
  '2.0.10': {
    title: 'v2.0.10',
    date: '2026-06-22',
    items: [
      { type: 'fix', text: '修复更新说明弹窗未弹出的问题（main 进程先设置标志再创建窗口，并增加 localStorage fallback）' },
      { type: 'fix', text: '修复检查更新后无提示的问题（检查状态由 IPC 返回值直接管理，避免事件覆盖）' },
      { type: 'fix', text: '修复自动检查更新完成后不显示"当前已是最新版本"的问题' }
    ]
  },
  '2.0.11': {
    title: 'v2.0.11',
    date: '2026-06-22',
    items: [
      { type: 'fix', text: '修复部分错误' },
      { type: 'improve', text: '优化用户体验' }
    ]
  },
  '2.0.12': {
    title: 'v2.0.12',
    date: '2026-06-22',
    items: [
      { type: 'fix', text: '修复部分错误' },
      { type: 'improve', text: '优化用户体验' }
    ]
  },
  '2.0.13': {
    title: 'v2.0.13',
    date: '2026-06-22',
    items: [
      { type: 'fix', text: '修复部分错误' },
      { type: 'improve', text: '优化用户体验' }
    ]
  },
  '2.1.0': {
    title: 'v2.1.0 架构升级',
    date: '2026-06-22',
    items: [
      { type: 'improve', text: '架构重构：后端 main.cjs 按领域拆分为 14 个独立模块，前端 App.jsx 拆分为 data/hooks/components，大幅提升可维护性' },
      { type: 'improve', text: '代码解耦：主题配置、更新日志、设备管理、ADB 操作、APK 管理、终端逻辑分离为独立模块' }
    ]
  },
  '3.0.0': {
    title: 'v3.0.0 会员体系',
    date: '2026-06-22',
    items: [
      { type: 'feature', text: '新增会员中心：基础版 / 会员版双档位，Ed25519 离线签名激活码激活' },
      { type: 'feature', text: '机器码绑定激活（CPU+主板+磁盘+MachineGuid 四源融合），防伪造防分享' },
      { type: 'feature', text: '基础版限额：设备列表最多 1 台、连接历史最多 5 条、仅保留自动诊断' },
      { type: 'feature', text: '会员版解锁：不限设备/历史、AI 分析、自然语言搜索、MCP 服务' },
      { type: 'improve', text: '多点 fail-closed 校验，永不信任单独布尔标志，提升防破解强度' }
    ]
  },
  '3.0.1': {
    title: 'v3.0.1',
    date: '2026-06-22',
    items: [
      { type: 'fix', text: '修复已激活会员仍显示"完成支付后解锁机器码"的问题' },
      { type: 'improve', text: '会员状态异步加载时自动同步机器码解锁状态' }
    ]
  }
};

function getChangelog(version) {
  return CHANGELOGS[version] || null;
}

// 语义化版本比较：v1 > v2 返回 1，v1 < v2 返回 -1，相等返回 0
function compareVersions(v1, v2) {
  const parts1 = String(v1 || '').split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = String(v2 || '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}
// XBH_AI_PATCH_END

export { CHANGELOGS, getChangelog, compareVersions };
