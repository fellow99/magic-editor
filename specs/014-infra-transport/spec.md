# 基础设施传输模块规范（As-Built）— 014-infra-transport

> 模块编号：014-infra-transport
> 状态：已实现
> 最后更新：2026-05-01
> 对应源码：
> - `src/api/request.js`（194 行）— HTTP 请求封装（axios + HttpResponse 链式）
> - `src/api/web.js`（0 行）— **空文件**（C-001 待澄清）
> - `src/scripts/websocket.js`（45 行）— MagicWebSocket 封装（帧解析 + bus 转发）
> - `src/scripts/reconnecting-websocket.js`（385 行）— 自适应重连 WebSocket 实现

---

## 1. 模块概述

### 1.1 目的

本模块是 magic-editor 的**通信基础设施层**，负责：

- **HTTP 传输**：封装 axios 实例，统一请求编码（form-urlencoded + qs）、鉴权 Header 注入（`magic-token`）、业务码解析（`code === 1` 为成功）、401 自动拦截触发登录覆盖层，以及 HttpResponse 链式回调（success/error/exception/end）
- **WebSocket 传输**：基于 ReconnectingWebSocket 实现自适应重连的持久连接，提供自定义文本帧协议（`msgType,content`）的发送与解析，将下行消息按 `ws_<msgType>` 命名空间广播至全局事件总线

### 1.2 解决的问题

- 所有业务组件无需关心 axios 配置细节（编码方式、超时、鉴权 Header），只需调用 `request.send(url, params)` 即可获得链式回调
- 后端返回业务码 `code !== 1` 时自动弹出错误提示框，避免各组件重复编写错误处理
- HTTP 401 未登录时自动弹出登录覆盖层，实现无感知的鉴权恢复
- WebSocket 连接断开后自动重连（指数退避），避免网络抖动导致调试中断
- 服务端推送的自定义文本帧被统一解析为结构化事件，业务组件只需订阅 `ws_*` 事件

### 1.3 范围

**包含**：
- axios 实例创建与默认配置（baseURL、Content-Type、transformRequest、paramsSerializer）
- HttpRequest 类：`send()` / `execute()` / `processError()` / `setBaseURL()` / `getAxios()`
- HttpResponse 类：链式回调 `success()` / `error()` / `exception()` / `end()` / `data()` / `get()`
- 业务码判定：`code === 1` 成功、`code === 401` 未登录、`code === 1000` 断点命中、`code === -1000` 脚本错误、`code === -10` 无权限
- Blob 响应自动 JSON 解析回退
- MagicWebSocket 类：上行帧发送、下行帧解析、bus 事件转发
- ReconnectingWebSocket：自适应重连（指数退避、最大间隔、超时检测）
- `src/api/web.js` 空文件登记（C-001）

**不包含**：
- EventBus 实现（`bus.js`）→ 模块 015-infra-bus-store
- 登录覆盖层 UI（`magic-login.vue`）→ 模块 007-layout-header
- 调试面板 UI（`magic-debug.vue` / `magic-log.vue`）→ 模块 009-layout-debug
- 业务端点定义（`/config.json`、`/login`、资源 CRUD 等）→ 各业务模块 spec
- `contants.js` 常量定义 → 模块 015-infra-bus-store

---

## 2. 用户故事

