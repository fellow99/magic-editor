# 015-infra-bus-store 模块规范（As-Built）

> 模块编号：015-infra-bus-store
> 状态：已实现
> 最后更新：2026-05-01
> 对应源码：`src/scripts/bus.js`（57 行）、`src/scripts/store.js`（21 行）、`src/scripts/contants.js`（36 行）、`src/scripts/hotkey.js`（46 行）、`src/scripts/utils.js`（182 行）、`src/scripts/beautifier/`（14 文件）

---

## 1. 模块概述

### 1.1 目的

本模块是 magic-editor 的**基础设施层**，为所有上层模块提供以下核心能力：

- **事件总线（bus）**：全局发布/订阅机制，所有跨组件通信的唯一通道
- **状态日志**：内存级状态变更记录，带时间戳
- **第三方埋点上报**：cnzz 统计脚本的异步加载与事件推送
- **持久化存储（store）**：localStorage 的极简封装，用于用户偏好与鉴权令牌
- **全局配置常量（contants）**：模块单例，承载所有运行期可配置参数与协议常量
- **全局快捷键（hotkey）**：基于 keyCode 位运算的组合键注册与分发
- **通用工具函数（utils）**：URL 处理、JSON 格式化、日期格式化、文件下载、深度克隆、DOM 锚点定位、URL 参数提取、HTML 关键词高亮替换
- **代码格式化器（beautifier）**：JavaScript 代码美化工具（第三方库内嵌）

### 1.2 解决的问题

- 消除组件间直接引用，通过事件总线实现松耦合通信
- 统一配置来源与默认值，避免各组件硬编码后端地址、字体、超时等参数
- 提供跨会话的用户偏好持久化（token、最近打开、忽略版本）
- 为全局快捷键提供统一的注册入口，与 monaco 编辑器内快捷键形成边界
- 提供通用工具函数，避免各业务模块重复实现

### 1.3 范围

**包含**：
- EventBus 实现与全部已登记事件
- cnzz 第三方统计脚本注入与上报
- statusLog 内存数组与查询/清空接口
- localStorage 封装（set/get/remove）
- 全局配置常量单例与三层注入机制
- 全局快捷键注册/注销
- 通用工具函数清单
- 内嵌 beautifier 代码格式化器

**不包含**：
- HTTP 请求封装（axios + Qs）→ 模块 014-infra-transport
- WebSocket 连接管理（ReconnectingWebSocket）→ 模块 014-infra-transport
- monaco 编辑器实例生命周期 → 模块 001-editor-core
- monaco 语言服务注册 → 模块 012-script-language
- magic-script 解析器 → 模块 011-script-parser

---

## 2. 用户场景与用例

### US-001：跨组件通信（事件总线）

- **角色**：系统内部各组件
- **前置条件**：应用已启动，bus 单例已创建
- **流程**：
  1. 业务组件通过 `bus.$on(eventName, handler)` 订阅事件
  2. 触发方通过 `bus.$emit(eventName, ...args)` 发布事件
  3. 所有订阅者按注册顺序同步执行回调
  4. 可通过 `bus.$off(eventName, handler)` 注销特定监听器，或 `bus.$off(eventName)` 清空该事件全部监听器
- **后置条件**：事件处理完成，状态更新

### US-002：状态变更追踪

- **角色**：开发者（调试用途）
- **前置条件**：应用运行中
- **流程**：
  1. 任意组件通过 `bus.$emit('status', content)` 发送状态消息
  2. bus 自动将消息追加到 `statusLog` 数组，附带格式化时间戳
  3. 开发者可通过 `bus.$getStatusLog()` 读取完整日志
  4. 可通过 `bus.$clearStatusLog()` 清空日志
- **后置条件**：状态日志数组更新

### US-003：配置注入与覆盖

- **角色**：宿主应用 / 开发者
- **前置条件**：应用启动
- **流程**：
  1. 系统按优先级读取配置：`window.MAGIC_EDITOR_CONFIG` → `parent.MAGIC_EDITOR_CONFIG` → 内置默认值
  2. `MagicEditor.beforeMount` 钩子将配置灌入 `contants` 模块单例
  3. 各业务组件通过 `import contants from '@/scripts/contants.js'` 读取配置
- **后置条件**：全局配置常量可用，所有组件共享同一份配置

### US-004：全局快捷键触发

- **角色**：开发者
- **前置条件**：编辑器已挂载
- **流程**：
  1. `magic-editor.vue` 在 mounted 时通过 `Key.bind(element, code, callback)` 注册快捷键
  2. 用户按下组合键（如 Ctrl+S）
  3. hotkey 模块匹配 keyCode 位运算结果，阻止默认行为，执行回调
  4. 回调通过 `bus.$emit('doSave')` 触发保存流程
- **后置条件**：对应业务操作执行

