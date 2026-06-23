# 设备巡检报告与证据包导出设计文档

- 日期：2026-06-23
- 目标版本：v3.1.0
- 状态：已确认设计，待实现计划

## 1. 背景与目标

当前应用已经具备 Android 设备管理、ADB 快捷操作、日志分析、AI 诊断、MCP 服务和会员体系。下一步需要把这些能力串成一个面向排查闭环的功能：用户选择一台在线设备后，一键生成可阅读的巡检报告，并导出可交给研发继续分析的证据包。

本功能目标：

- 降低用户手动执行多条 ADB 命令的成本。
- 让设备状态、系统信息、日志、截图和关键 dumpsys 输出集中沉淀。
- 单项采集失败不阻断整体巡检，失败原因写入报告。
- 生成两个明确产物：`inspection-report.md` 和 `evidence-package.zip`。

## 2. 功能范围

### 2.1 第一版包含

1. 在设备管理界面新增巡检入口，面向单台在线设备执行。
2. 巡检时显示采集进度、当前步骤、成功/失败数量。
3. 支持取消正在执行的巡检。
4. 默认执行标准采集，生成 Markdown 报告和 zip 证据包。
5. 可选勾选“包含 bugreport”，作为耗时增强项，默认关闭。
6. 完成后支持一键打开导出目录。

### 2.2 第一版不包含

1. 多设备批量巡检。
2. AI 自动总结巡检结论。
3. 在线上传证据包。
4. 规则库驱动的深度诊断。
5. PDF/HTML 报告导出。
6. 后端账号或云端历史管理。

这些能力可作为 v3.2 或后续版本扩展。

## 3. 用户体验

### 3.1 入口

在每个在线设备卡片中新增“巡检”按钮，放在常用操作区。点击后打开巡检面板或模态窗口，显示设备名称、设备 ID、采集选项和开始按钮。

建议第一版只提供两个选项：

- 标准证据：默认开启，不能关闭。
- 包含 bugreport：默认关闭，提示“耗时较长、文件较大”。

### 3.2 执行态

巡检执行时展示：

- 当前步骤名称，例如“采集系统属性”“导出 logcat”“截图”。
- 总进度，例如 `5/12`。
- 成功项、失败项数量。
- 取消按钮。

取消后保留已采集文件，并在报告中写入“用户取消，以下步骤未执行”。

### 3.3 完成态

完成后展示：

- 报告文件路径。
- 证据包文件路径。
- “打开目录”按钮。
- 失败项摘要。

如果全部关键项失败，则仍生成报告，但证据包中只包含错误记录和已创建的元数据。

## 4. 采集内容

### 4.1 设备基础信息

采集以下属性：

- `ro.product.brand`
- `ro.product.manufacturer`
- `ro.product.model`
- `ro.product.device`
- `ro.product.name`
- `ro.build.version.release`
- `ro.build.version.sdk`
- `ro.build.display.id`
- `ro.build.fingerprint`
- `ro.product.cpu.abi`
- `ro.serialno`
- 屏幕分辨率：`wm size`
- 屏幕密度：`wm density`

### 4.2 系统状态

采集：

- `adb devices -l`
- `id`
- `getprop`
- `uptime`
- `df -h`
- `cat /proc/meminfo`
- `top -b -n 1`
- `dumpsys battery`
- `dumpsys thermalservice`，失败时降级记录错误。

### 4.3 应用和前台状态

采集：

- `dumpsys activity activities`
- `dumpsys window`
- `cmd package list packages -f`
- `dumpsys package`，作为可选中等耗时项，第一版可纳入标准采集。

报告中只摘要关键内容，原始输出进入证据包。

### 4.4 日志证据

默认采集：

- `logcat -d -v threadtime`
- `logcat -b crash -d -v threadtime`
- `logcat -b events -d -v threadtime`

若设备不支持某个 buffer，记录失败但不中断。

### 4.5 图片证据

采集当前屏幕截图：

- 设备端：`screencap -p /sdcard/inspection-screen.png`
- 本地拉取到证据目录。
- 完成后尝试删除设备端临时文件。

截图失败时报告中记录失败原因。

### 4.6 可选 bugreport

用户勾选“包含 bugreport”时执行：

- `adb bugreport <localPath>`

该步骤超时时间比普通命令更长，失败时不影响其他产物。

## 5. 产物结构

每次巡检创建独立目录：

