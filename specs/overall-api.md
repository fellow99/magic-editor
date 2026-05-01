# overall-api.md — magic-editor 接口契约（As-Built）

> magic-editor 是 magic-api 的**前端**，本身不暴露 REST 服务；本文件刻画前端实际**消费**的接口契约：HTTP 端点、WebSocket 帧、宿主集成 API。
>
> 由于业务接口分散在各资源组件中，主组件直接消费的端点 + 通用约定在此集中描述；模块级 spec/plan 将补充各自接口。

## 1. 接口分类

| 类别 | 协议 | 主要消费方 |
|---|---|---|
| 后端 HTTP（magic-api） | HTTP/HTTPS | `src/api/request.js` 统一发起 |
| 后端 WebSocket | ws/wss | `src/scripts/websocket.js` |
| 浏览器 → 第三方 | HTTPS / `<script>` | `bus.js`（cnzz） / `magic-editor.vue`（maven-metadata） |
| 宿主集成 | JS 模块 | NPM 库 `magic-editor` |
| 配置注入 | 浏览器全局 | `window.MAGIC_EDITOR_CONFIG` / `parent.MAGIC_EDITOR_CONFIG` |

## 2. HTTP 通用约定

### 2.1 BaseURL 解析

```
config.baseURL → contants.BASE_URL → axios.baseURL
```

应用模式默认：`./`（相对路径，由 jar 路由）。
开发模式默认：`http://localhost:9999/magic/web`（`App.vue:26`）。

### 2.2 默认请求设置

来自 `src/api/request.js:7-47`：

| 项 | 值 |
|---|---|
| 默认 method | `post` |
| Content-Type | `application/x-www-form-urlencoded` |
| timeout | 0（不超时） |
| withCredentials | true |
| 请求体编码 | qs `arrayFormat: 'repeat'`、`allowDots: true`（FormData 不编码） |
| 参数序列化 | 同上 |

### 2.3 通用请求 Header

| Header | 值 | 时机 | 证据 |
|---|---|---|---|
| `magic-token` | `contants.HEADER_MAGIC_TOKEN_VALUE`（默认 `unauthorization`，登录后替换为后端返回 token） | 每个请求 | `request.js:111-112` |
| `Magic-Request-Session` | 调试会话 id | 调试运行时 | `contants.js:13`（值由调试 UI 注入） |
| `Magic-Request-Breakpoints` | 断点位置 | 调试运行时 | `contants.js:14` |

### 2.4 通用响应 Header（前端识别）

| Header | 用途 | 证据 |
|---|---|---|
| `Content-Type: application/json` | 即使 responseType=Blob，也会读为文本并 JSON.parse | `request.js:160-174` |
| `ma-content-type` | 后端实际响应内容类型（用于"测试运行"展示） | `contants.js:15` |
| `ma-content-disposition` | 下载时的文件名 | `contants.js:17` |

### 2.5 响应业务码（`ApiResponse.code`）

