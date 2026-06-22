import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Smartphone, Settings, Camera, Volume2, VolumeX, RotateCcw, Wifi, Unplug, Loader, Loader2, Shield, Save, Play, Pencil, FolderOpen, Download, Upload, Folder, File, ChevronRight, ArrowLeft, Package, Copy, Terminal, X, Send, Palette, History, FileText, Video, Maximize2, Minimize2, ScrollText, Bot, DownloadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import './index.css';

const themes = {
  default: {
    name: '简约默认',
    preview: 'bg-slate-50 border-slate-200',
    primary: 'emerald',
    card: 'bg-white border-slate-200',
    header: 'bg-white border-b border-slate-200',
    button: {
      primary: 'bg-emerald-500 hover:bg-emerald-600 text-white',
      secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
      outline: 'border border-slate-200 hover:border-emerald-400 text-slate-700'
    },
    text: 'text-slate-700',
    textMuted: 'text-slate-400',
    input: 'border-slate-200 bg-white',
      terminal: {
        bg: 'bg-[#202124]',
        output: 'bg-[#0D0E10]',
        text: 'text-[#E8EAED]',
        accent: 'text-emerald-400'
      }
  },
  cute: {
    name: '可爱甜心',
    preview: 'bg-pink-50 border-pink-200',
    primary: 'pink',
    card: 'bg-white border-pink-100',
    header: 'bg-gradient-to-r from-pink-100 to-rose-50 border-b border-pink-200',
    button: {
      primary: 'bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white shadow-lg shadow-pink-200',
      secondary: 'bg-pink-50 hover:bg-pink-100 text-pink-600 border border-pink-200',
      outline: 'border border-pink-200 hover:border-pink-400 text-pink-600'
    },
    text: 'text-pink-700',
    textMuted: 'text-pink-400',
    input: 'border-pink-200 bg-pink-50/50',
    terminal: {
      bg: 'bg-gradient-to-br from-pink-900 to-rose-900',
      output: 'bg-pink-950/50',
      text: 'text-pink-100',
      accent: 'text-rose-300'
    }
  },
  tech: {
    name: '科技未来',
    preview: 'bg-[#202124] border-[#3E4145]',
    primary: 'cyan',
    card: 'bg-slate-800/80 border-[#3E4145]',
    header: 'bg-[#202124]/90 border-b border-[#3E4145] backdrop-blur',
    button: {
      primary: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg shadow-cyan-500/30',
      secondary: 'bg-[#3E4145] hover:bg-slate-600 text-cyan-300 border border-[#5F6368]',
      outline: 'border border-cyan-500/50 hover:border-cyan-400 text-cyan-400'
    },
    text: 'text-[#E8EAED]',
    textMuted: 'text-slate-400',
    input: 'border-[#5F6368] bg-[#2D2F33] text-[#E8EAED]',
    terminal: {
      bg: 'bg-black',
      output: 'bg-[#0D0E10]',
      text: 'text-cyan-300',
      accent: 'text-cyan-400'
    }
  },
  ocean: {
    name: '清新海洋',
    preview: 'bg-gradient-to-br from-blue-50 to-teal-50 border-blue-200',
    primary: 'blue',
    card: 'bg-white/90 border-blue-100 backdrop-blur',
    header: 'bg-gradient-to-r from-blue-100 to-teal-50 border-b border-blue-200',
    button: {
      primary: 'bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-400 hover:to-teal-400 text-white shadow-lg shadow-blue-200',
      secondary: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200',
      outline: 'border border-blue-300 hover:border-blue-500 text-blue-600'
    },
    text: 'text-slate-700',
    textMuted: 'text-blue-400',
    input: 'border-blue-200 bg-blue-50/30',
    terminal: {
      bg: 'bg-gradient-to-br from-slate-800 to-slate-900',
      output: 'bg-slate-900/80',
      text: 'text-[#E8EAED]',
      accent: 'text-cyan-400'
    }
  },
  forest: {
    name: '自然森林',
    preview: 'bg-green-50 border-green-200',
    primary: 'green',
    card: 'bg-white border-green-100',
    header: 'bg-gradient-to-r from-green-100 to-emerald-50 border-b border-green-200',
    button: {
      primary: 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white shadow-lg shadow-green-200',
      secondary: 'bg-green-50 hover:bg-green-100 text-green-600 border border-green-200',
      outline: 'border border-green-300 hover:border-green-500 text-green-600'
    },
    text: 'text-slate-700',
    textMuted: 'text-green-500',
    input: 'border-green-200 bg-green-50/30',
    terminal: {
      bg: 'bg-gradient-to-br from-slate-800 to-green-900',
      output: 'bg-slate-900/80',
      text: 'text-green-100',
      accent: 'text-green-400'
    }
  },
  sunset: {
    name: '落日余晖',
    preview: 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200',
    primary: 'orange',
    card: 'bg-white border-orange-100',
    header: 'bg-gradient-to-r from-orange-100 to-amber-50 border-b border-orange-200',
    button: {
      primary: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-200',
      secondary: 'bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200',
      outline: 'border border-orange-300 hover:border-orange-500 text-orange-600'
    },
    text: 'text-slate-700',
    textMuted: 'text-orange-400',
    input: 'border-orange-200 bg-orange-50/30',
    terminal: {
      bg: 'bg-gradient-to-br from-slate-800 to-orange-900',
      output: 'bg-slate-900/80',
      text: 'text-orange-100',
      accent: 'text-amber-400'
    }
  }
};

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
  }
};

function getChangelog(version) {
  return CHANGELOGS[version] || null;
}
// XBH_AI_PATCH_END

