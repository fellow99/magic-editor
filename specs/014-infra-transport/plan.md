# 014-infra-transport 技术计划（As-Built）

> 本文件以"已建成系统"视角记录 014-infra-transport 模块的实际架构、设计决策与实现策略。
> 模块：014-infra-transport
> 对应规范：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. 技术上下文

### 1.1 运行环境

| 维度 | 值 |
|---|---|
| 运行时 | 浏览器（现代浏览器，ES Module + Fetch 支持） |
| 框架 | Vue 3.4（Options API 风格编写本模块） |
| 构建工具 | Vite 5.4.21 |
| 模块系统 | ES Module（`import`/`export`），ReconnectingWebSocket 额外提供 UMD/AMD 兼容 |
| 部署形态 | 应用模式（`dist-app/`，jar 内嵌）+ 库模式（`dist/`，NPM 包） |

### 1.2 依赖清单

| 依赖 | 版本 | 用途 | 类型 |
|---|---|---|---|
| `axios` | ^0.21.0 | HTTP 客户端 | 直接依赖 |
| `qs` | ^6.9.4 | 请求体/参数序列化（form-urlencoded） | 直接依赖 |
| `vue` | ^3.4.0 | 前端框架（本模块不直接 import vue，但通过 bus/modal 间接依赖） | 直接依赖 |
| `monaco-editor` | ^0.29.1 | 编辑器内核（本模块不直接引用） | 直接依赖 |

**间接依赖**（通过 import 链）：

| 依赖 | 来源 | 用途 |
|---|---|---|
| `@/scripts/bus.js` | `request.js:5`、`websocket.js:1` | EventBus 单例 |
| `@/scripts/contants.js` | `request.js:4` | 全局常量（HEADER_MAGIC_TOKEN 等） |
| `@/components/common/modal` | `request.js:3` | modal.magicAlert 弹出框 |

### 1.3 文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/api/request.js` | 194 | HTTP 请求封装：axios 实例、HttpRequest 类、HttpResponse 类 |
| `src/api/web.js` | 0 | **空文件**（C-001 待澄清） |
| `src/scripts/websocket.js` | 45 | MagicWebSocket 封装：帧发送/解析、bus 转发 |
| `src/scripts/reconnecting-websocket.js` | 385 | 自适应重连 WebSocket 实现（Joe Walnes 开源库，MIT 许可证） |

---

## 2. Constitution 合规性检查

| 条款 | 状态 | 说明 |
|---|---|---|
| **第一条 单一主组件 + 注入式配置** | ✅ 合规 | baseURL 通过 `contants.BASE_URL` 注入，由 `magic-editor.vue:beforeMount` 灌入，本模块不硬编码地址（`request.js:9` 初始为空字符串） |
| **第二条 前后端契约即真相** | ✅ 合规 | 本模块仅负责传输层，不持有业务数据；所有请求/响应均透传后端 |
| **第三条 通信双通道：HTTP 命令 + WebSocket 事件** | ✅ 合规 | HTTP（`request.js`）专用于 CRUD/运行/编译；WebSocket（`websocket.js`）专用于调试/日志/事件流，两者职责清晰分离 |
| **第四条 事件总线即全局状态** | ✅ 合规 | 跨组件通信全部走 `bus.js`：401 → `bus.$emit('showLogin')`、WS 消息 → `bus.$emit('ws_*')`、上行帧 → `bus.$on('message', ...)` |
| **第五条 monaco 一切围绕"magic-script"** | ✅ 合规 | 本模块不涉及 monaco，无违反 |
| **第六条 类型契约由 Header 而非 URL 表达** | ✅ 合规 | `magic-token` 通过 Header 注入（`request.js:112`），不通过 URL 参数 |
| **第七条 国际化只信"语言包索引化"机制** | ✅ 合规 | 本模块不涉及国际化 |
| **第八条 双构建产物共存** | ✅ 合规 | 本模块为纯 JS 模块，两种构建模式均正常打包 |
| **第九条 错误反馈一律走模态框 + Bus** | ✅ 合规 | HTTP 错误 → `modal.magicAlert`（`request.js:62-66, 117-127`）；401 → `bus.$emit('showLogin')`（`request.js:152`） |
| **第十条 源代码即文档真相** | ⚠️ 部分合规 | `src/api/web.js` 为空文件，无法溯源其用途（E-001 / C-001） |

---

## 3. 研究发现

### 3.1 axios 实例配置策略

