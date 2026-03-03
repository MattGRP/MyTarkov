# MyTarkov Project Knowledge Base

> 目标：给任何新会话/新协作者一个“可直接进入开发”的项目总览，而不是一次对话的流水记录。
> 更新时间：2026-03-03

## 1. 项目定位
- 项目：`MyTarkov`
- 类型：Expo + React Native 的跨平台移动应用（iOS / Android）
- 主题：Escape From Tarkov 数据查询与个人信息展示工具
- 核心页面：
  - `我的资料`（玩家信息）
  - `搜索`（物品 / 玩家 / 任务 / 商人）
  - `设置`（语言、绑定、日志、反馈）

## 2. 代码结构（高频目录）
- 路由页面：`app/`
  - `app/(tabs)/(home)/` 我的资料
  - `app/(tabs)/search/` 搜索与详情页
  - `app/(tabs)/settings/` 设置
  - `app/(tabs)/tasks/` 任务详情相关路由（部分由搜索复用）
- 服务层：`services/`
  - `services/tarkovApi.ts` 主 API、缓存、聚合逻辑（最关键）
- 类型：`types/`
  - `types/tarkov.ts`
- 多语言：`constants/i18n.ts`
- 组件：`components/`
  - 账号绑定、Turnstile、Header、详情展示等
- 工具：`utils/`
  - 格式化、日志等

## 3. 技术栈与运行方式
- 框架：Expo 54 / React Native 0.81 / Expo Router / React Query / TypeScript
- 包管理：Bun
- 常用命令：
  - `bun i`
  - `bun run start`
  - `bun run android`
  - `bun run ios`
  - `bunx tsc --noEmit`

## 4. 平台差异（必须遵守）
- iOS：
  - 玩家搜索支持：`名称 + AccountID`
  - 使用 Turnstile token 后台流程
- Android：
  - 玩家搜索仅支持：`AccountID`
  - 绑定玩家采用可见 WebView 回退方案（用户进入 tarkov.dev 玩家主页后提取 AccountID）
- 原因：Android 上零交互 Turnstile 稳定性不可依赖，已采用产品级回退策略

## 5. 数据源与参考仓库
- 主 GraphQL：`https://api.tarkov.dev/graphql`
- 站点：`https://tarkov.dev`
- 玩家页（绑定/参考）：`https://tarkov.dev/players?gameMode=regular`
- 参考仓库（实现对照）：
  - `https://github.com/the-hideout/tarkov-dev`
- 次级参考站点（数据来源背景）：`https://www.sp-tarkov.com/`

## 6. 关键业务规则（持续有效）
- token 策略：
  - token 可用则不刷新
  - 仅缺失时刷新
  - 失败指数退避
- UI 规则：
  - 统一 Header 与安全区规范
  - 仅可跳转实体使用可点击样式，不可跳转信息禁止伪“胶囊按钮”
- 语言规则：
  - 三语并行维护：`zh/en/ru`
  - 俄语必须持续可用（优先级高）

## 7. 商人中文映射（当前产品约定）
- Fence = 黑商
- Jaeger = 杰哥
- Lightkeeper = 灯塔商人
- Mechanic = 机械师
- Peacekeeper = 美商
- Prapor = 俄商
- Therapist = 大妈
- Ragman = 服装商
- Skier = 小蓝帽

## 8. 搜索域功能现状（面向回答问题）
- 物品搜索：排序、分类筛选、详情页价格与历史
- 玩家搜索：iOS 名称+ID；Android 仅 ID
- 任务搜索：多维筛选（商人/等级/地图/阵营/3x4/灯塔商人）
- 商人详情：
  - 等级 Tab
  - 解锁条件
  - 补货倒计时（详情与列表）
  - 商品排序 + 分类筛选 + 购买类型筛选（全部/购买/兑换）
  - 兑换所需物品子项展示

## 9. API 实现要点（避免踩坑）
- `fetchTraderById` 使用“两段式”：
  - 先轻量 traders 定位索引
  - 再 `limit=1 + offset` 拉单商人详情
- 原因：某些深层字段组合会触发上游 `INTERNAL_SERVER_ERROR`
- 建议：新查询先做小样本验证，再接入 UI；避免一次性重字段全查

## 10. 关键文件索引（回答问题优先查看）
- 搜索入口与筛选：`app/(tabs)/search/index.tsx`
- 物品详情：`app/(tabs)/search/item/[id].tsx`
- 商人详情：`app/(tabs)/search/trader/[id].tsx`
- 任务详情：`app/(tabs)/tasks/[id].tsx`
- API：`services/tarkovApi.ts`
- 类型：`types/tarkov.ts`
- 文案：`constants/i18n.ts`
- token bootstrap：`components/PlayerSearchTokenBootstrap.tsx`
- 绑定面板：`components/AccountBindingPanel.tsx`

## 11. 调试与排错建议
- 首先执行：`bunx tsc --noEmit`
- UI 无变化优先排查 Metro 缓存：`bunx expo start --clear`
- Android “Unable to load script”：
  - 确认 Metro 在运行
  - `adb reverse tcp:8081 tcp:8081`
- 任何慢请求问题先区分：
  - 上游接口慢
  - 本地串行/重复请求导致慢

## 12. 当前环境开发约束（非常重要）
- 在本项目环境中，尽量不要用 `Get-Content` 读取大文件（可能导致编辑器卡顿）
- 推荐：
  - `rg` / `rg --files`
  - `cmd /c type`
  - 小范围脚本读取

## 13. 新会话快速接入清单
- 1) 先读本文件 + `README.md`
- 2) 确认平台目标（iOS 还是 Android）
- 3) 锁定变更范围（页面层 / 组件层 / service 层 / i18n）
- 4) 修改后最少执行：
  - `bunx tsc --noEmit`
- 5) 涉及文案必须补齐 `zh/en/ru`
- 6) 涉及商人/任务/搜索规则，先核对“第 4/6/7 节”的约束再改代码