| ID | 用户故事 | 源码位置 |
|---|---|---|
| US-014-001 | 作为开发者，我调用 `request.send(url, params)` 发起 HTTP 请求时，系统自动携带鉴权 token 并以 form-urlencoded 编码发送，无需手动配置 | `request.js:132-191` |
| US-014-002 | 作为开发者，我可以通过 `.success(fn).error(fn).end(fn)` 链式注册回调，分别处理成功、失败和最终完成逻辑 | `request.js:69-87` |
| US-014-003 | 作为用户，当我的登录态过期（HTTP 401）时，系统自动弹出登录框，无需手动刷新页面 | `request.js:151-153` |
| US-014-004 | 作为开发者，当后端返回 `code !== 1` 时，系统自动弹出错误提示框显示异常代码和消息 | `request.js:61-66, 150-155` |
| US-014-005 | 作为开发者，WebSocket 连接断开后系统自动重连，无需手动干预 | `reconnecting-websocket.js:261-287` |
| US-014-006 | 作为开发者，我通过 `bus.$emit('message', msgType, content)` 向服务端发送 WebSocket 消息 | `websocket.js:7-13` |
| US-014-007 | 作为开发者，我订阅 `ws_<msgType>` 事件即可接收服务端推送的对应类型消息 | `websocket.js:24-39` |
| US-014-008 | 作为开发者，当后端返回 Blob 但实际内容为 JSON 时，系统自动解析为 JSON 对象 | `request.js:161-174` |

---

## 3. 功能需求（FR）

### 3.1 HTTP 请求封装

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-014-001 | 系统 MUST 创建 axios 实例，默认 method 为 `post`，`withCredentials` 为 `true`，`responseType` 为 `json` | `request.js:7-17` |
| FR-014-002 | 系统 MUST 将 `Content-Type` 设置为 `application/x-www-form-urlencoded` | `request.js:19-22` |
| FR-014-003 | 系统 MUST 通过 `transformRequest` 将请求体使用 `Qs.stringify` 编码为 form-urlencoded 格式，配置 `arrayFormat: 'repeat'` 和 `allowDots: true` | `request.js:26-38` |
| FR-014-004 | 当请求体为 `FormData` 实例时，系统 MUST 跳过 `Qs.stringify` 编码，直接返回原始 FormData | `request.js:28-30` |
| FR-014-005 | 系统 MUST 通过 `paramsSerializer` 将 URL 查询参数使用 `Qs.stringify` 编码，配置同上 | `request.js:39-46` |
| FR-014-006 | 系统 MUST 在每个请求的 Header 中自动注入 `magic-token`，值为 `contants.HEADER_MAGIC_TOKEN_VALUE`（默认 `unauthorization`，登录后替换为实际 token） | `request.js:111-112` |
| FR-014-007 | 系统 MUST 支持通过 `setBaseURL(baseURL)` 动态修改 baseURL | `request.js:102-104` |
| FR-014-008 | 系统 MUST 以单例模式导出 HttpRequest 实例（`export default new HttpRequest()`） | `request.js:194` |

### 3.2 请求发送与响应处理

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-014-010 | `send(url, params, newConfig)` MUST 根据 `method` 决定参数位置：`post` 方法参数放入 `data`，其他方法参数放入 `params` | `request.js:135-139` |
| FR-014-011 | 系统 MUST 在收到响应后检查 `Content-Type` 是否为 `application/json`，若是 Blob 则尝试读取为文本并 JSON.parse | `request.js:160-174` |
| FR-014-012 | 当响应数据为 Blob 且 `isJson` 为 true 时，系统 MUST 使用 `FileReader.readAsText()` 读取后尝试 `JSON.parse`，解析失败则按原始 Blob 处理 | `request.js:161-174` |
| FR-014-013 | 当响应 `data.code === 1` 时，系统 MUST 调用 `successHandle(data.data, response)` | `request.js:147-149` |
| FR-014-014 | 当响应 `data.code !== 1` 且 `data.code === 401` 时，系统 MUST 通过 `bus.$emit('showLogin')` 触发登录覆盖层 | `request.js:151-153` |
| FR-014-015 | 当响应 `data.code !== 1` 且 `data.code !== 401` 时，系统 MUST 调用 `exceptionHandle(data.code, data.message, response)` | `request.js:154-155` |
| FR-014-016 | 当响应 `data.code !== 1` 时，系统 MUST 使用默认 `exceptionHandle` 弹出 `modal.magicAlert` 显示异常代码和消息 | `request.js:61-66` |
| FR-014-017 | 当 HTTP 请求发生网络错误或 HttpStatus 错误时，系统 MUST 调用 `processError(error)` 弹出 `modal.magicAlert` 显示错误信息 | `request.js:116-129` |
| FR-014-018 | 当 HTTP 请求发生错误且调用方注册了 `errorHandle` 时，系统 MUST 调用 `errorHandle(error.response.data, error.response, error)` 而非默认错误处理 | `request.js:178-183` |
| FR-014-019 | 无论请求成功或失败，系统 MUST 在 finally 阶段调用 `endHandle(successed)`，其中 `successed` 为布尔值表示是否成功 | `request.js:185-189` |

