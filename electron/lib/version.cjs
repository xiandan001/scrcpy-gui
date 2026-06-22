// 版本号管理 + 版本升级检测
// getAppVersion() 统一获取应用版本号
// compareVersions() 语义化版本比较
// checkVersionAndNotifyChangelog() 检测版本升级并设置标志（由渲染进程通过 IPC 查询）
// cleanupPendingUpdater() 清理 OTA 遗留安装包

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// XBH_AI_PATCH_START
// 版本号统一管理：使用 Electron 内置的 app.getVersion()
// 该方法自动读取 package.json 的 version 字段，打包后也能正确获取
// 修改版本号只需改 package.json 一处，其他地方自动同步
let APP_VERSION = null;
function getAppVersion() {
  if (!APP_VERSION) {
    try {
      APP_VERSION = app.getVersion();
    } catch (e) {
      APP_VERSION = require('../../package.json').version;
    }
  }
  return APP_VERSION;
}
// XBH_AI_PATCH_END

// 简单的语义化版本比较：v1 > v2 返回 1，v1 < v2 返回 -1，相等返回 0
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = v2.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

// XBH_AI_PATCH_START
// 清理 OTA 更新遗留的安装包
// electron-updater 下载的安装包默认存放在 userData/pending 目录
// 安装完成后该文件不会被自动删除，需手动清理以释放磁盘空间
function cleanupPendingUpdater() {
  try {
    const userDataPath = app.getPath('userData');
    const pendingDir = path.join(userDataPath, 'pending');
    if (fs.existsSync(pendingDir)) {
      const files = fs.readdirSync(pendingDir);
      for (const file of files) {
        const filePath = path.join(pendingDir, file);
        fs.unlinkSync(filePath);
        console.log(`[Updater] 已清理遗留安装包: ${file}`);
      }
    }
  } catch (err) {
    console.warn('[Updater] 清理安装包失败:', err.message);
  }
}

// 检测版本升级并设置标志（渲染进程通过 IPC 主动查询）
// 在 userData 目录中存储 last-version.txt，对比当前版本判断是否需要显示更新说明
let pendingChangelog = { needsShow: false, version: null };
function checkVersionAndNotifyChangelog() {
  try {
    const currentVersion = getAppVersion();
    const userDataPath = app.getPath('userData');
    const versionFile = path.join(userDataPath, 'last-version.txt');
    let lastVersion = null;
    if (fs.existsSync(versionFile)) {
      lastVersion = fs.readFileSync(versionFile, 'utf-8').trim();
    }
    console.log(`[Version] 当前版本: ${currentVersion}, 上次版本: ${lastVersion}`);
    if (lastVersion !== currentVersion) {
      // 版本不同（含首次安装），设置标志，等待渲染进程查询
      pendingChangelog = { needsShow: true, version: currentVersion };
      console.log(`[Version] 已标记需要显示 v${currentVersion} 更新说明`);
    }
    // 更新存储的版本号
    fs.writeFileSync(versionFile, currentVersion, 'utf-8');
  } catch (err) {
    console.warn('[Version] 版本检测失败:', err.message);
  }
}

// 渲染进程主动查询后清除标志
function consumePendingChangelog() {
  const result = { ...pendingChangelog };
  pendingChangelog = { needsShow: false, version: null };
  return result;
}
// XBH_AI_PATCH_END

// 注册版本相关 IPC handler
function register(ipcMain) {
  // XBH_AI_PATCH_START
  // 版本号统一管理：渲染进程通过此 IPC 获取应用版本
  ipcMain.handle('app:getVersion', async () => {
    return getAppVersion();
  });
  // 渲染进程主动查询是否需要显示更新说明（拉取模式，避免事件丢失）
  ipcMain.handle('app:checkChangelog', async () => {
    return consumePendingChangelog();
  });
  // XBH_AI_PATCH_END

  // 其他模块也会用到的辅助 IPC
  ipcMain.handle('app:getDocumentsPath', async () => {
    try {
      const documentsPath = app.getPath('documents');
      return { success: true, path: documentsPath };
    } catch (error) {
      console.error('Failed to get documents path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app:getUserDataPath', async () => {
    try {
      const userDataPath = app.getPath('userData');
      return { success: true, path: userDataPath };
    } catch (error) {
      console.error('Failed to get userData path:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  getAppVersion,
  compareVersions,
  cleanupPendingUpdater,
  checkVersionAndNotifyChangelog,
  consumePendingChangelog,
  register,
};
