# 015-infra-bus-store 测试用例

> 模块编号：015-infra-bus-store
> 关联规范：[spec.md](./spec.md)
> 对应源码：`src/scripts/{bus,store,contants,hotkey,utils}.js`、`src/scripts/beautifier/`
> 用例编号格式：`TC-015-NNN`

---

## 1. 测试范围

**纳入**：EventBus 行为（$on/$off/$emit）、statusLog、cnzz 注入与 report、Store（localStorage 封装）、contants 三层注入与默认值、Key 快捷键位运算与作用域、utils 工具函数语义、Beautifier 可消费性。

**排除**：上层模块对事件的具体业务语义（由各业务模块负责）；axios/请求实现（→ 014）；Beautifier 内部实现（第三方内嵌）。

---

## 2. 环境前置

| 项 | 期望 |
|---|---|
| 单测框架 | Jest / Vitest（jsdom 环境） |
| 浏览器 API | `localStorage`、`document`、`window`、`Blob`、`URL.createObjectURL` 可用 |
| Mock | `axios`/`request.js`（utils.requestGroup 用）、cnzz 网络请求拦截 |

---

## 3. EventBus（FR-001~009）

### TC-015-001 $on 注册回调
- **关联**：FR-001、FR-002、US-001
- **优先级**：P0
- **预期**：`bus.$on('e', fn)` 后，`bus.$emit('e', a, b)` 调用 fn(a,b) 一次

### TC-015-002 $on 多回调按注册顺序
- **关联**：FR-002、FR-004
- **优先级**：P0
- **预期**：注册 `fn1, fn2, fn3`，emit 后调用顺序为 fn1→fn2→fn3

### TC-015-003 $off(event, fn) 移除指定监听器
- **关联**：FR-003
- **优先级**：P0
- **预期**：仅 `fn1` 被移除，`fn2` 仍接收 emit

### TC-015-004 $off(event) 清空全部监听器
- **关联**：FR-003
- **优先级**：P0
- **预期**：传第二参数 undefined 时，该事件下全部回调被清空

### TC-015-005 $emit 同步执行
- **关联**：NFR-001、FR-004
- **优先级**：P0
- **预期**：`$emit` 返回前回调已全部执行（无 setTimeout / Promise）

### TC-015-006 $emit 透传可变参数
- **关联**：FR-004
- **优先级**：P0
- **输入**：`$emit('e', 1, 'a', {x:1})`
- **预期**：回调接收完整参数列表

### TC-015-007 单例
- **关联**：FR-005
- **优先级**：P0
- **预期**：多处 `import bus` 得到同一对象（`===` 相等）

### TC-015-008 status 事件写入 statusLog
- **关联**：FR-006、FR-007、US-002
- **优先级**：P0
- **输入**：`bus.$emit('status', 'msg1')`
- **预期**：`bus.$getStatusLog()` 返回数组含 `{ timestamp:'YYYY-MM-DD HH:mm:ss', content:'msg1' }`

### TC-015-009 $clearStatusLog
- **关联**：FR-008
- **优先级**：P0
- **预期**：调用后 `$getStatusLog()` 返回空数组

### TC-015-010 statusLog 无上限
- **关联**：FR-009、NFR-002
- **优先级**：P1
- **预期**：连续 emit 1000 条 status，statusLog 长度 = 1000；不自动截断（风险记录）

### TC-015-011 回调异常中断后续
- **关联**：C-001
- **优先级**：P1
- **预期**：fn1 抛错时 fn2/fn3 不被执行（无 try-catch 保护，记录约束）

---

## 4. cnzz 埋点（FR-010~014）

### TC-015-020 cnzz 脚本异步注入
- **关联**：FR-010、NFR-003
- **优先级**：P1
- **预期**：模块加载时向 `<head>` 追加 `<script async src="https://s4.cnzz.com/...id=1280031557...">`

### TC-015-021 onload 触发 report 版本
- **关联**：FR-011
- **优先级**：P1
- **预期**：脚本 load 后 `bus.$emit('report', contants.MAGIC_API_VERSION)`

### TC-015-022 report 推 _czc
- **关联**：FR-012
- **优先级**：P1
- **输入**：`bus.$emit('report', 'evt-1')`
- **预期**：`window._czc.push(['_trackEvent', 'evt-1', 'evt-1'])`

### TC-015-023 _czc 缺失静默
- **关联**：FR-013、NFR-004
- **优先级**：P1
- **输入**：`window._czc = undefined; bus.$emit('report','x')`
- **预期**：不抛错，不影响后续业务

### TC-015-024 cnzz 开关待澄清
- **关联**：FR-014、NC-001
- **优先级**：P2
- **预期**：登记为待澄清；当前无配置开关

---

