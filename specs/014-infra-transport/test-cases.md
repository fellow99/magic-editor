# 014-infra-transport 测试用例

> 模块编号：014-infra-transport
> 关联规范：[spec.md](./spec.md)
> 对应源码：`src/api/request.js`、`src/scripts/websocket.js`、`src/scripts/reconnecting-websocket.js`、`src/api/web.js`
> 用例编号格式：`TC-014-NNN`

---

## 1. 测试范围

**纳入**：HTTP 请求封装（axios 实例配置/编码/Header 注入/baseURL/单例）、`send()` 流程、HttpResponse 链式回调、业务码语义、Blob→JSON 回退、网络错误、WebSocket 连接（重连/超时/事件）、帧协议（上行/下行解析）、bus 事件转发。

**排除**：登录覆盖层 UI（007）、调试面板渲染（009）、bus 实现细节（015）、modal 组件实现（016）、业务端点的具体语义（各业务模块）。

---

## 2. 环境前置

| 项 | 期望 |
|---|---|
| axios | 0.21.4 已安装；可被 mock |
| qs | `arrayFormat: 'repeat'`、`allowDots: true` 支持 |
| `bus` | 已挂载，支持 `$on/$emit` |
| `modal.magicAlert` | 可被 mock 验证调用 |
| WebSocket | 浏览器环境或 jsdom + `mock-socket` |
| 测试方法 | 单元测试 + Mock Server（推荐 jest + axios-mock-adapter + mock-socket） |

---

## 3. HTTP 请求封装（FR-014-001~008）

### TC-014-001 axios 默认配置
- **关联**：FR-014-001、FR-014-002
- **优先级**：P0
- **预期**：`request.getAxios().defaults` 中 `method='post'`、`withCredentials=true`、`responseType='json'`、`headers['Content-Type']='application/x-www-form-urlencoded'`

### TC-014-002 transformRequest form-urlencoded
- **关联**：FR-014-003
- **优先级**：P0
- **输入**：`request.send('/x', { a:[1,2], obj:{k:1} })`
- **预期**：抓包请求体使用 `Qs.stringify` 编码：`a=1&a=2&obj.k=1`（repeat + allowDots）

### TC-014-003 transformRequest 跳过 FormData
- **关联**：FR-014-004
- **优先级**：P0
- **输入**：`request.send('/upload', new FormData())`
- **预期**：FormData 直接透传，`Content-Type` 由 axios 设为 `multipart/form-data`（不被 qs 编码）

### TC-014-004 paramsSerializer
- **关联**：FR-014-005
- **优先级**：P0
- **输入**：GET 请求 `params = { ids:[1,2] }`
- **预期**：URL 包含 `ids=1&ids=2`

### TC-014-005 magic-token 注入
- **关联**：FR-014-006
- **优先级**：P0
- **预期**：每个请求 Header 包含 `magic-token: <HEADER_MAGIC_TOKEN_VALUE>`；登录后该值被替换并出现在后续请求中

### TC-014-006 setBaseURL
- **关联**：FR-014-007
- **优先级**：P0
- **输入**：`request.setBaseURL('http://api.test/')`
- **预期**：后续请求 URL 前缀变更为新值

### TC-014-007 单例导出
- **关联**：FR-014-008
- **优先级**：P0
- **预期**：多次 `import request` 获取同一实例（`===` 相等）

---

## 4. send() 与响应处理（FR-014-010~019）

### TC-014-010 method=post 时参数入 data
- **关联**：FR-014-010
- **优先级**：P0
- **预期**：post 请求 axios config 中 `data` 含传入参数，`params` 为空

### TC-014-011 非 post 时参数入 params
- **关联**：FR-014-010
- **优先级**：P0
- **输入**：`request.send('/x', { a:1 }, { method:'get' })`
- **预期**：URL 含 `?a=1`，request body 为空

### TC-014-012 Blob → JSON 解析
- **关联**：FR-014-011、FR-014-012、US-014-008
- **优先级**：P0
- **输入**：服务端返回 `Content-Type: application/json` 的 Blob，内容为 `{"code":1,"data":{"x":1}}`
- **预期**：FileReader 读取为文本 → JSON.parse 成功 → 走 `successHandle({x:1})`

### TC-014-013 Blob 解析失败回退
- **关联**：FR-014-012
- **优先级**：P1
- **输入**：Blob 内容非 JSON
- **预期**：`successHandle` 接收原始 Blob 对象，不抛错

### TC-014-014 业务码 1 → success
- **关联**：FR-014-013
- **优先级**：P0
- **输入**：响应 `{ code:1, data:{ id:1 } }`
- **预期**：`success` 回调被调用，参数 `(data={id:1}, response)`

### TC-014-015 业务码 401 → showLogin
- **关联**：FR-014-014、US-014-003、接受场景 2
- **优先级**：P0
- **输入**：响应 `{ code:401, message:'未登录' }`
- **预期**：`bus.$emit('showLogin')` 被触发；`exception` 回调以 `(401, '未登录', response)` 被调用