**决策**：使用 `axios.create(config)` 创建独立实例，而非使用全局 `axios` 对象。

**实现**（`request.js:94`）：
```js
this._axios = axios.create(config)
```

**理由**：
- 避免污染全局 axios 默认配置
- 允许通过 `getAxios()` 暴露实例供宿主注入拦截器（`magic-editor.vue:156-183`）
- `config` 对象在模块加载时即定义（`request.js:7-47`），作为闭包变量被 `HttpRequest` 实例引用

**关键配置细节**：
- `transformRequest` 仅对 POST/PUT/PATCH 生效（axios 内部行为），FormData 实例直接透传（`request.js:28-30`）
- `paramsSerializer` 处理 GET/DELETE 等方法的 URL 查询参数
- `Qs.stringify` 配置 `arrayFormat: 'repeat'`（`a=[1,2]` → `a=1&a=2`）和 `allowDots: true`（`a[b]=1` → `a.b=1`），适配 magic-api 后端的参数解析规则

### 3.2 HttpResponse 链式回调设计

**决策**：采用回调注册模式（非 Promise 链），通过 `send()` 返回 HttpResponse 实例供调用方链式注册回调。

**实现模式**：
```js
request.send(url, params)
  .success((data, response) => { ... })
  .exception((code, message, response) => { ... })
  .error((errorData, errorResponse, error) => { ... })
  .end((successed) => { ... })
```

**设计分析**：
- `success()` / `exception()` / `error()` 返回 `this`，支持链式调用
- `end()` **不返回** `this`（`request.js:85-87`），是链式调用的一个不一致点
- 回调在 `send()` 内部通过 Promise `.then()/.catch()/.finally()` 触发，但对外暴露的是同步注册接口
- 默认 `exceptionHandle` 弹出 `modal.magicAlert`，调用方可通过 `.exception(customFn)` 覆盖

**与 Promise 模式的对比**：
- 优点：业务码判定（`code === 1`）内置，调用方无需重复编写
- 缺点：无法使用 `async/await` 语法；回调注册必须在 `send()` 返回后立即进行（同步窗口）

### 3.3 业务码判定逻辑

**实现**（`request.js:143-156` 的 `processResult` 函数）：

```
响应 data
  ├─ instanceof Blob → successed=true, 调用 successHandle(data, response)
  ├─ data.code === 1 → successed=true, 调用 successHandle(data.data, response)
  └─ data.code !== 1
      ├─ code === 401 → bus.$emit('showLogin')
      └─ 其他 → 调用 exceptionHandle(code, message, response)
                （默认实现：modal.magicAlert）
```

**注意**：`code === 1000`（断点命中）、`code === -1000`（脚本错误）、`code === -10`（无权限）在本模块中**未做特殊处理**，均走 `exceptionHandle` 分支。特殊语义由消费方（如 001-editor-core）在 `successHandle` 或业务层自行判定。

### 3.4 Blob 响应自动 JSON 解析

**实现**（`request.js:160-174`）：

当后端返回 `Blob` 但 `Content-Type` 为 `application/json` 时（常见于某些 Spring Boot 配置下），系统使用 `FileReader.readAsText()` 异步读取后尝试 `JSON.parse`。

**异常处理**：`JSON.parse` 失败时 `catch` 块静默捕获，仍调用 `processResult(data, response)`（此时 `data` 仍为 Blob），由 Blob 分支处理。

**潜在问题**：`reader.onload` 是异步回调，但 `return;` 之后 Promise 链继续执行 `.catch()` 和 `.finally()`，此时 `processResult` 尚未被调用。这意味着对于 Blob→JSON 的情况，`.finally()` 中的 `endHandle` 会在 JSON 解析完成**之前**执行，`successed` 值为 `false`。

### 3.5 WebSocket 帧解析算法

**实现**（`websocket.js:24-39`）：

```
输入: "msgType,arg1,arg2,{jsonPayload}"
                ↓
1. 找第一个逗号 → msgType = "msgType"
2. 循环解析剩余部分:
   - 遇到 "[" 或 "{" 开头 → JSON.parse → 终止
   - 否则 → 找下一个逗号 → 提取子串 → 继续
                ↓
输出: bus.$emit('ws_msgType', ["arg1", "arg2", {jsonPayload}])
```