## 5. Store（FR-020~024）

### TC-015-030 set 字符串
- **关联**：FR-020
- **优先级**：P0
- **预期**：`store.set('k','v')` 后 `localStorage.getItem('k') === 'v'`

### TC-015-031 set 数组/对象自动 stringify
- **关联**：FR-021
- **优先级**：P0
- **输入**：`store.set('k', {a:1})` / `store.set('arr',[1,2])`
- **预期**：`localStorage.getItem('k') === '{"a":1}'`、`'[1,2]'`

### TC-015-032 set 数字/布尔保留原样
- **关联**：FR-021
- **优先级**：P1
- **预期**：非对象/非数组按 String(value) 存储

### TC-015-033 get 返回原始字符串
- **关联**：FR-022、C-002
- **优先级**：P0
- **预期**：set 对象后 get 返回 JSON 字符串（不自动 parse）

### TC-015-034 remove
- **关联**：FR-020
- **优先级**：P0
- **预期**：`store.remove('k')` 后 `get('k') === null`

### TC-015-035 单例
- **关联**：FR-023
- **优先级**：P0
- **预期**：多处 import 得到同一实例

---

## 6. Contants（FR-030~048）

### TC-015-040 三层优先级注入
- **关联**：FR-031、US-003
- **优先级**：P0
- **输入**：同时设置 `window.MAGIC_EDITOR_CONFIG.baseURL='A'` 与 `parent.MAGIC_EDITOR_CONFIG.baseURL='B'`
- **预期**：window 优先；contants.BASE_URL='A'

### TC-015-041 parent 兜底
- **关联**：FR-031
- **优先级**：P0
- **输入**：仅设置 `parent.MAGIC_EDITOR_CONFIG.baseURL='B'`
- **预期**：contants.BASE_URL='B'

### TC-015-042 全部缺失走默认值
- **关联**：FR-031~048
- **优先级**：P0
- **预期**：BASE_URL/SERVER_URL/WEBSOCKET_SERVER 为 ''；AUTO_SAVE=true；DECORATION_TIMEOUT=10000；EDITOR_FONT_SIZE=14；LOG_MAX_ROWS=Infinity；DEFAULT_EXPAND=true；API_DEFAULT_METHOD='GET'

### TC-015-043 字体默认值
- **关联**：FR-037
- **优先级**：P1
- **预期**：EDITOR_FONT_FAMILY = 'JetBrainsMono, Consolas, "Courier New",monospace, 微软雅黑'

### TC-015-044 版本派生
- **关联**：FR-042、FR-043
- **优先级**：P1
- **输入**：`process.env.VUE_APP_MA_VERSION = '2.2.2'`
- **预期**：MAGIC_API_VERSION_TEXT='2.2.2'；MAGIC_API_VERSION='V2_2_2'

### TC-015-045 Header 名常量
- **关联**：FR-044
- **优先级**：P0
- **预期**：HEADER_REQUEST_SESSION/HEADER_REQUEST_BREAKPOINTS/HEADER_RESPONSE_MAGIC_CONTENT_TYPE/HEADER_APPLICATION_STREAM/HEADER_CONTENT_DISPOSITION/HEADER_MAGIC_TOKEN/HEADER_MAGIC_TOKEN_VALUE 均存在且为非空字符串

### TC-015-046 业务码常量
- **关联**：FR-045
- **优先级**：P0
- **预期**：RESPONSE_CODE_DEBUG=1000；RESPONSE_CODE_SCRIPT_ERROR=-1000；RESPONSE_NO_PERMISSION=-10

### TC-015-047 localStorage 键名常量
- **关联**：FR-046
- **优先级**：P0
- **预期**：IGNORE_VERSION='ignore-version'；RECENT_OPENED_TAB='recent_opened_tab'；RECENT_OPENED='recent_opened'

### TC-015-048 单例可变（约束）
- **关联**：C-003
- **优先级**：P1
- **预期**：运行时修改 contants 属性后，所有引用方读到新值（非冻结）

---

## 7. Hotkey（FR-050~059）

### TC-015-060 keyCode 映射 A-Z
- **关联**：FR-050
- **优先级**：P0
- **预期**：`Key.A === 65 ... Key.Z === 90`

### TC-015-061 F1-F12 映射
- **关联**：FR-050
- **优先级**：P0
- **预期**：`Key.F1 === 112 ... Key.F12 === 123`

### TC-015-062 修饰键位掩码
- **关联**：FR-051
- **优先级**：P0
- **预期**：Alt=512、Ctrl=1024、Shift=2048