### TC-014-016 业务码异常默认弹框
- **关联**：FR-014-015、FR-014-016、US-014-004、接受场景 3
- **优先级**：P0
- **输入**：响应 `{ code:-1000, message:'脚本错误' }`
- **预期**：未注册 `exception` 时，`modal.magicAlert` 被调用，文案含 `异常代码(-1000)` 与 `脚本错误`

### TC-014-017 网络错误默认弹框
- **关联**：FR-014-017、接受场景 4
- **优先级**：P0
- **输入**：mock 服务返回 500 / 网络断开
- **预期**：未注册 `error` 时，`modal.magicAlert` 显示 HttpStatus 信息；`console.error` 输出错误

### TC-014-018 自定义 error 回调拦截默认处理
- **关联**：FR-014-018
- **优先级**：P0
- **输入**：`request.send().error(fn)`
- **预期**：网络错误时调用 `fn(error.response.data, error.response, error)`，**不**弹默认 modal

### TC-014-019 endHandle 总被调用
- **关联**：FR-014-019
- **优先级**：P0
- **输入**：成功 / 业务异常 / 网络错误三种场景
- **预期**：`end(fn)` 在 finally 阶段触发，`fn` 接收 `successed:boolean`（成功 true，失败 false）

---

## 5. HttpResponse 链式回调（FR-014-020~027）

### TC-014-020 success 链式
- **关联**：FR-014-020
- **优先级**：P0
- **输入**：`request.send().success(fn)`
- **预期**：返回 `this`，可继续链式

### TC-014-021 exception/error 链式
- **关联**：FR-014-021、FR-014-022
- **优先级**：P0
- **预期**：均返回 `this`

### TC-014-022 end 不返回 this
- **关联**：FR-014-023、C-004
- **优先级**：P1
- **预期**：`end(fn)` 返回 undefined（与其他链式方法不一致，文档化）

### TC-014-023 回调参数签名
- **关联**：FR-014-024~027
- **优先级**：P0
- **预期**：
  - success: `(data, response)`，data 为 `response.data.data`
  - exception: `(code, message, response)`
  - error: `(errorData, errorResponse, error)`
  - end: `(successed)`

---

## 6. 业务码语义（FR-014-030~034）

| 编号 | 用例 | 关联 | 优先级 | 预期 |
|---|---|---|---|---|
| TC-014-030 | code=1 视为成功 | FR-014-030 | P0 | 走 successHandle |
| TC-014-031 | code=401 触发登录 | FR-014-031 | P0 | emit showLogin |
| TC-014-032 | code=1000 (RESPONSE_CODE_DEBUG) | FR-014-032 | P1 | 不走 success；走 exception；调试场景由调用方拦截 |
| TC-014-033 | code=-1000 (脚本错误) | FR-014-033 | P0 | 走 exception；默认弹框 |
| TC-014-034 | code=-10 (无权限) | FR-014-034 | P1 | 走 exception；默认弹框 |

---

## 7. WebSocket 连接（FR-014-040~046）

### TC-014-040 连接 URL
- **关联**：FR-014-040
- **优先级**：P0
- **预期**：连接 URL = `SERVER_URL + '/console'`

### TC-014-041 重连默认参数
- **关联**：FR-014-041
- **优先级**：P0
- **预期**：`reconnectInterval=1000`、`maxReconnectInterval=30000`、`reconnectDecay=1.5`、`timeoutInterval=2000`、`maxReconnectAttempts=null`

### TC-014-042 指数退避重连
- **关联**：FR-014-042、NFR-014-003、接受场景 5
- **优先级**：P0
- **输入**：mock-socket 多次断开
- **预期**：第 N 次重连等待 `min(1000 × 1.5^N, 30000)` ms

### TC-014-043 连接超时关闭
- **关联**：FR-014-043
- **优先级**：P0
- **输入**：服务端 2s 内不响应握手
- **预期**：触发 close 并进入重连流程

### TC-014-044 ws_open 事件
- **关联**：FR-014-044
- **优先级**：P0
- **预期**：连接建立后 `bus.$emit('ws_open')` 被触发

### TC-014-045 on(msgType, callback)
- **关联**：FR-014-045
- **优先级**：P1
- **预期**：注册的回调在收到对应 msgType 时被调用（与 bus.$on('ws_'+type) 等价路径）

### TC-014-046 close()
- **关联**：FR-014-046
- **优先级**：P0
- **预期**：`MagicWebSocket.close()` 关闭底层连接，停止重连

---

## 8. WebSocket 帧协议（FR-014-050~055）

### TC-014-050 上行帧（仅 msgType）
- **关联**：FR-014-050、US-014-006、接受场景 7
- **优先级**：P0
- **输入**：`bus.$emit('message', 'ping')`
- **预期**：socket 收到字符串 `"ping"`

