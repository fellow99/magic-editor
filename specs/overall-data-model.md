# overall-data-model.md — magic-editor 数据模型（As-Built）

> magic-editor **是前端控制面**，业务数据全部由 magic-api 后端拥有；本文件刻画前端**实际持有的数据模型**：客户端会话状态、配置常量、事件载荷、持久化条目。
>
> 字段定义均来自源代码反向归纳。所有结构以 TS 风格描述以便阅读，**项目本身不使用 TypeScript**。

## 1. 数据分类总览

| 类别 | 持有者 | 生命周期 | 是否持久化 |
|---|---|---|---|
| 配置常量 | `scripts/contants.js` 模块单例 | 整个应用生命周期 | 否（每次启动重灌） |
| 会话/UI 状态 | 各组件 `data()` | 组件生命周期 | 否 |
| 事件载荷 | EventBus 内存 | 一次发射 | 否 |
| 用户偏好 | localStorage（`store.js`） | 跨会话 | 是 |
| 后端响应缓存 | 组件内 / `contants.config` | 应用生命周期 | 否 |

## 2. 配置常量模型（`Contants`）

来源：`src/scripts/contants.js` + `magic-editor.vue:beforeMount`

```ts
interface Contants {
  // —— 注入式配置（运行时被覆盖）——
  BASE_URL: string                  // 后端 web 路径，如 http://localhost:9999/magic/web
  WEBSOCKET_SERVER: string          // WS 服务地址（实际由 BASE_URL 派生）
  SERVER_URL: string                // 接口实际路径，如 http://localhost:9999/
  AUTO_SAVE: boolean                // 默认 true
  DECORATION_TIMEOUT: number        // 默认 10000ms
  DEFAULT_EXPAND: boolean           // 资源树默认展开
  JDBC_DRIVERS: any[]               // 来自 config.jdbcDrivers
  DATASOURCE_TYPES: any[]           // 来自 config.datasourceTypes
  OPTIONS: any[]                    // 底部 Options 自定义页签
  EDITOR_FONT_FAMILY: string
  EDITOR_FONT_SIZE: number
  LOG_MAX_ROWS: number              // 默认 Infinity
  config: object                    // 来自 GET /config.json

  // —— 协议常量 ——
  API_DEFAULT_METHOD: 'GET'
  MAGIC_API_VERSION_TEXT: string    // 编译时 env VUE_APP_MA_VERSION
  MAGIC_API_VERSION: string         // 'V' + version 替换 . 为 _

  HEADER_REQUEST_SESSION: 'Magic-Request-Session'
  HEADER_REQUEST_BREAKPOINTS: 'Magic-Request-Breakpoints'
  HEADER_RESPONSE_MAGIC_CONTENT_TYPE: 'ma-content-type'
  HEADER_APPLICATION_STREAM: 'application/octet-stream'
  HEADER_CONTENT_DISPOSITION: 'ma-content-disposition'
  HEADER_MAGIC_TOKEN: 'magic-token'
  HEADER_MAGIC_TOKEN_VALUE: string  // 默认 'unauthorization'，登录后被替换

  // —— 业务码 ——
  RESPONSE_CODE_DEBUG: 1000
  RESPONSE_CODE_SCRIPT_ERROR: -1000
  RESPONSE_NO_PERMISSION: -10

  // —— 持久化键 ——
  IGNORE_VERSION: 'ignore-version'
  RECENT_OPENED_TAB: 'recent_opened_tab'
  RECENT_OPENED: 'recent_opened'
}
```

## 3. localStorage 持久化条目

> 所有访问通过 `src/scripts/store.js` 封装；非对象值存原文，对象/数组 `JSON.stringify`。

| Key（常量） | 值类型 | 写入位置 | 读取位置 | 说明 |
|---|---|---|---|---|
| `magic-token` | string | 登录成功后 | `magic-editor.vue:304` | 鉴权令牌 |
| `recent_opened_tab` | string (JSON array of id) | 资源打开/关闭时 | `magic-editor.vue:353` | 上次打开的资源 id 列表 |
| `recent_opened` | string (JSON) | 最近打开组件 | `magic-recent-opened.vue` | 最近打开历史 |
| `ignore-version` | string | 用户拒绝版本更新 | `magic-editor.vue:321,331` | 跳过的版本号 |

