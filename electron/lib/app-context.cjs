// XBH_AI_PATCH
// 共享上下文单例：集中管理跨模块共享的全局状态（窗口引用、isDev、广播工具）
// CommonJS 模块缓存机制保证整个应用内 require 的都是同一实例

// isDev 在模块加载时计算并缓存
const isDev = process.env.NODE_ENV === 'development';

// 共享可变状态：在 createWindow / createLogAnalyzerWindow 时通过 setter 注入
const state = {
  mainWindow: null,
  logAnalyzerWindow: null,
};

function setMainWindow(win) { state.mainWindow = win; }
function setLogAnalyzerWindow(win) { state.logAnalyzerWindow = win; }
function getMainWindow() { return state.mainWindow; }
function getLogAnalyzerWindow() { return state.logAnalyzerWindow; }

// 广播到所有窗口（主窗口 + Log Analyzer 窗口）
function broadcastToAllWindows(channel, payload) {
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send(channel, payload);
  }
  if (state.logAnalyzerWindow && !state.logAnalyzerWindow.isDestroyed()) {
    state.logAnalyzerWindow.webContents.send(channel, payload);
  }
}

module.exports = {
  state,
  isDev,
  setMainWindow,
  setLogAnalyzerWindow,
  getMainWindow,
  getLogAnalyzerWindow,
  broadcastToAllWindows,
};
