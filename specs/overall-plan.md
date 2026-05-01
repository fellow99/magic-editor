# overall-plan.md — magic-editor 整体实施计划（As-Built）

> 本文件以"已建成系统"视角描述实施分层、依赖与构建流水线。代码现状为基线，本文件不安排未来工作，仅记录工程上**已经做出的**实施决策。

## 1. 实施总览

| 维度 | 当前实施 |
|---|---|
| 框架 | Vue 3.4 (Composition / Options 混用，主组件用 Options) |
| 构建 | Vite 5.4.21（双 mode：app / lib） |
| 编辑器内核 | monaco-editor 0.29.1 + 自研 magic-script 语言服务 |
| 通信 | axios 0.21 (HTTP) + 自研 ReconnectingWebSocket (WS) |
| 状态 | 自实现 EventBus（无 Vuex/Pinia） |
| 持久化 | localStorage（仅偏好/最近） |
| 测试 | 无 |
| CI | 无（仅本地 npm scripts） |

## 2. 实施分层与对应代码

实施严格对齐 [ARCHITECTURE.md §2 五层架构](./ARCHITECTURE.md#2-架构层自顶向下)：

| 层 | 子目录 | 主要交付物 |
|---|---|---|
| Delivery | `dist/` `dist-app/` | 双产物 |
| Root + 注入 | `src/{App.vue,index.js,main.js,components/magic-editor.vue}` | 应用 / 库入口 + 主组件 |
| UI 组件 | `src/components/{layout,resources,editor,common}/` | 业务 UI |
| 领域脚本 | `src/scripts/{parsing,editor,workers,beautifier}/` | magic-script 解析 + monaco 语言服务 |
| 基础设施 | `src/scripts/{bus,websocket,store,contants,hotkey,utils,reconnecting-websocket}.js` + `src/api/request.js` | 通信 / 总线 / 存储 |

## 3. 模块构建顺序（实施依赖）

> 依据 import 关系反推，自下而上：

```
1. 常量与基础设施
   contants.js → bus.js → store.js → utils.js → hotkey.js
   → reconnecting-websocket.js → websocket.js → api/request.js

2. 解析与编辑器内核
   parsing/{tokenizer,ast,parser,index}.js
   → editor/{magic-script, theme, default-theme, dark-theme, java-class}.js
   → editor/{completion, hover, signature, folding, high-light, mybatis}.js
   → workers/{editor.worker.js, json.worker.js}
   → beautifier/

3. 通用 UI 组件（无业务依赖）
   common/{modal/, magic-contextmenu/, magic-tree.vue, magic-loading.vue, ...}

4. 业务 UI 组件
   resources/{magic-api-list, magic-function-list, magic-datasource-list, magic-recent-opened}.vue
   layout/{magic-header, magic-status-bar, magic-options, magic-login, ...}.vue
   editor/magic-script-editor.vue

5. 主组件
   components/magic-editor.vue

6. 入口
   - 应用：main.js → App.vue → MagicEditor
   - 库：index.js (export install + MagicEditor)
```

## 4. 关键实施决策（已落地）

### 4.1 配置中心化为 contants 模块单例

**决策**：所有运行期可变配置统一收敛在 `src/scripts/contants.js`；主组件 `beforeMount` 阶段一次性灌入。

**位置**：`magic-editor.vue:106-155`

**结果**：业务模块直接 `import contants` 读取，无需 props 透传链。

**后果**：
- 优点：跨层访问简单，避免 prop drilling。
- 缺点：模块耦合到全局单例，单元测试不便（无测试目录，问题尚未暴露）。

### 4.2 axios 拦截器作为用户扩展点

**决策**：暴露 `config.request.beforeSend` / `config.request.onError` / `config.response.onSuccess` / `config.response.onError` 四个钩子，注册到全局 axios 实例。

**位置**：`magic-editor.vue:147-183`

**结果**：宿主可在不修改源码的情况下注入鉴权 / 埋点 / 统一错误处理。

### 4.3 WebSocket 协议自定义文本格式

**决策**：协议为 `msgType,arg1,...,arg_n[,jsonPayload]` 文本帧；客户端发送通过 EventBus，服务端消息广播为 `ws_<msgType>` 事件。

**位置**：`websocket.js:7-39`

**理由**（推断）：调试场景下文本帧便于人肉排查；JSON 包裹会增加冗余字符。

**风险**：协议无版本号，后端协议变更将无声破坏（见 ARCHITECTURE R-006）。

### 4.4 monaco 国际化在构建期完成

**决策**：自研 `monacoEditorLocalesPlugin`（`vite.config.js:7-116`），构建期改写 `esm/vs/nls.js`，将 `localize(data, message, ...args)` 替换为索引化查找。

**理由**：monaco 0.29.x 没有可靠的运行时 locale 切换 API；通过构建期注入实现"一次构建一种语言"。

**约束**：升级 monaco 前必须验证 `nls.js` 的接口签名（见 constitution 第七条）。

### 4.5 双产物 Vite 配置

**决策**：通过环境变量 / mode 区分应用模式与库模式：
- 应用：默认 mode → `dist-app/`
- 库：`mode=lib` → `dist/`，`vue` external，UMD + ES 双格式

**位置**：`vite.config.js:118-207`、`package.json:scripts`

### 4.6 Web Worker 通过 Vite ?worker 加载

**决策**：monaco 的 editor / json worker 不通过 CDN，而通过 Vite 内置的 `?worker` 后缀加载，确保打包后路径正确。

**位置**：`src/scripts/workers/{editor,json}.worker.js` + `magic-editor.vue:53-63`

## 5. 配置项实施清单

> 反向归纳自 `magic-editor.vue:beforeMount`。所有可注入字段：

| 字段 | 类型 | 默认 | 实施位置 |
|---|---|---|---|
| `baseURL` | string | dev: `http://localhost:9999/magic/web`，prod: `./` | App.vue:26 |
| `serverURL` | string | dev: `http://localhost:9999/`，prod: `./` | App.vue:27 |
| `inJar` | boolean | true | App.vue:28 |
| `title` | string | `'magic-api'` | magic-editor.vue:134 |
| `version` | string | 来自 env `VUE_APP_MA_VERSION` | contants.js:1 |
| `defaultExpand` | boolean | true | magic-editor.vue:120 |
| `jdbcDrivers` | array | [] | magic-editor.vue:121 |
| `datasourceTypes` | array | [] | magic-editor.vue:122 |
| `options` | array | [] | magic-editor.vue:123 |
| `editorFontFamily` | string | JetBrainsMono, Consolas, "Courier New", monospace, 微软雅黑 | magic-editor.vue:124-126 |
| `editorFontSize` | number | 14 | magic-editor.vue:127-129 |
| `logMaxRows` | number | Infinity（最小 10） | magic-editor.vue:130-132 |
| `themes` | object | `{}` | magic-editor.vue:135 |
| `defaultTheme` | string | `'default'` | magic-editor.vue:136 |
| `header` | object | `{skin:true, document:true, repo:true, qqGroup:true}` | magic-editor.vue:137-142 |
| `autoSave` | boolean | true | magic-editor.vue:143 |
| `decorationTimeout` | number | 10000 | magic-editor.vue:144-146 |
| `request.beforeSend` | function | identity | magic-editor.vue:147-150 |
| `request.onError` | function | reject | magic-editor.vue:147-150 |
| `response.onSuccess` | function | identity | magic-editor.vue:151-154 |
| `response.onError` | function | reject | magic-editor.vue:151-154 |
| `blockClose` | boolean | true | magic-editor.vue:191-193 |
| `checkUpdate` | boolean | true | magic-editor.vue:201-203 |

## 6. 构建流水线

```
开发：
  npm run dev      → vite dev server，默认指向 localhost:9999
应用模式产物：
  npm run build    → dist-app/  （供 magic-editor.jar 内嵌）
库模式产物：
  npm run build:lib → dist/       （NPM 包发布物）
                       ├─ magic-editor.umd.js
                       ├─ magic-editor.es.js
                       └─ magic-editor.css
```

> CI 缺失（见 ARCHITECTURE R-003）。

## 7. 已知技术债与风险（与 ARCHITECTURE §7 对齐）

| 债务 | 来源 | 缓解 |
|---|---|---|
| axios 0.21 已知 CVE | `package.json` | C-003 待澄清是否升级 |
| 第三方统计上报 | `bus.js:28-48` | C-002 待澄清是否保留 |
| 双构建无 CI 验证 | 无 `.github/` | 建议补 CI（不在本次范围） |
| EventBus 事件无类型 | `bus.js` | 文档化事件清单（已做：ARCHITECTURE §3.3） |
| monaco 0.29 升级阻塞 | `vite.config.js` 自定义插件 | 升级时同步验证 nls 接口 |
| WS 协议无版本号 | `websocket.js` | 协议变更需同步前后端 |
| 应用 UI 仅中文 | 多处硬编码 | 不在本次范围 |

## 8. 与模块文档的链接

- 模块级 `spec.md` / `plan.md` 见 `001-*` ~ `016-*`，逐一对齐本文 §2~§4 决策。
- 待澄清统一登记于 [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md#待澄清事项)。