### 3.3 HttpResponse 链式回调

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-014-020 | HttpResponse MUST 提供 `success(handle)` 方法注册成功回调，返回 `this` 支持链式调用 | `request.js:69-72` |
| FR-014-021 | HttpResponse MUST 提供 `exception(handle)` 方法注册业务异常回调（`code !== 1`），返回 `this` 支持链式调用 | `request.js:74-77` |
| FR-014-022 | HttpResponse MUST 提供 `error(handle)` 方法注册 HTTP 错误回调（网络/HttpStatus），返回 `this` 支持链式调用 | `request.js:80-83` |
| FR-014-023 | HttpResponse MUST 提供 `end(handle)` 方法注册最终完成回调 | `request.js:85-87` |
| FR-014-024 | `successHandle` 回调接收参数为 `(data, response)`，其中 `data` 为 `response.data.data`（已剥离外层包装） | `request.js:149` |
| FR-014-025 | `exceptionHandle` 回调接收参数为 `(code, message, response)` | `request.js:154` |
| FR-014-026 | `errorHandle` 回调接收参数为 `(errorData, errorResponse, error)` | `request.js:179` |
| FR-014-027 | `endHandle` 回调接收参数为 `(successed: boolean)` | `request.js:187` |

### 3.4 业务码语义

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-014-030 | 业务码 `1` 表示请求成功 | `request.js:147`、`contants.js`（隐式约定） |
| FR-014-031 | 业务码 `401` 表示未登录/鉴权失败，触发登录覆盖层 | `request.js:151-153` |
| FR-014-032 | 业务码 `1000`（`RESPONSE_CODE_DEBUG`）表示断点命中 | `contants.js:23` |
| FR-014-033 | 业务码 `-1000`（`RESPONSE_CODE_SCRIPT_ERROR`）表示脚本执行错误 | `contants.js:24` |
| FR-014-034 | 业务码 `-10`（`RESPONSE_NO_PERMISSION`）表示无权限 | `contants.js:25` |

### 3.5 WebSocket 连接管理

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-014-040 | 系统 MUST 使用 ReconnectingWebSocket 建立 WebSocket 连接，连接 URL 为 `SERVER_URL + '/console'` | `websocket.js:5`、`magic-editor.vue:108-117` |
| FR-014-041 | ReconnectingWebSocket MUST 支持以下重连参数：`reconnectInterval=1000ms`、`maxReconnectInterval=30000ms`、`reconnectDecay=1.5`、`timeoutInterval=2000ms`、`maxReconnectAttempts=null`（无上限） | `reconnecting-websocket.js:112-135` |
| FR-014-042 | 重连延迟 MUST 使用指数退避算法：`delay = reconnectInterval × reconnectDecay^reconnectAttempts`，上限为 `maxReconnectInterval` | `reconnecting-websocket.js:281-285` |
| FR-014-043 | 连接超时（`timeoutInterval` 内未建立连接）MUST 自动关闭并重试 | `reconnecting-websocket.js:238-245` |
| FR-014-044 | 连接成功时 MUST 触发 `bus.$emit('ws_open')` 事件 | `websocket.js:14-16` |
| FR-014-045 | MagicWebSocket MUST 提供 `on(msgType, callback)` 方法注册消息监听器 | `websocket.js:19-22` |
| FR-014-046 | MagicWebSocket MUST 提供 `close()` 方法关闭底层 WebSocket 连接 | `websocket.js:41-43` |