### US-005：用户偏好持久化

- **角色**：系统
- **前置条件**：用户已登录或操作过资源
- **流程**：
  1. 登录成功后，token 通过 `store.set('magic-token', value)` 持久化
  2. 打开/关闭资源时，最近打开列表通过 `store.set('recent_opened_tab', ids)` 持久化
  3. 用户拒绝版本更新时，版本号通过 `store.set('ignore-version', version)` 持久化
  4. 下次启动时通过 `store.get(key)` 读取
- **后置条件**：用户偏好跨会话保留

---

## 3. 功能需求

### 3.1 事件总线（EventBus）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-001 | 系统 MUST 提供极简 EventBus，支持 `$on`（订阅）、`$off`（注销）、`$emit`（发布）三个方法 | `bus.js:6-24` |
| FR-002 | `$on(event, fn)` MUST 将回调函数追加到对应事件的处理数组中 | `bus.js:10` |
| FR-003 | `$off(event, fn)` 在 `fn` 为空时 MUST 清空该事件的全部监听器；否则仅移除匹配的回调 | `bus.js:12-18` |
| FR-004 | `$emit(event, ...args)` MUST 按注册顺序同步执行所有回调，并透传全部参数 | `bus.js:20-22` |
| FR-005 | 系统 MUST 导出 bus 为模块单例（`export default bus`），所有组件 import 得到同一实例 | `bus.js:26,57` |
| FR-006 | 系统 MUST 维护 `statusLog` 内存数组，每条记录包含 `timestamp`（格式化时间）和 `content`（状态文案） | `bus.js:4,49-54` |
| FR-007 | 系统 MUST 提供 `bus.$getStatusLog()` 读取状态日志数组 | `bus.js:55` |
| FR-008 | 系统 MUST 提供 `bus.$clearStatusLog()` 清空状态日志数组 | `bus.js:56` |
| FR-009 | 状态日志数组 MUST 无上限（`LOG_MAX_ROWS` 默认为 `Infinity`），不自动截断 | `contants.js:26`、`bus.js:4` |

### 3.2 已登记事件清单

> 以下为源码中实际出现的全部 bus 事件，按功能域分类。

#### 3.2.1 鉴权 / 会话

| 事件名 | 方向 | payload | 触发方 | 订阅方 | 源码行 |
|---|---|---|---|---|---|
| `showLogin` | 出 | — | `request.js:152`（401 拦截） | `magic-editor.vue:223` | `request.js:152` |
| `login` | 出 | — | `magic-editor.vue:100`（资源加载完成） | `magic-editor.vue:116`（创建 WS）、`magic-status-bar.vue:47`、`magic-todo.vue:53` | `magic-editor.vue:100` |
| `logout` | 出 | — | `magic-status-bar.vue:66` | `magic-editor.vue:219`（关闭 WS）、`magic-script-editor.vue:223`（关闭所有 Tab）、`magic-api-list.vue:958`、`magic-function-list.vue:864`、`magic-datasource-list.vue:350` | `magic-status-bar.vue:66` |

#### 3.2.2 WebSocket 通信

| 事件名 | 方向 | payload | 触发方 | 订阅方 | 源码行 |
|---|---|---|---|---|---|
| `message` | 入 | `(msgType, content?)` | 业务组件 | `websocket.js:7-13`（转发到 WS） | `websocket.js:7` |
| `ws_open` | 出 | — | `websocket.js:15`（WS 连接建立） | `magic-editor.vue:119`（发送登录帧） | `websocket.js:15` |
| `ws_<msgType>` | 出 | `args: any[]` | `websocket.js:39`（服务端帧解析后） | 各业务组件（如 `ws_breakpoint`、`ws_log`、`ws_exception`、`ws_user` 等） | `websocket.js:39` |

#### 3.2.3 命令 / 调试控制

| 事件名 | 方向 | payload | 触发方 | 订阅方 | 源码行 |
|---|---|---|---|---|---|
| `doSave` | 出 | — | `magic-editor.vue:250`（Ctrl+S）、`magic-header.vue:11` | `magic-script-editor.vue:218` | `magic-editor.vue:250` |
| `doTest` | 出 | — | `magic-editor.vue:252`（Ctrl+Q）、`magic-header.vue:8` | `magic-script-editor.vue:220` | `magic-editor.vue:252` |
| `doContinue` | 出 | — | `magic-editor.vue:254`（F8）、`magic-debug.vue:4` | `magic-script-editor.vue:221` | `magic-editor.vue:254` |
| `doStepInto` | 出 | — | `magic-editor.vue:256`（F6）、`magic-debug.vue:6` | `magic-script-editor.vue:222` | `magic-editor.vue:256` |

#### 3.2.4 导航 / 资源定位