**算法特点**：
- 第一个逗号严格分隔 msgType 与参数
- 后续逗号分隔普通字符串参数
- 遇到 JSON 段（`[` 或 `{` 开头）时立即解析并终止，剩余内容不再处理
- 若帧不含逗号，msgType 为整个字符串，args 为空数组

**边界情况**：
- 若 content 中包含逗号且不是 JSON 段，会被错误拆分为多个参数（如 `"log,hello,world"` → args = `["hello", "world"]` 而非 `["hello,world"]`）
- JSON 解析失败时异常向上抛出，无静默回退（`websocket.js:32`）

### 3.6 ReconnectingWebSocket 重连策略

**实现**（`reconnecting-websocket.js:281-285`）：

```js
var timeout = self.reconnectInterval * Math.pow(self.reconnectDecay, self.reconnectAttempts);
setTimeout(function () {
    self.reconnectAttempts++;
    self.open(true);
}, timeout > self.maxReconnectInterval ? self.maxReconnectInterval : timeout);
```

**重连时间序列**（默认参数）：

| 尝试次数 | 延迟（ms） | 说明 |
|---|---|---|
| 1 | 1,000 | 初始间隔 |
| 2 | 1,500 | 1000 × 1.5^1 |
| 3 | 2,250 | 1000 × 1.5^2 |
| 4 | 3,375 | 1000 × 1.5^3 |
| 5 | 5,063 | 1000 × 1.5^4 |
| 6 | 7,594 | 1000 × 1.5^5 |
| 7 | 11,391 | 1000 × 1.5^6 |
| 8 | 17,086 | 1000 × 1.5^7 |
| 9+ | 30,000 | 达到 maxReconnectInterval 上限 |

**超时检测**（`reconnecting-websocket.js:238-245`）：连接建立后启动 `timeoutInterval`（2000ms）定时器，若超时未触发 `onopen` 则强制关闭并重试。

### 3.7 MagicWebSocket 与 EventBus 的桥接

**架构模式**：MagicWebSocket 充当 EventBus 与原生 WebSocket 之间的**双向适配器**。

```
业务组件 ←→ bus.$emit/$on ←→ MagicWebSocket ←→ ReconnectingWebSocket ←→ 服务端
```

**上行路径**：
1. 业务组件调用 `bus.$emit('message', msgType, content)`
2. MagicWebSocket 在构造函数中通过 `bus.$on('message', ...)` 监听（`websocket.js:7`）
3. 调用 `socket.send('msgType,content')` 或 `socket.send(msgType)`

**下行路径**：
1. ReconnectingWebSocket 收到消息 → 触发 `onmessage`
2. MagicWebSocket 的 `messageReceived()` 解析帧（`websocket.js:24-39`）
3. 通过 `bus.$emit('ws_' + msgType, args)` 广播

**设计评价**：
- 优点：业务组件完全解耦于 WebSocket 实例，只需订阅 bus 事件
- 缺点：`bus.$on('message', ...)` 在构造函数中注册，无法取消订阅；MagicWebSocket 实例销毁后仍会尝试发送消息（若 socket 已关闭则抛异常）

---

## 4. 数据模型

### 4.1 axios 默认配置对象

```js
{
  baseURL: '',                    // string，由 contants.BASE_URL 注入
  method: 'post',                 // string，默认请求方法
  timeout: 0,                     // number，0 = 不超时
  withCredentials: true,          // boolean，携带 cookie
  responseType: 'json',           // string，响应格式
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  transformRequest: [function(data) { ... }],  // FormData 透传，否则 Qs.stringify
  paramsSerializer: function(data) { ... }     // Qs.stringify
}
```

### 4.2 HttpRequest 实例状态

```js
{
  _axios: AxiosInstance  // axios.create(config) 返回的实例
}
```

### 4.3 HttpResponse 实例状态

```js
{
  successHandle: Function | null,    // .success(fn) 注册
  errorHandle: Function | null,      // .error(fn) 注册
  exceptionHandle: Function,         // .exception(fn) 注册，默认弹框
  endHandle: Function | null         // .end(fn) 注册
}
```

### 4.4 MagicWebSocket 实例状态

```js
{
  listeners: { [msgType: string]: Function[] },  // 消息监听器映射
  socket: ReconnectingWebSocket                  // 底层连接
}
```

### 4.5 ReconnectingWebSocket 实例状态