### TC-014-051 上行帧（msgType + content）
- **关联**：FR-014-050、接受场景 7
- **优先级**：P0
- **输入**：`bus.$emit('message', 'resume_breakpoint', '0,10|25')`
- **预期**：socket 收到 `"resume_breakpoint,0,10|25"`

### TC-014-052 下行帧无逗号
- **关联**：FR-014-051、FR-014-054
- **优先级**：P0
- **输入**：服务端发送 `"pong"`
- **预期**：`bus.$emit('ws_pong', [])`

### TC-014-053 下行帧多字符串参数
- **关联**：FR-014-051、FR-014-053
- **优先级**：P0
- **输入**：`"log,info,hello"`
- **预期**：`bus.$emit('ws_log', ['info', 'hello'])`

### TC-014-054 下行帧 JSON 终止段
- **关联**：FR-014-052、接受场景 6
- **优先级**：P0
- **输入**：`'breakpoint,var1,var2,{"name":"x","value":1}'`
- **预期**：`bus.$emit('ws_breakpoint', ['var1','var2',{name:'x',value:1}])`，最后一段被 JSON.parse

### TC-014-055 下行帧 JSON 数组段
- **关联**：FR-014-052
- **优先级**：P0
- **输入**：`'foo,a,[1,2,3]'`
- **预期**：args=`['a',[1,2,3]]`

### TC-014-056 JSON 解析失败抛错
- **关联**：FR-014-055
- **优先级**：P1
- **输入**：`'foo,a,{invalid'`
- **预期**：抛出异常（不静默回退）

---

## 9. 待澄清登记

### TC-014-060 web.js 空文件
- **关联**：FR-014-060、FR-014-061、C-001
- **优先级**：P2
- **预期**：登记为待澄清；不阻塞测试

---

## 10. 边界与异常

| 编号 | 场景 | 关联 | 预期 |
|---|---|---|---|
| TC-014-200 | 同时注册 success+exception，code=1 | FR-014-013 | 仅 success 被调用 |
| TC-014-201 | 同时注册 error+exception，HTTP 500 | FR-014-018 | 仅 error 被调用，不弹默认 modal |
| TC-014-202 | 不注册任何回调，业务码异常 | FR-014-016 | 默认 magicAlert 仍弹出 |
| TC-014-203 | 不注册任何回调，HTTP 错误 | FR-014-017 | 默认 magicAlert 仍弹出 |
| TC-014-204 | 默认无 timeout，请求挂起 | NFR-014-004、C-003 | 不自动取消（风险记录） |
| TC-014-205 | 浏览器不支持 WebSocket | NFR-014-006 | ReconnectingWebSocket 静默返回 undefined |
| TC-014-206 | 重连无上限 | A-004 | maxReconnectAttempts=null，页面不关则持续 |
| TC-014-207 | content 含逗号导致误切分 | A-003 | 风险记录：`"foo,a,b,c"` 解析为多参数，调用方需保证不含逗号或末段为 JSON |
| TC-014-208 | refresh() 触发重连 | reconnecting-websocket.js:344 | 当前连接关闭并立即重连 |
| TC-014-209 | send() 在未连接状态调用 | reconnecting-websocket.js:314-323 | 抛错或返回失败状态 |
| TC-014-210 | localStorage 存储 token 安全风险 | NFR-014-002 | 风险记录（XSS） |
| TC-014-211 | axios 0.21.4 CVE | NFR-014-001、C-002 | 风险记录 |
| TC-014-212 | Qs.stringify 大请求体性能 | NFR-014-007 | 性能记录（>1MB JSON）|
| TC-014-213 | WS 帧协议无版本号 | C-006 | 风险记录：后端协议变更将破坏前端解析 |
| TC-014-214 | 401 后立即 401 | FR-014-014 | showLogin 重复触发由 007 模块去重，本模块每次 emit |
| TC-014-215 | response.data 不是约定结构 | A-001 | 风险记录：可能 NPE 在 `data.code` 取值 |
| TC-014-216 | 初始 token 'unauthorization' 被后端接受 | A-002 | 启动时不应触发 401 循环 |

---

## 11. 索引摘要

| 章节 | 用例区间 | 数量 |
|---|---|---|
| HTTP 配置 | TC-014-001~007 | 7 |
| send/响应处理 | TC-014-010~019 | 10 |
| HttpResponse 链 | TC-014-020~023 | 4 |
| 业务码语义 | TC-014-030~034 | 5 |
| WebSocket 连接 | TC-014-040~046 | 7 |
| WS 帧协议 | TC-014-050~056 | 7 |
| 待澄清 | TC-014-060 | 1 |
| 边界异常 | TC-014-200~216 | 17 |
| **合计** | | **58** |

> P0 ≈ 39，P1 ≈ 4，P2 ≈ 1，边界 14。所有 8 个 US 与 8 个接受场景均有覆盖。
