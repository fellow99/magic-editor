# overall-spec.md — magic-editor 整体功能规范（As-Built）

> 反向归纳自源代码。本规范刻画**已实现**的能力边界，不包含未来计划。所有功能项可在源代码中找到证据。

## 1. 产品定义

magic-editor 是 **magic-api 后端的官方 Web IDE**：
- 提供基于 monaco 的 magic-script 在线编辑器
- 提供接口（API）/函数（Function）/数据源（DataSource）的资源管理 UI
- 提供本地化调试能力（断点 / 单步 / 变量 / 控制台）
- 通过两种形态交付：jar 内嵌 SPA、NPM Vue 3 组件

**目标用户**：使用 magic-api 的后端 / 全栈开发者。

## 2. 功能特性清单（FR）

> 编号 `FR-XXX`；每条附实现位置。

### 2.1 基础与启动

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-001 | 通过 `parent.MAGIC_EDITOR_CONFIG` / `window.MAGIC_EDITOR_CONFIG` / 默认值三层注入配置 | `App.vue:18-28` |
| FR-002 | 启动时拉取 `/config.json` 并缓存至 `contants.config` | `magic-editor.vue:258-281` |
| FR-003 | 启动时尝试自动登录（`GET /login`），失败弹出登录覆盖层 | `magic-editor.vue:303-314` |
| FR-004 | 前后端版本不一致时弹框告警 | `magic-editor.vue:268-273` |
| FR-005 | 关闭页面前提示"系统可能不会保存您所做的更改"（可关） | `magic-editor.vue:191-193` |
| FR-006 | 检查 maven-central 最新版本并提示更新（可关） | `magic-editor.vue:315-347` |

### 2.2 鉴权

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-010 | 自定义 token Header `magic-token`，初始值 `unauthorization` | `contants.js:18-19`、`request.js:111-112` |
| FR-011 | localStorage 持久化 token | `magic-editor.vue:304`、`store.js` |
| FR-012 | HTTP 响应 code=401 自动弹出登录覆盖层 | `request.js:151-153` |
| FR-013 | 登出时关闭 WebSocket | `magic-editor.vue:219-222` |
| FR-014 | 登录覆盖层组件 magic-login | `components/layout/magic-login.vue` |

### 2.3 编辑器（monaco + magic-script）

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-020 | 集成 monaco 编辑器并加载 editor / json worker | `magic-editor.vue:56-63` |
| FR-021 | 注册自定义语言 magic-script | `scripts/editor/magic-script.js` |
| FR-022 | 自研 magic-script 词法/语法/AST | `scripts/parsing/{tokenizer,parser,ast,index}.js` |
| FR-023 | 自动补全（含变量、Java 类、import 类、函数签名） | `scripts/editor/completion.js` (368 行)、`java-class.js` |
| FR-024 | 鼠标悬停显示类型/文档 | `scripts/editor/hover.js` (151 行) |
| FR-025 | 函数签名提示 | `scripts/editor/signature.js` |
| FR-026 | 代码折叠 | `scripts/editor/folding.js` (154 行) |
| FR-027 | 同名变量高亮 | `scripts/editor/high-light.js` (120 行) |
| FR-028 | 主题 default / dark 内置 + 用户自定义主题 | `scripts/editor/{default,dark}-theme.js`、`defineTheme()` |
| FR-029 | 字体族 / 字号可配置 | `contants.js:31-32`、`magic-editor.vue:124-129` |
| FR-030 | MyBatis 风格脚本支持（标签解析） | `scripts/editor/mybatis.js` (1419 行) |
| FR-031 | 代码格式化 | `scripts/beautifier/` |

