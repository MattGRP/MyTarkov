# MyTarkov

Escape From Tarkov 非官方移动端工具，基于 `Expo + React Native` 构建，支持 iOS / Android。

## 功能概览
- 玩家信息页：角色基础信息、装备、任务等展示。
- 搜索页四合一：
  - 物品搜索（排序/筛选/详情）
  - 玩家搜索
  - 任务搜索与详情
  - 商人搜索与详情
- 设置页：
  - 语言切换（`zh / en / ru`）
  - 玩家绑定/换绑/解绑
  - 调试日志导出、联系作者入口

## 平台差异（重要）
- iOS：
  - 玩家搜索支持 `名称 + AccountID`
  - 使用 Turnstile token 后台流程
- Android：
  - 玩家搜索仅支持 `AccountID`
  - 绑定流程走可见 Tarkov.dev WebView（从玩家主页 URL 自动识别 AccountID 后确认绑定）

## 技术栈
- Expo 54
- React Native 0.81
- Expo Router
- React Query
- TypeScript
- expo-image / react-native-svg / react-native-webview

## 目录结构
```text
app/
  (tabs)/
    (home)/               # 我的资料
    search/               # 搜索（物品/玩家/任务/商人）
    settings/             # 设置
    tasks/                # 任务详情相关路由
components/               # 复用 UI 与业务组件（含 Turnstile/绑定面板）
services/                 # API 请求与缓存逻辑
types/                    # 类型定义
constants/                # 主题、i18n、配置常量
utils/                    # 工具函数（格式化、日志等）
```

## 环境要求
- Node.js（建议 LTS）
- Bun
- iOS 开发：Xcode（仅本地原生构建需要）
- Android 开发：Android Studio + SDK + emulator + adb（仅本地原生构建需要）

## 安装与运行
```bash
bun i
```

### 启动开发服务
```bash
bun run start
```

### Web
```bash
bun run start-web
```

### 本地原生运行
```bash
# Android
bun run android

# iOS
bun run ios
```

## 常用脚本
- `bun run start`：隧道模式启动（Rork CLI）
- `bun run start-web`：Web 预览
- `bun run lint`：ESLint
- `bunx tsc --noEmit`：TypeScript 类型检查

## 打包
项目已配置 `eas.json`：
- `preview`：Android `apk`（内测安装包）
- `production`：Android `aab`

示例：
```bash
# 预览 APK
eas build -p android --profile preview

# 生产 AAB
eas build -p android --profile production
```

## Android 模拟器相关
若 PowerShell 提示 `emulator` 命令不存在，使用 SDK 完整路径启动，或把 SDK `emulator` 目录加入 PATH。

安装 APK（模拟器/设备）：
```bash
adb install -r <your-apk-path.apk>
```

## 已知约束
- Android 无稳定的零交互 Turnstile 方案，因此采用 AccountID-only 搜索 + WebView 绑定回退策略。
- 上游 `api.tarkov.dev` 个别字段/查询在某些组合下会出现 `INTERNAL_SERVER_ERROR`，代码中已做查询拆分与降级。

## 排错建议
- Metro 缓存问题：
```bash
bunx expo start --clear
```
- Android 真机连开发服务失败：
```bash
adb reverse tcp:8081 tcp:8081
```
- “Unable to load script”：
  - 确认 Metro 正在运行
  - 确认设备与电脑连通（同网段或 adb reverse）

## 维护约定
- 三语文案改动必须同步 `constants/i18n.ts`（`zh/en/ru`）。
- 搜索与详情 UI 调整后需回归 iOS/Android 安全区与键盘遮挡。
- 仓库浏览请避免 `Get-Content`（当前环境会导致卡顿），优先使用 `rg` 或 `cmd /c type`。

## 关键文档
- 会话交接与决策记录：[`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md)
- 工程开发准则（加载动画与 API 分块策略）：[`docs/ENGINEERING_GUIDELINES.md`](./docs/ENGINEERING_GUIDELINES.md)