| 事件名 | 方向 | payload | 触发方 | 订阅方 | 源码行 |
|---|---|---|---|---|---|
| `search-open` | 出 | `item`（搜索结果项） | `magic-search.vue:167` | `magic-editor.vue:212-218` | `magic-search.vue:167` |
| `position-api` | 出 | `id` | `magic-script-editor.vue:837` | `magic-editor.vue:224-227` | `magic-script-editor.vue:837` |
| `position-function` | 出 | `id` | `magic-script-editor.vue:837` | `magic-editor.vue:228-231` | `magic-script-editor.vue:837` |

#### 3.2.5 窗口 / 布局

| 事件名 | 方向 | payload | 触发方 | 订阅方 | 源码行 |
|---|---|---|---|---|---|
| `update-window-size` | 出 | — | `magic-editor.vue:301,374`、`magic-script-editor.vue:214`、`magic-options.vue:105,119,127,132` | `magic-script-editor.vue:215`（编辑器 layout）、`magic-run.vue:120`、`magic-request.vue:371`、`magic-history.vue:52` | `magic-editor.vue:301` |

#### 3.2.6 状态 / 埋点

| 事件名 | 方向 | payload | 触发方 | 订阅方 | 源码行 |
|---|---|---|---|---|---|
| `status` | 出 | `content: string`（可含 HTML） | 几乎所有业务组件 | `bus.js:49-54`（写入 statusLog）、`magic-status-bar.vue:46`、`magic-event.vue:38` | `bus.js:49` |
| `report` | 出 | `eventId: string` | 各业务组件（保存/删除/分组操作等） | `bus.js:42-48`（推送 cnzz） | `bus.js:42` |

#### 3.2.7 编辑器 / Tab 管理

| 事件名 | 方向 | payload | 触发方 | 订阅方 | 源码行 |
|---|---|---|---|---|---|
| `open` | 出 | `item`（资源项） | `magic-api-list.vue:191`、`magic-function-list.vue:183`、`magic-recent-opened.vue:87` | `magic-script-editor.vue:216` | `magic-api-list.vue:191` |
| `close` | 出 | `item` | `magic-script-editor.vue:770` | `magic-recent-opened.vue:38` | `magic-script-editor.vue:770` |
| `opened` | 出 | `item` 或 `{empty: true}` | `magic-script-editor.vue:380,434,787` | `magic-api-list.vue:959`、`magic-function-list.vue:865`、`magic-header.vue:126`、`magic-options.vue:68` | `magic-script-editor.vue:380` |
| `switch-tab` | 出 | `target: string`（面板名称） | `magic-script-editor.vue:295,537,696,750,756` | `magic-options.vue:93` | `magic-script-editor.vue:295` |
| `changed` | 出 | `item` | 外部数据变更 | `magic-script-editor.vue:217` | `magic-script-editor.vue:217` |
| `viewHistory` | 出 | — | `magic-header.vue:17` | `magic-script-editor.vue:219` | `magic-header.vue:17` |
| `ready-delete` | 出 | — | 删除准备 | `magic-script-editor.vue:224-228` | `magic-script-editor.vue:224` |
| `delete-api` | 出 | `info` | `magic-script-editor.vue:226` | `magic-api-list.vue:962`、`magic-function-list.vue:868` | `magic-script-editor.vue:226` |

#### 3.2.8 响应数据传递

| 事件名 | 方向 | payload | 触发方 | 订阅方 | 源码行 |
|---|---|---|---|---|---|
| `update-response-body` | 出 | `(responseBody, headers)` | `magic-script-editor.vue:752` | `magic-run.vue:70`、`magic-options.vue:83` | `magic-script-editor.vue:752` |
| `update-response-body-definition` | 出 | `responseBodyDefinition` | `magic-script-editor.vue:751` | `magic-run.vue:80`、`magic-options.vue:82` | `magic-script-editor.vue:751` |
| `update-response-blob` | 出 | `(contentType, blob, headers)` | `magic-script-editor.vue:757` | `magic-run.vue:83` | `magic-script-editor.vue:757` |
| `update-request-body` | 出 | `requestBody` | `magic-options.vue:81` | `magic-request.vue:268` | `magic-options.vue:81` |
| `update-request-body-definition` | 出 | `requestBodyDefinition` | `magic-options.vue:80` | `magic-request.vue:273` | `magic-options.vue:80` |

#### 3.2.9 资源刷新 / 分组

| 事件名 | 方向 | payload | 触发方 | 订阅方 | 源码行 |
|---|---|---|---|---|---|
| `refresh-resource` | 出 | — | `magic-header.vue:248` | `magic-api-list.vue:965`、`magic-function-list.vue:871`、`magic-datasource-list.vue:351` | `magic-header.vue:248` |
| `update-group` | 出 | — | `magic-group.vue:168` | `magic-api-list.vue:968` | `magic-group.vue:168` |
| `api-group-selected` | 出 | `group` | `magic-api-list.vue:36` | `magic-options.vue:63` | `magic-api-list.vue:36` |