### 2.4 资源管理

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-040 | 接口资源树（CRUD + 复制 + 移动 + 锁定） | `components/resources/magic-api-list.vue` |
| FR-041 | 函数资源树 | `components/resources/magic-function-list.vue` |
| FR-042 | 数据源管理（含 JDBC 驱动 / 数据源类型可配置） | `components/resources/magic-datasource-list.vue`、`contants.js:28-29` |
| FR-043 | 最近打开列表（持久化到 localStorage） | `components/resources/magic-recent-opened.vue`、`contants.js:21-22` |
| FR-044 | URL 通过 `?openIds=` 批量打开资源 | `magic-editor.vue:351-369` |
| FR-045 | 全局搜索打开（`bus.$emit('search-open', item)`） | `magic-editor.vue:212-218` |
| FR-046 | 资源跳转定位（`position-api` / `position-function`） | `magic-editor.vue:224-231` |
| FR-047 | 默认展开行为可配置 | `contants.js:27`、`magic-editor.vue:120` |

### 2.5 请求 / 调试

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-050 | 请求面板（参数/请求体/Header/Cookie/Path） | `components/layout/` 请求相关 |
| FR-051 | 调试 Header `Magic-Request-Session` / `Magic-Request-Breakpoints` 注入 | `contants.js:13-14` |
| FR-052 | 调试响应码 1000 表示命中断点 | `contants.js:23` |
| FR-053 | 控制台日志（最大行数可配置） | `contants.js:26`、`magic-editor.vue:130-132` |
| FR-054 | 快捷键：Ctrl+S 保存 / Ctrl+Q 测试 / F8 继续 / F6 单步 | `magic-editor.vue:247-257` |
| FR-055 | 自动保存开关 | `contants.js:8`、`magic-editor.vue:143` |
| FR-056 | Decoration 超时（断点高亮等）可配置 | `contants.js:9` |

### 2.6 WebSocket 实时通信

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-060 | 自动重连（ReconnectingWebSocket） | `scripts/reconnecting-websocket.js` |
| FR-061 | 连接成功后发送登录帧 `login,<token>` | `magic-editor.vue:119` |
| FR-062 | 服务端消息按 `msgType,arg1,...,jsonPayload` 解析并广播 `ws_<msgType>` 事件 | `websocket.js:24-39` |
| FR-063 | 客户端通过 `bus.$emit('message', msgType[, content])` 发送 | `websocket.js:7-13` |

### 2.7 UI / 布局

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-070 | 顶部 Header（皮肤切换 / 文档 / 仓库 / QQ群可配置显示） | `components/layout/magic-header.vue`、`magic-editor.vue:137-142` |
| FR-071 | 左侧工具条（接口/函数/数据源 三选一切换） | `magic-editor.vue:7-9, 13-15` |
| FR-072 | 资源栏与编辑器之间可拖拽分隔 | `magic-editor.vue:282-302`（宽度 274~700px） |
| FR-073 | 底部 Options 区域（请求 / 测试 / 控制台等子页签） | `components/layout/magic-options.vue`、`contants.js:30` |
| FR-074 | 状态条（版本 / 状态文案） | `components/layout/magic-status-bar.vue` |
| FR-075 | Loading 覆盖层（启动时） | `components/common/magic-loading.vue` |
| FR-076 | 模态框 / 确认框 API（`$magicAlert` / `$magicConfirm`） | `components/common/modal/` |
| FR-077 | 右键菜单 | `components/common/magic-contextmenu/` |
| FR-078 | 树组件 | `components/common/magic-tree.vue` 等 |

### 2.8 国际化

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-080 | monaco 文案中英两套，构建期通过自定义 Vite 插件注入 | `vite.config.js:7-116`、`plugins/editor.main.nls.*.js` |
| FR-081 | 应用自身文案为中文硬编码（不支持运行时切换） | 多处源码 |

### 2.9 交付形态

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-090 | 应用模式构建（jar 嵌入静态资源） | `vite.config.js`、`package.json` `build` 脚本 |
| FR-091 | 库模式构建（NPM 组件） | `vite.config.js:118-207`、`package.json` `build:lib` 脚本 |
| FR-092 | NPM 库 `vue` external、双格式 (umd/es) | `vite.config.js` rollupOptions |
| FR-093 | 库样式输出固定文件名 `magic-editor.css` | `vite.config.js` `assetFileNames` |