### TC-015-063 Ctrl+S 触发
- **关联**：FR-052、FR-053、FR-055、FR-056、US-004
- **优先级**：P0
- **输入**：`Key.bind(el, Key.S | Key.Ctrl, fn)`；派发 `keydown` keyCode=83 ctrlKey=true，target 在 el 内
- **预期**：fn 被调用一次；`event.preventDefault()` 被调用；不触发其他绑定

### TC-015-064 Meta 等价 Ctrl
- **关联**：FR-054、NFR-006
- **优先级**：P0
- **输入**：metaKey=true（macOS Cmd+S）keyCode=83
- **预期**：触发 `Key.S | Key.Ctrl` 绑定

### TC-015-065 target 作用域限定
- **关联**：FR-059、A-006
- **优先级**：P0
- **输入**：keydown.target 在 el 之外
- **预期**：fn 不被调用

### TC-015-066 unbind 清空
- **关联**：FR-057、C-004
- **优先级**：P0
- **预期**：`Key.unbind()` 后再次按键不触发任何回调；`keydown` 监听器被移除

### TC-015-067 惰性初始化
- **关联**：FR-058
- **优先级**：P1
- **预期**：未调用 bind 前不安装全局 keydown 监听；首次 bind 才安装一次

### TC-015-068 多回调匹配优先级
- **关联**：FR-056
- **优先级**：P1
- **预期**：第一个匹配 listener 执行后立即 return，后续同 code 的 listener 不再执行

---

## 8. Utils 工具函数（FR-060~071）

### TC-015-080 replaceURL 多斜杠规范化
- **关联**：FR-060
- **优先级**：P0
- **输入**：`replaceURL('http://a.com//b///c')`
- **预期**：`'http://a.com/b/c'`（保留 `://`）

### TC-015-081 isVisible
- **关联**：FR-061
- **优先级**：P1
- **预期**：display:none 元素返回 false；正常元素返回 true

### TC-015-082 formatJson 字符串
- **关联**：FR-062
- **优先级**：P0
- **输入**：`formatJson('{"a":1}')`
- **预期**：返回美化后的多行字符串（Beautifier 输出）

### TC-015-083 formatJson 对象
- **关联**：FR-062
- **优先级**：P0
- **输入**：`formatJson({a:1,b:[1,2]})`
- **预期**：返回 `JSON.stringify(val, null, 4)` 结果

### TC-015-084 formatJson 异常回退
- **关联**：FR-062
- **优先级**：P1
- **输入**：非法 JSON 字符串、defaultVal='--'
- **预期**：返回 defaultVal

### TC-015-085 paddingZero
- **关联**：FR-063
- **优先级**：P0
- **预期**：9→'09'；10→'10'；0→'00'

### TC-015-086 formatDate 13 位时间戳
- **关联**：FR-064、A-002
- **优先级**：P0
- **输入**：`formatDate(1700000000000)`
- **预期**：返回 `'YYYY-MM-DD HH:mm:ss'` 格式（按本地时区）

### TC-015-087 formatDate 10 位时间戳
- **关联**：FR-064、A-002
- **优先级**：P0
- **输入**：`formatDate(1700000000)`
- **预期**：与 13 位 *1000 等价

### TC-015-088 formatDate Date 对象
- **关联**：FR-064
- **优先级**：P0
- **预期**：接受 `new Date(...)` 输入

### TC-015-089 formatDate 非法输入
- **关联**：NFR-010
- **优先级**：P1
- **输入**：`formatDate('abc')` / `formatDate(null)`
- **预期**：返回 ''

### TC-015-090 download 触发下载
- **关联**：FR-065
- **优先级**：P0
- **预期**：创建临时 `<a download>` 并点击；事后撤销 ObjectURL；DOM 节点被移除

### TC-015-091 requestGroup POST
- **关联**：FR-066
- **优先级**：P1
- **输入**：`requestGroup('/group/save', {id,name,path,type,paths,options,parentId})`
- **预期**：mock axios 收到 POST、`Content-Type: application/json`、body 为 JSON

### TC-015-092 isArray
- **关联**：FR-067
- **优先级**：P1
- **预期**：`isArray([])===true`、`isArray('')===false`、`isArray({length:0})===false`

### TC-015-093 deepClone 基本
- **关联**：FR-068
- **优先级**：P0
- **输入**：`{a:1, b:{c:2}, d:[1,2]}`
- **预期**：值相等且引用不同；嵌套对象/数组也是新引用

### TC-015-094 deepClone ignoreFields
- **关联**：FR-068、C-005
- **优先级**：P1
- **输入**：`deepClone({a:1,secret:'x'}, ['secret'])`
- **预期**：返回对象不含 `secret`；嵌套对象的同名字段**不**递归忽略（约束记录）

### TC-015-095 deepClone 循环引用
- **关联**：A-003
- **优先级**：P2
- **输入**：`obj.self = obj`
- **预期**：抛栈溢出（风险记录，不修复）