## 4. 后端响应数据模型

### 4.1 `GET /config.json` 响应（写入 `contants.config`）

> 仅根据使用点反推：

```ts
interface RemoteConfig {
  version?: string                  // 后端版本号；与前端版本不一致时弹框
  web?: string                      // 后端 web 路径，用于 inJar 模式下二次定位 SERVER_URL
  prefix?: string                   // SERVER_URL 拼接前缀
  // 其他字段由各业务组件按需读取，未在主组件枚举
}
```

证据：`magic-editor.vue:262-273`

### 4.2 标准响应包装

> 来自 `src/api/request.js:147-156`：

```ts
interface ApiResponse<T = any> {
  code: number      // 1 表示成功；401 触发 showLogin；其他走 exceptionHandle
  message?: string
  data?: T
}
```

> 二进制响应（Blob）：当 `data instanceof Blob` 且 `Content-Type` 为 `application/json` 时，前端会读为文本并尝试 JSON.parse 后再走标准流程；否则直接交给 `successHandle`（`request.js:158-176`）。

### 4.3 业务码语义

| code | 语义 | 证据 |
|---|---|---|
| `1` | 成功 | `request.js:147` |
| `401` | 未登录，触发 `bus.$emit('showLogin')` | `request.js:151-153` |
| `1000` | 调试断点命中 | `contants.js:23`（`RESPONSE_CODE_DEBUG`） |
| `-1000` | 脚本错误 | `contants.js:24` |
| `-10` | 无权限 | `contants.js:25` |
| 其他 | 由 `exceptionHandle` 弹框 | `request.js:154` |

## 5. WebSocket 帧数据模型

> 实现：`src/scripts/websocket.js`

### 5.1 上行（客户端 → 服务端）

```
"<msgType>"               // 仅 msgType
"<msgType>,<content>"     // msgType + 文本内容
```

触发：`bus.$emit('message', msgType[, content])`（`websocket.js:7-13`）

已知 msgType（推断自代码）：
- `login` —— `magic-editor.vue:119`，content 为 magic-token
- 其他调试控制（继续 / 单步等）—— 由编辑器调试 UI 触发，具体 msgType 在 `magic-script-editor.vue` 中（待模块文档刻画）

### 5.2 下行（服务端 → 客户端）

帧文本协议（`websocket.js:24-39`）：

```
<msgType>[,<arg_1>][,<arg_2>]...[,<jsonPayload>]
```

解析规则：
1. 第一个逗号前是 msgType
2. 之后每个逗号分隔一个参数
3. 一旦遇到以 `[` 或 `{` 开头的段，将剩余整段作为 JSON 解析为最后一个参数
4. 解析结果通过 `bus.$emit('ws_' + msgType, args)` 广播

载荷示例（推测，待模块文档校验）：
- `ws_log,<sessionId>,<level>,<message>` — 调试日志
- `ws_breakpoint,<sessionId>,{...stack/vars...}` — 断点命中
- `ws_user,...` — 用户在线状态

## 6. EventBus 事件载荷

> 来自 `src/scripts/bus.js` + 各组件订阅点。

### 6.1 鉴权 / 会话

| 事件 | payload | 触发 | 订阅 |
|---|---|---|---|
| `showLogin` | — | `request.js:152`、`magic-editor.vue:223` | `magic-editor.vue` |
| `logout` | — | 用户登出 | `magic-editor.vue:219-222` |
| `login` | — | 资源加载完成 | `magic-editor.vue:116-118` |

### 6.2 WebSocket

| 事件 | payload | 触发 | 订阅 |
|---|---|---|---|
| `message` | `(msgType, content?)` | 业务模块 | `websocket.js:7-13` |
| `ws_open` | — | WS 连接建立 | `magic-editor.vue:119` |
| `ws_<msgType>` | `args: any[]` | 服务端帧 | 各业务组件 |

### 6.3 命令 / 快捷键

| 事件 | payload | 触发 | 订阅 |
|---|---|---|---|
| `doSave` | — | Ctrl+S | 编辑器 |
| `doTest` | — | Ctrl+Q | 编辑器 |
| `doContinue` | — | F8 | 编辑器 |
| `doStepInto` | — | F6 | 编辑器 |