### 3.3 cnzz 第三方统计上报

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-010 | 系统 MUST 在模块加载时异步注入 cnzz 统计脚本（`https://s4.cnzz.com/z_stat.php?id=1280031557&web_id=1280031557`） | `bus.js:28-33` |
| FR-011 | cnzz 脚本加载完成后 MUST 触发 `bus.$emit('report', contants.MAGIC_API_VERSION)` | `bus.js:34-38` |
| FR-012 | `report` 事件处理 MUST 调用 `window._czc.push(["_trackEvent", eventId, eventId])` 推送埋点 | `bus.js:42-48` |
| FR-013 | cnzz 脚本注入与 `_czc.push` 调用 MUST 被 try-catch 包裹，异常静默忽略 | `bus.js:28-48` |
| FR-014 | [NEEDS CLARIFICATION: cnzz 第三方统计是否仍需保留？涉及隐私合规与用户体验。当前代码中无配置开关控制其启用/禁用。] | `bus.js:28-48`、constitution E-003、C-002 |

### 3.4 持久化存储（Store）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-020 | 系统 MUST 提供 `Store` 类封装 `localStorage`，包含 `set`、`get`、`remove` 三个方法 | `store.js:1-21` |
| FR-021 | `set(key, value)` 在值为数组或对象时 MUST 先 `JSON.stringify` 再存储 | `store.js:6-8` |
| FR-022 | `get(key)` MUST 直接返回 `localStorage.getItem(key)` 的原始字符串值，不自动反序列化 | `store.js:16-18` |
| FR-023 | 系统 MUST 导出 Store 为模块单例（`export default new Store()`） | `store.js:21` |
| FR-024 | 系统 MUST 仅使用 localStorage 存储用户偏好与鉴权令牌，不存储业务数据 | `constitution.md` 第二条 |

### 3.5 全局配置常量（Contants）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-030 | 系统 MUST 提供 `contants` 模块单例，承载所有运行期可配置参数 | `contants.js:4-34` |
| FR-031 | 配置来源 MUST 遵循三层优先级：`window.MAGIC_EDITOR_CONFIG` > `parent.MAGIC_EDITOR_CONFIG` > 内置默认值 | `App.vue:18-28`、`constitution.md` 第一条 |
| FR-032 | `BASE_URL` MUST 默认为空字符串，运行时由宿主或 config.json 注入 | `contants.js:5` |
| FR-033 | `SERVER_URL` MUST 默认为空字符串，运行时由宿主或 config.json 注入 | `contants.js:7` |
| FR-034 | `WEBSOCKET_SERVER` MUST 默认为空字符串，运行时由 BASE_URL 派生 | `contants.js:6` |
| FR-035 | `AUTO_SAVE` MUST 默认为 `true` | `contants.js:8` |
| FR-036 | `DECORATION_TIMEOUT` MUST 默认为 `10000`（毫秒） | `contants.js:9` |
| FR-037 | `EDITOR_FONT_FAMILY` MUST 默认为 `'JetBrainsMono, Consolas, "Courier New",monospace, 微软雅黑'` | `contants.js:31` |
| FR-038 | `EDITOR_FONT_SIZE` MUST 默认为 `14` | `contants.js:32` |
| FR-039 | `LOG_MAX_ROWS` MUST 默认为 `Infinity` | `contants.js:26` |
| FR-040 | `DEFAULT_EXPAND` MUST 默认为 `true` | `contants.js:27` |
| FR-041 | `API_DEFAULT_METHOD` MUST 默认为 `'GET'` | `contants.js:10` |
| FR-042 | `MAGIC_API_VERSION_TEXT` MUST 从编译时环境变量 `VUE_APP_MA_VERSION` 读取 | `contants.js:1` |
| FR-043 | `MAGIC_API_VERSION` MUST 为 `'V' + MAGIC_API_VERSION_TEXT`，其中 `.` 替换为 `_` | `contants.js:2` |
| FR-044 | 系统 MUST 定义以下 HTTP Header 名称常量：`HEADER_REQUEST_SESSION`、`HEADER_REQUEST_BREAKPOINTS`、`HEADER_RESPONSE_MAGIC_CONTENT_TYPE`、`HEADER_APPLICATION_STREAM`、`HEADER_CONTENT_DISPOSITION`、`HEADER_MAGIC_TOKEN`、`HEADER_MAGIC_TOKEN_VALUE` | `contants.js:13-19` |
| FR-045 | 系统 MUST 定义以下业务响应码常量：`RESPONSE_CODE_DEBUG`（1000）、`RESPONSE_CODE_SCRIPT_ERROR`（-1000）、`RESPONSE_NO_PERMISSION`（-10） | `contants.js:23-25` |
| FR-046 | 系统 MUST 定义以下 localStorage 键名常量：`IGNORE_VERSION`（`'ignore-version'`）、`RECENT_OPENED_TAB`（`'recent_opened_tab'`）、`RECENT_OPENED`（`'recent_opened'`） | `contants.js:20-22` |
| FR-047 | `JDBC_DRIVERS`、`DATASOURCE_TYPES`、`OPTIONS` MUST 默认为空数组，运行时由 config.json 注入 | `contants.js:28-30` |
| FR-048 | `config` MUST 默认为空对象，运行时由 `GET /config.json` 响应写入 | `contants.js:33` |