### 3.6 WebSocket 帧协议

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-014-050 | 上行帧格式 MUST 为 `<msgType>` 或 `<msgType>,<content>`，通过 `bus.$emit('message', msgType[, content])` 触发发送 | `websocket.js:7-13` |
| FR-014-051 | 下行帧格式 MUST 为 `<msgType>[,<arg_1>...][,<jsonPayload>]`，其中第一个逗号前为 msgType | `websocket.js:24-39` |
| FR-014-052 | 下行帧解析规则：从第一个逗号后开始逐段解析，遇到以 `[` 或 `{` 开头的段时解析为 JSON 并终止解析 | `websocket.js:29-34` |
| FR-014-053 | 解析后的消息 MUST 通过 `bus.$emit('ws_' + msgType, args)` 广播，其中 `args` 为参数数组 | `websocket.js:39` |
| FR-014-054 | 若下行帧不含逗号（纯 msgType），则 `args` 为空数组 | `websocket.js:27` |
| FR-014-055 | JSON 解析失败时 MUST 抛出异常（无静默回退） | `websocket.js:32` |

### 3.7 空文件登记

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-014-060 | `src/api/web.js` 文件存在但内容为空（0 行），其用途未知 | `src/api/web.js`（空文件） |
| FR-014-061 | **[NEEDS CLARIFICATION: C-001]** `src/api/web.js` 空文件是否为历史废弃文件（应删除），还是占位文件（计划用于 web 模块的接口集合）？ | `src/api/web.js` |

---

## 4. 非功能需求（NFR）

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-014-001 | 安全性 | axios 版本 0.21.4 存在已知 CVE 漏洞（R-001/C-003），建议升级至 1.x | `package.json` 依赖 |
| NFR-014-002 | 安全性 | `magic-token` 存储在 localStorage 中，存在 XSS 风险（NFR-005） | `magic-login.vue:48`、`magic-status-bar.vue:64-65` |
| NFR-014-003 | 韧性 | WebSocket 连接断开后 MUST 自动重连，重连间隔从 1 秒指数增长至最大 30 秒 | `reconnecting-websocket.js:121-125, 281-285` |
| NFR-014-004 | 可用性 | HTTP 请求超时默认设置为 0（不超时），长时间无响应的请求不会自动取消 | `request.js:13` |
| NFR-014-005 | 可用性 | 错误反馈 MUST 通过 `modal.magicAlert` 弹出模态框，不得仅依赖 `console.error`（宪法第九条） | `request.js:62-66, 117-127` |
| NFR-014-006 | 兼容性 | ReconnectingWebSocket 在浏览器不支持 WebSocket 时静默返回 undefined | `reconnecting-websocket.js:105-107` |
| NFR-014-007 | 性能 | `transformRequest` 中的 `Qs.stringify` 对大请求体可能产生性能开销 | `request.js:26-38` |

---

## 5. 关键实体

| 实体 | 描述 | 关键属性 | 源码证据 |
|---|---|---|---|
| **HttpRequest** | HTTP 请求封装单例 | `_axios`（axios 实例）、`config`（默认配置）、`send()` / `execute()` / `processError()` / `setBaseURL()` / `getAxios()` | `request.js:90-194` |
| **HttpResponse** | 响应回调链式容器 | `successHandle` / `errorHandle` / `exceptionHandle` / `endHandle`、`success()` / `error()` / `exception()` / `end()` | `request.js:49-88` |
| **MagicWebSocket** | WebSocket 封装 | `listeners`（消息监听器映射）、`socket`（ReconnectingWebSocket 实例）、`on()` / `messageReceived()` / `close()` | `websocket.js:3-45` |
| **ReconnectingWebSocket** | 自适应重连 WebSocket | `url` / `reconnectAttempts` / `readyState` / `protocol`、`open()` / `send()` / `close()` / `refresh()`、重连参数 | `reconnecting-websocket.js:109-382` |
| **axios 默认配置（config）** | axios 实例默认设置 | `baseURL` / `method` / `timeout` / `withCredentials` / `responseType` / `headers` / `transformRequest` / `paramsSerializer` | `request.js:7-47` |