```text
inspection-YYYYMMDD-HHmmss-<deviceId>/
  inspection-report.md
  evidence-package.zip
  metadata.json
  raw/
    adb-devices.txt
    getprop.txt
    uptime.txt
    df.txt
    meminfo.txt
    top.txt
    battery.txt
    thermalservice.txt
    activity.txt
    window.txt
    package-list.txt
    package-dumpsys.txt
    logcat-main.txt
    logcat-crash.txt
    logcat-events.txt
  media/
    screen.png
  bugreport/
    bugreport.zip
  errors.json
```

`bugreport/` 目录仅在用户勾选并成功或部分生成时出现。

## 6. 报告格式

`inspection-report.md` 面向用户阅读，包含：

1. 巡检概要：设备、时间、App 版本、执行结果。
2. 设备信息：型号、系统版本、构建号、序列号、ABI、分辨率。
3. 系统状态：Root 状态、运行时间、磁盘摘要、内存摘要、电池摘要。
4. 当前前台信息：从 activity/window 输出中提取可读摘要。
5. 日志摘要：各日志文件是否采集成功、文件大小。
6. 失败项：命令、错误信息、是否影响整体结果。
7. 附件清单：证据包内容说明。

报告中的摘要可以用简单解析实现，不要求第一版做复杂诊断。

## 7. 技术设计

### 7.1 主进程模块

新增 `electron/lib/inspection.cjs`，职责：

- 注册巡检相关 IPC。
- 管理当前巡检任务和取消状态。
- 执行 ADB 命令。
- 创建导出目录。
- 写入 raw 文件、报告、metadata、errors。
- 打包 zip。
- 推送进度事件到渲染进程。

建议 IPC：

| Channel | 方向 | 作用 |
|---|---|---|
| `inspection:start` | renderer -> main | 开始巡检 |
| `inspection:cancel` | renderer -> main | 取消当前巡检 |
| `inspection:openFolder` | renderer -> main | 打开巡检目录 |
| `inspection:progress` | main -> renderer | 推送进度 |
| `inspection:done` | main -> renderer | 推送完成结果 |

### 7.2 渲染进程组件

新增 `src/components/InspectionPanel.jsx`，职责：

- 展示巡检选项。
- 展示执行进度。
- 展示完成结果。
- 发起取消和打开目录操作。

`DeviceCard.jsx` 只增加入口按钮和面板挂载点，不承担采集逻辑。`App.jsx` 只负责传递设备信息和主题，避免继续扩大现有文件职责。

### 7.3 命令清单

命令清单放在 `inspection.cjs` 内部常量即可。第一版不单独抽象为配置文件，避免过早扩展。后续做规则库或可配置巡检模板时再拆出。

### 7.4 zip 打包

优先使用项目已有依赖或 Node/Electron 可用能力。如果当前依赖没有 zip 工具，新增轻量依赖前需要评估包体积。也可以第一版用 PowerShell `Compress-Archive` 打包，但要做好 Windows-only 约束和错误提示。由于当前应用主要面向 Windows 并内置 `scrcpy-win64`，第一版可接受 Windows-only 打包方案。

## 8. 错误处理

1. ADB 不可用：巡检不启动，显示明确错误。
2. 设备离线：巡检不启动。
3. 单项命令失败：记录到 `errors.json` 和报告，继续下一项。
4. 命令超时：杀掉该命令，记录超时，继续下一项。
5. 用户取消：停止后续任务，尝试终止当前命令，生成部分报告。
6. 打包失败：报告和 raw 文件仍保留，UI 显示 zip 打包失败。

## 9. 会员策略

第一版建议设为会员功能，但保留基础版可见入口：

- 基础版点击“巡检”显示会员专属提示，引导到会员中心。
- 会员版可执行完整巡检。

理由：该功能是高价值调试闭环能力，且与 v3.0 会员权益一致。若需要提高转化，可允许基础版生成一次“基础巡检报告”，但不导出证据包；这不作为第一版默认方案。

## 10. 验收标准

1. 在线设备点击巡检后能看到进度。
2. 标准采集完成后生成 `inspection-report.md` 和 `evidence-package.zip`。
3. 证据包包含 raw 命令输出、日志和截图。
4. 勾选 bugreport 后，证据包包含 bugreport 产物或明确失败记录。
5. 单项命令失败不阻断整体巡检。
6. 用户取消后生成部分报告，并清楚标记取消状态。
7. 完成后可打开导出目录。
8. 非会员无法执行巡检，并展示会员引导。
9. `npm run build` 通过。
10. 发版前按项目发布流程执行 `npm run electron:build`。

## 11. 后续扩展

- AI 自动总结巡检结果。
- 多设备批量巡检。
- 巡检模板和自定义命令。
- 规则库诊断。
- PDF/HTML 报告导出。
- 历史巡检记录管理。