### 3.6 全局快捷键（Hotkey）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-050 | 系统 MUST 提供 `Key` 对象，支持 A-Z（65-90）与 F1-F12（112-123）的 keyCode 映射 | `hotkey.js:1-9` |
| FR-051 | 系统 MUST 定义修饰键位掩码：`Alt=512`、`Ctrl=1024`、`Shift=2048` | `hotkey.js:2-5` |
| FR-052 | `Key.bind(target, code, callback)` MUST 将监听器注册到全局 `keydown` 事件 | `hotkey.js:31-39` |
| FR-053 | 快捷键匹配 MUST 使用位运算：`e.keyCode & listener.code === listener.code`，并组合 Ctrl/Shift/Alt/Meta 修饰键 | `hotkey.js:14-24` |
| FR-054 | Meta 键（Cmd on macOS）MUST 映射为 Ctrl 的位掩码（`Key.Ctrl`） | `hotkey.js:19` |
| FR-055 | 快捷键触发时 MUST 调用 `e.preventDefault()` 阻止浏览器默认行为 | `hotkey.js:21` |
| FR-056 | 快捷键回调执行后 MUST 立即 return，不继续遍历后续监听器 | `hotkey.js:23` |
| FR-057 | `Key.unbind()` MUST 清空全部监听器并移除 `keydown` 事件监听 | `hotkey.js:40-44` |
| FR-058 | 快捷键监听器仅在首次 `bind` 时初始化（惰性初始化），通过 `inited` 标志控制 | `hotkey.js:28-35` |
| FR-059 | 快捷键的作用域通过 `target` 元素限定：仅当 `e.target` 在 `target` 的子树内或与 `target` 相同时才触发 | `hotkey.js:14` |

### 3.7 通用工具函数（Utils）

| ID | 需求 | 需求描述 | 源码证据 |
|---|---|---|---|
| FR-060 | `replaceURL(url)` | MUST 规范化 URL 中的连续斜杠，保留 `://` 协议部分 | `utils.js:3` |
| FR-061 | `isVisible(elem)` | MUST 判断 DOM 元素是否可见（offsetWidth/offsetHeight/getClientRects） | `utils.js:4` |
| FR-062 | `formatJson(val, defaultVal)` | MUST 将字符串通过 Beautifier 美化，将对象通过 `JSON.stringify(val, null, 4)` 格式化 | `utils.js:5-15` |
| FR-063 | `paddingZero(val)` | MUST 将小于 10 的数字补零（如 `9` → `'09'`） | `utils.js:16` |
| FR-064 | `formatDate(val)` | MUST 支持时间戳（13 位毫秒 / 10 位秒）、Date 对象输入，输出 `YYYY-MM-DD HH:mm:ss` 格式 | `utils.js:17-34` |
| FR-065 | `download(blob, filename)` | MUST 通过创建临时 `<a>` 元素触发浏览器文件下载，下载后清理 URL 对象 | `utils.js:35-44` |
| FR-066 | `requestGroup(path, group)` | MUST 通过 POST 请求发送分组数据（id/name/path/type/paths/options/parentId），Content-Type 为 `application/json` | `utils.js:45-61` |
| FR-067 | `isArray(arr)` | MUST 通过 `Object.prototype.toString.call(arr) === '[object Array]'` 判断数组 | `utils.js:63-65` |
| FR-068 | `deepClone(obj, ignoreFields)` | MUST 实现深度克隆，支持忽略指定字段数组 | `utils.js:71-89` |
| FR-069 | `goToAnchor(dom)` | MUST 将指定 DOM 元素滚动到可视区域（支持选择器字符串或 DOM 节点） | `utils.js:92-99` |
| FR-070 | `getQueryVariable(variable)` | MUST 从 URL 查询字符串中提取指定参数值 | `utils.js:106-116` |
| FR-071 | `replaceKeywords(htmlString, keyword)` | MUST 在 HTML 字符串中查找关键词并用 `<span class="keyword">` 包裹，支持跨文本节点匹配、忽略大小写、特殊字符转义 | `utils.js:171-181` |