---

## 6. 接受场景

### 场景 1：正常 HTTP 请求成功

- Given 用户已登录（`magic-token` 为有效值）
- When 调用 `request.send('/api/save', { name: 'test' })`
- Then 系统发送 POST 请求，Header 携带 `magic-token`，请求体为 `name=test`（form-urlencoded）
- And 后端返回 `{ code: 1, data: { id: 1 } }`
- And `successHandle` 被调用，参数为 `{ id: 1 }` 和原始 response

### 场景 2：HTTP 401 自动触发登录

- Given 用户 token 已过期
- When 调用 `request.send('/api/save', {})`
- Then 后端返回 `{ code: 401, message: '未登录' }`
- And 系统通过 `bus.$emit('showLogin')` 触发登录覆盖层
- And `exceptionHandle` 被调用，参数为 `(401, '未登录', response)`

### 场景 3：HTTP 业务异常（非 401）

- Given 用户已登录
- When 调用 `request.send('/api/save', { invalid: true })`
- Then 后端返回 `{ code: -1000, message: '脚本语法错误' }`
- And 系统弹出 `modal.magicAlert` 显示"请求出错，异常代码(-1000)"和"脚本语法错误"
- And `exceptionHandle` 被调用，参数为 `(-1000, '脚本语法错误', response)`

### 场景 4：HTTP 网络错误

- Given 后端服务不可达
- When 调用 `request.send('/api/save', {})`
- Then 系统弹出 `modal.magicAlert` 显示 "请求出错HttpStatus:(网络错误状态)" 或错误消息
- And `console.error` 输出错误详情

### 场景 5：WebSocket 连接断开后自动重连

- Given WebSocket 连接已建立
- When 网络断开导致连接关闭
- Then ReconnectingWebSocket 在 1 秒后尝试重连
- And 若仍失败，下次重连间隔为 1.5 秒（`1000 × 1.5^1`）
- And 重连间隔逐次增长，上限 30 秒
- And 连接恢复后触发 `bus.$emit('ws_open')`

### 场景 6：WebSocket 下行帧解析

- Given WebSocket 连接已建立
- When 服务端推送帧 `"breakpoint,var1,var2,{"name":"x","value":1}"`
- Then 系统解析 msgType 为 `"breakpoint"`
- And args 为 `["var1", "var2", {"name":"x","value":1}]`
- And 系统通过 `bus.$emit('ws_breakpoint', args)` 广播

### 场景 7：WebSocket 上行帧发送

- Given 用户需要向服务端发送调试命令
- When 调用 `bus.$emit('message', 'resume_breakpoint', '0,10|25')`
- Then MagicWebSocket 发送 `"resume_breakpoint,0,10|25"` 到服务端
- And 若 content 为空，则仅发送 `"resume_breakpoint"`

### 场景 8：Blob 响应自动 JSON 解析

- Given 调用 `request.send('/api/download', {})` 且后端返回 Blob
- When 响应 `Content-Type` 为 `application/json`
- Then 系统使用 FileReader 读取 Blob 为文本
- And 尝试 `JSON.parse` 解析
- And 解析成功后按正常 JSON 响应处理（`processResult`）
- And 解析失败则按原始 Blob 处理（`successHandle` 接收 Blob）

---

## 7. 假设与约束

### 7.1 假设

