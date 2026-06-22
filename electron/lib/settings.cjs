// 设置存储 IPC handlers
// 持久化用户设置：自定义主题、截图保存路径、录屏保存路径、推送远程路径历史

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function register(ipcMain) {
  // Custom themes persistence
  ipcMain.handle('themes:saveCustomThemes', async (event, customThemes) => {
    try {
      const userDataPath = app.getPath('userData');
      const themesFilePath = path.join(userDataPath, 'customThemes.json');
      fs.writeFileSync(themesFilePath, JSON.stringify(customThemes, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to save custom themes:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('themes:loadCustomThemes', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const themesFilePath = path.join(userDataPath, 'customThemes.json');
      if (fs.existsSync(themesFilePath)) {
        const data = fs.readFileSync(themesFilePath, 'utf-8');
        return { success: true, data: JSON.parse(data) };
      }
      return { success: true, data: [] };
    } catch (error) {
      console.error('Failed to load custom themes:', error);
      return { success: false, error: error.message, data: [] };
    }
  });

  // XBH_AI_PATCH_START
  // 截图保存路径设置持久化
  ipcMain.handle('settings:saveScreenshotPath', async (event, screenshotPath) => {
    try {
      const userDataPath = app.getPath('userData');
      const settingsFilePath = path.join(userDataPath, 'settings.json');
      let settings = {};
      if (fs.existsSync(settingsFilePath)) {
        const data = fs.readFileSync(settingsFilePath, 'utf-8');
        settings = JSON.parse(data);
      }
      settings.screenshotPath = screenshotPath;
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to save screenshot path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:loadScreenshotPath', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const settingsFilePath = path.join(userDataPath, 'settings.json');
      if (fs.existsSync(settingsFilePath)) {
        const data = fs.readFileSync(settingsFilePath, 'utf-8');
        const settings = JSON.parse(data);
        return { success: true, data: settings.screenshotPath || null };
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Failed to load screenshot path:', error);
      return { success: false, error: error.message, data: null };
    }
  });

  // XBH_AI_PATCH_START
  // 录屏保存路径设置持久化（与截图路径区分）
  ipcMain.handle('settings:saveScreenRecordPath', async (event, screenRecordPath) => {
    try {
      const userDataPath = app.getPath('userData');
      const settingsFilePath = path.join(userDataPath, 'settings.json');
      let settings = {};
      if (fs.existsSync(settingsFilePath)) {
        const data = fs.readFileSync(settingsFilePath, 'utf-8');
        settings = JSON.parse(data);
      }
      settings.screenRecordPath = screenRecordPath;
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to save screenrecord path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:loadScreenRecordPath', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const settingsFilePath = path.join(userDataPath, 'settings.json');
      if (fs.existsSync(settingsFilePath)) {
        const data = fs.readFileSync(settingsFilePath, 'utf-8');
        const settings = JSON.parse(data);
        return { success: true, data: settings.screenRecordPath || null };
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Failed to load screenrecord path:', error);
      return { success: false, error: error.message, data: null };
    }
  });
  // XBH_AI_PATCH_END

  // XBH_AI_PATCH_START
  // 推送远程路径历史记录持久化
  ipcMain.handle('settings:savePushRemotePathHistory', async (event, historyList) => {
    try {
      const userDataPath = app.getPath('userData');
      const settingsFilePath = path.join(userDataPath, 'settings.json');
      let settings = {};
      if (fs.existsSync(settingsFilePath)) {
        const data = fs.readFileSync(settingsFilePath, 'utf-8');
        settings = JSON.parse(data);
      }
      settings.pushRemotePathHistory = historyList;
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to save push remote path history:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:loadPushRemotePathHistory', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const settingsFilePath = path.join(userDataPath, 'settings.json');
      if (fs.existsSync(settingsFilePath)) {
        const data = fs.readFileSync(settingsFilePath, 'utf-8');
        const settings = JSON.parse(data);
        return { success: true, data: settings.pushRemotePathHistory || [] };
      }
      return { success: true, data: [] };
    } catch (error) {
      console.error('Failed to load push remote path history:', error);
      return { success: false, error: error.message, data: [] };
    }
  });
  // XBH_AI_PATCH_END
}

module.exports = { register };
