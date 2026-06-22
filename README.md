# AdbDeviceManagement

一款基于 Electron + React + TailwindCSS 开发的跨平台手机投屏管理软件。
该软件封装了 `adb` 和 `scrcpy`，提供美观的图形化界面来进行 Android 设备的屏幕镜像、管理和控制。

## 功能特点
- 🚀 **设备管理**: 自动检测通过 USB 或 Wi-Fi (ADB) 连接的 Android 设备。
- 📱 **一键投屏**: 快速启动 `scrcpy` 进行低延迟、高画质的屏幕镜像。
- 🎮 **快捷控制**:
  - 📸 截取屏幕并保存到本地
  - 🎥 屏幕录制 (计划中)
  - 🔊 调节音量 (+ / -)
  - ⏻ 模拟电源键控制息屏/亮屏
- 🎨 **现代化 UI**: 基于 Tailwind CSS 打造的美观、流畅的用户界面。

## 环境要求
在使用本软件前，请确保您的系统已安装以下依赖，并已将其添加至系统环境变量 (`PATH`)：
1. [Node.js](https://nodejs.org/) (用于编译和运行项目)
2. [ADB (Android Debug Bridge)](https://developer.android.com/studio/releases/platform-tools)
3. [scrcpy](https://github.com/Genymobile/scrcpy)

## 安装与运行

1. 安装依赖:
```bash
npm install
```

2. 启动开发模式:
```bash
npm run electron:dev
```

3. 构建打包 (生产环境):
```bash
npm run electron:build
```

## 注意事项
- 请确保 Android 设备已在开发者选项中开启 **USB 调试** 并在连接电脑时授权。
- Windows 用户建议直接下载 `scrcpy` 官方自带 adb 的 release 压缩包，并将其解压路径添加至系统环境变量。