- A-001：后端所有 HTTP 接口均返回 `{ code: number, data: any, message?: string }` 格式的统一响应体
- A-002：`magic-token` 的初始值 `unauthorization` 在后端被视为"未认证"状态，不会导致 401（否则启动即弹登录框）
- A-003：WebSocket 帧的 content 字段中不应出现逗号，否则解析规则会将逗号后的内容误认为独立参数（`websocket.js:24-39` 的解析逻辑）
- A-004：ReconnectingWebSocket 的 `maxReconnectAttempts` 为 `null`（无上限），意味着只要浏览器不关闭页面，重连将无限持续
- A-005：`request.send()` 返回的 HttpResponse 对象在 `send()` 调用时即已创建，回调注册必须在 `send()` 返回后立即进行（同步注册）

### 7.2 约束

- C-001：`src/api/web.js` 为空文件，用途未知（见 FR-014-061）
- C-002：axios 版本锁定为 0.21.4，存在已知 CVE 风险（NFR-014-001 / R-001 / C-003）
- C-003：HTTP 请求默认无超时（`timeout: 0`），长时间挂起的请求不会自动取消
- C-004：`endHandle` 在 HttpResponse 中注册后**不会**返回 `this`，不支持链式调用（`request.js:85-87`）
- C-005：ReconnectingWebSocket 不支持 `bufferedAmount`、`extensions`、`binaryType` 属性（与标准 WebSocket API 的差异）
- C-006：WebSocket 帧协议无版本号，后端协议变更将无声破坏前端解析（R-006）

---

## 8. 依赖关系

### 8.1 上游依赖（本模块消费）

| 模块 | 依赖内容 | 证据 |
|---|---|---|
| **015-infra-bus-store** | `bus` EventBus（`$emit`/`$on`）、`contants` 常量（`HEADER_MAGIC_TOKEN`、`HEADER_MAGIC_TOKEN_VALUE`、`BASE_URL`、`SERVER_URL`、`RESPONSE_CODE_DEBUG`、`RESPONSE_CODE_SCRIPT_ERROR`、`RESPONSE_NO_PERMISSION`） | `request.js:4-5`、`websocket.js:1` |
| **016-common-ui** | `modal.magicAlert` 模态框组件 | `request.js:3, 62-66, 117-127` |

### 8.2 下游依赖（消费本模块）

| 模块 | 依赖内容 | 证据 |
|---|---|---|
| **007-layout-header** | `request.send()` 发起登录/注销/上传/导出/推送等 HTTP 请求；消费 `showLogin` 事件触发登录弹窗 | `magic-header.vue:90`、`magic-login.vue:19`、`request.js:151-153` |
| **009-layout-debug** | 消费 `ws_log` / `ws_breakpoint` / `ws_exception` 等 WebSocket 事件（经本模块解析后通过 bus 转发） | `magic-log.vue:28`、`magic-script-editor.vue:229-230` |
| **001-editor-core** | `request.send()` 发起保存/测试/编译等 HTTP 请求；消费 `ws_breakpoint` / `ws_exception` 事件；通过 `bus.$emit('message', ...)` 发送调试控制帧 | `magic-script-editor.vue` 多处 |
| **003-resources-api** | `request.send()` 发起接口资源 CRUD HTTP 请求 | `magic-api-list.vue` |
| **004-resources-function** | `request.send()` 发起函数资源 CRUD HTTP 请求 | `magic-function-list.vue` |
| **005-resources-datasource** | `request.send()` 发起数据源 CRUD HTTP 请求 | `magic-datasource-list.vue` |

### 8.3 模块边界说明

| 边界 | 说明 |
|---|---|
| **与 015-infra-bus-store** | 本模块是 bus 事件的**主要生产者**（`showLogin`、`ws_open`、`ws_*`）和消费者（`message` 事件触发上行帧发送）。`contants` 提供鉴权 Header 名称/值、业务码常量、URL 配置。本模块不定义 bus 事件名常量，不实现总线逻辑。 |
| **与 007-layout-header** | 401 拦截逻辑在本模块 `request.js` 中实现（emit `showLogin`），007 模块仅负责**响应**该事件并显示登录弹窗。本模块不处理登录 UI、token 存储、注销逻辑。 |
| **与 009-layout-debug** | 本模块负责 WebSocket 连接管理和帧解析，009 模块仅消费解析后的 `ws_log` / `ws_breakpoint` 事件。本模块不关心调试 UI 渲染、变量展示、日志高亮。 |
| **与 001-editor-core** | 本模块提供 HTTP 请求能力和 WS 事件转发，001 模块负责发起具体业务请求（保存/测试/编译）和处理调试事件。本模块不感知业务端点、不处理编辑器装饰。 |