### TC-015-096 goToAnchor 字符串选择器
- **关联**：FR-069
- **优先级**：P1
- **预期**：调用 `document.querySelector(s).scrollIntoView`

### TC-015-097 goToAnchor DOM 节点
- **关联**：FR-069
- **优先级**：P1
- **预期**：直接调用 `.scrollIntoView`

### TC-015-098 getQueryVariable
- **关联**：FR-070、A-004
- **优先级**：P1
- **输入**：URL `?a=1&b=hello%20world`
- **预期**：`getQueryVariable('a')==='1'`；`getQueryVariable('b')==='hello%20world'`（不解码）；缺失键返回 false

### TC-015-099 replaceKeywords 基础
- **关联**：FR-071
- **优先级**：P0
- **输入**：HTML `'<div>hello world</div>'`、关键词 `'world'`
- **预期**：输出含 `<span class="keyword">world</span>`

### TC-015-100 replaceKeywords 大小写不敏感
- **关联**：FR-071
- **优先级**：P1
- **输入**：关键词 `'World'`、内容含 `'world'`
- **预期**：仍命中并包裹

### TC-015-101 replaceKeywords 跨文本节点
- **关联**：FR-071
- **优先级**：P1
- **输入**：`'<b>he</b>llo'`、关键词 `'hello'`
- **预期**：跨 `<b>` 与文本节点匹配并高亮

### TC-015-102 replaceKeywords 特殊字符转义
- **关联**：FR-071
- **优先级**：P1
- **输入**：关键词包含 `.`、`*`、`(`、`)`
- **预期**：作为字面量匹配，不作为正则元字符

### TC-015-103 replaceKeywords XSS 风险
- **关联**：A-005、NC-002
- **优先级**：P2
- **预期**：登记风险：`div.innerHTML` 直接赋值；调用方需保证 htmlString 可信

---

## 9. Beautifier 可消费性（FR-080~083）

### TC-015-110 import Beautifier
- **关联**：FR-080、FR-083
- **优先级**：P1
- **预期**：`import { Beautifier } from '@/scripts/beautifier/javascript/beautifier.js'` 能取到类，调用 `new Beautifier(src, opts).beautify()` 返回字符串

### TC-015-111 不修改第三方源
- **关联**：FR-083
- **优先级**：P2
- **预期**：beautifier/ 目录无项目自定义改动（建立基线快照）

---

## 10. 边界与待澄清

| 编号 | 场景 | 关联 | 预期 |
|---|---|---|---|
| TC-015-200 | 未注册事件 emit | FR-004 | 静默无操作 |
| TC-015-201 | $off 未知事件 | FR-003 | 静默无操作 |
| TC-015-202 | $on 同一回调注册多次 | FR-002 | emit 时该回调被调用多次（不去重） |
| TC-015-203 | localStorage 满 | FR-020 | 抛 QuotaExceededError（不被吞） |
| TC-015-204 | localStorage 不可用（隐私模式） | FR-020 | 风险记录：set/get 抛错或返回 null |
| TC-015-205 | contants 被业务模块改写 | C-003 | 后续读取看到新值（非只读） |
| TC-015-206 | hotkey unbind 后 rebind | FR-057、FR-058 | 重新初始化全局监听并正常工作 |
| TC-015-207 | 多组件各自 unbind | NC-003 | 风险记录：unbind 清空全部，影响其他组件 |
| TC-015-208 | utils.requestGroup 网络失败 | FR-066 | 错误冒泡，不静默吞没 |
| TC-015-209 | formatDate 时区差异 | FR-064 | 输出按本地时区，跨时区运行结果不同（记录） |
| TC-015-210 | replaceKeywords 关键词为空串 | FR-071 | 不进行替换，原样返回 |
| TC-015-211 | replaceKeywords 关键词无命中 | FR-071 | 原样返回 |
| TC-015-212 | bus 事件名命名约定 | NFR-008 | 用例验证 ws_* / status / report 命名映射符合约定 |

---

## 11. 索引摘要

| 章节 | 用例区间 | 数量 |
|---|---|---|
| EventBus | TC-015-001~011 | 11 |
| cnzz 埋点 | TC-015-020~024 | 5 |
| Store | TC-015-030~035 | 6 |
| Contants | TC-015-040~048 | 9 |
| Hotkey | TC-015-060~068 | 9 |
| Utils | TC-015-080~103 | 24 |
| Beautifier | TC-015-110~111 | 2 |
| 边界/待澄清 | TC-015-200~212 | 13 |
| **合计** | | **79** |

> P0 ≈ 38、P1 ≈ 25、P2 ≈ 4、边界 13。覆盖 5 个 US、所有显式 FR/NFR/约束/待澄清。