```js
{
  url: string,                    // 连接 URL
  reconnectAttempts: number,      // 当前重连次数
  readyState: number,             // CONNECTING/OPEN/CLOSING/CLOSED
  protocol: string | null,        // 子协议
  // 重连参数
  debug: boolean,                 // 默认 false
  automaticOpen: boolean,         // 默认 true
  reconnectInterval: number,      // 默认 1000
  maxReconnectInterval: number,   // 默认 30000
  reconnectDecay: number,         // 默认 1.5
  timeoutInterval: number,        // 默认 2000
  maxReconnectAttempts: number,   // 默认 null（无上限）
  binaryType: string              // 默认 'blob'
}
```

### 4.6 业务码状态机

```
HTTP 响应
  ├─ code === 1 ──────────→ 成功态 → successHandle(data.data, response)
  ├─ code === 401 ─────────→ 未登录态 → bus.$emit('showLogin') + exceptionHandle
  ├─ code === 1000 ────────→ 断点命中 → exceptionHandle(1000, ...)
  │                           （消费方在 successHandle 中另行判定）
  ├─ code === -1000 ───────→ 脚本错误 → exceptionHandle(-1000, ...)
  ├─ code === -10 ─────────→ 无权限 → exceptionHandle(-10, ...)
  └─ code === 其他 ────────→ 业务异常 → exceptionHandle(code, message, response)

HTTP 错误（网络/HttpStatus）
  └─ errorHandle 已注册 ───→ errorHandle(errorData, errorResponse, error)
  └─ errorHandle 未注册 ───→ processError(error) → modal.magicAlert
```

---

## 5. 接口契约

### 5.1 导出接口

| 导出 | 类型 | 说明 |
|---|---|---|
| `export default new HttpRequest()` | 单例对象 | 全局唯一的 HTTP 请求实例 |
| `export default _ReconnectingWebSocket` | 构造函数 | ReconnectingWebSocket 类（`reconnecting-websocket.js:384-385`） |
| `export default MagicWebSocket` | 构造函数 | MagicWebSocket 类（`websocket.js:45`） |

### 5.2 HttpRequest 公共 API

| 方法 | 签名 | 返回值 | 说明 |
|---|---|---|---|
| `send` | `(url: string, params: object, newConfig?: object) => HttpResponse` | HttpResponse | 发起请求，返回回调容器 |
| `execute` | `(requestConfig: object) => Promise` | Promise | 直接执行 axios 请求（内部方法） |
| `getAxios` | `() => AxiosInstance` | axios 实例 | 供宿主注入拦截器 |
| `setBaseURL` | `(baseURL: string) => void` | void | 动态修改 baseURL |
| `processError` | `(error: Error) => void` | void | 错误处理（内部方法） |

### 5.3 HttpResponse 公共 API

| 方法 | 签名 | 返回值 | 说明 |
|---|---|---|---|
| `success` | `(handle: (data, response) => void) => this` | this | 注册成功回调 |
| `exception` | `(handle: (code, message, response) => void) => this` | this | 注册业务异常回调 |
| `error` | `(handle: (errorData, errorResponse, error) => void) => this` | this | 注册 HTTP 错误回调 |
| `end` | `(handle: (successed: boolean) => void) => void` | void | 注册最终完成回调（**不返回 this**） |

### 5.4 MagicWebSocket 公共 API

| 方法 | 签名 | 返回值 | 说明 |
|---|---|---|---|
| 构造函数 | `(url: string) => void` | - | 创建连接，注册 bus 监听 |
| `on` | `(msgType: string, callback: Function) => void` | - | 注册消息监听器 |
| `close` | `() => void` | - | 关闭连接 |
| `messageReceived` | `(e: MessageEvent) => void` | - | 消息解析（内部方法） |

### 5.5 消费的 EventBus 事件

| 事件 | 方向 | 载荷 | 说明 |
|---|---|---|---|
| `message` | 消费 | `(msgType: string, content?: string)` | 触发上行帧发送 |
| `showLogin` | 生产 | 无 | 401 拦截时触发 |
| `ws_open` | 生产 | 无 | WS 连接成功时触发 |
| `ws_<msgType>` | 生产 | `(args: any[])` | WS 下行消息解析后广播 |

### 5.6 消费的 contants 常量

| 常量 | 值 | 用途 |
|---|---|---|
| `HEADER_MAGIC_TOKEN` | `'magic-token'` | Header 名称 |
| `HEADER_MAGIC_TOKEN_VALUE` | `'unauthorization'` | Header 初始值 |

---

## 6. 实现策略

### 6.1 架构模式

本模块采用**门面模式（Facade）+ 适配器模式（Adapter）**：

