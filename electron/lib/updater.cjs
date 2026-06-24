// 自动更新集成 - 使用 electron-updater 实现差分增量更新
// 开发模式下不启用自动更新（electron-updater 需要签名后的应用才能工作）
//
// 该模块管理 updaterStatus 状态缓存，并通过 sendUpdaterEvent 将事件转发到渲染进程

const { autoUpdater } = require('electron-updater');
const ctx = require('./app-context.cjs');
const { isDev } = ctx;
const { getAppVersion, compareVersions } = require('./version.cjs');

autoUpdater.autoDownload = false;  // 不自动下载，由用户点击或自动检查逻辑触发
autoUpdater.autoInstallOnAppQuit = true;  // 下载完成后退出应用时自动安装
autoUpdater.logger = console;  // 启用日志，便于排查更新问题

// 自动更新事件状态缓存（供渲染进程查询）
let updaterStatus = {
  checking: false,
  available: false,
  downloading: false,
  progress: null,        // { percent, transferred, total, bytesPerSecond }
  downloaded: false,
  error: null,
  info: null             // { version, releaseNotes, releaseName }
};

// 自动更新事件转发到渲染进程（同时发送到主窗口 + Log Analyzer 窗口）
function sendUpdaterEvent(eventName, payload) {
  const mainWindow = ctx.getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:event', { eventName, payload });
  }
  const logAnalyzerWindow = ctx.getLogAnalyzerWindow();
  if (logAnalyzerWindow && !logAnalyzerWindow.isDestroyed()) {
    logAnalyzerWindow.webContents.send('updater:event', { eventName, payload });
  }
}

// 绑定 autoUpdater 事件（在模块加载时绑定一次，与原 main.cjs 行为一致）
function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    updaterStatus.checking = true;
    updaterStatus.available = false;
    updaterStatus.error = null;
    sendUpdaterEvent('checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    updaterStatus.checking = false;
    updaterStatus.available = true;
    updaterStatus.info = info;
    sendUpdaterEvent('update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    updaterStatus.checking = false;
    updaterStatus.available = false;
    updaterStatus.info = info;
    sendUpdaterEvent('update-not-available', info);
  });

  autoUpdater.on('error', (err) => {
    updaterStatus.checking = false;
    updaterStatus.downloading = false;
    updaterStatus.error = err ? err.message : String(err);
    sendUpdaterEvent('error', updaterStatus.error);
  });

  autoUpdater.on('download-progress', (progress) => {
    updaterStatus.progress = {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    };
    sendUpdaterEvent('download-progress', updaterStatus.progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    updaterStatus.downloading = false;
    updaterStatus.downloaded = true;
    updaterStatus.info = info;
    sendUpdaterEvent('update-downloaded', info);
  });
}

// 在模块加载时立即绑定事件（保持与原 main.cjs 顶层绑定的行为一致）
setupAutoUpdater();

// 自动更新 IPC handlers
// electron-updater 打包后会自动读取 resources/app-update.yml 中的 publish 配置
// 无需手动检测 electron-builder.json（该文件打包后不存在于 asar 中）

function register(ipcMain) {
  // 检查更新（手动触发）
  // 直接使用 checkForUpdates() 返回值判断，不依赖事件监听器
  // 事件仍会触发并通过 sendUpdaterEvent 转发，用于 UI 状态同步
  ipcMain.handle('updater:check', async () => {
    if (isDev) {
      return { success: false, error: '开发模式不支持自动更新，请打包后使用' };
    }
    try {
      console.log('[Updater] 开始检查更新...');
      const result = await autoUpdater.checkForUpdates();
      console.log('[Updater] checkForUpdates 返回:', result ? `有更新 v${result.updateInfo?.version}` : '无更新');
      if (result && result.updateInfo) {
        // 比较版本号：如果服务器版本高于当前版本，则有更新
        const currentVersion = getAppVersion();
        const serverVersion = result.updateInfo.version;
        const hasUpdate = compareVersions(serverVersion, currentVersion) > 0;
        console.log(`[Updater] 当前: ${currentVersion}, 服务器: ${serverVersion}, 有更新: ${hasUpdate}`);
        return {
          success: true,
          available: hasUpdate,
          notAvailable: !hasUpdate,
          info: result.updateInfo
        };
      }
      // result 为 null，表示没有更新
      return { success: true, available: false, notAvailable: true, info: null };
    } catch (err) {
      console.error('[Updater] 检查更新失败:', err);
      return { success: false, error: err.message || String(err) };
    }
  });

  // 下载更新
  ipcMain.handle('updater:download', async () => {
    if (isDev) {
      return { success: false, error: '开发模式不支持自动更新' };
    }
    try {
      console.log('[Updater] 开始下载更新...');
      updaterStatus.downloading = true;
      updaterStatus.downloaded = false;
      await autoUpdater.downloadUpdate();
      console.log('[Updater] 下载完成');
      return { success: true };
    } catch (err) {
      console.error('[Updater] 下载失败:', err);
      updaterStatus.downloading = false;
      return { success: false, error: err.message };
    }
  });

  // 安装更新（退出应用并安装）
  ipcMain.handle('updater:install', async () => {
    if (updaterStatus.downloaded) {
      autoUpdater.quitAndInstall();
      return { success: true };
    }
    return { success: false, error: '更新尚未下载完成' };
  });

  // 获取当前更新状态
  ipcMain.handle('updater:status', async () => {
    return { ...updaterStatus, currentVersion: getAppVersion() };
  });
}

module.exports = { register };