## 3. 非功能需求（NFR）

| ID | 类别 | 现状 / 实现 | 证据 |
|---|---|---|---|
| NFR-001 | 浏览器兼容 | 现代浏览器（依赖 ES module / fetch） | `vite.config.js`、未见 polyfill |
| NFR-002 | 启动性能 | 资源接口并行（`Promise.all`） | `magic-editor.vue:95-101` |
| NFR-003 | WebSocket 韧性 | 自动重连 | `reconnecting-websocket.js` |
| NFR-004 | 状态日志 | 内存数组上限不限 | `bus.js:4`（无截断） |
| NFR-005 | 安全 | token 仅放 localStorage（XSS 风险默认接受） | `store.js`、未见加固 |
| NFR-006 | 国际化 | monaco 双语，应用 UI 仅中文 | 见 FR-080/081 |
| NFR-007 | 可观测性 | 第三方统计 cnzz（待澄清是否保留） | `bus.js:28-48`（C-002） |

## 4. 用户场景（核心用例）

### UC-1：jar 模式 — 用户访问 `/magic/web`

1. 浏览器加载 SPA → App.vue 自动判定 `inJar=true`
2. 自动登录尝试（FR-003）
3. 拉取 `/config.json`（FR-002）
4. 加载接口/函数/数据源资源（FR-040~042）
5. 用户编辑脚本 → Ctrl+S 保存（FR-054）→ Ctrl+Q 测试（FR-054）

### UC-2：库模式 — 宿主 Vue 3 应用集成

1. `npm i magic-editor` → `import 'magic-editor/dist/magic-editor.css'`
2. 在模板中使用 `<magic-editor :config="{ baseURL, serverURL, ... }">`
3. 其余流程同 UC-1，但 baseURL 由宿主显式传入

### UC-3：调试工作流

1. 用户在编辑器里点击行号设置断点
2. Ctrl+Q 触发执行 → POST 时携带 `Magic-Request-Breakpoints`
3. 命中断点 → 后端响应 `code=1000`（FR-052）→ UI 进入调试态
4. WS 推送变量 / 堆栈 → 通过 `ws_*` 事件渲染
5. F8 继续 / F6 单步 → 通过 WS `bus.$emit('message', ...)`

## 5. 输入 / 输出契约

| 输入 | 来源 | 处理 |
|---|---|---|
| `config` props | 宿主 / window / parent | 灌入 `contants` 模块单例 |
| `/config.json` | 后端 | 写入 `contants.config` |
| WebSocket 帧 | 后端 | 解析为 `ws_*` 事件 |
| 用户输入 | 编辑器 / 表单 | monaco 模型 / 组件本地状态 |

| 输出 | 目标 | 形式 |
|---|---|---|
| HTTP 请求 | magic-api 后端 | form-urlencoded + 自定义 Header |
| WebSocket 帧 | magic-api 后端 | `msgType[,content]` |
| localStorage | 浏览器 | token / 最近打开 / 忽略版本 |
| 第三方统计 | cnzz s4.cnzz.com | 见 C-002 |

## 6. 不在范围（Out of Scope）

> 反向归纳：源代码中**未见**以下能力。

- 离线模式 / Service Worker
- 多用户协同编辑
- 版本控制 / Git 集成
- 应用 UI 多语言切换（仅 monaco 文案双语）
- 移动端响应式适配
- 单元测试 / E2E 测试（无测试目录）
- 类型检查（无 TS / JSDoc 严格模式）
- CI/CD 工作流（无 `.github/` 工作流目录）

## 7. 待澄清

集中登记于 [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md#待澄清事项)：
- C-001：`src/api/web.js` 空文件用途
- C-002：cnzz 第三方统计是否保留
- C-003：axios 0.21 旧版本是否升级