### 3.8 代码格式化器（Beautifier）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-080 | 系统 MUST 内嵌 JavaScript 代码格式化器，通过 `Beautifier` 类暴露 `beautify()` 方法 | `beautifier/javascript/beautifier.js` |
| FR-081 | Beautifier MUST 依赖内嵌的 tokenizer、acorn 解析器、options 配置 | `beautifier/javascript/` 目录 |
| FR-082 | Beautifier 核心 MUST 依赖 `core/` 目录下的 InputScanner、Output、Token、Tokenizer 等基础组件 | `beautifier/core/` 目录 |
| FR-083 | Beautifier 作为第三方库内嵌，系统不修改其源码，仅通过 `import { Beautifier }` 消费 | `utils.js:2` |

---

## 4. 非功能需求

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-001 | 性能 | EventBus 的 `$emit` MUST 为同步执行，不引入微任务或宏任务延迟 | `bus.js:20-22` |
| NFR-002 | 性能 | 状态日志数组 MUST 无上限，长时间运行可能导致内存增长 | `bus.js:4`、`contants.js:26` |
| NFR-003 | 安全性 | cnzz 第三方脚本 MUST 通过 `async` 属性异步加载，不阻塞主线程 | `bus.js:31` |
| NFR-004 | 安全性 | cnzz 脚本注入与 `_czc.push` 调用 MUST 被 try-catch 静默捕获，不影响主流程 | `bus.js:28-48` |
| NFR-005 | 安全性 | localStorage 存储的 token 存在 XSS 风险（未使用 httpOnly cookie），此为项目默认接受的风险 | `store.js`、`overall-data-model.md` NFR-005 |
| NFR-006 | 兼容性 | 快捷键模块 MUST 同时支持 Ctrl（Windows/Linux）与 Meta（macOS）修饰键 | `hotkey.js:19` |
| NFR-007 | 可配置性 | 所有运行期参数 MUST 通过 `contants` 模块单例集中管理，不得在业务组件中硬编码 | `constitution.md` 第一条 |
| NFR-008 | 可维护性 | EventBus 事件名 MUST 遵循命名约定：`ws_*`（WebSocket）、`status`/`report`（埋点）、其余动词命名 | `constitution.md` 第四条衍生约束 |
| NFR-009 | 可维护性 | `deepClone` 的 `ignoreFields` 参数仅对对象有效，对数组无效 | `utils.js:69-70` 注释 |
| NFR-010 | 可用性 | `formatDate` 对非 Date/Number 类型输入 MUST 返回空字符串 | `utils.js:33` |

---

## 5. 数据与事件依赖

### 5.1 模块导出

| 导出 | 类型 | 说明 | 源码行 |
|---|---|---|---|
| `bus`（default） | EventBus 实例 | 全局事件总线单例 | `bus.js:57` |
| `Store`（default） | Store 实例 | localStorage 封装单例 | `store.js:21` |
| `contants`（default） | Object | 全局配置常量单例 | `contants.js:36` |
| `Key`（default） | Object | 全局快捷键注册器 | `hotkey.js:46` |
| `replaceURL, isVisible, formatJson, formatDate, paddingZero, download, requestGroup, deepClone, goToAnchor, getQueryVariable, replaceKeywords` | 具名导出 | 通用工具函数 | `utils.js:182` |
| `Beautifier` | 具名导出（内部） | JavaScript 代码格式化器 | `beautifier/javascript/beautifier.js` |

### 5.2 模块内部依赖

| 依赖 | 被依赖方 | 用途 | 源码行 |
|---|---|---|---|
| `bus.js` | `contants.js` | 读取 `MAGIC_API_VERSION` 用于 cnzz 上报 | `bus.js:1,36` |
| `bus.js` | `utils.js` | 读取 `formatDate` 用于状态日志时间戳 | `bus.js:2,51` |
| `utils.js` | `@/api/request` | `requestGroup` 函数使用 HTTP 请求 | `utils.js:1` |
| `utils.js` | `beautifier/javascript/beautifier.js` | `formatJson` 使用 Beautifier | `utils.js:2` |

### 5.3 与上层模块的边界

本模块是**基础设施层**，所有上层模块均可访问本模块的导出。边界规则如下：