见 [overall-data-model §4.3](./overall-data-model.md#43-业务码语义)。

### 2.6 拦截器扩展点（宿主可注入）

| 钩子 | 签名 | 默认 | 注入位置 |
|---|---|---|---|
| `config.request.beforeSend` | `(axiosConfig) => axiosConfig` | identity | `magic-editor.vue:156-169` |
| `config.request.onError` | `(err) => Promise<...>` | reject | 同上 |
| `config.response.onSuccess` | `(resp) => resp` | identity | `magic-editor.vue:170-183` |
| `config.response.onError` | `(err) => Promise<...>` | reject | 同上 |

## 3. 主组件直接消费的 HTTP 端点

> 业务模块（接口/函数/数据源）端点详见各模块 spec/plan，此处仅枚举主组件 `magic-editor.vue` 自己消费的端点。

| 方法 | 路径 | 调用点 | 用途 |
|---|---|---|---|
| GET | `${baseURL}/config.json` | `magic-editor.vue:259-260` | 启动时拉取后端公开配置 |
| POST | `${baseURL}/login` | `magic-editor.vue:306` | 自动登录（无参；返回 `data: boolean`） |

### 3.1 `GET /config.json`

**请求**：无业务参数，仅携带 `magic-token` Header。

**响应**：

```json
{
  "code": 1,
  "data": {
    "version": "2.x.x",       // 后端版本
    "web": "/magic/web",      // 后端 web 路径
    "prefix": "/api"          // 服务接口前缀
    // 其他字段由各业务模块按需消费
  }
}
```

**前端处理**：
- 写入 `contants.config`
- 当 `inJar=true` 且 URL 含 `data.web` 时，重算 `contants.SERVER_URL = host + '/' + (prefix || '')`（`magic-editor.vue:264-267`）
- 版本不一致弹框（`magic-editor.vue:268-273`）

### 3.2 `POST /login`

**请求**：无 body；自动登录依赖 cookie + `magic-token` Header。

**响应**：

```json
{ "code": 1, "data": true }    // 已登录
{ "code": 1, "data": false }   // 未登录 → 弹登录覆盖层
{ "code": 401, ... }           // 触发 bus.$emit('showLogin')
```

## 4. WebSocket 接口契约

### 4.1 连接 URL

```
ws[s]://<host><BASE_URL>/console
```

由 `magic-editor.vue:108-117` 推导：
- 取 `location.protocol://location.host` 拼 baseURL
- 替换 `^http` → `ws`
- 末尾追加 `/console`

### 4.2 连接策略

- 实现：`src/scripts/reconnecting-websocket.js`
- 自动重连（参数详见模块 014-infra-transport）
- 连接成功 → `bus.$emit('ws_open')` → 自动发送 `login,<token>`

### 4.3 帧协议（双向文本）

详见 [overall-data-model §5](./overall-data-model.md#5-websocket-帧数据模型)。

**上行**：`<msgType>` 或 `<msgType>,<content>`
**下行**：`<msgType>[,<arg_n>...][,<jsonPayload>]`

下行解析后广播为 `ws_<msgType>` 事件。已知 msgType：
- `login` 上行
- `ws_open` 内部事件（仅前端）
- 其余 `ws_*`（log / breakpoint / user 等）由各编辑器/调试模块订阅，详见 009-layout-debug 模块。

### 4.4 协议稳定性

- **无版本字段**（R-006）：后端协议变更必须前后端同步发版。
- 帧分隔符为单一逗号 `,`，**content 中不应出现逗号**或必须以 JSON 段结尾以避免歧义（`websocket.js:24-39` 的解析规则）。

## 5. 浏览器 → 第三方接口

### 5.1 cnzz 统计（C-002 待澄清）

| 项 | 值 |
|---|---|
| URL | `https://s4.cnzz.com/z_stat.php?id=1280031557&web_id=1280031557` |
| 加载方式 | 异步 `<script>` 注入 |
| 调用 | `window._czc.push(['_trackEvent', eventId, eventId])` |
| eventId | `contants.MAGIC_API_VERSION`（如 `V2_0_0`） |
| 触发 | bus 事件 `report` |
| 证据 | `bus.js:28-48` |

### 5.2 maven-central 版本检查

| 项 | 值 |
|---|---|
| URL | `https://img.shields.io/maven-metadata/v.json?label=maven-central&metadataUrl=https%3A%2F%2Frepo1.maven.org%2Fmaven2%2Forg%2Fssssssss%2Fmagic-api%2Fmaven-metadata.xml` |
| 协议 | HTTPS GET (fetch) |
| 响应 | `{ value: "vX.Y.Z", ... }` |
| 触发 | 启动时（`config.checkUpdate !== false`） |
| 证据 | `magic-editor.vue:316-347` |

## 6. 宿主集成 API（NPM 库）

### 6.1 入口导出

`src/index.js`：

```js
// 默认导出：组件
import MagicEditor from 'magic-editor'

// 命名导出：Vue 3 plugin install
import { install } from 'magic-editor'

// 完整 plugin
const plugin = { install }
export default MagicEditor    // 默认是组件本身
export { install }            // install(app) 注册组件 + 子插件
```

证据：`src/index.js:1-23`

### 6.2 组件 API

```vue
<MagicEditor :config="config" />
```

`config` 全部字段见 [overall-plan §5 配置项实施清单](./overall-plan.md#5-配置项实施清单)。

### 6.3 全局插件副作用

`install(app)` 内部还会：
- `app.use(MagicContextMenu)`（`components/common/magic-contextmenu/index.js`）
- `app.use(Modal)`（`components/common/modal/index.js`）

证据：`src/index.js:7-13`

含义：宿主即使不渲染 MagicEditor，只要 `app.use(plugin)`，就会获得右键菜单和 Modal 的全局指令/方法（`$magicAlert` / `$magicConfirm`）。

### 6.4 浏览器全局兼容

```js
if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin)
}
```

`src/index.js:19-21` — 兼容直接 `<script>` 引入 UMD 的场景。

## 7. 配置注入接口（应用模式）

宿主页面或父窗口可通过以下两种方式注入配置（`App.vue:18-25`）：

```js
// 1. 父窗口注入（iframe 嵌入）
parent.MAGIC_EDITOR_CONFIG = { baseURL: '...', ... }

// 2. 同窗口全局
window.MAGIC_EDITOR_CONFIG = { ... }
```

合并优先级：`parent` 基线 → `window` 覆盖。

应用模式始终强制 `inJar = true`（`App.vue:28`）。

## 8. 错误传播契约

| 来源 | 传播路径 | 用户可见反馈 |
|---|---|---|
| HTTP `code !== 1` | `httpResponse.exceptionHandle` → 默认弹框 | `modal.magicAlert` |
| HTTP 抛错（network/HttpStatus） | `errorHandle`（若注册）或 `processError` | `modal.magicAlert` + `console.error` |
| HTTP 401 | `bus.$emit('showLogin')` | 登录覆盖层 |
| WS 连接断开 | ReconnectingWebSocket 内部重连 | 状态条（取决于业务） |
| WS 帧解析失败 | `JSON.parse` 异常静默 | 无 |
| 配置加载失败 | `magic-editor.vue:205-211` 兜底弹框 | `modal.magicAlert("加载失败")` |

## 9. 接口稳定性矩阵

| 接口 | 稳定性 | 演进策略 |
|---|---|---|
| HTTP `/config.json` schema | 中 | 由 magic-api 定义；前端只消费已知字段 |
| HTTP `/login` 返回 | 中 | 同上 |
| HTTP 自定义 Header（`magic-*` / `ma-*`） | 高（事实标准） | 变更须双端同步 |
| WS 帧协议 | 中（无版本号） | 变更须双端同步发版（R-006） |
| `props.config` 字段 | 高（公开 API） | 仅追加；删除/重命名为 BREAKING |
| EventBus 事件名 | 内部 | 重构内部组件时可调整 |
| `install(app)` 副作用 | 中 | 全局指令变更将影响宿主 |

## 10. 待澄清

- C-001：`src/api/web.js` 空文件 — 是否计划暴露独立 web 模块的接口集合
- C-002：cnzz 上报是否保留 / 是否提供关闭开关
- C-003：axios 0.21 升级到 1.x 时的兼容性（错误对象结构、interceptor 签名）
