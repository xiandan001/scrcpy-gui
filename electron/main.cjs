// XBH_AI_PATCH
// 瘦入口：app 生命周期 + createWindow + 注册所有领域模块
// 各领域逻辑已拆分到 electron/lib/ 下的模块中

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const ctx = require('./lib/app-context.cjs');
const { isDev } = ctx;

const version = require('./lib/version.cjs');
const updater = require('./lib/updater.cjs');
const adb = require('./lib/adb.cjs');
const window = require('./lib/window.cjs');
const settings = require('./lib/settings.cjs');
const history = require('./lib/history.cjs');
const logAnalyzer = require('./lib/log-analyzer.cjs');
const mcp = require('./lib/mcp-server.cjs');
const autoDiagnose = require('./lib/auto-diagnose.cjs');
const aiAnalyze = require('./lib/ai-analyze.cjs');
const smartSearch = require('./lib/smart-search.cjs');
const vip = require('./lib/vip.cjs');
// $XBH_AI_PATCH_START
// 设备巡检报告与证据包导出 IPC 模块
const inspection = require('./lib/inspection.cjs');
// $XBH_AI_PATCH_END

// XBH_AI_PATCH_START
// 单实例锁定 - 确保只有一个应用实例在运行
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance is already running. Quitting...');
  app.quit();
} else {
  // 当第二个实例尝试启动时，聚焦到第一个实例的窗口
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('Second instance tried to launch');
    const mainWindow = ctx.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}
// XBH_AI_PATCH_END

// 主窗口创建（Log Analyzer 窗口的创建由 log-analyzer 模块负责）
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Prevent navigation
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  ctx.setMainWindow(mainWindow);
}

app.whenReady().then(() => {
  // XBH_AI_PATCH_START
  // 检测版本升级：必须在 createWindow() 之前执行。
  // 因为 createWindow() 会立即加载页面，渲染进程会马上调用 app:checkChangelog
  // 查询 pendingChangelog；如果此时还没设置标志位，弹窗就会丢失。
  version.cleanupPendingUpdater();
  version.checkVersionAndNotifyChangelog();
  // XBH_AI_PATCH_END

  // 注册所有领域模块的 IPC handlers
  // 顺序无依赖（每个模块独立注册自己的 ipcMain.handle/on）
  version.register(ipcMain);
  updater.register(ipcMain);
  adb.register(ipcMain);
  window.register(ipcMain);
  settings.register(ipcMain);
  history.register(ipcMain);
  logAnalyzer.register(ipcMain);
  mcp.register(ipcMain);
  autoDiagnose.register(ipcMain);
  aiAnalyze.register(ipcMain);
  smartSearch.register(ipcMain);
  vip.register(ipcMain);
  // $XBH_AI_PATCH_START
  // 注册设备巡检报告与证据包导出模块
  inspection.register(ipcMain);
  // $XBH_AI_PATCH_END

  // XBH_AI_PATCH: 启动时异步预采集机器码（不阻塞窗口创建和 IPC）
  vip.preload();

  createWindow();
  mcp.initMcpServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// XBH_AI_PATCH_START
app.on('before-quit', async (event) => {
  // 清理 AI 相关资源
  aiAnalyze.resetAiState();
  // XBH_AI_PATCH: 关闭 MCP HTTP server，避免端口占用/进程残留导致 OTA 安装器提示应用未关闭
  mcp.closeMcpServer();
  // 关闭 Log Analyzer 窗口（如有）
  const logWin = ctx.getLogAnalyzerWindow();
  if (logWin && !logWin.isDestroyed()) {
    logWin.destroy();
  }
  // 停止所有录屏进程（如果有）
  if (adb.hasActiveScreenRecords()) {
    event.preventDefault();
    await adb.stopAllScreenRecords();
    app.quit();
  }
});
// XBH_AI_PATCH_END

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
