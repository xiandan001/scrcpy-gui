// ADB / scrcpy 操作 IPC handlers
// 该模块管理 screenRecordProcs（只在内部使用），并提供 stopAllScreenRecords 供 before-quit 调用

const { exec, spawn } = require('child_process');
const { runCommand, checkCommandExists, findScrcpyPath } = require('./commands.cjs');

// XBH_AI_PATCH_START
// ScreenRecord: Android native screen recording via adb shell screenrecord
const screenRecordProcs = new Map();

// XBH_AI_PATCH_START
// 应用退出时自动停止所有录屏进程
async function stopAllScreenRecords() {
  if (screenRecordProcs.size === 0) return;
  console.log(`[ScreenRecord] Stopping ${screenRecordProcs.size} recording(s) before quit...`);
  const promises = [];
  for (const [deviceId, proc] of screenRecordProcs) {
    promises.push(new Promise((resolve) => {
      try {
        proc.kill('SIGTERM');
      } catch (e) {
        console.error(`[ScreenRecord] Failed to kill process for ${deviceId}:`, e.message);
      }
      // 尝试通过 adb 停止设备端的 screenrecord 进程
      exec(`adb -s ${deviceId} shell pkill -l 2 -f screenrecord`, { windowsHide: true }, () => {
        screenRecordProcs.delete(deviceId);
        resolve();
      });
    }));
  }
  await Promise.all(promises);
  console.log('[ScreenRecord] All recordings stopped.');
}

// 判断是否有正在进行的录屏（供 before-quit 决定是否 preventDefault）
function hasActiveScreenRecords() {
  return screenRecordProcs.size > 0;
}

