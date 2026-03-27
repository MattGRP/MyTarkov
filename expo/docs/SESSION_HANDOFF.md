# MyTarkov 交接文档（2026-03-04）

## 1. 项目定位
- 技术栈：Expo + React Native + Expo Router + React Query + TypeScript。
- 核心页面：个人资料、搜索（任务/Boss/商人/物品/玩家）、设置、任务详情。
- 数据源：`https://api.tarkov.dev/graphql`，参考实现：`https://github.com/the-hideout/tarkov-dev`。

## 2. 本轮对话总结（关键决策）
- 物品、任务、Boss、商人、玩家相关页面持续做了结构和交互修正，重点是分类可达性、详情完整性、翻译覆盖和请求稳定性。
- 统一了“先显示基础信息，再分块加载详情”的页面策略，配套骨架屏，减少整页阻塞。
- 搜索/列表场景统一分页思路，避免一次性请求过大导致慢响应。
- 增加“当前页面请求优先级 + 离开页面取消请求/切换条件取消请求”策略，降低后台预热对前台的阻塞。
- 游戏模式改为模式化请求与模式化主题：PvP/PvE 使用不同主色，且请求参数跟随模式。
- 主题色与背景色改为统一入口管理，清理页面/组件中的硬编码色值。
- i18n 改为统一入口 + 拆分模块，避免单文件过大。

## 3. 已落地的结构调整
- i18n 统一入口：
  - `constants/i18n.ts`（仅作为统一导出入口）
- i18n 拆分文件：
  - `constants/i18n/index.ts`
  - `constants/i18n/types.ts`
  - `constants/i18n/translations.ts`
  - `constants/i18n/localizers.ts`
- 主题色统一入口：
  - `constants/colors.ts`（包含模式色、透明度工具、accent 主题工具）

## 4. 当前开发铁律（必须遵守）
- 不允许猜测上游 API 字段或结构。
- 新增/修改任何查询前，先用真实请求验证 `api.tarkov.dev/graphql` 返回结构。
- 对照 `the-hideout/tarkov-dev` 的字段使用方式再落代码。
- 出现运行时错误时，先复现实例请求并记录真实返回，再改映射逻辑。
- 该规则必须写入后续总结与交接文档，作为硬约束。

## 5. 页面与请求规范（长期）
- 加载规范：禁止转圈作为主加载态，统一使用骨架屏（结构先行）。
- 数据规范：summary/detail 解耦，详情按 section 独立加载。
- 请求规范：支持 `AbortSignal`，切页/切条件/离开页面立即取消在途请求。
- 列表规范：默认分页，避免整表大查询。
- 错误规范：不隐藏接口错误；允许 partial data 时必须记录日志并可追踪。

## 6. i18n 与翻译规范
- 所有多语言文案必须进入 i18n，不允许散落在页面中硬编码。
- 实体名本地化（分类/商人/Boss/任务状态等）统一走 `constants/i18n/localizers.ts`。
- 文案新增需同步维护 `zh/en/ru`，禁止只加单语言。

## 7. 视觉与主题规范
- 所有颜色统一由 `constants/colors.ts` 提供，不在页面写十六进制或 `rgba(...)` 字面量。
- PvP/PvE 的 accent 与背景色允许差异，但必须通过主题入口切换，不允许组件级分叉硬编码。

## 8. 常用检查命令
- 类型检查：`bunx tsc --noEmit`
- 规范检查：`bun run lint`
- 清缓存启动（UI 变更未生效时）：`bunx expo start --clear`

## 9. 关键文件索引
- 搜索入口：`app/(tabs)/search/index.tsx`
- 物品详情：`app/(tabs)/search/item/[id].tsx`
- Boss 详情：`app/(tabs)/search/boss/[id].tsx`
- 商人详情：`app/(tabs)/search/trader/[id].tsx`
- 任务详情：`app/(tabs)/tasks/[id].tsx`
- API 层：`services/tarkovApi.ts`
- 领域类型：`types/tarkov.ts`
- 主题：`constants/colors.ts`
- i18n 入口：`constants/i18n.ts`

## 10. 后续接手建议
- 先看本文件 + `docs/ENGINEERING_GUIDELINES.md`。
- 开发前先确认是 PvP 还是 PvE 场景，检查请求参数是否正确透传。
- 任何新功能先做最小可验证查询（真实 API），再扩展 UI。

## 11. 当前待确认项（交接时未完全闭环）
- 若再次出现 GraphQL `Unexpected error` / partial data：
  - 先保存实际查询语句与返回体（含 errors + data）。
  - 再对照 `the-hideout/tarkov-dev` 同功能查询做字段裁剪与分段查询。
- 若再次出现 Turnstile 相关失败：
  - 先确认当前接口是否存在无需 token 的 `accountId` 路径（优先使用）。
  - 仅在确实无替代接口时再走 token/Turnstile 分支。
- 若出现“叶子分类无物品”或“节点有子分类但仍可返回物品”：
  - 需要做一次离线核查表（`category id -> hasChildren -> itemCount`），并持久化为调试文档。

## 12. 交接执行清单（每次改接口必走）
1. 写最小可运行 GraphQL 查询，直接请求 `api.tarkov.dev/graphql`。
2. 保存真实返回示例（成功与失败各一份）。
3. 更新 `types/tarkov.ts` 与映射逻辑，禁止 `any` 兜底吞错。
4. 跑 `bunx tsc --noEmit` 与 `bun run lint`。
5. 在 PR 或交接文档记录：查询语句、关键字段、风险点、回归点。