- **HttpRequest** 是 axios 的门面，隐藏配置细节，暴露简化的 `send()` API
- **MagicWebSocket** 是 EventBus 与原生 WebSocket 之间的双向适配器
- **ReconnectingWebSocket** 是标准 WebSocket API 的适配器，增加重连能力

### 6.2 关键算法

#### 6.2.1 请求参数路由

```
send(url, params, newConfig)
  ├─ method === 'post' → requestConfig.data = params
  └─ method !== 'post' → requestConfig.params = params
```

#### 6.2.2 响应处理分支

见 §4.6 业务码状态机。

#### 6.2.3 指数退避重连

见 §3.6 ReconnectingWebSocket 重连策略。

### 6.3 错误处理

**三层错误处理**：

| 层级 | 触发条件 | 处理方式 | 代码位置 |
|---|---|---|---|
| 业务异常 | `data.code !== 1` | 401 → `bus.$emit('showLogin')`；其他 → `exceptionHandle`（默认弹框） | `request.js:150-155` |
| HTTP 错误 | 网络错误 / HttpStatus 错误 | `errorHandle`（若注册）或 `processError`（弹框 + console.error） | `request.js:177-183` |
| 帧解析错误 | `JSON.parse` 失败 | 异常向上抛出，无静默回退 | `websocket.js:32` |

**错误传播路径**：
```
axios 请求失败
  → .catch()
    → httpResponse.errorHandle 已注册？
      ├─ 是 → errorHandle(errorData, errorResponse, error)
      └─ 否 → processError(error) → modal.magicAlert + console.error
```

### 6.4 性能考量

- `Qs.stringify` 对大请求体（如包含大量参数的批量操作）可能产生序列化开销
- Blob→JSON 解析使用 `FileReader.readAsText()`，为异步操作，不阻塞主线程
- ReconnectingWebSocket 使用 `document.createEvent` 派发事件（兼容 IE9-11），在现代浏览器中性能略低于原生 `Event` 构造函数
- `statusLog` 数组（在 bus.js 中）无上限增长，但本模块不直接操作

---

## 7. 测试考虑

### 7.1 可测试性分析

**当前状态**：项目无测试目录，无测试框架配置。

**可测试单元**：

| 单元 | 测试类型 | 测试要点 |
|---|---|---|
| `Qs.stringify` 配置 | 单元测试 | `arrayFormat: 'repeat'` 和 `allowDots: true` 的序列化结果 |
| FormData 透传 | 单元测试 | FormData 实例不被 `Qs.stringify` 处理 |
| 业务码判定 | 单元测试 | `code === 1` / `401` / `1000` / `-1000` / `-10` 的分支覆盖 |
| Blob→JSON 解析 | 单元测试 | Blob + `application/json` Content-Type 的解析路径 |
| 帧解析算法 | 单元测试 | 各种帧格式的解析结果（纯 msgType、含参数、含 JSON、含逗号） |
| 指数退避计算 | 单元测试 | 重连延迟序列验证 |

### 7.2 边界情况

| 场景 | 预期行为 | 风险 |
|---|---|---|
| 后端返回空响应体 | `data` 为 `undefined`，`data.code` 访问报错 | 中等 |
| WebSocket 帧中 JSON 段格式错误 | `JSON.parse` 抛异常，消息丢失 | 高（无静默回退） |
| `send()` 后未注册任何回调 | 请求正常执行，但无反馈 | 低（调用方责任） |
| 网络断开期间调用 `socket.send()` | ReconnectingWebSocket 抛 `INVALID_STATE_ERR` | 中等 |
| `endHandle` 在 Blob→JSON 路径中提前执行 | `successed` 为 `false`，但实际可能成功 | 高（§3.4 已分析） |

---

## 8. 文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/api/request.js` | 194 | HTTP 请求封装：axios 实例配置（7-47）、HttpResponse 类（49-88）、HttpRequest 类（90-194） |
| `src/api/web.js` | 0 | **空文件**（C-001 待澄清） |
| `src/scripts/websocket.js` | 45 | MagicWebSocket 类：构造函数（3-17）、on 方法（19-22）、messageReceived 方法（24-39）、close 方法（41-43） |
| `src/scripts/reconnecting-websocket.js` | 385 | ReconnectingWebSocket 实现：UMD/ESM 导出（95-107）、构造函数（109-348）、事件处理（181-302）、公共 API（314-382） |