function register(ipcMain) {
  // IPC Handlers for ADB
  ipcMain.handle('adb:getDevices', async () => {
    try {
      const adbExists = await checkCommandExists('adb');
      if (!adbExists) {
        throw new Error('ADB 未安装或未添加到 PATH。请确保 Android SDK platform-tools 已安装并配置。');
      }
      const output = await runCommand('adb devices');
      const lines = output.split('\n');
      const devices = [];

      // Skip the first line "List of devices attached"
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            devices.push({
              id: parts[0],
              status: parts[1] // 'device', 'offline', 'unauthorized'
            });
          }
        }
      }

      // Fetch device models
      for (let device of devices) {
        if (device.status === 'device') {
          try {
            const model = await runCommand(`adb -s ${device.id} shell getprop ro.product.model`);
            device.model = model;
          } catch (e) {
            device.model = 'Unknown Device';
          }
        } else {
          device.model = 'Unauthorized / Offline';
        }
      }

      return devices;
    } catch (error) {
      console.error('ADB error:', error);
      throw new Error('ADB is not installed or not running.');
    }
  });

  ipcMain.handle('scrcpy:start', async (event, { deviceId, settings }) => {
    return new Promise(async (resolve, reject) => {
      try {
        const scrcpyPath = await findScrcpyPath();
        if (!scrcpyPath) {
          reject(new Error('Scrcpy 未安装或未添加到 PATH。请安装 Scrcpy 并确保在命令行中可用。\n\n安装方法：\n1. Windows: winget install scrcpy 或从 https://github.com/Genymobile/scrcpy/releases 下载\n2. 确保 scrcpy.exe 所在目录已添加到系统 PATH'));
          return;
        }

        const args = ['-s', deviceId, '--window-title', `Scrcpy - ${deviceId}`];

        if (settings) {
          if (settings.screenOff) {
            args.push('--turn-screen-off');
          }
          if (settings.stayAwake) {
            args.push('--stay-awake');
          }
          if (settings.bitrate && settings.bitrate !== '0') {
            const bitrateValue = settings.bitrate.replace(' Mbps', 'M');
            args.push('--video-bit-rate', bitrateValue);
          }
          if (settings.maxSize && settings.maxSize !== '0') {
            args.push('--max-size', settings.maxSize);
          }
        }

        console.log(`Starting scrcpy with device: ${deviceId}, args: ${args.join(' ')}`);

        const scrcpyProcess = spawn('scrcpy', args, {
          detached: true,
          stdio: 'ignore'
        });

        scrcpyProcess.on('error', (error) => {
          console.error('Scrcpy spawn error:', error);
          reject(new Error(`Scrcpy 启动失败: ${error.message}`));
        });

        scrcpyProcess.on('spawn', () => {
          console.log('Scrcpy process spawned successfully');
          resolve({ success: true, message: 'Scrcpy 已启动' });
        });

        setTimeout(() => {
          resolve({ success: true, message: 'Scrcpy 已启动' });
        }, 500);

      } catch (error) {
        console.error('Scrcpy error:', error);
        reject(error);
      }
    });
  });

  // Basic device control handlers
  // XBH_AI_PATCH: 使用 spawn + 参数数组，避免 Windows cmd 解析管道符/重定向符
  // 用户输入的 command（含 |、>、< 等）整体传给 Android shell 执行
  ipcMain.handle('adb:shell', async (event, { deviceId, command }) => {
    try {
      const output = await new Promise((resolve, reject) => {
        const proc = spawn('adb', ['-s', deviceId, 'shell', command], {
          windowsHide: true,
          encoding: 'utf8'
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(stderr.trim() || `Command failed with code ${code}`));
          } else {
            resolve(stdout.trim());
          }
        });
      });
      return { success: true, output };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Screenshot: pull file from device
  ipcMain.handle('adb:screenshot', async (event, { deviceId, localPath }) => {
    try {
      const output = await runCommand(`adb -s ${deviceId} pull /sdcard/screen.png "${localPath}"`);
      return { success: true, output };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('adb:screenrecord:start', async (event, { deviceId, remotePath }) => {
    try {
      if (screenRecordProcs.has(deviceId)) {
        return { success: false, error: '当前设备正在录屏中，请先停止' };
      }
      const p = spawn('adb', ['-s', deviceId, 'shell', 'screenrecord', remotePath || '/sdcard/screenrecord.mp4'], {
        windowsHide: true,
        detached: false
      });
      screenRecordProcs.set(deviceId, p);
      p.on('exit', () => {
        screenRecordProcs.delete(deviceId);
      });
      p.on('error', () => {
        screenRecordProcs.delete(deviceId);
      });
      return { success: true, message: '录屏已开始' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('adb:screenrecord:stop', async (event, { deviceId, localPath }) => {
    try {
      const p = screenRecordProcs.get(deviceId);
      if (p) {
        p.kill();
        screenRecordProcs.delete(deviceId);
      } else {
        await runCommand(`adb -s ${deviceId} shell pkill -l 2 -f screenrecord`).catch(() => {});
      }
      await new Promise(r => setTimeout(r, 800));
      const remotePath = '/sdcard/screenrecord.mp4';
      await runCommand(`adb -s ${deviceId} pull "${remotePath}" "${localPath}"`);
      await runCommand(`adb -s ${deviceId} shell rm -f "${remotePath}"`).catch(() => {});
      return { success: true, message: '录屏已停止并保存', path: localPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('adb:screenrecord:status', async (event, { deviceId }) => {
    return { recording: screenRecordProcs.has(deviceId) };
  });

  // Reboot device
  ipcMain.handle('adb:reboot', async (event, { deviceId }) => {
    try {
      spawn('adb', ['-s', deviceId, 'reboot'], {
        detached: true,
        stdio: 'ignore'
      }).unref();
      return { success: true, message: '设备正在重启' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Reboot to loader mode
  ipcMain.handle('adb:rebootLoader', async (event, { deviceId }) => {
    try {
      spawn('adb', ['-s', deviceId, 'reboot', 'loader'], {
        detached: true,
        stdio: 'ignore'
      }).unref();
      return { success: true, message: '设备正在进入loader模式' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Adb root
  ipcMain.handle('adb:root', async (event, { deviceId }) => {
    try {
      const output = await runCommand(`adb -s ${deviceId} root`);
      if (output.includes('restarting') || output.includes('running as root')) {
        return { success: true, message: output || 'Root 权限获取成功' };
      } else {
        return { success: false, error: output || 'Root 权限获取失败，设备可能不支持或未解锁' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Adb remount
  ipcMain.handle('adb:remount', async (event, { deviceId }) => {
    try {
      const output = await runCommand(`adb -s ${deviceId} remount`);
      if (output.includes('remount') || output.includes('succeeded') || output.includes('success')) {
        return { success: true, message: output || 'Remount 成功' };
      } else {
        return { success: false, error: output || 'Remount 失败，可能需要先执行 root' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Wi-Fi Connection
  ipcMain.handle('adb:connect', async (event, ipAddress) => {
    try {
      const output = await runCommand(`adb connect ${ipAddress}`);
      if (output.includes('connected to') && !output.includes('already connected')) {
        return { success: true, message: output };
      } else if (output.includes('already connected')) {
        return { success: true, message: output };
      } else {
        return { success: false, error: output };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Install APK
  ipcMain.handle('adb:install', async (event, { deviceId, apkPath }) => {
    try {
      const output = await runCommand(`adb -s ${deviceId} install -r -d "${apkPath}"`);
      if (output.includes('Success')) {
        return { success: true, message: '安装成功' };
      } else {
        return { success: false, error: output || '安装失败' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Push APK to device
  ipcMain.handle('adb:push', async (event, { deviceId, localPath, remotePath }) => {
    try {
      const output = await runCommand(`adb -s ${deviceId} push "${localPath}" "${remotePath}"`);
      if (output.includes('pushed') || output.includes('pushing')) {
        return { success: true, message: '推送成功' };
      } else {
        return { success: false, error: output || '推送失败' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Pull file from device
  ipcMain.handle('adb:pull', async (event, { deviceId, remotePath, localPath }) => {
    try {
      const output = await runCommand(`adb -s ${deviceId} pull "${remotePath}" "${localPath}"`);
      if (output.includes('pulled') || output.includes('pulling')) {
        return { success: true, message: `拉取成功！\n设备: ${remotePath}\n本地: ${localPath}` };
      } else if (output.includes('does not exist')) {
        return { success: false, error: '文件不存在' };
      } else {
        return { success: false, error: output || '拉取失败' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // List files on device (for browsing APK paths)
  ipcMain.handle('adb:shellLs', async (event, { deviceId, path }) => {
    try {
      const cleanPath = (p) => {
        if (p === '/' || p === '') return '/';
        const parts = p.split('/').filter(part => part && part !== '.');
        let result = '/' + parts.join('/');
        return result || '/';
      };

      const getParentPath = (p) => {
        if (p === '/' || p === '') return '/';
        const parts = p.split('/').filter(part => part && part !== '.');
        parts.pop();
        return parts.length === 0 ? '/' : '/' + parts.join('/');
      };

      const output = await runCommand(`adb -s ${deviceId} shell ls -la "${path}"`);
      const lines = output.trim().split('\n').filter(line => line.length > 0);
      const items = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(/\s+/);
        if (parts.length < 8) continue;

        const perms = parts[0];
        const size = parts[4];
        const name = parts.slice(7).join(' ');
        const isDir = perms.startsWith('d');
        const isLink = perms.includes('l');

        let itemPath;
        if (name === '.') {
          itemPath = path;
        } else if (name === '..') {
          itemPath = getParentPath(path);
        } else {
          itemPath = path === '/' ? `/${name}` : `${path}/${name}`;
        }

        items.push({
          name,
          isDirectory: name === '..' || name === '.' ? true : isDir,
          isLink,
          size: isDir ? null : size,
          path: itemPath
        });
      }

      return { success: true, items, currentPath: path };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Disconnect Device
  ipcMain.handle('adb:disconnect', async (event, deviceId) => {
    try {
      const output = await runCommand(`adb disconnect ${deviceId}`);
      return { success: true, message: output };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  // XBH_AI_PATCH_END

  // XBH_AI_PATCH_START
  // 定期清理 screenRecordProcs 中已退出的进程，防止 Map 累积僵尸条目
  // 每 60 秒遍历一次，检查 p.killed || p.exitCode !== null
  setInterval(() => {
    if (screenRecordProcs.size === 0) return;
    for (const [devId, p] of screenRecordProcs) {
      if (p.killed || p.exitCode !== null) {
        console.log(`[ScreenRecord] 定期清理：设备 ${devId} 的录屏进程已退出，从 Map 中删除`);
        screenRecordProcs.delete(devId);
      }
    }
  }, 60000).unref();
  // XBH_AI_PATCH_END
}

module.exports = {
  register,
  stopAllScreenRecords,
  hasActiveScreenRecords,
};