### 6.4 导航 / 搜索

| 事件 | payload | 触发 | 订阅 |
|---|---|---|---|
| `search-open` | `{ type: 1\|2, ... }` | 全局搜索 | `magic-editor.vue:212-218` |
| `position-api` | `id` | 资源跳转 | `magic-editor.vue:224-227` |
| `position-function` | `id` | 资源跳转 | `magic-editor.vue:228-231` |
| `update-window-size` | — | 布局变化 | 各编辑器 / 列表 |

### 6.5 状态 / 埋点

| 事件 | payload | 触发 | 订阅 |
|---|---|---|---|
| `status` | `content: string` | 任意业务 | `bus.js:49-54`（写入 statusLog 数组） |
| `report` | `eventId: string` | cnzz 加载完成 | `bus.js:42-48`（推送 `_czc`） |

### 6.6 状态日志数组

```ts
interface StatusLogEntry {
  timestamp: string   // formatDate(new Date())
  content: string
}
```

存于 `bus.js` 模块作用域；通过 `bus.$getStatusLog()` 读取，`bus.$clearStatusLog()` 清空。

## 7. magic-script AST（前端侧解析结果）

> 由 `src/scripts/parsing/` 产出；详细节点定义在 `parsing/ast.js`（735 行），将由模块 011-script-parser 的 spec/plan 完整刻画。

顶层抽象（推断）：

```
SourceUnit
 ├─ ImportStatement[]
 ├─ Statement[]
 │   ├─ Expression
 │   │   ├─ BinaryExpression
 │   │   ├─ UnaryExpression
 │   │   ├─ MethodCall
 │   │   ├─ Identifier
 │   │   ├─ Literal (string / number / boolean / null)
 │   │   ├─ ArrayLiteral / MapLiteral
 │   │   └─ ...
 │   ├─ VariableDeclaration
 │   ├─ IfStatement
 │   ├─ ForStatement / WhileStatement
 │   ├─ TryCatch
 │   ├─ ReturnStatement
 │   └─ FunctionDeclaration
 └─ ...
```

> 节点细节延后到 011-script-parser 模块文档（避免在此重复 700+ 行 AST 定义）。

## 8. Java 类元数据缓存

> 来自 `src/scripts/editor/java-class.js`（在 `magic-editor.vue:195-196` 调用 `JavaClass.initClasses()` / `JavaClass.initImportClass()`）。

```ts
interface JavaClassMeta {
  // 用于补全的 Java 类信息：类名、方法、字段、参数、返回类型
  // 完整结构延后到 012-script-language 模块文档刻画
}
```

## 9. UI 状态模型（主组件）

`magic-editor.vue:84-103` 定义：

```ts
interface MagicEditorState {
  loading: boolean              // 启动 loading
  toolbars: ['接口','函数','数据源']
  toolbarIndex: number          // -1 折叠侧栏；0/1/2 选中
  toolboxWidth: 'auto' | string // 像素值字符串
  themeStyle: object            // 当前主题样式
  showLogin: boolean
  websocket: MagicWebSocket | null
  onLogin: () => void
}
```

## 10. 对外契约的稳定性

| 数据契约 | 稳定性 | 说明 |
|---|---|---|
| `props.config` 字段 | 高（公开 API） | 库模式宿主依赖；变更须 BREAKING |
| EventBus 事件名 | 中 | 内部约定，但 `ws_*` 与后端协议绑定 |
| WS 协议帧格式 | 中 | 与后端强绑定，无版本号（R-006） |
| HTTP 自定义 Header | 中 | 与后端强绑定 |
| localStorage 键 | 高 | 跨版本兼容关键 |
| AST 节点结构 | 低（内部） | 仅供 monaco 语言服务消费 |

## 11. 待澄清

- C-001：`src/api/web.js` 空文件 — 是否计划承载某类数据模型/接口
- C-002：cnzz 第三方上报载荷 `_czc.push(["_trackEvent", eventId, eventId])`
- C-003：axios 0.21 是否升级（升级会影响响应包装行为兼容性）