| 上层模块 | 访问内容 | 边界说明 |
|---|---|---|
| 001-editor-core | bus、contants、store、utils | 通过 bus 收发事件；通过 contants 读取配置；通过 store 读取主题/全局参数；通过 utils 调用 `isVisible`/`replaceURL`/`formatJson` |
| 002-editor-history | bus | 通过 bus 监听 `update-window-size` |
| 003-resources-api | bus、contants、store | 通过 bus 发布状态/埋点/资源操作事件；通过 contants 读取 Header 名/响应码；通过 store 读取全局参数 |
| 004-resources-function | bus、contants、store | 同 003-resources-api |
| 005-resources-datasource | bus、contants | 通过 bus 发布状态事件；通过 contants 读取 JDBC_DRIVERS/DATASOURCE_TYPES |
| 006-resources-recent | bus、contants、store | 通过 bus 发布 open/close 事件；通过 contants 读取 RECENT_OPENED/RECENT_OPENED_TAB 键名；通过 store 持久化 |
| 007-layout-header | bus、contants、store | 通过 bus 发布 doTest/doSave/viewHistory/status/report 事件；通过 contants 读取版本信息；通过 store 读取皮肤 |
| 008-layout-request | bus、contants | 通过 bus 监听 update-window-size/update-request-body 事件 |
| 009-layout-debug | bus | 通过 bus 发布 doContinue/doStepInto 事件；监听 ws_log 事件 |
| 010-layout-options | bus、contants | 通过 bus 监听 opened/api-group-selected/switch-tab 事件；发布 update-response-body 等事件 |
| 011-script-parser | 无直接依赖 | 解析器为纯函数模块，不依赖 bus/store/contants |
| 012-script-language | contants | 通过 contants 读取字体/主题配置 |
| 013-script-mybatis | 无直接依赖 | 纯语言服务模块 |
| 014-infra-transport | bus、contants | 通过 bus 监听 message 事件并发布 ws_open/ws_* 事件；通过 contants 读取 Header 名/token/响应码 |
| 016-common-ui | bus | modal/contextmenu/tree 等组件通过 bus 发布/监听事件 |

**边界规则**：
- 本模块**不反向依赖**任何上层模块
- 本模块**不直接操作**任何 UI 组件
- 本模块**不发起**任何 HTTP 请求（除 `utils.requestGroup` 外，该函数由业务层调用）
- 本模块**不管理** WebSocket 连接生命周期（由 014-infra-transport 负责）

---

## 6. 假设与约束

### 6.1 假设

- A-001：`window._czc` 对象由 cnzz 脚本异步创建，bus 模块不主动创建
- A-002：`formatDate` 的 10 位时间戳输入为秒级 Unix 时间戳，13 位为毫秒级
- A-003：`deepClone` 不处理循环引用（代码中无环检测），输入含环时将导致栈溢出
- A-004：`getQueryVariable` 不处理 URL 解码（`decodeURIComponent`），返回原始字符串
- A-005：`replaceKeywords` 的 HTML 输入为可信内容（通过 `div.innerHTML` 直接赋值，无 XSS 防护）
- A-006：快捷键模块的 `target` 参数通常为 `magic-editor.vue` 的根 DOM 元素，覆盖整个编辑器区域

### 6.2 约束

- C-001：EventBus 为同步执行，若回调中抛出异常将中断后续回调执行（无 try-catch 保护）
- C-002：`store.get()` 返回原始字符串，调用方需自行 `JSON.parse`（如 `magic-editor.vue:304`）
- C-003：`contants` 为可变对象，任何模块均可在运行时修改其属性（非只读）
- C-004：快捷键模块的 `unbind()` 清空全部监听器，不支持单独注销某个快捷键
- C-005：`deepClone` 的 `ignoreFields` 仅对顶层对象生效，不递归忽略嵌套对象中的同名字段

---

## 7. 待澄清

| ID | 位置 | 描述 |
|---|---|---|
| NC-001 | `bus.js:28-48` | cnzz 第三方统计是否仍需保留？当前无配置开关控制其启用/禁用，涉及隐私合规（C-002）。 |
| NC-002 | `utils.js:171-181` | `replaceKeywords` 通过 `div.innerHTML` 直接赋值 HTML 字符串，若 `htmlString` 来自用户输入则存在 XSS 风险。当前调用方是否均为可信内容？ |
| NC-003 | `hotkey.js:40-44` | `Key.unbind()` 清空全部监听器而非单独注销。若多个组件各自注册快捷键，一个组件调用 `unbind()` 将影响所有组件。是否应支持按 target 或 callback 单独注销？ |

---

## 8. 依赖清单