function App() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('devices');
  const [wifiIp, setWifiIp] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [scrcpySettings, setScrcpySettings] = useState({
    screenOff: false,
    stayAwake: true,
    bitrate: '8 Mbps',
    maxSize: '0'
  });
  // XBH_AI_PATCH_START
  // Toast 提示状态
  const [toast, setToast] = useState(null);
  const showToast = (message, duration = 5000) => {
    setToast(message);
    setTimeout(() => setToast(null), duration);
  };
  // Confirm 确认框状态
  const [confirmModal, setConfirmModal] = useState(null);
  const showConfirm = (message, onConfirm) => {
    setConfirmModal({ message, onConfirm });
  };
  // 截图保存路径
  const [screenshotPath, setScreenshotPath] = useState('');
  // 录屏保存路径
  const [screenRecordPath, setScreenRecordPath] = useState('');
  const [deviceNames, setDeviceNames] = useState({});
  const [expandedDeviceIds, setExpandedDeviceIds] = useState(new Set());
  const [apkInstallPaths, setApkInstallPaths] = useState({});
  const [apkPushPaths, setApkPushPaths] = useState({});
  const [apkPushRemotePaths, setApkPushRemotePaths] = useState({});
  const [apkBrowserPaths, setApkBrowserPaths] = useState({});
  const [apkBrowserItemsMap, setApkBrowserItemsMap] = useState({});
  const [apkBrowserLoadingMap, setApkBrowserLoadingMap] = useState({});
  const [operationLoading, setOperationLoading] = useState({});
  // XBH_AI_PATCH_START
  // 记住上次文件选择对话框打开的文件夹路径
  const [lastSelectFolder, setLastSelectFolder] = useState('');
  // 推送远程路径历史记录
  const [pushRemotePathHistory, setPushRemotePathHistory] = useState([]);
  // XBH_AI_PATCH_END
  const [currentTheme, setCurrentTheme] = useState('default');
  const [customThemes, setCustomThemes] = useState([]);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null);
  const [newThemeName, setNewThemeName] = useState('');
  // XBH_AI_PATCH_START
  // 自动更新状态
  const [appVersion, setAppVersion] = useState('');
  const [updaterState, setUpdaterState] = useState({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    progress: null,
    error: null,
    info: null
  });
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(() => {
    return localStorage.getItem('autoUpdateEnabled') !== 'false';
  });
  // 更新说明弹窗（版本升级后首次打开时显示）
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogContent, setChangelogContent] = useState(null);
  // XBH_AI_PATCH_END
  const [themeColors, setThemeColors] = useState({
    primary: 'emerald',
    primaryFrom: 'from-emerald-500',
    primaryTo: 'to-emerald-600',
    useGradient: true,
    secondary: 'bg-slate-100',
    secondaryText: 'text-slate-700',
    secondaryBorder: 'border-slate-200',
    bg: 'bg-slate-50',
    card: 'bg-white',
    cardBorder: 'border-slate-200',
    input: 'border-slate-200',
    terminalBg: 'bg-[#202124]',
    terminalOutput: 'bg-[#0D0E10]',
    terminalText: 'text-[#E8EAED]',
    terminalAccent: 'text-emerald-400'
  });
  // XBH_AI_PATCH_START
  // 连接历史记录
  const [connectionHistory, setConnectionHistory] = useState([]);
  // 终端命令历史记录（全局共享）
  const [terminalCommandHistory, setTerminalCommandHistory] = useState([]);

  const allThemes = { ...themes, ...Object.fromEntries(customThemes.map(t => [t.key, t])) };
  const theme = allThemes[currentTheme] || themes.default;

  const saveCustomTheme = () => {
    const themeName = newThemeName.trim() || `自定义${customThemes.length + 1}`;
    const isDarkCard = themeColors.card.includes('slate-800') || themeColors.card.includes('gradient');
    const autoText = isDarkCard ? 'text-[#E8EAED]' : 'text-slate-700';
    const autoTextMuted = isDarkCard ? 'text-slate-400' : 'text-slate-400';
    const customTheme = {
      name: themeName,
      preview: themeColors.card,
      primary: themeColors.primary,
      card: themeColors.card,
      header: `${themeColors.card} ${themeColors.cardBorder} border-b`,
      button: {
        primary: themeColors.useGradient
          ? `bg-gradient-to-r ${themeColors.primaryFrom} ${themeColors.primaryTo} text-white`
          : `bg-${themeColors.primary}-500 text-white`,
        secondary: `${themeColors.secondary} ${themeColors.secondaryText} ${themeColors.secondaryBorder} border`,
        outline: `${themeColors.secondaryBorder} border ${themeColors.secondaryText}`
      },
      text: autoText,
      textMuted: autoTextMuted,
      input: `${themeColors.input} ${themeColors.bg}`,
      terminal: {
        bg: themeColors.terminalBg,
        output: themeColors.terminalOutput,
        text: themeColors.terminalText,
        accent: themeColors.terminalAccent
      },
      isCustom: true
    };

    const customKey = `custom_${Date.now()}`;
    if (editingTheme) {
      setCustomThemes(prev => prev.map(t => t.key === editingTheme.key ? { ...customTheme, key: editingTheme.key } : t));
    } else {
      setCustomThemes(prev => [...prev, { ...customTheme, key: customKey }]);
    }
    setCurrentTheme(editingTheme?.key || customKey);
    setShowThemeEditor(false);
    setEditingTheme(null);
    setNewThemeName('');
  };

  const deleteCustomTheme = (themeKey) => {
    setCustomThemes(prev => prev.filter(t => t.key !== themeKey));
    if (currentTheme === themeKey) {
      setCurrentTheme('default');
    }
  };

  const editCustomTheme = (customTheme) => {
    setEditingTheme(customTheme);
    setNewThemeName(customTheme.name);
    const isGradient = customTheme.button.primary.includes('gradient');
    setThemeColors({
      primary: customTheme.primary,
      primaryFrom: isGradient ? customTheme.button.primary.split(' ')[1] : `from-${customTheme.primary}-500`,
      primaryTo: isGradient ? customTheme.button.primary.split(' ')[2] : `to-${customTheme.primary}-600`,
      useGradient: isGradient,
      secondary: customTheme.button.secondary.split(' ')[0] || 'bg-slate-100',
      secondaryText: customTheme.button.secondary.split(' ')[1] || 'text-slate-700',
      secondaryBorder: customTheme.button.secondary.split(' ')[3] || 'border-slate-200',
      bg: customTheme.header.includes('slate-50') ? 'bg-slate-50' : customTheme.header.includes('pink-50') ? 'bg-pink-50' : customTheme.header.includes('blue-50') ? 'bg-blue-50' : 'bg-slate-50',
      card: customTheme.card,
      cardBorder: customTheme.card.includes('border-') ? customTheme.card.split('border-')[1].split(' ')[0] : 'border-slate-200',
      input: customTheme.input,
      terminalBg: customTheme.terminal.bg,
      terminalOutput: customTheme.terminal.output,
      terminalText: customTheme.terminal.text,
      terminalAccent: customTheme.terminal.accent
    });
    setShowThemeEditor(true);
  };

  const fetchDevices = async () => {
    setLoading(true);
    setError('');
    try {
      if (window.electronAPI) {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('获取设备列表超时，请检查 ADB 是否正常运行')), 10000)
        );
        const devs = await Promise.race([
          window.electronAPI.getDevices(),
          timeoutPromise
        ]);
        setDevices(devs);
      } else {
        // Mock data for browser testing
        setDevices([
          { id: 'emulator-5554', status: 'device', model: 'Pixel 6 Pro' },
          { id: '192.168.1.100:5555', status: 'offline', model: 'Unknown' },
        ]);
      }
    } catch (err) {
      setError(err.message || '获取设备列表失败');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const loadCustomThemes = async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.loadCustomThemes();
        if (result.success && result.data.length > 0) {
          setCustomThemes(result.data);
        }
      }
    };
    loadCustomThemes();
    // XBH_AI_PATCH_START
    // 加载截图保存路径
    const loadScreenshotPath = async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.loadScreenshotPath();
        if (result.success && result.data) {
          setScreenshotPath(result.data);
        }
      }
    };
    loadScreenshotPath();
    // 加载录屏保存路径
    const loadScreenRecordPath = async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.loadScreenRecordPath();
        if (result.success && result.data) {
          setScreenRecordPath(result.data);
        }
      }
    };
    loadScreenRecordPath();
    // XBH_AI_PATCH_END
    // 加载连接历史记录
    const loadConnectionHistory = async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.loadConnectionHistory();
        if (result.success && result.data) {
          setConnectionHistory(result.data);
        }
      }
    };
    loadConnectionHistory();
    // 加载终端命令历史记录
    const loadTerminalCmdHistory = async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.loadTerminalHistory();
        if (result.success && result.data) {
          setTerminalCommandHistory(result.data);
        }
      }
    };
    loadTerminalCmdHistory();
    // 加载推送远程路径历史记录
    const loadPushHistory = async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.loadPushRemotePathHistory();
        if (result.success && result.data) {
          setPushRemotePathHistory(result.data);
        }
      }
    };
    loadPushHistory();
  }, []);

  useEffect(() => {
    const saveThemes = async () => {
      if (window.electronAPI) {
        await window.electronAPI.saveCustomThemes(customThemes);
      }
    };
    saveThemes();
  }, [customThemes]);

  // XBH_AI_PATCH_START
  // 保存截图路径变化时自动保存
  useEffect(() => {
    const saveScreenshotPath = async () => {
      if (window.electronAPI && screenshotPath) {
        await window.electronAPI.saveScreenshotPath(screenshotPath);
      }
    };
    saveScreenshotPath();
  }, [screenshotPath]);
  // 保存录屏路径变化时自动保存
  useEffect(() => {
    const saveScreenRecordPath = async () => {
      if (window.electronAPI && screenRecordPath) {
        await window.electronAPI.saveScreenRecordPath(screenRecordPath);
      }
    };
    saveScreenRecordPath();
  }, [screenRecordPath]);
  // 保存推送远程路径历史变化时自动持久化
  useEffect(() => {
    const savePushHistory = async () => {
      if (window.electronAPI && pushRemotePathHistory.length > 0) {
        await window.electronAPI.savePushRemotePathHistory(pushRemotePathHistory);
      }
    };
    savePushHistory();
  }, [pushRemotePathHistory]);

  // XBH_AI_PATCH_START
  // 获取应用版本号 + 检测版本升级弹出更新说明
  useEffect(() => {
    const fetchVersion = async () => {
      if (window.electronAPI?.getVersion) {
        const v = await window.electronAPI.getVersion();
        setAppVersion(v);
        // XBH_AI_PATCH_START
        // 检测版本升级：对比 localStorage 中存储的上次版本号
        const lastVersion = localStorage.getItem('lastAppVersion');
        if (lastVersion && lastVersion !== v) {
          // 版本不同，说明刚升级完，弹出更新说明
          const changelog = getChangelog(v);
          if (changelog) {
            setChangelogContent({ version: v, ...changelog });
            setShowChangelog(true);
          }
        }
        // 更新存储的版本号
        localStorage.setItem('lastAppVersion', v);
        // XBH_AI_PATCH_END
      }
    };
    fetchVersion();
  }, []);

  // 监听自动更新事件
  useEffect(() => {
    if (!window.electronAPI?.onUpdaterEvent) return;
    const cleanup = window.electronAPI.onUpdaterEvent((data) => {
      const { eventName, payload } = data;
      setUpdaterState(prev => {
        switch (eventName) {
          case 'checking-for-update':
            return { ...prev, checking: true, available: false, error: null };
          case 'update-available':
            return { ...prev, checking: false, available: true, info: payload, error: null };
          case 'update-not-available':
            return { ...prev, checking: false, available: false, info: payload };
          case 'error':
            return { ...prev, checking: false, downloading: false, error: payload };
          case 'download-progress':
            return { ...prev, downloading: true, progress: payload };
          case 'update-downloaded':
            return { ...prev, downloading: false, downloaded: true, info: payload };
          default:
            return prev;
        }
      });
    });
    return cleanup;
  }, []);

  // 自动更新开关变化时持久化 + 启动时自动检查
  useEffect(() => {
    localStorage.setItem('autoUpdateEnabled', autoUpdateEnabled ? 'true' : 'false');
  }, [autoUpdateEnabled]);

  // 应用启动后自动检查更新（仅在开关开启时）
  useEffect(() => {
    if (!autoUpdateEnabled) return;
    if (!window.electronAPI?.checkForUpdates) return;
    const timer = setTimeout(async () => {
      const res = await window.electronAPI.checkForUpdates();
      // 如果服务器未配置或开发模式，静默失败（不弹错误提示，因为是自动检查）
      if (!res?.success) {
        console.log('自动检查更新跳过:', res?.error);
      }
    }, 3000); // 启动 3 秒后检查
    return () => clearTimeout(timer);
  }, []);
  // XBH_AI_PATCH_END

  const handleScreenRecordStart = async (deviceId) => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbScreenRecordStart(deviceId);
        return res;
      }
      return { success: false, error: '录屏功能需要 Electron 环境' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const handleScreenRecordStop = async (deviceId) => {
    try {
      if (window.electronAPI) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let saveDir = screenRecordPath;
        if (!saveDir) {
          const userDataResult = await window.electronAPI.getUserDataPath();
          const baseDir = userDataResult.success ? userDataResult.path : '.';
          saveDir = `${baseDir}/screenrecord`;
        }
        await window.electronAPI.ensureFolder(saveDir);
        const localPath = `${saveDir}/screenrecord-${timestamp}.mp4`;
        const res = await window.electronAPI.adbScreenRecordStop(deviceId, localPath);
        return res;
      }
      return { success: false, error: '录屏功能需要 Electron 环境' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };
  // XBH_AI_PATCH_END

  const handleStartScrcpy = async (deviceId) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.startScrcpy(deviceId, scrcpySettings);
        showToast(`开始投屏 ${deviceId}`);
      } else {
        showToast(`开始投屏 ${deviceId}`);
      }
    } catch (err) {
      showToast(`启动失败: ${err.message}`);
    }
  };

  const handleAdbCommand = async (deviceId, command) => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbShell(deviceId, command);
        if (!res.success) {
          showToast(`命令执行失败: ${res.error}`);
        }
      } else {
        console.log(`发送命令到 ${deviceId}: adb shell ${command}`);
      }
    } catch (err) {
      showToast(`命令执行错误: ${err.message}`);
    }
  };

  const handleExecuteCommand = async (deviceId, command) => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbShell(deviceId, command);
        if (res.success) {
          return res.output || '命令执行成功';
        } else {
          return `命令执行失败: ${res.error}`;
        }
      } else {
        return '终端功能需要 Electron 环境';
      }
    } catch (err) {
      return `命令执行错误: ${err.message}`;
    }
  };

  // XBH_AI_PATCH_START
  // 保存终端命令到全局共享历史记录
  const handleSaveTerminalCommand = async (command) => {
    const trimmedCmd = (command || '').trim();
    if (!trimmedCmd) return;
    setTerminalCommandHistory(prev => {
      const filtered = prev.filter(c => c !== trimmedCmd);
      return [trimmedCmd, ...filtered].slice(0, 100);
    });
    if (window.electronAPI) {
      await window.electronAPI.saveTerminalCommand(trimmedCmd);
    }
  };

  // 清空终端命令历史记录
  const handleClearTerminalHistory = async () => {
    setTerminalCommandHistory([]);
    if (window.electronAPI) {
      await window.electronAPI.clearTerminalHistory();
    }
    showToast('终端命令历史已清除');
  };
  // XBH_AI_PATCH_END

  // XBH_AI_PATCH_START
  const handleScreenshot = async (deviceId) => {
    setOperationLoading(prev => ({ ...prev, [`screenshot_${deviceId}`]: true }));
    try {
      if (window.electronAPI) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let saveDir = screenshotPath;
        if (!saveDir) {
          const userDataResult = await window.electronAPI.getUserDataPath();
          const baseDir = userDataResult.success ? userDataResult.path : '.';
          saveDir = `${baseDir}/screenshot`;
        }
        await window.electronAPI.ensureFolder(saveDir);
        const localPath = `${saveDir}/screenshot-${timestamp}.png`;
        const res = await window.electronAPI.adbShell(deviceId, 'screencap -p /sdcard/screen.png');
        if (res.success) {
          const pullRes = await window.electronAPI.adbScreenshot(deviceId, localPath);
          if (pullRes.success) {
            showToast(`截图已保存: ${localPath}`);
          } else {
            showToast(`截图保存失败: ${pullRes.error}`);
          }
        } else {
          showToast(`截图命令失败: ${res.error}`);
        }
      } else {
        showToast('截图功能需要 Electron 环境');
      }
    } catch (err) {
      showToast(`截图错误: ${err.message}`);
    } finally {
      setOperationLoading(prev => ({ ...prev, [`screenshot_${deviceId}`]: false }));
    }
  };
  // XBH_AI_PATCH_END

  const handleReboot = async (deviceId) => {
    setOperationLoading(prev => ({ ...prev, [`reboot_${deviceId}`]: true }));
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbReboot(deviceId);
        if (res.success) {
          showToast('设备正在重启...');
          setTimeout(() => fetchDevices(), 3000);
        } else {
          showToast(`重启失败: ${res.error}`);
        }
      } else {
        showToast('重启功能需要 Electron 环境');
      }
    } catch (err) {
      showToast(`重启失败: ${err.message}`);
    } finally {
      setOperationLoading(prev => ({ ...prev, [`reboot_${deviceId}`]: false }));
    }
  };

  const handleRebootLoader = async (deviceId) => {
    setOperationLoading(prev => ({ ...prev, [`loader_${deviceId}`]: true }));
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbRebootLoader(deviceId);
        if (res.success) {
          showToast('设备正在进入loader模式...');
          setTimeout(() => fetchDevices(), 3000);
        } else {
          showToast(`进入loader模式失败: ${res.error}`);
        }
      } else {
        showToast('Loader模式需要 Electron 环境');
      }
    } catch (err) {
      showToast(`进入loader模式失败: ${err.message}`);
    } finally {
      setOperationLoading(prev => ({ ...prev, [`loader_${deviceId}`]: false }));
    }
  };

  const handleRoot = async (deviceId) => {
    setOperationLoading(prev => ({ ...prev, [`root_${deviceId}`]: true }));
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbRoot(deviceId);
        if (res.success) {
          showToast(`Root 成功！${res.message}`);
        } else {
          showToast(`Root 失败: ${res.error}`);
        }
      } else {
        showToast('Root 功能需要 Electron 环境');
      }
    } catch (err) {
      showToast(`Root 执行失败: ${err.message}`);
    } finally {
      setOperationLoading(prev => ({ ...prev, [`root_${deviceId}`]: false }));
    }
  };

  const handleRemount = async (deviceId) => {
    setOperationLoading(prev => ({ ...prev, [`remount_${deviceId}`]: true }));
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbRemount(deviceId);
        if (res.success) {
          showToast(`Remount 成功！${res.message}`);
        } else {
          showToast(`Remount 失败: ${res.error}`);
        }
      } else {
        showToast('Remount 功能需要 Electron 环境');
      }
    } catch (err) {
      showToast(`Remount 执行失败: ${err.message}`);
    } finally {
      setOperationLoading(prev => ({ ...prev, [`remount_${deviceId}`]: false }));
    }
  };

  const handleSelectApkFile = async (deviceId, forWhat) => {
    try {
      if (window.electronAPI) {
        const dialogOptions = {
          properties: ['openFile']
        };
        // 安装仅限 APK，推送支持所有文件
        if (forWhat === 'install') {
          dialogOptions.filters = [{ name: 'APK Files', extensions: ['apk'] }];
        } else {
          dialogOptions.filters = [{ name: '所有文件', extensions: ['*'] }];
        }
        // 记住上次打开的文件夹路径
        if (lastSelectFolder) {
          dialogOptions.defaultPath = lastSelectFolder;
        }
        const result = await window.electronAPI.showOpenDialog(dialogOptions);
        if (!result.canceled && result.filePaths.length > 0) {
          // 记录选择的文件所在文件夹
          const selectedPath = result.filePaths[0];
          const folder = selectedPath.substring(0, selectedPath.lastIndexOf('\\') !== -1 ? selectedPath.lastIndexOf('\\') : selectedPath.lastIndexOf('/'));
          setLastSelectFolder(folder);
          if (forWhat === 'install') {
            setApkInstallPaths(prev => ({ ...prev, [deviceId]: selectedPath }));
          } else {
            setApkPushPaths(prev => ({ ...prev, [deviceId]: selectedPath }));
          }
        }
      } else {
        showToast('选择文件功能需要 Electron 环境');
      }
    } catch (err) {
      showToast(`选择文件失败: ${err.message}`);
    }
  };

  const handleInstallApk = async (deviceId) => {
    const apkPath = apkInstallPaths[deviceId];
    if (!apkPath) {
      showToast('请先选择一个 APK 文件');
      return;
    }
    setOperationLoading(prev => ({ ...prev, [`install_${deviceId}`]: true }));
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbInstall(deviceId, apkPath);
        if (res.success) {
          showToast(`安装成功！文件: ${apkPath}`);
        } else {
          showToast(`安装失败: ${res.error}`);
        }
      } else {
        showToast('安装功能需要 Electron 环境');
      }
    } catch (err) {
      showToast(`安装失败: ${err.message}`);
    } finally {
      setOperationLoading(prev => ({ ...prev, [`install_${deviceId}`]: false }));
    }
  };

  const handlePushApk = async (deviceId) => {
    const localPath = apkPushPaths[deviceId];
    const remotePath = apkPushRemotePaths[deviceId] !== undefined ? apkPushRemotePaths[deviceId] : '/sdcard/';
    if (!localPath) {
      showToast('请先选择一个文件');
      return;
    }
    if (!remotePath) {
      showToast('请输入远程路径');
      return;
    }
    setOperationLoading(prev => ({ ...prev, [`push_${deviceId}`]: true }));
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbPush(deviceId, localPath, remotePath);
        if (res.success) {
          showToast(`推送成功！文件: ${localPath} 目标: ${remotePath}`);
          // XBH_AI_PATCH_START
          // 推送成功后将远程路径加入历史记录
          setPushRemotePathHistory(prev => {
            const filtered = prev.filter(p => p !== remotePath);
            return [remotePath, ...filtered].slice(0, 10);
          });
          // XBH_AI_PATCH_END
        } else {
          showToast(`推送失败: ${res.error}`);
        }
      } else {
        showToast('推送功能需要 Electron 环境');
      }
    } catch (err) {
      showToast(`推送失败: ${err.message}`);
    } finally {
      setOperationLoading(prev => ({ ...prev, [`push_${deviceId}`]: false }));
    }
  };

  const handleBrowseApk = async (deviceId, path) => {
    setApkBrowserLoadingMap(prev => ({ ...prev, [deviceId]: true }));
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbShellLs(deviceId, path);
        if (res.success) {
          setApkBrowserPaths(prev => ({ ...prev, [deviceId]: res.currentPath }));
          setApkBrowserItemsMap(prev => ({ ...prev, [deviceId]: res.items }));
        } else {
          showToast(`浏览失败: ${res.error}`);
        }
      } else {
        showToast('浏览功能需要 Electron 环境');
      }
    } catch (err) {
      showToast(`浏览失败: ${err.message}`);
    } finally {
      setApkBrowserLoadingMap(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  const handlePullFile = async (deviceId, remotePath) => {
    try {
      if (window.electronAPI) {
        setOperationLoading(prev => ({ ...prev, [`pull_${deviceId}_${remotePath}`]: true }));
        const fileName = remotePath.split('/').pop() || 'downloaded_file';
        const saveResult = await window.electronAPI.showSaveDialog({
          defaultPath: fileName,
          filters: [{ name: 'All Files', extensions: ['*'] }]
        });

        if (saveResult.canceled || !saveResult.filePath) {
          setOperationLoading(prev => ({ ...prev, [`pull_${deviceId}_${remotePath}`]: false }));
          return;
        }

        const res = await window.electronAPI.adbPull(deviceId, remotePath, saveResult.filePath);
        if (res.success) {
          showToast(res.message);
        } else {
          showToast(`拉取失败: ${res.error}`);
        }
      } else {
        showToast('拉取功能需要 Electron 环境');
      }
    } catch (err) {
      showToast(`拉取失败: ${err.message}`);
    } finally {
      setOperationLoading(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(key => {
          if (key.startsWith(`pull_${deviceId}_`)) {
            newState[key] = false;
          }
        });
        return newState;
      });
    }
  };

  const handleWifiConnect = async (e) => {
    e.preventDefault();
    if (!wifiIp.trim()) return;
    
    setIsConnecting(true);
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbConnect(wifiIp.trim());
        if (res.success) {
          showToast(`连接成功: ${res.message}`);
          setWifiIp('');
          fetchDevices();
          // 保存到历史记录
          await window.electronAPI.saveConnectionHistory({
            deviceId: wifiIp.trim(),
            deviceName: wifiIp.trim(),
            ip: wifiIp.trim(),
            type: 'wifi'
          });
          // 刷新历史记录
          const historyResult = await window.electronAPI.loadConnectionHistory();
          if (historyResult.success) {
            setConnectionHistory(historyResult.data);
          }
        } else {
          showToast(`连接失败: ${res.error}`);
        }
      } else {
        showToast(`模拟 Wi-Fi 连接到: ${wifiIp}`);
        setWifiIp('');
        fetchDevices();
      }
    } catch (err) {
      showToast(`网络请求错误: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (deviceId) => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.adbDisconnect(deviceId);
        if (res.success) {
          fetchDevices();
        } else {
          showToast(`断开连接失败: ${res.error}`);
        }
      } else {
        showToast(`模拟断开设备: ${deviceId}`);
        fetchDevices();
      }
    } catch (err) {
      showToast(`断开请求错误: ${err.message}`);
    }
  };

  const handleDeviceNameChange = (deviceId, newName) => {
    if (newName) {
      setDeviceNames(prev => ({ ...prev, [deviceId]: newName }));
    } else {
      setDeviceNames(prev => {
        const updated = { ...prev };
        delete updated[deviceId];
        return updated;
      });
    }
  };

  const t = theme || themes.default;

  return (
    <div className={`flex h-screen select-none ${t.primary === 'tech' ? 'bg-[#202124] text-[#E8EAED]' : 'bg-slate-50 text-slate-900'}`}>
      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-[#2D2F33] text-white rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}
      {/* Confirm 确认框 */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`p-4 rounded-lg shadow-xl max-w-sm ${t.primary === 'tech' ? 'bg-[#2D2F33]' : 'bg-white'}`}>
            <p className={`mb-4 text-sm ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal(null)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${t.primary === 'tech' ? 'bg-[#3E4145] text-[#E8EAED] hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                取消
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <div className={`w-72 flex flex-col pt-8 bg-[#202124] text-[#E8EAED]`}>
        <div className={`px-6 mb-8 flex items-center space-x-3 ${t.primary === 'cyan' || t.primary === 'blue' ? 'text-cyan-400' : t.primary === 'pink' ? 'text-pink-400' : t.primary === 'green' ? 'text-green-400' : t.primary === 'orange' ? 'text-orange-400' : 'text-emerald-400'}`}>
          <Smartphone size={28} />
          <h1 className="text-xl font-bold tracking-wide">ADB Device Management</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button
            onClick={() => setActiveTab('devices')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'devices' ? `${t.primary === 'cyan' || t.primary === 'blue' ? 'bg-cyan-500/20 text-cyan-400' : t.primary === 'pink' ? 'bg-pink-500/20 text-pink-400' : t.primary === 'green' ? 'bg-green-500/20 text-green-400' : t.primary === 'orange' ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}` : 'hover:bg-[#2D2F33]'}`}
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <Smartphone size={20} />
            <span className="font-medium">设备列表</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'history' ? `${t.primary === 'cyan' || t.primary === 'blue' ? 'bg-cyan-500/20 text-cyan-400' : t.primary === 'pink' ? 'bg-pink-500/20 text-pink-400' : t.primary === 'green' ? 'bg-green-500/20 text-green-400' : t.primary === 'orange' ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}` : 'hover:bg-[#2D2F33]'}`}
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <History size={20} />
            <span className="font-medium">连接历史</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'settings' ? `${t.primary === 'cyan' || t.primary === 'blue' ? 'bg-cyan-500/20 text-cyan-400' : t.primary === 'pink' ? 'bg-pink-500/20 text-pink-400' : t.primary === 'green' ? 'bg-green-500/20 text-green-400' : t.primary === 'orange' ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}` : 'hover:bg-[#2D2F33]'}`}
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <Settings size={20} />
            <span className="font-medium">偏好设置</span>
          </button>
          {/* XBH_AI_PATCH_START Log分析服务 */}
          <button
            onClick={() => {
              if (window.electronAPI && window.electronAPI.logAnalyzerOpen) {
                window.electronAPI.logAnalyzerOpen();
              }
            }}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors hover:bg-[#2D2F33]"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <Bot size={20} />
            <span className="font-medium">AI 日志助手</span>
          </button>
          {/* XBH_AI_PATCH_END */}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col pt-8 h-screen overflow-hidden">
        {/* Header */}
        <header className={`px-8 pb-6 border-b flex justify-between items-center sticky top-0 z-10 ${t.primary === 'tech' ? 'bg-[#202124]/90 border-[#3E4145]' : 'bg-slate-50 border-slate-200'}`}>
          <div>
            <h2 className={`text-2xl font-bold ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-800'}`}>
              {activeTab === 'devices' ? '已连接设备' : activeTab === 'history' ? '连接历史' : '全局设置'}
            </h2>
            <p className={`text-sm mt-1 ${t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#80868B]'}`}>
              {activeTab === 'devices' ? '管理并投屏您的 Android 设备' : activeTab === 'history' ? '查看无线连接历史记录' : '配置 Scrcpy 及 ADB 相关偏好'}
            </p>
          </div>

          {activeTab === 'devices' && (
            <button
              onClick={fetchDevices}
              disabled={loading}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${t.button.primary.split(' ')[0]} ${t.button.primary.split(' ')[1] || ''}`}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              <span>刷新</span>
            </button>
          )}
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
          {error && (
            <div className={`p-4 rounded-lg mb-6 border ${t.primary === 'tech' ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-red-50 text-red-600 border-red-200'}`}>
              {error}
            </div>
          )}

          {activeTab === 'devices' && (
            <>
              {/* Wi-Fi Connect Section */}
              <div className={`mb-8 p-5 rounded-xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 ${t.primary === 'tech' ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
                <div>
                  <h3 className={`text-lg font-semibold flex items-center gap-2 ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-800'}`}>
                    <Wifi size={20} className={t.primary === 'cyan' || t.primary === 'blue' ? 'text-blue-400' : t.primary === 'pink' ? 'text-pink-400' : t.primary === 'green' ? 'text-green-400' : t.primary === 'orange' ? 'text-orange-400' : 'text-emerald-500'} />
                    Wi-Fi 无线连接
                  </h3>
                  <p className={`text-sm mt-1 ${t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#80868B]'}`}>输入设备的 IP 地址和端口 (例如: 192.168.1.100:5555)</p>
                </div>
                <form onSubmit={handleWifiConnect} className="flex w-full sm:w-auto gap-2">
                  <input
                    type="text"
                    value={wifiIp}
                    onChange={(e) => setWifiIp(e.target.value)}
                    placeholder="IP 地址:端口"
                    className={`flex-1 sm:w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all ${t.primary === 'tech' ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED] placeholder-slate-400' : 'bg-slate-50 border-slate-200'}`}
                  />
                  <button
                    type="submit"
                    disabled={isConnecting || !wifiIp.trim()}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${t.button.primary.split(' ')[0]} ${t.button.primary.split(' ')[1] || ''} disabled:opacity-50`}
                  >
                    {isConnecting ? '连接中...' : '连接'}
                  </button>
                </form>
              </div>

              <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
                {devices.length === 0 && !loading && !error ? (
                  <div className={`col-span-full flex flex-col items-center justify-center py-20 ${t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#9AA0A6]'}`}>
                    <Smartphone size={48} className={`mb-4 opacity-50 ${t.primary === 'cyan' || t.primary === 'blue' ? 'text-cyan-400' : t.primary === 'pink' ? 'text-pink-400' : t.primary === 'green' ? 'text-green-400' : t.primary === 'orange' ? 'text-orange-400' : 'text-emerald-400'}`} />
                    <p className="text-lg">未发现设备</p>
                    <p className="text-sm">请确保已开启 USB 调试并连接设备</p>
                  </div>
                ) : (
                  devices.map(device => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      deviceName={deviceNames[device.id]}
                      onNameChange={handleDeviceNameChange}
                      onStart={() => handleStartScrcpy(device.id)}
                      onCommand={(cmd) => handleAdbCommand(device.id, cmd)}
                      onScreenshot={() => handleScreenshot(device.id)}
                      onScreenRecordStart={(deviceId) => handleScreenRecordStart(deviceId)}
                      onScreenRecordStop={(deviceId) => handleScreenRecordStop(deviceId)}
                      onReboot={() => handleReboot(device.id)}
                      onRebootLoader={() => handleRebootLoader(device.id)}
                      onRoot={() => handleRoot(device.id)}
                      onRemount={() => handleRemount(device.id)}
                      onDisconnect={() => handleDisconnect(device.id)}
                      showApkManager={expandedDeviceIds.has(device.id)}
                      onApkManager={() => {
                        setExpandedDeviceIds(prev => {
                          const next = new Set(prev);
                          if (next.has(device.id)) {
                            next.delete(device.id);
                          } else {
                            next.add(device.id);
                          }
                          return next;
                        });
                      }}
                      onSelectApkForInstall={() => handleSelectApkFile(device.id, 'install')}
                      onSelectApkForPush={() => handleSelectApkFile(device.id, 'push')}
                      onInstallApk={() => handleInstallApk(device.id)}
                      onPushApk={() => handlePushApk(device.id)}
                      onBrowsePath={(path) => handleBrowseApk(device.id, path)}
                      onPullFile={(path) => handlePullFile(device.id, path)}
                      onPushPathChange={(path) => setApkPushRemotePaths(prev => ({ ...prev, [device.id]: path }))}
                      onPushLocalPathChange={(path) => setApkPushPaths(prev => ({ ...prev, [device.id]: path }))}
                      onInstallPathChange={(path) => setApkInstallPaths(prev => ({ ...prev, [device.id]: path }))}
                      showToast={showToast}
                      apkInstallPath={apkInstallPaths[device.id] ?? ''}
                      apkPushPath={apkPushPaths[device.id] ?? ''}
                      apkPushRemotePath={apkPushRemotePaths[device.id] !== undefined ? apkPushRemotePaths[device.id] : '/sdcard/'}
                      pushRemotePathHistory={pushRemotePathHistory}
                      apkBrowserPath={apkBrowserPaths[device.id] ?? '/sdcard'}
                      apkBrowserItems={apkBrowserItemsMap[device.id] || []}
                      apkBrowserLoading={apkBrowserLoadingMap[device.id] || false}
                      operationLoading={operationLoading}
                      onExecuteCommand={handleExecuteCommand}
                      theme={theme}
                      sharedCommandHistory={terminalCommandHistory}
                      onSaveTerminalCommand={handleSaveTerminalCommand}
                      onClearTerminalHistory={handleClearTerminalHistory}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* XBH_AI_PATCH_START */}
              {/* 连接历史记录页面 */}
              <div className={`p-6 rounded-xl border shadow-sm ${t.primary === 'tech' ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className={`text-lg font-semibold flex items-center gap-2 ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-800'}`}>
                    <History size={20} className={t.primary === 'cyan' || t.primary === 'blue' ? 'text-blue-400' : t.primary === 'pink' ? 'text-pink-400' : t.primary === 'green' ? 'text-green-400' : t.primary === 'orange' ? 'text-orange-400' : 'text-emerald-500'} />
                    连接历史
                    <span className={`text-sm font-normal ml-2 px-2 py-0.5 rounded-full ${t.primary === 'tech' ? 'bg-[#3E4145] text-[#9AA0A6]' : 'bg-slate-100 text-[#80868B]'}`}>
                      {connectionHistory.length} 条
                    </span>
                  </h3>
                  {connectionHistory.length > 0 && (
                    <button
                      onClick={() => {
                        showConfirm('确定要清除所有连接历史吗？', async () => {
                          if (window.electronAPI) {
                            await window.electronAPI.clearConnectionHistory();
                          }
                          setConnectionHistory([]);
                          showToast('历史记录已清除');
                        });
                      }}
                      className={`text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${t.primary === 'tech' ? 'text-[#9AA0A6] hover:text-red-400 hover:bg-red-900/30' : 'text-[#80868B] hover:text-red-600 hover:bg-red-50'}`}
                    >
                      <RotateCcw size={14} />
                      一键清除
                    </button>
                  )}
                </div>
                {connectionHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <History size={48} className={`mb-4 opacity-30 ${t.primary === 'cyan' || t.primary === 'blue' ? 'text-cyan-400' : t.primary === 'pink' ? 'text-pink-400' : t.primary === 'green' ? 'text-green-400' : t.primary === 'orange' ? 'text-orange-400' : 'text-emerald-400'}`} />
                    <p className={`text-lg ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>暂无连接历史</p>
                    <p className={`text-sm mt-1 ${t.primary === 'tech' ? 'text-slate-600' : 'text-[#9AA0A6]'}`}>通过 Wi-Fi 连接设备后会显示在这里</p>
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {connectionHistory.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-all hover:shadow-md group ${t.primary === 'tech' ? 'bg-slate-700/50 border-[#5F6368] hover:border-slate-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.primary === 'tech' ? 'bg-slate-600' : 'bg-slate-200'}`}>
                                {item.type === 'wifi' ? (
                                  <Wifi size={16} className="text-emerald-500" />
                                ) : (
                                  <Smartphone size={16} className="text-slate-500" />
                                )}
                              </div>
                              <span className={`font-semibold truncate ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>
                                {item.deviceName}
                              </span>
                            </div>
                            {item.ip && (
                              <div className="flex items-center gap-2 mb-2">
                                <code className={`text-sm px-2 py-1 rounded ${t.primary === 'tech' ? 'bg-slate-600 text-[#E8EAED]' : 'bg-slate-200 text-slate-600'}`}>{item.ip}</code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.ip);
                                    showToast('IP 已复制');
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors ${t.primary === 'tech' ? 'hover:bg-slate-600 text-[#9AA0A6] hover:text-[#E8EAED]' : 'hover:bg-slate-200 text-[#9AA0A6] hover:text-slate-600'}`}
                                  title="复制 IP"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                            )}
                            <div className={`text-xs ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>
                              {new Date(item.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                        <div className={`mt-3 pt-3 border-t flex gap-2 ${t.primary === 'tech' ? 'border-[#5F6368]' : 'border-slate-200'}`}>
                          <button
                            onClick={() => {
                              setWifiIp(item.ip || item.deviceId);
                              setActiveTab('devices');
                              showToast('已填入 IP，请点击连接');
                            }}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${t.button.primary.split(' ')[0]} ${t.button.primary.split(' ')[1] || ''}`}
                          >
                            连接
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* XBH_AI_PATCH_END */}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className={`w-full p-6 rounded-xl border shadow-sm ${t.primary === 'tech' ? 'bg-slate-800/80 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-800'}`}>Scrcpy 投屏设置</h3>
              <p className={`text-sm mb-6 ${t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#80868B]'}`}>这些设置将在启动新的投屏会话时应用。</p>

              <div className="space-y-4">
                <div className={`flex items-center justify-between py-3 border-b ${t.primary === 'tech' ? 'border-[#3E4145]' : 'border-slate-100'}`}>
                  <div>
                    <span className={`font-medium ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>投屏时关闭设备屏幕</span>
                    <p className={`text-xs mt-0.5 ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>--turn-screen-off</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scrcpySettings.screenOff}
                      onChange={(e) => setScrcpySettings(prev => ({ ...prev, screenOff: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className={`flex items-center justify-between py-3 border-b ${t.primary === 'tech' ? 'border-[#3E4145]' : 'border-slate-100'}`}>
                  <div>
                    <span className={`font-medium ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>保持唤醒</span>
                    <p className={`text-xs mt-0.5 ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>设备在投屏期间保持唤醒状态</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scrcpySettings.stayAwake}
                      onChange={(e) => setScrcpySettings(prev => ({ ...prev, stayAwake: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className={`flex items-center justify-between py-3 border-b ${t.primary === 'tech' ? 'border-[#3E4145]' : 'border-slate-100'}`}>
                  <div>
                    <span className={`font-medium ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>视频比特率</span>
                    <p className={`text-xs mt-0.5 ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>--video-bit-rate</p>
                  </div>
                  <select
                    value={scrcpySettings.bitrate}
                    onChange={(e) => setScrcpySettings(prev => ({ ...prev, bitrate: e.target.value }))}
                    className={`border text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 ${t.primary === 'tech' ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED]' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  >
                    <option value="2 Mbps">2 Mbps</option>
                    <option value="4 Mbps">4 Mbps</option>
                    <option value="8 Mbps">8 Mbps (推荐)</option>
                    <option value="16 Mbps">16 Mbps</option>
                    <option value="32 Mbps">32 Mbps</option>
                  </select>
                </div>

                <div className={`flex items-center justify-between py-3 border-b ${t.primary === 'tech' ? 'border-[#3E4145]' : 'border-slate-100'}`}>
                  <div>
                    <span className={`font-medium ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>最大分辨率</span>
                    <p className={`text-xs mt-0.5 ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>--max-size，0 表示不限制</p>
                  </div>
                  <select
                    value={scrcpySettings.maxSize}
                    onChange={(e) => setScrcpySettings(prev => ({ ...prev, maxSize: e.target.value }))}
                    className={`border text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 ${t.primary === 'tech' ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED]' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                  >
                    <option value="0">不限制</option>
                    <option value="1920">1920</option>
                    <option value="1280">1280</option>
                    <option value="1024">1024</option>
                    <option value="720">720</option>
                  </select>
                </div>

                {/* XBH_AI_PATCH_START */}
                {/* 截图保存路径设置 */}
                <div className={`py-3 border-b ${t.primary === 'tech' ? 'border-[#3E4145]' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Camera size={16} className={t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#80868B]'} />
                    <span className={`font-medium ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>截图保存路径</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={screenshotPath}
                      onChange={(e) => setScreenshotPath(e.target.value)}
                      placeholder="默认: %APPDATA%/scrcpy-gui/screenshot/"
                      className={`flex-1 border text-sm rounded-lg p-2.5 ${t.primary === 'tech' ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED]' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                    <button
                      onClick={async () => {
                        if (window.electronAPI) {
                          const result = await window.electronAPI.selectFolder();
                          if (result.success && result.path) {
                            setScreenshotPath(result.path);
                          }
                        }
                      }}
                      className={`px-3 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${t.primary === 'tech' ? 'bg-[#3E4145] hover:bg-slate-600 text-[#E8EAED] border border-[#5F6368]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'}`}
                    >
                      <FolderOpen size={16} />
                      浏览
                    </button>
                    <button
                      onClick={async () => {
                        if (window.electronAPI) {
                          let targetPath = screenshotPath;
                          if (!targetPath) {
                            const userDataResult = await window.electronAPI.getUserDataPath();
                            targetPath = userDataResult.success ? `${userDataResult.path}/screenshot` : '';
                          }
                          if (targetPath) {
                            await window.electronAPI.openFolder(targetPath);
                          }
                        }
                      }}
                      className={`px-3 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${t.primary === 'tech' ? 'bg-[#3E4145] hover:bg-slate-600 text-[#E8EAED] border border-[#5F6368]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'}`}
                    >
                      <Folder size={16} />
                      打开
                    </button>
                  </div>
                  <p className={`text-xs mt-1.5 ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>
                    截图将保存到此目录，默认为 %APPDATA%/scrcpy-gui/screenshot/
                  </p>
                </div>
                {/* XBH_AI_PATCH_END */}

                {/* XBH_AI_PATCH_START */}
                {/* 录屏保存路径设置 */}
                <div className={`py-3 border-b ${t.primary === 'tech' ? 'border-[#3E4145]' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Video size={16} className={t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#80868B]'} />
                    <span className={`font-medium ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>录屏保存路径</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={screenRecordPath}
                      onChange={(e) => setScreenRecordPath(e.target.value)}
                      placeholder="默认: %APPDATA%/scrcpy-gui/screenrecord/"
                      className={`flex-1 border text-sm rounded-lg p-2.5 ${t.primary === 'tech' ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED]' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                    <button
                      onClick={async () => {
                        if (window.electronAPI) {
                          const result = await window.electronAPI.selectFolder();
                          if (result.success && result.path) {
                            setScreenRecordPath(result.path);
                          }
                        }
                      }}
                      className={`px-3 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${t.primary === 'tech' ? 'bg-[#3E4145] hover:bg-slate-600 text-[#E8EAED] border border-[#5F6368]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'}`}
                    >
                      <FolderOpen size={16} />
                      浏览
                    </button>
                    <button
                      onClick={async () => {
                        if (window.electronAPI) {
                          let targetPath = screenRecordPath;
                          if (!targetPath) {
                            const userDataResult = await window.electronAPI.getUserDataPath();
                            targetPath = userDataResult.success ? `${userDataResult.path}/screenrecord` : '';
                          }
                          if (targetPath) {
                            await window.electronAPI.openFolder(targetPath);
                          }
                        }
                      }}
                      className={`px-3 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${t.primary === 'tech' ? 'bg-[#3E4145] hover:bg-slate-600 text-[#E8EAED] border border-[#5F6368]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'}`}
                    >
                      <Folder size={16} />
                      打开
                    </button>
                  </div>
                  <p className={`text-xs mt-1.5 ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>
                    录屏文件将保存到此目录，默认为 %APPDATA%/scrcpy-gui/screenrecord/
                  </p>
                </div>
                {/* XBH_AI_PATCH_END */}

                {/* Theme Selection */}
                <div className="py-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Palette size={16} className={t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#80868B]'} />
                      <span className={`font-medium ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>界面主题</span>
                    </div>
                    <button
                      onClick={() => {
                        setEditingTheme(null);
                        setNewThemeName('');
                        setThemeColors({
                          primary: 'emerald',
                          primaryFrom: 'from-emerald-500',
                          primaryTo: 'to-emerald-600',
                          useGradient: true,
                          secondary: 'bg-slate-100',
                          secondaryText: 'text-slate-700',
                          secondaryBorder: 'border-slate-200',
                          bg: 'bg-slate-50',
                          card: 'bg-white',
                          cardBorder: 'border-slate-200',
                          input: 'border-slate-200',
                          terminalBg: 'bg-[#202124]',
                          terminalOutput: 'bg-[#0D0E10]',
                          terminalText: 'text-[#E8EAED]',
                          terminalAccent: 'text-emerald-400'
                        });
                        setShowThemeEditor(true);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${t.button.primary.split(' ')[0]} ${t.button.primary.split(' ')[1] || ''} text-white`}
                    >
                      + 自定义主题
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {Object.entries(allThemes).filter(([key]) => !key.startsWith('custom_') || customThemes.some(t => t.key === key)).map(([key, themeOption]) => {
                      const isCustom = themeOption.isCustom;
                      return (
                        <div key={key} className="relative">
                          <button
                            onClick={() => setCurrentTheme(key)}
                            className={`w-full p-3 rounded-xl border-2 transition-all ${
                              currentTheme === key
                                ? 'border-emerald-500 shadow-lg scale-105'
                                : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                            } ${themeOption.preview}`}
                          >
                            <div className={`text-xs font-medium mb-1 ${themeOption.text}`}>{themeOption.name}</div>
                            <div className="flex gap-1">
                              <div className={`w-4 h-4 rounded-full ${themeOption.button.primary.split(' ')[0]}`} />
                              <div className={`w-4 h-4 rounded-full ${themeOption.button.secondary.split(' ')[0]}`} />
                              <div className={`w-4 h-4 rounded-full ${themeOption.button.outline.split(' ')[0]}`} />
                            </div>
                            {currentTheme === key && (
                              <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                          </button>
                          {isCustom && (
                            <div className="absolute -top-1 -left-1 flex gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); editCustomTheme(themeOption); }}
                                className="w-5 h-5 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center"
                                title="编辑"
                              >
                                <span className="text-white text-xs">✎</span>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteCustomTheme(key); }}
                                className="w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center"
                                title="删除"
                              >
                                <span className="text-white text-xs">×</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* XBH_AI_PATCH_START */}
                {/* 关于与更新 */}
                <div className="py-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={16} className={t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#80868B]'} />
                    <span className={`font-medium ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>关于与更新</span>
                  </div>

                  <div className="space-y-3">
                    {/* 版本号显示 */}
                    <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${t.primary === 'tech' ? 'bg-[#3E4145]/50' : 'bg-slate-50'}`}>
                      <span className={`text-sm ${t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#80868B]'}`}>当前版本</span>
                      <span className={`text-sm font-mono font-semibold ${t.primary === 'tech' ? 'text-cyan-400' : 'text-cyan-600'}`}>v{appVersion || '2.0.0'}</span>
                    </div>

                    {/* 自动更新开关 */}
                    <div className={`flex items-center justify-between py-2 ${t.primary === 'tech' ? 'border-[#3E4145]' : 'border-slate-100'} border-b`}>
                      <div>
                        <span className={`font-medium text-sm ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>启动时自动检查更新</span>
                        <p className={`text-xs mt-0.5 ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>应用启动 3 秒后自动检测新版本</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoUpdateEnabled}
                          onChange={(e) => setAutoUpdateEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                    </div>

                    {/* 更新状态与操作按钮 */}
                    <div className="space-y-2">
                      {/* 错误提示 */}
                      {updaterState.error && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${t.primary === 'tech' ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                          <AlertCircle size={14} />
                          <span className="flex-1">{updaterState.error}</span>
                        </div>
                      )}

                      {/* 检查中 */}
                      {updaterState.checking && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${t.primary === 'tech' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
                          <Loader2 size={14} className="animate-spin" />
                          <span>正在检查更新…</span>
                        </div>
                      )}

                      {/* 发现新版本 */}
                      {updaterState.available && !updaterState.downloaded && (
                        <div className={`px-3 py-2 rounded-lg text-xs ${t.primary === 'tech' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <DownloadCloud size={14} />
                            <span className="font-semibold">发现新版本 v{updaterState.info?.version || '未知'}</span>
                          </div>
                          {updaterState.info?.releaseNotes && (
                            <p className="opacity-80 mt-1 line-clamp-2">
                              {typeof updaterState.info.releaseNotes === 'string'
                                ? updaterState.info.releaseNotes.slice(0, 120)
                                : '点击下载以查看更新内容'}
                            </p>
                          )}
                        </div>
                      )}

                      {/* 下载进度 */}
                      {updaterState.downloading && updaterState.progress && (
                        <div className={`px-3 py-2 rounded-lg text-xs ${t.primary === 'tech' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-700'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="flex items-center gap-1.5">
                              <Loader2 size={12} className="animate-spin" />
                              正在下载…
                            </span>
                            <span className="font-mono">{updaterState.progress.percent.toFixed(1)}%</span>
                          </div>
                          <div className={`h-1.5 rounded-full overflow-hidden ${t.primary === 'tech' ? 'bg-[#3E4145]' : 'bg-slate-200'}`}>
                            <div
                              className="h-full bg-cyan-500 transition-all"
                              style={{ width: `${updaterState.progress.percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1 opacity-70 text-[10px]">
                            <span>{(updaterState.progress.transferred / 1024 / 1024).toFixed(2)} MB</span>
                            <span>{(updaterState.progress.total / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        </div>
                      )}

                      {/* 下载完成 */}
                      {updaterState.downloaded && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${t.primary === 'tech' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                          <CheckCircle2 size={14} />
                          <span className="flex-1">更新已下载完成，点击"立即安装"重启应用</span>
                        </div>
                      )}

                      {/* 操作按钮组 */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {/* 检查更新按钮 */}
                        <button
                          onClick={async () => {
                            setUpdaterState(prev => ({ ...prev, error: null, checking: true }));
                            const res = await window.electronAPI?.checkForUpdates?.();
                            if (!res?.success) {
                              setUpdaterState(prev => ({ ...prev, checking: false, error: res?.error || '检查失败' }));
                            }
                          }}
                          disabled={updaterState.checking || updaterState.downloading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            t.primary === 'tech'
                              ? 'border-[#5F6368] text-[#E8EAED] hover:bg-[#3E4145] active:scale-95 shadow-sm'
                              : 'border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95 shadow-sm'
                          }`}
                          title="手动检查是否有新版本"
                        >
                          <RefreshCw size={14} className={updaterState.checking ? 'animate-spin' : ''} />
                          <span>检查更新</span>
                        </button>

                        {/* 下载按钮（发现新版本且未下载时显示） */}
                        {updaterState.available && !updaterState.downloading && !updaterState.downloaded && (
                          <button
                            onClick={() => window.electronAPI?.downloadUpdate?.()}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all active:scale-95 shadow-sm ${
                              t.primary === 'tech'
                                ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                                : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                            }`}
                          >
                            <Download size={14} />
                            <span>下载更新</span>
                          </button>
                        )}

                        {/* 立即安装按钮（下载完成后显示） */}
                        {updaterState.downloaded && (
                          <button
                            onClick={() => window.electronAPI?.installUpdate?.()}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all active:scale-95 shadow-sm ${
                              t.primary === 'tech'
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            <DownloadCloud size={14} />
                            <span>立即安装并重启</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {/* XBH_AI_PATCH_END */}

                {/* XBH_AI_PATCH_START */}
                {/* 更新说明弹窗（版本升级后首次打开时显示） */}
                {showChangelog && changelogContent && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className={`w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${t.primary === 'tech' ? 'bg-[#2D2F33] border-[#3E4145]' : 'bg-white border-slate-200'}`}>
                      {/* 头部：渐变背景 + 版本号 */}
                      <div className="relative px-6 py-5 bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-emerald-500/20 border-b border-[#3E4145]/50">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg">
                            <DownloadCloud size={24} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className={`text-lg font-bold ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-800'}`}>
                              {changelogContent.title}
                            </h3>
                            <p className={`text-xs mt-0.5 ${t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#80868B]'}`}>
                              发布日期：{changelogContent.date}
                            </p>
                          </div>
                          <button
                            onClick={() => setShowChangelog(false)}
                            className={`p-1.5 rounded-lg transition-colors ${t.primary === 'tech' ? 'text-[#9AA0A6] hover:bg-[#3E4145] hover:text-[#E8EAED]' : 'text-[#9AA0A6] hover:bg-slate-100 hover:text-slate-600'}`}
                          >
                            <X size={20} />
                          </button>
                        </div>
                      </div>

                      {/* 内容：更新条目列表 */}
                      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
                        {changelogContent.items.map((item, idx) => {
                          const typeConfig = {
                            feature: { label: '新增', color: t.primary === 'tech' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                            fix: { label: '修复', color: t.primary === 'tech' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-600 border-red-200' },
                            improve: { label: '优化', color: t.primary === 'tech' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-cyan-50 text-cyan-600 border-cyan-200' }
                          };
                          const cfg = typeConfig[item.type] || typeConfig.improve;
                          return (
                            <div key={idx} className="flex items-start gap-3">
                              <span className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded border ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              <span className={`text-sm leading-relaxed ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>
                                {item.text}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* 底部：操作按钮 */}
                      <div className={`px-6 py-4 border-t flex items-center justify-between ${t.primary === 'tech' ? 'border-[#3E4145] bg-[#202124]/50' : 'border-slate-100 bg-slate-50'}`}>
                        <span className={`text-xs ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>
                          感谢使用，如有问题请反馈
                        </span>
                        <button
                          onClick={() => setShowChangelog(false)}
                          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all active:scale-95 shadow-sm ${
                            t.primary === 'tech'
                              ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white'
                              : 'bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white'
                          }`}
                        >
                          知道了
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {/* XBH_AI_PATCH_END */}

                {/* XBH_AI_PATCH_START */}
                {/* 重置所有设置（放在最后） */}
                <div className="py-4 border-t mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RotateCcw size={16} className={t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#80868B]'} />
                      <div>
                        <span className={`font-medium ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>重置所有设置</span>
                        <p className={`text-xs mt-0.5 ${t.primary === 'tech' ? 'text-[#80868B]' : 'text-[#9AA0A6]'}`}>清除所有自定义配置，恢复默认状态</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        showConfirm('确定要重置所有设置吗？这将清除所有自定义主题和配置。', async () => {
                          setCustomThemes([]);
                          setCurrentTheme('default');
                          setScreenshotPath('');
                          setScreenRecordPath('');
                          setScrcpySettings({
                            screenOff: false,
                            stayAwake: true,
                            bitrate: '8 Mbps',
                            maxSize: '0'
                          });
                          // 重置自动更新开关为默认值（开启）
                          setAutoUpdateEnabled(true);
                          localStorage.setItem('autoUpdateEnabled', 'true');
                          if (window.electronAPI) {
                            await window.electronAPI.saveCustomThemes([]);
                            await window.electronAPI.saveScreenshotPath('');
                            await window.electronAPI.saveScreenRecordPath('');
                          }
                          showToast('所有设置已重置为默认值');
                        });
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${t.primary === 'tech' ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30' : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'}`}
                    >
                      <RotateCcw size={16} />
                      重置
                    </button>
                  </div>
                </div>
                {/* XBH_AI_PATCH_END */}

                {/* Custom Theme Editor Modal */}
                {showThemeEditor && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className={`w-full max-w-xl my-4 mx-2 sm:mx-auto p-4 sm:p-6 rounded-xl border shadow-xl ${t.primary === 'tech' ? 'bg-[#2D2F33] border-[#3E4145]' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className={`text-lg font-semibold ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-800'}`}>
                          {editingTheme ? '编辑自定义主题' : '创建自定义主题'}
                        </h4>
                        <button onClick={() => setShowThemeEditor(false)} className={`p-1 ${t.primary === 'tech' ? 'text-[#9AA0A6] hover:text-[#E8EAED]' : 'text-[#9AA0A6] hover:text-slate-600'}`}>
                          <X size={20} />
                        </button>
                      </div>

                      <div className="space-y-4 overflow-y-auto">
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>主题名称</label>
                          <input
                            type="text"
                            value={newThemeName}
                            onChange={(e) => setNewThemeName(e.target.value)}
                            placeholder="输入主题名称..."
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none ${t.primary === 'tech' ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED] placeholder-slate-400' : 'bg-white border-slate-200 text-slate-700'}`}
                          />
                        </div>

                        <div>
                          <label className={`block text-sm font-medium mb-2 ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>主色调</label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { name: 'emerald', color: '#10b981' },
                              { name: 'cyan', color: '#06b6d4' },
                              { name: 'blue', color: '#3b82f6' },
                              { name: 'pink', color: '#ec4899' },
                              { name: 'rose', color: '#f43f5e' },
                              { name: 'green', color: '#22c55e' },
                              { name: 'orange', color: '#f97316' },
                              { name: 'amber', color: '#f59e0b' },
                              { name: 'purple', color: '#a855f7' },
                              { name: 'red', color: '#ef4444' }
                            ].map(({ name, color }) => (
                              <button
                                key={name}
                                onClick={() => setThemeColors(prev => ({ ...prev, primary: name, primaryFrom: `from-${name}-500`, primaryTo: `to-${name}-600` }))}
                                style={{ backgroundColor: color }}
                                className={`w-7 h-7 rounded-full flex-shrink-0 ${themeColors.primary === name ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>按钮渐变</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={themeColors.useGradient}
                              onChange={(e) => setThemeColors(prev => ({ ...prev, useGradient: e.target.checked }))}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                            <span className={`ml-2 text-xs ${themeColors.useGradient ? 'text-emerald-500' : 'text-slate-400'}`}>{themeColors.useGradient ? '开启' : '关闭'}</span>
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${themeColors.useGradient ? (t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700') : 'text-[#9AA0A6]'}`}>按钮渐变起点</label>
                            <select
                              value={themeColors.primaryFrom}
                              onChange={(e) => setThemeColors(prev => ({ ...prev, primaryFrom: e.target.value }))}
                              disabled={!themeColors.useGradient}
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none ${themeColors.useGradient ? (t.primary === 'tech' ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED]' : 'bg-slate-50 border-slate-200 text-slate-700') : 'bg-slate-100 border-slate-200 text-[#9AA0A6] cursor-not-allowed'}`}
                            >
                              {[
                                { value: 'from-emerald-400', label: '翠绿' },
                                { value: 'from-cyan-400', label: '青色' },
                                { value: 'from-blue-400', label: '蓝色' },
                                { value: 'from-pink-400', label: '粉色' },
                                { value: 'from-rose-400', label: '玫红' },
                                { value: 'from-green-400', label: '绿色' },
                                { value: 'from-orange-400', label: '橙色' },
                                { value: 'from-amber-400', label: '琥珀' },
                                { value: 'from-purple-400', label: '紫色' },
                                { value: 'from-red-400', label: '红色' }
                              ].map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${themeColors.useGradient ? (t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700') : 'text-[#9AA0A6]'}`}>按钮渐变终点</label>
                            <select
                              value={themeColors.primaryTo}
                              onChange={(e) => setThemeColors(prev => ({ ...prev, primaryTo: e.target.value }))}
                              disabled={!themeColors.useGradient}
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none ${themeColors.useGradient ? (t.primary === 'tech' ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED]' : 'bg-slate-50 border-slate-200 text-slate-700') : 'bg-slate-100 border-slate-200 text-[#9AA0A6] cursor-not-allowed'}`}
                            >
                              {[
                                { value: 'to-emerald-500', label: '翠绿' },
                                { value: 'to-cyan-500', label: '青色' },
                                { value: 'to-blue-500', label: '蓝色' },
                                { value: 'to-pink-500', label: '粉色' },
                                { value: 'to-rose-500', label: '玫红' },
                                { value: 'to-green-500', label: '绿色' },
                                { value: 'to-orange-500', label: '橙色' },
                                { value: 'to-amber-500', label: '琥珀' },
                                { value: 'to-purple-500', label: '紫色' },
                                { value: 'to-red-500', label: '红色' }
                              ].map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className={`block text-sm font-medium mb-1 ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>卡片背景</label>
                          <select
                            value={themeColors.card}
                            onChange={(e) => setThemeColors(prev => ({ ...prev, card: e.target.value }))}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none ${t.primary === 'tech' ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED]' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                          >
                            <option value="bg-white">白色</option>
                            <option value="bg-slate-800/80">深灰半透明</option>
                            <option value="bg-pink-50">粉色</option>
                            <option value="bg-blue-50">蓝色</option>
                            <option value="bg-green-50">绿色</option>
                            <option value="bg-orange-50">橙色</option>
                            <option value="bg-purple-50">紫色</option>
                          </select>
                        </div>

                        <div>
                          <label className={`block text-sm font-medium mb-1 ${t.primary === 'tech' ? 'text-[#E8EAED]' : 'text-slate-700'}`}>终端背景</label>
                          <select
                            value={themeColors.terminalBg}
                            onChange={(e) => setThemeColors(prev => ({ ...prev, terminalBg: e.target.value }))}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none ${t.primary === 'tech' ? 'bg-[#3E4145] border-[#5F6368] text-[#E8EAED]' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                          >
                            <option value="bg-[#202124]">深灰 (#202124)</option>
                            <option value="bg-[#202124]">深灰 (slate-900)</option>
                            <option value="bg-black">纯黑</option>
                            <option value="bg-gradient-to-br from-pink-900 to-rose-900">粉紫渐变</option>
                            <option value="bg-gradient-to-br from-slate-800 to-slate-900">灰渐变</option>
                            <option value="bg-gradient-to-br from-blue-900 to-slate-900">蓝渐变</option>
                            <option value="bg-gradient-to-br from-green-900 to-slate-900">绿渐变</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-6">
                        <button
                          onClick={() => setShowThemeEditor(false)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${t.primary === 'tech' ? 'border-[#5F6368] text-[#E8EAED] hover:bg-[#3E4145]' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                        >
                          取消
                        </button>
                        <button
                          onClick={saveCustomTheme}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${t.button.primary.split(' ')[0]} ${t.button.primary.split(' ')[1] || ''} text-white`}
                        >
                          {editingTheme ? '保存修改' : '创建主题'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function DeviceCard({ device, deviceName, onNameChange, onStart, onCommand, onScreenshot, onScreenRecordStart, onScreenRecordStop, onReboot, onRebootLoader, onRoot, onRemount, onDisconnect, showApkManager, onApkManager, onSelectApkForInstall, onSelectApkForPush, onInstallApk, onPushApk, onBrowsePath, onPullFile, onPushPathChange, showToast, apkInstallPath, apkPushPath, apkPushRemotePath, pushRemotePathHistory, apkBrowserPath, apkBrowserItems, apkBrowserLoading, operationLoading, onExecuteCommand, theme, sharedCommandHistory, onSaveTerminalCommand, onClearTerminalHistory }) {
  const isOnline = device.status === 'device';
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(deviceName || '');
  const [showTerminal, setShowTerminal] = useState(false);
  // XBH_AI_PATCH_START
  // 终端放大模式：脱离原位置，全屏覆盖
  const [terminalFullscreen, setTerminalFullscreen] = useState(false);
  // 终端字体大小（Ctrl+滚轮缩放，范围 10-28px）
  const [terminalFontSize, setTerminalFontSize] = useState(12);
  const terminalOutputRef = useRef(null);
  // XBH_AI_PATCH_END
  const [terminalCommand, setTerminalCommand] = useState('');
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const commandHistory = sharedCommandHistory || [];

  const handleNameSubmit = () => {
    onNameChange(device.id, editName.trim());
    setIsEditing(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditName(deviceName || '');
      setIsEditing(false);
    }
  };

  const handleTerminalSubmit = async (e) => {
    e?.preventDefault();
    if (!terminalCommand.trim() || isExecuting) return;

    setIsExecuting(true);
    setShowHistory(false);
    const cmd = terminalCommand.trim();
    setTerminalOutput(prev => [...prev, { type: 'command', text: `$ adb -s ${device.id} shell "${cmd}"` }]);
    setTerminalCommand('');
    setHistoryIndex(-1);
    if (onSaveTerminalCommand) {
      onSaveTerminalCommand(cmd);
    }

    try {
      if (onExecuteCommand) {
        const result = await onExecuteCommand(device.id, cmd);
        setTerminalOutput(prev => [...prev, { type: 'output', text: result }]);
      }
    } catch (err) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: `Error: ${err.message}` }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTerminalKeyDown = (e) => {
    // XBH_AI_PATCH_START
    // 放大模式下按 Esc 退出
    if (e.key === 'Escape' && terminalFullscreen) {
      e.preventDefault();
      setTerminalFullscreen(false);
      return;
    }
    // Ctrl+= / Ctrl+- 调整字号
    if (terminalFullscreen && (e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      setTerminalFontSize((s) => Math.min(28, s + 1));
      return;
    }
    if (terminalFullscreen && (e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();
      setTerminalFontSize((s) => Math.max(10, s - 1));
      return;
    }
    // Ctrl+0 重置字号
    if (terminalFullscreen && (e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      setTerminalFontSize(12);
      return;
    }
    // XBH_AI_PATCH_END
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTerminalSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setShowHistory(false);
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? 0 : Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(newIndex);
        setTerminalCommand(commandHistory[newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowHistory(false);
      if (historyIndex !== -1) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setTerminalCommand(newIndex === -1 ? '' : commandHistory[newIndex] || '');
      }
    }
  };

  // XBH_AI_PATCH_START
  // 终端放大模式下 Ctrl+滚轮缩放字体（10-28px 临界值）
  useEffect(() => {
    if (!terminalFullscreen) return;
    const el = terminalOutputRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      setTerminalFontSize((s) => Math.max(10, Math.min(28, s + delta)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [terminalFullscreen]);
  // XBH_AI_PATCH_END

  const clearTerminal = () => {
    setTerminalOutput([]);
  };

  const handleTerminalFocus = () => {
    if (terminalCommand === '' && commandHistory.length > 0) {
      setShowHistory(true);
    }
  };

  const handleTerminalBlur = () => {
    setTimeout(() => setShowHistory(false), 200);
  };

  const isLoading = (key) => operationLoading?.[key] || false;

  const t = theme || themes.default;

  return (
    <div className={`${t.card} rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow`}>
      <div className={`p-5 border-b flex justify-between items-start ${t.header.replace('border-b', 'border-b')}`}>
        <div className="flex items-center space-x-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOnline ? `${t.primary === 'cyan' || t.primary === 'blue' ? 'bg-blue-100 text-blue-600' : t.primary === 'pink' ? 'bg-pink-100 text-pink-600' : t.primary === 'green' ? 'bg-green-100 text-green-600' : t.primary === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}` : 'bg-slate-100 text-slate-400'}`}>
            <Smartphone size={24} />
          </div>
          <div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleNameSubmit}
                  autoFocus
                  className="px-2 py-1 text-sm border border-emerald-400 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 w-32"
                  placeholder="输入设备名称"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className={`text-lg font-bold ${t.text.replace('text-slate-700', 'text-slate-800').replace('text-pink-700', 'text-pink-800').replace('text-[#E8EAED]', 'text-[#E8EAED]')}`}>
                  {deviceName || device.model || '未知设备'}
                </h3>
                <button
                  onClick={() => {
                    setEditName(deviceName || '');
                    setIsEditing(true);
                  }}
                  className="p-1 text-slate-400 hover:text-emerald-500 transition-colors"
                  title="编辑名称"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center space-x-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${isOnline ? (t.primary === 'cyan' || t.primary === 'blue' ? 'bg-blue-500' : t.primary === 'pink' ? 'bg-pink-500' : t.primary === 'green' ? 'bg-green-500' : t.primary === 'orange' ? 'bg-orange-500' : 'bg-emerald-500') : 'bg-slate-300'}`}></span>
              <span className={`text-sm font-mono ${t.textMuted}`}>{device.id}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${t.primary === 'cyan' || t.primary === 'blue' ? 'bg-blue-100 text-blue-600' : t.primary === 'pink' ? 'bg-pink-100 text-pink-600' : t.primary === 'green' ? 'bg-green-100 text-green-600' : t.primary === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'} capitalize`}>
                {device.status === 'device' ? '在线' : device.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDisconnect}
            title="断开设备"
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Unplug size={20} />
          </button>
          <button
            onClick={onStart}
            disabled={!isOnline}
            className={`${t.button.primary.split(' ')[0]} ${t.button.primary.split(' ')[1] || ''} disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors`}
          >
            <Play size={18} />
            <span>开始投屏</span>
          </button>
        </div>
      </div>

      <div className={`px-5 py-4 flex flex-wrap gap-2 ${t.primary === 'tech' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
        <ControlButton
          icon={<Camera size={16} />}
          label={isLoading(`screenshot_${device.id}`) ? '截图中...' : '截图'}
          onClick={onScreenshot}
          disabled={!isOnline || isLoading(`screenshot_${device.id}`)}
          loading={isLoading(`screenshot_${device.id}`)}
          theme={t}
          isOnline={isOnline}
        />
        <ControlButton
          icon={isRecording ? <div className="w-4 h-4 rounded-full bg-red-700 shadow-sm shadow-red-900/30" /> : <Video size={16} />}
          label={isSavingRecord ? '保存中...' : isRecording ? '停止录屏' : '录屏'}
          onClick={async () => {
            if (isRecording) {
              setIsSavingRecord(true);
              const res = await onScreenRecordStop(device.id);
              setIsSavingRecord(false);
              if (res.success) {
                setIsRecording(false);
                showToast(`录屏已保存: ${res.path}`);
              } else {
                showToast(`录屏停止失败: ${res.error}`);
              }
            } else {
              const res = await onScreenRecordStart(device.id);
              if (res.success) {
                setIsRecording(true);
                showToast('录屏已开始');
              } else {
                showToast(`录屏启动失败: ${res.error}`);
              }
            }
          }}
          disabled={!isOnline || isSavingRecord}
          theme={t}
          isOnline={isOnline}
          isRecording={isRecording}
          isSaving={isSavingRecord}
        />
        <ControlButton
          icon={<Volume2 size={16} />}
          label="音量+"
          onClick={() => onCommand('input keyevent 24')}
          disabled={!isOnline}
          theme={t}
          isOnline={isOnline}
        />
        <ControlButton
          icon={<VolumeX size={16} />}
          label="音量-"
          onClick={() => onCommand('input keyevent 25')}
          disabled={!isOnline}
          theme={t}
          isOnline={isOnline}
        />
        <ControlButton
          icon={<Shield size={16} />}
          label={isLoading(`root_${device.id}`) ? 'Root中...' : 'Root'}
          onClick={onRoot}
          disabled={!isOnline || isLoading(`root_${device.id}`)}
          loading={isLoading(`root_${device.id}`)}
          theme={t}
          isOnline={isOnline}
        />
        <ControlButton
          icon={<Save size={16} />}
          label={isLoading(`remount_${device.id}`) ? 'Remount中...' : 'Remount'}
          onClick={onRemount}
          disabled={!isOnline || isLoading(`remount_${device.id}`)}
          loading={isLoading(`remount_${device.id}`)}
          theme={t}
          isOnline={isOnline}
        />
        <ControlButton
          icon={<RotateCcw size={16} />}
          label={isLoading(`reboot_${device.id}`) ? '重启中...' : '重启'}
          onClick={onReboot}
          disabled={!isOnline || isLoading(`reboot_${device.id}`)}
          loading={isLoading(`reboot_${device.id}`)}
          theme={t}
          isOnline={isOnline}
        />
        <ControlButton
          icon={<Loader size={16} />}
          label={isLoading(`loader_${device.id}`) ? 'Loader中...' : 'Loader'}
          onClick={onRebootLoader}
          disabled={!isOnline || isLoading(`loader_${device.id}`)}
          loading={isLoading(`loader_${device.id}`)}
          theme={t}
          isOnline={isOnline}
        />
        <ControlButton
          icon={<Package size={16} />}
          label="APK管理"
          onClick={onApkManager}
          disabled={!isOnline}
          theme={t}
          isOnline={isOnline}
        />
        <ControlButton
          icon={<Terminal size={16} />}
          label="终端"
          onClick={() => setShowTerminal(true)}
          disabled={!isOnline}
          theme={t}
          isOnline={isOnline}
        />
      </div>

      {/* APK Manager Section */}
      {showApkManager && (
        <div className={`border-t p-4 ${t.primary === 'tech' ? 'bg-slate-800/30' : 'bg-slate-50'}`}>
          <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${t.text}`}>
            <Package size={16} />
            APK 管理
          </h4>

          {/* Install APK */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Download size={14} className={t.primary === 'cyan' || t.primary === 'blue' ? 'text-blue-500' : t.primary === 'pink' ? 'text-pink-500' : t.primary === 'green' ? 'text-green-500' : t.primary === 'orange' ? 'text-orange-500' : 'text-emerald-500'} />
              <span className={`text-sm font-medium ${t.text}`}>安装 APK</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={apkInstallPath}
                readOnly
                placeholder="点击选择 APK 文件..."
                className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${t.input}`}
              />
              <button
                onClick={onSelectApkForInstall}
                disabled={isLoading(`install_${device.id}`)}
                className={`px-4 py-2 text-sm border rounded-lg transition-colors flex items-center gap-1 ${t.button.secondary}`}
              >
                <FolderOpen size={14} />
                选择
              </button>
              <button
                onClick={onInstallApk}
                disabled={!apkInstallPath || isLoading(`install_${device.id}`)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1 ${t.button.primary.split(' ')[0]} ${t.button.primary.split(' ')[1] || ''} disabled:opacity-50`}
              >
                {isLoading(`install_${device.id}`) ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {isLoading(`install_${device.id}`) ? '安装中...' : '安装'}
              </button>
            </div>
          </div>

          {/* Push File */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Upload size={14} className={t.primary === 'cyan' || t.primary === 'blue' ? 'text-blue-500' : t.primary === 'pink' ? 'text-pink-500' : t.primary === 'green' ? 'text-green-500' : t.primary === 'orange' ? 'text-orange-500' : 'text-blue-500'} />
              <span className={`text-sm font-medium ${t.text}`}>推送文件到设备</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={apkPushPath}
                readOnly
                placeholder="点击选择文件..."
                className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${t.input}`}
              />
              <button
                onClick={onSelectApkForPush}
                disabled={isLoading(`push_${device.id}`)}
                className={`px-4 py-2 text-sm border rounded-lg transition-colors flex items-center gap-1 ${t.button.secondary}`}
              >
                <FolderOpen size={14} />
                选择
              </button>
              <div className="relative">
                <input
                  type="text"
                  value={apkPushRemotePath}
                  onChange={(e) => onPushPathChange?.(e.target.value)}
                  list={`push-remote-path-history-${device.id}`}
                  placeholder="/sdcard/"
                  readOnly={false}
                  className={`w-40 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${t.input}`}
                />
                <datalist id={`push-remote-path-history-${device.id}`}>
                  {(pushRemotePathHistory || []).map((path, idx) => (
                    <option key={idx} value={path} />
                  ))}
                </datalist>
              </div>
              <button
                onClick={onPushApk}
                disabled={!apkPushPath || isLoading(`push_${device.id}`)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1 ${t.button.primary.split(' ')[0]} ${t.button.primary.split(' ')[1] || ''} disabled:opacity-50`}
              >
                {isLoading(`push_${device.id}`) ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                {isLoading(`push_${device.id}`) ? '推送中...' : '推送'}
              </button>
            </div>
          </div>

          {/* Browse Device */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Folder size={14} className="text-purple-500" />
              <span className={`text-sm font-medium ${t.text}`}>浏览设备文件</span>
              <div className="flex items-center gap-1 ml-auto">
                <span className={`text-xs font-mono px-2 py-1 rounded select-all ${t.primary === 'tech' ? 'bg-[#3E4145] text-[#E8EAED]' : 'bg-slate-100 text-slate-600'}`}>{apkBrowserPath}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(apkBrowserPath);
                    showToast(`路径已复制: ${apkBrowserPath}`);
                  }}
                  className={`p-1 transition-colors ${t.primary === 'tech' ? 'text-[#9AA0A6] hover:text-cyan-400' : 'text-[#9AA0A6] hover:text-emerald-500'}`}
                  title="复制路径"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onBrowsePath?.('/')}
                className={`px-3 py-2 text-sm border rounded-lg transition-colors ${t.button.secondary}`}
              >
                / (根目录)
              </button>
              <button
                onClick={() => onBrowsePath?.('/system/app')}
                className={`px-3 py-2 text-sm border rounded-lg transition-colors ${t.button.secondary}`}
              >
                /system/app
              </button>
            <button
                onClick={() => onBrowsePath?.('/system_ext/app')}
                className={`px-3 py-2 text-sm border rounded-lg transition-colors ${t.button.secondary}`}
              >
                /system_ext/app
              </button>
              <button
                onClick={() => onBrowsePath?.('/data/app')}
                className={`px-3 py-2 text-sm border rounded-lg transition-colors ${t.button.secondary}`}
              >
                /data/app
              </button>
            </div>

            {/* File List */}
            <div className={`mt-3 border rounded-lg max-h-48 overflow-y-auto ${t.primary === 'tech' ? 'bg-slate-800/50 border-[#3E4145]' : 'bg-white border-slate-200'}`}>
              {apkBrowserLoading ? (
                <div className={`p-4 text-center text-sm ${t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#9AA0A6]'}`}>加载中...</div>
              ) : apkBrowserItems.length === 0 ? (
                <div className={`p-4 text-center text-sm ${t.primary === 'tech' ? 'text-[#9AA0A6]' : 'text-[#9AA0A6]'}`}>暂无文件</div>
              ) : (
                <div className={`divide-y ${t.primary === 'tech' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                  {apkBrowserItems.map((item, index) => (
                    <div
                      key={index}
                      className={`px-3 py-2 flex items-center justify-between cursor-pointer group ${t.primary === 'tech' ? 'hover:bg-[#3E4145]' : 'hover:bg-slate-50'}`}
                      onClick={() => item.isDirectory && item.name !== '.' && onBrowsePath?.(item.path)}
                    >
                      <div className="flex items-center gap-2">
                        {item.name === '.' ? (
                          <ArrowLeft size={14} className="text-slate-400" />
                        ) : item.name === '..' ? (
                          <ArrowLeft size={14} className="text-blue-400" />
                        ) : item.isDirectory ? (
                          <Folder size={14} className="text-amber-500" />
                        ) : (
                          <File size={14} className="text-slate-400" />
                        )}
                        <span className={`text-sm ${item.name === '..' ? 'text-blue-500 font-medium' : item.name === '.' ? 'text-slate-400' : t.text}`}>
                          {item.name === '.' ? '当前目录' : item.name === '..' ? '上一级目录' : item.name}
                        </span>
                      </div>
                      {!item.isDirectory && item.name !== '.' && item.name !== '..' ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(item.path);
                              showToast(`路径已复制: ${item.path}`);
                            }}
                            className={`px-2 py-1 text-xs border rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${t.button.secondary}`}
                            title="复制路径"
                          >
                            <Copy size={12} />
                            复制
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPullFile?.(item.path);
                            }}
                            disabled={isLoading(`pull_${device.id}_${item.path}`)}
                            className={`px-2 py-1 text-xs border rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${t.button.secondary} disabled:opacity-50`}
                          >
                            {isLoading(`pull_${device.id}_${item.path}`) ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <Download size={12} />
                            )}
                            {isLoading(`pull_${device.id}_${item.path}`) ? '拉取中' : '拉取'}
                          </button>
                        </div>
                      ) : item.isDirectory ? (
                        item.name !== '.' && <ChevronRight size={14} className="text-slate-400" />
                      ) : (
                        <span className="text-xs text-slate-400">{item.size}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Terminal Section */}
      {showTerminal && (
        // XBH_AI_PATCH_START
        // 放大模式：fixed 全屏覆盖；普通模式：原位置 border-t
        <div className={`${terminalFullscreen ? 'fixed inset-0 z-50 p-6 flex flex-col' : `border-t p-4`} ${t.terminal.bg}`}>
          <div className={`flex items-center justify-between mb-3 ${t.terminal.accent} ${terminalFullscreen ? 'pb-3 border-b border-[#3E4145]' : ''}`}>
            <div className="flex items-center gap-2">
              <Terminal size={16} />
              <span className="text-sm font-medium">终端 - {device.id}</span>
              {terminalFullscreen && (
                <span className="text-xs text-slate-500 ml-2">（放大模式 · 按 Esc 或点击还原返回 · Ctrl+滚轮缩放）</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 放大模式下显示字号控制 */}
              {terminalFullscreen && (
                <div className="flex items-center gap-1 px-2 py-1 text-xs bg-[#3E4145] rounded">
                  <button
                    onClick={() => setTerminalFontSize((s) => Math.max(10, s - 1))}
                    className="w-5 h-5 flex items-center justify-center hover:bg-[#5F6368] rounded text-[#E8EAED] disabled:opacity-30"
                    disabled={terminalFontSize <= 10}
                    title="缩小 (Ctrl+-)"
                  >
                    -
                  </button>
                  <span className="text-[#9AA0A6] w-10 text-center">{terminalFontSize}px</span>
                  <button
                    onClick={() => setTerminalFontSize((s) => Math.min(28, s + 1))}
                    className="w-5 h-5 flex items-center justify-center hover:bg-[#5F6368] rounded text-[#E8EAED] disabled:opacity-30"
                    disabled={terminalFontSize >= 28}
                    title="放大 (Ctrl+=)"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setTerminalFontSize(12)}
                    className="px-1.5 h-5 flex items-center justify-center hover:bg-[#5F6368] rounded text-[#9AA0A6] text-[10px]"
                    title="重置 (Ctrl+0)"
                  >
                    重置
                  </button>
                </div>
              )}
              <button
                onClick={clearTerminal}
                className="px-2 py-1 text-xs bg-[#3E4145] hover:bg-slate-600 text-[#E8EAED] rounded transition-colors"
              >
                清空输出
              </button>
              {commandHistory.length > 0 && (
                <button
                  onClick={() => {
                    if (onClearTerminalHistory) {
                      onClearTerminalHistory();
                    }
                    setHistoryIndex(-1);
                    setShowHistory(false);
                  }}
                  className="px-2 py-1 text-xs bg-[#3E4145] hover:bg-red-900/50 text-[#E8EAED] hover:text-red-400 rounded transition-colors flex items-center gap-1"
                >
                  <RotateCcw size={10} />
                  清空历史命令
                </button>
              )}
              {/* 放大 / 还原按钮 */}
              <button
                onClick={() => setTerminalFullscreen((v) => !v)}
                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-[#3E4145] rounded transition-colors"
                title={terminalFullscreen ? '还原' : '放大'}
              >
                {terminalFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={() => {
                  setShowTerminal(false);
                  setTerminalFullscreen(false);
                  setTerminalOutput([]);
                  setTerminalCommand('');
                  setHistoryIndex(-1);
                  setShowHistory(false);
                }}
                className="p-1 text-slate-400 hover:text-red-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Terminal Output - 放大模式下 flex-1 撑满，支持 Ctrl+滚轮缩放 */}
          <div
            ref={terminalOutputRef}
            style={{ fontSize: `${terminalFontSize}px` }}
            className={`${t.terminal.output} rounded-lg p-3 mb-3 overflow-y-auto font-mono select-text border border-[#3E4145] ${terminalFullscreen ? 'flex-1' : 'h-56'}`}
          >
            {terminalOutput.length === 0 ? (
              <div className="flex items-center gap-2 text-slate-500 select-text py-2">
                <Terminal size={14} className="opacity-50" />
                <span>输入命令并按 Enter 执行...</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {terminalOutput.map((line, index) => {
                  const isCmd = line.type === 'command';
                  const isErr = line.type === 'error';
                  return (
                    <div
                      key={index}
                      className={`flex items-start gap-2 px-2 py-1 rounded select-text transition-colors hover:bg-white/5 ${
                        isCmd ? 'bg-cyan-500/5' : isErr ? 'bg-red-500/5' : ''
                      }`}
                    >
                      {/* 行号 */}
                      <span className="text-slate-600 select-none text-[10px] mt-0.5 w-6 text-right shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {/* 类型标记 */}
                      <span className={`select-none shrink-0 text-[10px] mt-0.5 w-4 ${
                        isCmd ? 'text-cyan-400' : isErr ? 'text-red-400' : 'text-slate-500'
                      }`}>
                        {isCmd ? '$' : isErr ? '!' : '›'}
                      </span>
                      {/* 内容 */}
                      <span className={`flex-1 break-all whitespace-pre-wrap ${
                        isCmd ? 'text-cyan-300 font-semibold' : isErr ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {line.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {isExecuting && (
              <div className="flex items-center gap-2 px-2 py-1 text-amber-400 animate-pulse select-text">
                <Loader2 size={12} className="animate-spin" />
                <span className="text-xs">执行中...</span>
              </div>
            )}
          </div>

          {/* Terminal Input */}
          <form onSubmit={handleTerminalSubmit} className="flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">$</span>
            <div className="flex-1 relative">
              <input
                type="text"
                value={terminalCommand}
                onChange={(e) => setTerminalCommand(e.target.value)}
                onKeyDown={handleTerminalKeyDown}
                onFocus={handleTerminalFocus}
                onBlur={handleTerminalBlur}
                disabled={isExecuting || !isOnline}
                placeholder="输入 ADB Shell 命令..."
                className={`w-full px-3 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500 disabled:opacity-50 ${t.terminal.bg.replace('bg-', 'bg-').replace('gradient-to-br', 'bg-').includes('gradient') ? 'bg-[#2D2F33] border-[#3E4145] text-[#E8EAED]' : t.terminal.text.includes('300') ? 'bg-[#2D2F33] border-[#3E4145] text-[#E8EAED]' : 'bg-[#202124] border-[#3E4145] text-[#E8EAED]'}`}
              />
              {showHistory && commandHistory.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#2D2F33] border border-[#3E4145] rounded-lg overflow-hidden shadow-lg max-h-40 overflow-y-auto z-50">
                  <div className="px-3 py-1 text-xs text-slate-500 border-b border-[#3E4145] flex items-center justify-between">
                    <span>历史命令</span>
                    <span>{commandHistory.length}/100</span>
                  </div>
                  {commandHistory.slice(0, 10).map((cmd, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setTerminalCommand(cmd);
                        setShowHistory(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm text-[#E8EAED] hover:bg-[#3E4145] font-mono truncate"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isExecuting || !terminalCommand.trim() || !isOnline}
              className={`${t.button.primary.split(' ')[0]} ${t.button.primary.split(' ')[1] || ''} px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50`}
            >
              {isExecuting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              执行
            </button>
          </form>

          {/* Quick Commands */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500">快捷命令:</span>
            {['pm list packages', 'getprop ro.build.version', 'dumpsys battery', 'cat /proc/meminfo', 'ls -la /data/'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => {
                  setTerminalCommand(cmd);
                }}
                className="px-2 py-1 text-xs bg-[#2D2F33] hover:bg-[#3E4145] text-[#9AA0A6] hover:text-[#E8EAED] rounded transition-colors font-mono"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ControlButton({ icon, label, onClick, disabled, loading, theme, isRecording, isSaving }) {
  const t = theme || themes.default;
  const primaryColor = t.primary;

  const getSecondaryClass = () => {
    if (primaryColor === 'cyan' || primaryColor === 'blue') return 'text-blue-600';
    if (primaryColor === 'pink') return 'text-pink-600';
    if (primaryColor === 'green') return 'text-green-600';
    if (primaryColor === 'orange') return 'text-orange-600';
    return 'text-emerald-600';
  };

  // XBH_AI_PATCH_START
  // 录屏按钮红色样式
  const isRecordButton = isRecording !== undefined;
  const buttonClass = isRecordButton && isRecording
    ? 'flex items-center space-x-2 border bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-md text-sm font-medium transition-colors'
    : `flex items-center space-x-2 border ${t.button.secondary} hover:${getSecondaryClass()} disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-md text-sm font-medium transition-colors`;
  // XBH_AI_PATCH_END

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={buttonClass}
    >
      {loading ? (
        <>
          <RefreshCw size={16} className="animate-spin" />
          <span>{label}</span>
        </>
      ) : (
        <>
          {icon}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export default App;
