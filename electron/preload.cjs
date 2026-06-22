const { contextBridge, ipcRenderer } = require('electron');

// XBH_AI_PATCH_START
// 安全 listener 包装：隔离 callback 异常，避免影响后续 IPC 事件处理
const safeListener = (callback) => (event, ...args) => {
  try {
    callback(...args);
  } catch (e) {
    console.error('[Preload] IPC listener error:', e);
  }
};
// XBH_AI_PATCH_END

contextBridge.exposeInMainWorld('electronAPI', {
  getDevices: () => ipcRenderer.invoke('adb:getDevices'),
  startScrcpy: (deviceId, settings) => ipcRenderer.invoke('scrcpy:start', { deviceId, settings }),
  adbShell: (deviceId, command) => ipcRenderer.invoke('adb:shell', { deviceId, command }),
  adbScreenshot: (deviceId, localPath) => ipcRenderer.invoke('adb:screenshot', { deviceId, localPath }),
  adbScreenRecordStart: (deviceId, remotePath) => ipcRenderer.invoke('adb:screenrecord:start', { deviceId, remotePath }),
  adbScreenRecordStop: (deviceId, localPath) => ipcRenderer.invoke('adb:screenrecord:stop', { deviceId, localPath }),
  adbScreenRecordStatus: (deviceId) => ipcRenderer.invoke('adb:screenrecord:status', { deviceId }),
  adbReboot: (deviceId) => ipcRenderer.invoke('adb:reboot', { deviceId }),
  adbRebootLoader: (deviceId) => ipcRenderer.invoke('adb:rebootLoader', { deviceId }),
  adbRoot: (deviceId) => ipcRenderer.invoke('adb:root', { deviceId }),
  adbRemount: (deviceId) => ipcRenderer.invoke('adb:remount', { deviceId }),
  adbConnect: (ipAddress) => ipcRenderer.invoke('adb:connect', ipAddress),
  adbDisconnect: (deviceId) => ipcRenderer.invoke('adb:disconnect', deviceId),
  adbInstall: (deviceId, apkPath) => ipcRenderer.invoke('adb:install', { deviceId, apkPath }),
  adbPush: (deviceId, localPath, remotePath) => ipcRenderer.invoke('adb:push', { deviceId, localPath, remotePath }),
  adbPull: (deviceId, remotePath, localPath) => ipcRenderer.invoke('adb:pull', { deviceId, remotePath, localPath }),
  adbShellLs: (deviceId, path) => ipcRenderer.invoke('adb:shellLs', { deviceId, path }),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  getDroppedFilePath: (fileName) => ipcRenderer.invoke('dialog:getDroppedFilePath', fileName),
  // XBH_AI_PATCH_START
  onDroppedFile: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('drop:file', listener);
    return () => ipcRenderer.off('drop:file', listener);
  },
  onUpdate: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.off('update-status', listener);
  },
  // XBH_AI_PATCH_END
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  saveCustomThemes: (customThemes) => ipcRenderer.invoke('themes:saveCustomThemes', customThemes),
  loadCustomThemes: () => ipcRenderer.invoke('themes:loadCustomThemes'),
  // XBH_AI_PATCH_START
  // 截图保存路径设置
  saveScreenshotPath: (path) => ipcRenderer.invoke('settings:saveScreenshotPath', path),
  loadScreenshotPath: () => ipcRenderer.invoke('settings:loadScreenshotPath'),
  saveScreenRecordPath: (path) => ipcRenderer.invoke('settings:saveScreenRecordPath', path),
  loadScreenRecordPath: () => ipcRenderer.invoke('settings:loadScreenRecordPath'),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  // XBH_AI_PATCH_START
  // 版本号统一管理：渲染进程获取应用版本
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  // 渲染进程主动查询是否需要显示更新说明（拉取模式）
  checkChangelog: () => ipcRenderer.invoke('app:checkChangelog'),
  // XBH_AI_PATCH_END
  // XBH_AI_PATCH_START
  // 更新说明弹窗：main 进程检测版本升级后主动推送
  onChangelogShow: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('changelog:show', listener);
    return () => ipcRenderer.off('changelog:show', listener);
  },
  // XBH_AI_PATCH_END
  // XBH_AI_PATCH_START
  // 自动更新 API
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getUpdaterStatus: () => ipcRenderer.invoke('updater:status'),
  onUpdaterEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('updater:event', handler);
    return () => ipcRenderer.removeListener('updater:event', handler);
  },
  // XBH_AI_PATCH_END
  openFolder: (path) => ipcRenderer.invoke('shell:openPath', path),
  ensureFolder: (path) => ipcRenderer.invoke('shell:ensureFolder', path),
  // 连接历史记录
  saveConnectionHistory: (entry) => ipcRenderer.invoke('history:save', entry),
  loadConnectionHistory: () => ipcRenderer.invoke('history:load'),
  clearConnectionHistory: () => ipcRenderer.invoke('history:clear'),
  // 终端命令历史记录
  saveTerminalCommand: (command) => ipcRenderer.invoke('terminalHistory:save', command),
  loadTerminalHistory: () => ipcRenderer.invoke('terminalHistory:load'),
  clearTerminalHistory: () => ipcRenderer.invoke('terminalHistory:clear'),
  // XBH_AI_PATCH_START
  // Android Log Analyzer 集成
  adbListDevices: () => ipcRenderer.invoke('adb:listDevices'),
  adbStartLog: (args) => ipcRenderer.invoke('adb:startLog', args),
  adbStopLog: () => ipcRenderer.invoke('adb:stopLog'),
  logOpenFile: () => ipcRenderer.invoke('log:openFile'),
  logClear: (args) => ipcRenderer.invoke('log:clear', args),
  logGetState: () => ipcRenderer.invoke('log:getState'),
  logFilterInMain: (args) => ipcRenderer.invoke('log:filterInMain', args),
  logExportToFile: (args) => ipcRenderer.invoke('log:exportToFile', args),
  onLogReset: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('log:reset', listener);
    return () => ipcRenderer.off('log:reset', listener);
  },
  onLogAppendBatch: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('log:appendBatch', listener);
    return () => ipcRenderer.off('log:appendBatch', listener);
  },
  mcpGetInfo: () => ipcRenderer.invoke('mcp:getInfo'),
  mcpStart: () => ipcRenderer.invoke('mcp:start'),
  mcpStop: () => ipcRenderer.invoke('mcp:stop'),
  logAnalyzerOpen: () => ipcRenderer.invoke('logAnalyzer:open'),
  logAnalyzerClose: () => ipcRenderer.invoke('logAnalyzer:close'),
  logAnalyzerIsAlive: () => ipcRenderer.invoke('logAnalyzer:isAlive'),
  // 推送远程路径历史记录
  savePushRemotePathHistory: (historyList) => ipcRenderer.invoke('settings:savePushRemotePathHistory', historyList),
  loadPushRemotePathHistory: () => ipcRenderer.invoke('settings:loadPushRemotePathHistory'),
  // XBH_AI_PATCH_START
  // AI 日志分析
  aiAnalyzeLog: (args) => ipcRenderer.invoke('ai:analyzeLog', args),
  aiStopAnalyze: () => ipcRenderer.invoke('ai:stopAnalyze'),
  aiClearConversation: () => ipcRenderer.invoke('ai:clearConversation'),
  aiExportResult: (args) => ipcRenderer.invoke('ai:exportResult', args),
  onAiStreamStart: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('ai:streamStart', listener);
    return () => ipcRenderer.off('ai:streamStart', listener);
  },
  onAiStreamChunk: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('ai:streamChunk', listener);
    return () => ipcRenderer.off('ai:streamChunk', listener);
  },
  onAiStreamEnd: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('ai:streamEnd', listener);
    return () => ipcRenderer.off('ai:streamEnd', listener);
  },
  onAiStreamError: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('ai:streamError', listener);
    return () => ipcRenderer.off('ai:streamError', listener);
  },
  // XBH_AI_PATCH_START
  // AI 自动诊断：实时检测崩溃/ANR/OOM 并提示用户
  autoDiagnoseAnalyze: (args) => ipcRenderer.invoke('auto-diagnose:analyze', args),
  autoDiagnoseToggle: (enabled) => ipcRenderer.invoke('auto-diagnose:toggle', { enabled }),
  autoDiagnoseStatus: () => ipcRenderer.invoke('auto-diagnose:status'),
  autoDiagnoseClear: () => ipcRenderer.invoke('auto-diagnose:clear'),
  // XBH_AI_PATCH_START
  // 日志显示区域变更时重新扫描（搜索完成 / 返回原日志）
  autoDiagnoseRescan: (args) => ipcRenderer.invoke('auto-diagnose:rescan', args),
  // XBH_AI_PATCH_END
  onAutoDiagnose: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('auto-diagnose:detected', listener);
    return () => ipcRenderer.off('auto-diagnose:detected', listener);
  },
  // XBH_AI_PATCH_START
  // 扫描完成事件：渲染进程据此从"监控中"切换到"扫描完成（无异常）"状态
  onAutoDiagnoseScanComplete: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('auto-diagnose:scan-complete', listener);
    return () => ipcRenderer.off('auto-diagnose:scan-complete', listener);
  },
  // XBH_AI_PATCH_END
  // XBH_AI_PATCH_START
  // 智能日志搜索
  smartSearch: (args) => ipcRenderer.invoke('smart-search:search', args),
  smartSearchStop: () => ipcRenderer.invoke('smart-search:stop'),
  onSmartSearchStart: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('smart-search:start', listener);
    return () => ipcRenderer.off('smart-search:start', listener);
  },
  onSmartSearchProgress: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('smart-search:progress', listener);
    return () => ipcRenderer.off('smart-search:progress', listener);
  },
  onSmartSearchChunk: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('smart-search:chunk', listener);
    return () => ipcRenderer.off('smart-search:chunk', listener);
  },
  onSmartSearchComplete: (callback) => {
    const listener = safeListener(callback);
    ipcRenderer.on('smart-search:complete', listener);
    return () => ipcRenderer.off('smart-search:complete', listener);
  }
  // XBH_AI_PATCH_END
});