| 依赖 | 类型 | 用途 | 源码行 |
|---|---|---|---|
| `@/scripts/contants.js` | 内部模块 | bus 读取 MAGIC_API_VERSION | `bus.js:1` |
| `@/scripts/utils.js` | 内部模块 | bus 读取 formatDate | `bus.js:2` |
| `@/api/request` | 内部模块 | utils.requestGroup 使用 HTTP 请求 | `utils.js:1` |
| `beautifier/javascript/beautifier.js` | 内部模块 | utils.formatJson 使用 Beautifier | `utils.js:2` |
| `beautifier/javascript/acorn.js` | 内部模块 | Beautifier 依赖的 JS 解析器 | `beautifier/javascript/` |
| `beautifier/javascript/tokenizer.js` | 内部模块 | Beautifier 依赖的 tokenizer | `beautifier/javascript/` |
| `beautifier/javascript/options.js` | 内部模块 | Beautifier 配置选项 | `beautifier/javascript/` |
| `beautifier/core/inputscanner.js` | 内部模块 | Beautifier 核心输入扫描器 | `beautifier/core/` |
| `beautifier/core/output.js` | 内部模块 | Beautifier 核心输出处理器 | `beautifier/core/` |
| `beautifier/core/token.js` | 内部模块 | Beautifier 核心 Token 定义 | `beautifier/core/` |
| `beautifier/core/tokenizer.js` | 内部模块 | Beautifier 核心 tokenizer | `beautifier/core/` |
| `beautifier/core/tokenstream.js` | 内部模块 | Beautifier 核心 token 流 | `beautifier/core/` |
| `beautifier/core/options.js` | 内部模块 | Beautifier 核心选项 | `beautifier/core/` |
| `beautifier/core/directives.js` | 内部模块 | Beautifier 核心指令处理 | `beautifier/core/` |
| `beautifier/core/pattern.js` | 内部模块 | Beautifier 核心模式匹配 | `beautifier/core/` |
| `beautifier/core/templatablepattern.js` | 内部模块 | Beautifier 核心模板模式 | `beautifier/core/` |
| `beautifier/core/whitespacepattern.js` | 内部模块 | Beautifier 核心空白模式 | `beautifier/core/` |

---

## 附录：源码引用清单

| 文件 | 行数 | 引用说明 |
|---|---|---|
| `src/scripts/bus.js` | 1-57 | EventBus 实现（createEventBus）、statusLog 内存数组、cnzz 脚本异步注入、report/status 事件处理、$getStatusLog/$clearStatusLog 接口 |
| `src/scripts/store.js` | 1-21 | Store 类封装 localStorage（set/get/remove），对象/数组自动 JSON.stringify，模块单例导出 |
| `src/scripts/contants.js` | 1-36 | 全局配置常量单例：BASE_URL/WEBSOCKET_SERVER/SERVER_URL/AUTO_SAVE/DECORATION_TIMEOUT/字体/Header 名/响应码/localStorage 键名/默认数组/config 对象 |
| `src/scripts/hotkey.js` | 1-46 | Key 对象：A-Z/F1-F12 keyCode 映射、修饰键位掩码（Alt/Ctrl/Shift）、bind/unbind/init、位运算匹配、惰性初始化、target 作用域限定 |
| `src/scripts/utils.js` | 1-182 | 11 个工具函数：replaceURL/isVisible/formatJson/formatDate/paddingZero/download/requestGroup/isArray/deepClone/goToAnchor/getQueryVariable/replaceKeywords（含 getTextNodeList/getTextInfoList/getMatchList/replaceMatchResult 四个内部辅助函数） |
| `src/scripts/beautifier/javascript/beautifier.js` | — | JavaScript 代码格式化器主类，暴露 `beautify()` 方法 |
| `src/scripts/beautifier/javascript/acorn.js` | — | JS 解析器（内嵌 acorn） |
| `src/scripts/beautifier/javascript/options.js` | — | Beautifier 配置选项 |
| `src/scripts/beautifier/javascript/tokenizer.js` | — | JS tokenizer |
| `src/scripts/beautifier/core/inputscanner.js` | — | 输入扫描器 |
| `src/scripts/beautifier/core/output.js` | — | 输出处理器 |
| `src/scripts/beautifier/core/token.js` | — | Token 定义 |
| `src/scripts/beautifier/core/tokenizer.js` | — | 核心 tokenizer |
| `src/scripts/beautifier/core/tokenstream.js` | — | Token 流 |
| `src/scripts/beautifier/core/options.js` | — | 核心选项 |
| `src/scripts/beautifier/core/directives.js` | — | 指令处理 |
| `src/scripts/beautifier/core/pattern.js` | — | 模式匹配 |
| `src/scripts/beautifier/core/templatablepattern.js` | — | 模板模式 |
| `src/scripts/beautifier/core/whitespacepattern.js` | — | 空白模式 |
| `src/scripts/websocket.js` | 1-45 | MagicWebSocket：通过 bus 监听 message 事件转发到 WS，WS onopen 触发 ws_open，onmessage 解析帧后触发 ws_* 事件 |
| `src/api/request.js` | 151-153 | 401 拦截触发 bus.$emit('showLogin') |
| `src/components/magic-editor.vue` | 100,116-119,212-231,247-257,301,305-308,335-345,374 | 根组件：login/ws_open/showLogin/position-api/position-function 事件订阅；doSave/doTest/doContinue/doStepInto 快捷键注册；update-window-size/status 事件发布 |
| `src/App.vue` | 18-28 | 三层配置注入：parent.MAGIC_EDITOR_CONFIG → window.MAGIC_EDITOR_CONFIG → 默认值 |
