# constitution.md — magic-editor 项目宪法

> 本文件记录工程中**不可破坏**的工程原则。所有规范文档、模块设计、后续重构必须遵守；如需违反，须显式记录例外并经评审。
> 原则均通过对源代码的反向归纳得出，每条均附**事实证据（路径/行号）**。

## 第一条 单一主组件 + 注入式配置

**原则**：整个前端通过单一根组件 `<MagicEditor :config="...">` 暴露能力；所有运行参数（baseURL、serverURL、inJar 等）必须通过 props/window 注入，**严禁**在组件内部硬编码后端地址。

**证据**：
- `src/components/magic-editor.vue` 是唯一对外组件
- `src/App.vue:18-28` 三层兜底注入：`parent.MAGIC_EDITOR_CONFIG` → `window.MAGIC_EDITOR_CONFIG` → `import.meta.env.VITE_DEV_MODE` 默认值
- `src/index.js:10` 仅注册一个组件 `MagicEditor`

**衍生约束**：
- 任何新增功能不得新增暴露的根组件。
- 库模式与 jar 模式共用同一组件，区别仅在 `config.inJar`。

## 第二条 前后端契约即真相

**原则**：前端是 magic-api 后端的"控制面 UI"，**所有业务数据、脚本、资源全部由后端拥有**；前端不得持久化业务数据，只允许 localStorage 缓存"用户偏好/最近打开"。

**证据**：
- `src/scripts/store.js` 仅封装 `localStorage.{set,get,remove}`，无 IndexedDB / SessionStorage / 其它持久化
- `src/scripts/contants.js:21-22` 仅 `RECENT_OPENED_TAB`/`RECENT_OPENED` 两类用户偏好键
- 所有资源加载均通过 `src/api/request.js` 走 HTTP

**衍生约束**：
- 离线编辑、本地脚本仓库等需求必须先与后端协商扩展契约。
- 不允许引入 IndexedDB/Service Worker 缓存业务数据。

## 第三条 通信双通道：HTTP 命令 + WebSocket 事件

**原则**：HTTP 用于一次性请求/响应（CRUD/运行/编译）；WebSocket 仅用于**调试/日志/事件流**。两者各司其职，不可混用。

**证据**：
- `src/api/request.js` 全部走 axios（form-urlencoded + qs）
- `src/scripts/websocket.js` 仅做事件分发：`bus.$emit('ws_' + msgType, args)`
- `src/scripts/contants.js:13-19` 调试相关 Header（`Magic-Request-Session`、`Magic-Request-Breakpoints`）通过 HTTP，但调试输出走 WS

**衍生约束**：
- 不得通过 WS 发起 CRUD。
- 不得通过 HTTP 长轮询替代 WS。

## 第四条 事件总线即全局状态

**原则**：跨组件通信统一使用 `src/scripts/bus.js` 提供的极简 EventBus；**禁止**引入 Vuex / Pinia / Provide-Inject 全局状态。组件内部状态使用 Vue 自身响应式即可。

**证据**：
- `package.json:dependencies` 不含任何状态管理库
- `bus.js:6-26` 自建 `createEventBus()` 实现 `$on/$off/$emit`
- `websocket.js:7,15,39` 全部通过 bus 转发
- `request.js:152` 401 通过 `bus.$emit('showLogin')` 触发登录覆盖层

**衍生约束**：
- 新跨组件通信必须走 bus；事件名以 `ws_*`（WebSocket）、`status`/`report`（埋点）、其余动词命名（`showLogin`、`message` 等）。

## 第五条 monaco 一切围绕"magic-script"

**原则**：编辑器内核为 monaco；自研内容（解析器/语言服务/MyBatis 支持）**只为 magic-script 服务**，不得通用化为多语言 IDE。

**证据**：
- `src/scripts/parsing/*` 是 magic-script 专用 lexer/parser/AST
- `src/scripts/editor/magic-script.js` 注册 monaco 语言
- `src/scripts/editor/{completion,hover,signature,folding,high-light}.js` 均针对 magic-script
- `src/scripts/editor/mybatis.js` 1419 行专门支持 MyBatis

**衍生约束**：
- 新增语言（如 SQL、Groovy）须独立模块，不得改动 magic-script 实现。
- monaco 主版本升级须连带验证自定义 i18n 注入（见第七条）。

## 第六条 类型契约由 Header 而非 URL 表达

**原则**：响应内容类型、调试模式、鉴权状态通过 HTTP **自定义 Header** 表达，不通过 URL 路径或查询参数。

**证据**：
- `contants.js:13-19`：
  - `Magic-Request-Session`、`Magic-Request-Breakpoints`：调试上下文
  - `ma-content-type`、`ma-content-disposition`：响应类型
  - `magic-token`：鉴权
- `request.js:112` 自动注入 `magic-token`

**衍生约束**：
- 新协议字段优先扩展 Header；URL 仅承载资源标识与动作。

## 第七条 国际化只信"语言包索引化"机制

**原则**：monaco 的语言包通过 `vite.config.js:monacoEditorLocalesPlugin` 在构建期注入；**严禁**在运行时通过 monaco 官方 API 切换语言（该 API 在 0.29.x 不可靠）。

**证据**：
- `vite.config.js:7-116` 替换 `esm/vs/nls.js` 中的 `localize`
- `plugins/editor.main.nls.{zh-cn,en}.js` 全量字面量

**衍生约束**：
- 升级 monaco 主版本前必须验证 `esm/vs/nls.js` 接口未变。
- 新增语言须同时提供"完整字面量包"。

## 第八条 双构建产物（应用 + 库）共存

**原则**：必须同时支持 jar 内嵌（应用模式 → `dist-app/`）与 NPM 库（`dist/`）两种交付形态；任何不能同时构建出两种产物的改动一律拒绝。

**证据**：
- `vite.config.js:118-207` 通过 `mode === 'lib'` 分支
- `package.json:10-16`：`main`/`module` 指向 `dist/`，`scripts.build`/`build:lib` 双命令

**衍生约束**：
- 库模式 `vue` 必须 external（已通过 `rollupOptions.external` 强制）。
- 共享 CSS 文件名必须命名为 `magic-editor.css`，不得带 hash。

## 第九条 错误反馈一律走模态框 + Bus

**原则**：用户可见的错误统一通过 `modal.magicAlert` 弹出；网络/会话错误（401）通过 bus 触发登录层；**禁止** `console.error` 作为唯一反馈。

**证据**：
- `request.js:62-66, 117-127` 失败均 `modal.magicAlert`
- `request.js:151-153` 401 → `bus.$emit('showLogin')`

**衍生约束**：
- 静默失败必须显式注释说明原因。

## 第十条 源代码即文档真相

**原则**：本规范文档套件所有论断必须可在源代码中找到证据；任何无法溯源的设计意图必须以 `[NEEDS CLARIFICATION]` 标记，不得臆测填空。

**证据**：本文件每条原则均附路径/行号。

**衍生约束**：
- 模块文档遵循同一规则。
- 待澄清事项集中登记于 `SPECS_CHECKLIST.md` 的"待澄清事项"表。

---

## 例外登记

> 任何违反上述原则的现状/计划均须在此登记。当前已识别例外：

| ID | 违反条款 | 现状 | 备注 |
| --- | --- | --- | --- |
| E-001 | 第十条 | `src/api/web.js` 为空文件 | 已记 C-001 待澄清 |
| E-002 | 第八条衍生 | 未正式 CI 验证双构建 | 仅命令存在，未见 CI 配置 |
| E-003 | 第二条衍生 | `bus.js:28-48` 注入 cnzz 第三方统计 | 已记 C-002 待澄清 |