---

## 9. 待澄清

| ID | 位置 | 描述 |
|---|---|---|
| C-001 | `src/api/web.js` | 文件存在但内容为空（0 行），用途未知。是否为历史废弃文件（应删除），还是占位文件（计划用于 web 模块的接口集合）？已在 constitution.md E-001 和 overall-spec.md 中登记。 |

---

## 附录：源码引用清单

| 文件 | 行号范围 | 引用说明 |
|---|---|---|
| `src/api/request.js` | 1-47 | axios 默认配置：baseURL、method、timeout、withCredentials、Content-Type、transformRequest、paramsSerializer |
| `src/api/request.js` | 49-88 | HttpResponse 类：链式回调容器（success/exception/error/end） |
| `src/api/request.js` | 90-194 | HttpRequest 类：axios 实例封装、send/execute/processError/setBaseURL/getAxios |
| `src/api/request.js` | 111-112 | magic-token Header 自动注入 |
| `src/api/request.js` | 143-156 | processResult：业务码判定（code===1 成功、code===401 触发登录） |
| `src/api/request.js` | 160-174 | Blob 响应自动 JSON 解析回退 |
| `src/api/request.js` | 177-189 | catch/finally 错误处理与 endHandle 调用 |
| `src/api/web.js` | 1-0 | **空文件**（C-001 待澄清） |
| `src/scripts/websocket.js` | 1-45 | MagicWebSocket 类：上行帧发送、下行帧解析、bus 事件转发 |
| `src/scripts/websocket.js` | 7-13 | 上行帧发送：`bus.$on('message', ...)` → `socket.send(...)` |
| `src/scripts/websocket.js` | 24-39 | 下行帧解析：`msgType,arg1,...,jsonPayload` → `bus.$emit('ws_'+msgType, args)` |
| `src/scripts/reconnecting-websocket.js` | 1-94 | MIT 许可证 + JSDoc 注释 |
| `src/scripts/reconnecting-websocket.js` | 95-107 | UMD/ESM 兼容导出 + WebSocket 可用性检测 |
| `src/scripts/reconnecting-websocket.js` | 109-147 | 构造函数：默认重连参数（reconnectInterval=1000, maxReconnectInterval=30000, reconnectDecay=1.5, timeoutInterval=2000） |
| `src/scripts/reconnecting-websocket.js` | 220-302 | open() 方法：连接建立、超时检测、onopen/onclose/onmessage/onerror 处理 |
| `src/scripts/reconnecting-websocket.js` | 281-285 | 指数退避重连算法：`delay = reconnectInterval × reconnectDecay^reconnectAttempts` |
| `src/scripts/reconnecting-websocket.js` | 314-323 | send() 方法：状态检查 + 数据发送 |
| `src/scripts/reconnecting-websocket.js` | 329-338 | close() 方法：强制关闭 + 默认 CLOSE_NORMAL (1000) |
| `src/scripts/reconnecting-websocket.js` | 344-348 | refresh() 方法：关闭后触发重连 |
| `src/scripts/reconnecting-websocket.js` | 384-385 | ES module 默认导出 |
| `src/scripts/contants.js` | 1-36 | 全局常量：BASE_URL、SERVER_URL、HEADER_MAGIC_TOKEN、RESPONSE_CODE_DEBUG(1000)、RESPONSE_CODE_SCRIPT_ERROR(-1000)、RESPONSE_NO_PERMISSION(-10) |
| `src/scripts/bus.js` | 1-57 | EventBus 实现、status 日志、cnzz 统计注入 |
