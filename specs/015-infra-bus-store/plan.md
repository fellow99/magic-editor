# 015-infra-bus-store 技术计划（As-Built）

> 本文档为反向归纳的技术计划，记录实际已构建的架构、设计决策与实现策略。
> 模块：015-infra-bus-store
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. 技术上下文

### 1.1 运行环境

| 维度 | 值 | 说明 |
|---|---|---|
| 运行时 | 现代浏览器（Chrome/Edge/Firefox/Safari） | 依赖 ES Module、`localStorage`、`document.createElement`、`addEventListener` |
| 构建工具 | Vite 5.4.21 | `vite.config.js` 双模式构建（应用模式 / 库模式） |
| 框架 | Vue 3.4.0（Options API） | 本模块为纯 JS 模块，不依赖 Vue 响应式系统 |
| 模块系统 | ES Module（`import/export`） | 所有文件通过 `export default` 或具名导出 |
| 路径别名 | `@/` → `src/` | Vite 配置中定义，源码中广泛使用 |

### 1.2 依赖清单

| 依赖 | 版本 | 类型 | 用途 | 被谁使用 |
|---|---|---|---|---|
| `axios` | ^0.21.0 | 运行时 | HTTP 请求（`utils.requestGroup`） | `utils.js:1` |
| `vue` | ^3.4.0 | 运行时 | 框架核心（本模块不直接依赖） | — |
| `monaco-editor` | ^0.29.1 | 运行时 | 编辑器内核（本模块不直接依赖） | — |
| `qs` | ^6.9.4 | 运行时 | URL 编码（本模块不直接依赖） | — |
| `@vitejs/plugin-vue` | ^5.2.4 | 开发 | Vue SFC 编译 | 构建配置 |
| `eslint` | ^8.56.0 | 开发 | 代码检查 | 开发流程 |
| `eslint-plugin-vue` | ^9.21.0 | 开发 | Vue 文件 lint | 开发流程 |
| `vite` | ^5.4.21 | 开发 | 构建工具 | 构建流程 |
| `vue-eslint-parser` | ^9.4.0 | 开发 | Vue 文件解析 | 开发流程 |

**beautifier 内嵌依赖（第三方库，无独立 package.json）**：

| 文件 | 行数 | 职责 |
|---|---|---|
| `beautifier/javascript/beautifier.js` | 1459 | JavaScript 代码格式化主类，暴露 `Beautifier` 类与 `beautify()` 方法 |
| `beautifier/javascript/tokenizer.js` | 569 | JS tokenizer，将源码拆分为 token 流 |
| `beautifier/javascript/acorn.js` | 57 | 内嵌 acorn 解析器（精简版），用于 JS 语法分析 |
| `beautifier/javascript/options.js` | 93 | Beautifier 配置选项定义 |
| `beautifier/core/output.js` | 421 | 格式化输出处理器，管理缩进、换行、空白 |
| `beautifier/core/inputscanner.js` | 192 | 输入扫描器，逐字符读取源码 |
| `beautifier/core/tokenizer.js` | 139 | 核心 tokenizer 基类 |
| `beautifier/core/tokenstream.js` | 78 | Token 流管理器 |
| `beautifier/core/token.js` | 54 | Token 数据结构定义 |
| `beautifier/core/options.js` | 191 | 核心选项基类 |
| `beautifier/core/templatablepattern.js` | 211 | 模板模式匹配器 |
| `beautifier/core/whitespacepattern.js` | 105 | 空白模式匹配器 |
| `beautifier/core/pattern.js` | 94 | 模式匹配基类 |
| `beautifier/core/directives.js` | 62 | 指令处理 |

**模块源码文件**：

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/scripts/bus.js` | 57 | EventBus 实现 + statusLog + cnzz 统计 |
| `src/scripts/store.js` | 20 | localStorage 封装 |
| `src/scripts/contants.js` | 36 | 全局配置常量单例 |
| `src/scripts/hotkey.js` | 45 | 全局快捷键注册器 |
| `src/scripts/utils.js` | 182 | 11 个通用工具函数 |

**总计**：19 个源文件，4065 行代码。

---

## 2. Constitution 合规性检查

| 条款 | 合规状态 | 说明 |
|---|---|---|
| 第一条：单一主组件 + 注入式配置 | ✅ 合规 | `contants.js` 为配置载体，本身不硬编码任何后端地址；所有默认值为空字符串或安全默认值，运行时由 `App.vue:18-28` 三层注入覆盖 |
| 第二条：前后端契约即真相 | ✅ 合规 | `store.js` 仅封装 `localStorage`，不持久化业务数据；`contants.js:21-22` 仅定义 `RECENT_OPENED_TAB`/`RECENT_OPENED` 两个用户偏好键 |
| 第三条：通信双通道 | ✅ 合规 | 本模块不直接发起 HTTP 或 WS 连接；`utils.requestGroup` 为工具函数，由业务层调用；WS 通信由 014-infra-transport 负责 |
| 第四条：事件总线即全局状态 | ✅ 合规 | `bus.js:6-26` 自建极简 EventBus，未引入 Vuex/Pinia；所有跨组件通信走 bus；事件命名遵循 `ws_*`/`status`/`report`/动词约定 |
| 第五条：monaco 围绕 magic-script | ⬜ 不涉及 | 本模块不接触 monaco 集成 |
| 第六条：类型契约由 Header 表达 | ✅ 合规 | `contants.js:13-19` 定义全部 Header 名称常量，供 014-infra-transport 使用 |
| 第七条：国际化只信语言包索引化 | ⬜ 不涉及 | 本模块无国际化逻辑 |
| 第八条：双构建产物共存 | ✅ 合规 | 本模块为纯 JS，两种构建模式均正常打包 |
| 第九条：错误反馈走模态框 + Bus | ✅ 合规 | `bus.js:28-48` cnzz 注入与 `_czc.push` 均被 try-catch 包裹，异常静默忽略 |
| 第十条：源代码即文档真相 | ✅ 合规 | 本文档所有论断均可在源码中找到证据 |

**例外登记（与本模块相关）**：

| ID | 违反条款 | 现状 | 备注 |
|---|---|---|---|
| E-003 | 第二条衍生 | `bus.js:28-48` 注入 cnzz 第三方统计 | 已记 C-002 / NC-001 待澄清 |

---

## 3. 研究发现

### 3.1 EventBus 为何自实现而非使用 mitt

**决策**：使用自实现 `createEventBus()` 而非引入 `mitt` 等第三方库。

**理由**：
- 项目 `package.json` 中无任何事件总线依赖，说明作者有意保持零额外依赖
- 实现仅 19 行（`bus.js:6-24`），功能覆盖 `$on/$off/$emit` 三个核心方法
- 在 `bus.js` 上直接挂载 `$getStatusLog`/`$clearStatusLog` 扩展方法，利用模块单例特性

**替代方案**：引入 `mitt`（~200 bytes），但会增加一个外部依赖。

### 3.2 cnzz 统计为何硬编码在 bus.js 中

**决策**：cnzz 脚本注入与 `report` 事件处理直接写在 `bus.js` 模块顶层，而非独立模块。

**理由**（推测自代码结构）：
- `bus.js` 是全局单例，模块加载时即执行顶层代码
- 利用模块加载时机自动注入 cnzz 脚本，无需额外初始化
- `report` 事件处理与 cnzz 脚本加载完成回调在同一文件中，形成闭环

**风险**：
- 无配置开关控制启用/禁用（NC-001）
- 第三方脚本 URL 硬编码（`bus.js:30`）
- 与 EventBus 核心职责耦合

### 3.3 contants 为何是可变对象而非冻结

**决策**：`contants` 导出为普通对象，运行时可被任何模块修改。

**理由**（自 `magic-editor.vue:106-155` 推断）：
- `beforeMount` 钩子中通过 `Object.assign(contants, config)` 批量灌入配置
- 各业务组件在运行时也可能修改个别属性（如 `HEADER_MAGIC_TOKEN_VALUE` 登录后被替换）
- 未使用 `Object.freeze()` 或 `readonly` 保护

**风险**：任何模块均可意外修改配置值，无运行时保护。

### 3.4 快捷键为何使用位运算而非字符串

**决策**：`hotkey.js` 使用 keyCode 位运算（`Alt=512, Ctrl=1024, Shift=2048`）而非字符串组合（如 `'Ctrl+S'`）。

**理由**：
- 位运算匹配性能更高（单次 `&` 操作 vs 字符串解析）
- Meta 键（macOS Cmd）直接映射为 Ctrl 位掩码（`hotkey.js:19`），统一处理
- 作用域通过 `target` 元素限定，避免全局快捷键冲突

**风险**：
- `unbind()` 清空全部监听器，不支持单独注销（NC-003）
- 使用 `keyCode`（已废弃 API），现代浏览器推荐使用 `key`/`code`

### 3.5 beautifier 为何内嵌而非 npm 引入

**决策**：beautifier 整个目录（14 文件，3765 行）内嵌在 `src/scripts/beautifier/` 中，而非通过 `npm install js-beautify` 引入。

**理由**（推测）：
- 库模式构建时需要 self-contained，不依赖外部 npm 包
- 内嵌版本可能经过裁剪，仅保留 JavaScript 格式化能力
- 避免版本升级带来的行为变化

**风险**：内嵌版本与上游 `js-beautify` 不同步，安全修复/bug 修复需手动合并。

### 3.6 store.get() 为何不自动反序列化

**决策**：`store.get(key)` 返回原始字符串，调用方需自行 `JSON.parse`。

**理由**：
- 保持 API 极简，不猜测值的类型
- 调用方明确知道何时需要反序列化（如 `magic-editor.vue:304` 读取 token 时不需要反序列化）

**风险**：调用方忘记 `JSON.parse` 时得到字符串而非对象，无类型提示。

---

## 4. 数据模型

### 4.1 EventBus 内部状态

```js
// bus.js 模块作用域
const events = {}       // { eventName: [fn1, fn2, ...] }
const statusLog = []    // [{ timestamp: string, content: string }]
```

### 4.2 Store 内部状态

无内部状态，纯代理 `localStorage`。

### 4.3 Contants 运行时形态

```js
// contants.js 模块导出（运行时被覆盖后的典型形态）
{
  BASE_URL: 'http://localhost:9999/magic/web',
  WEBSOCKET_SERVER: 'ws://localhost:9999/magic/web/console',
  SERVER_URL: 'http://localhost:9999/',
  AUTO_SAVE: true,
  DECORATION_TIMEOUT: 10000,
  EDITOR_FONT_FAMILY: 'JetBrainsMono, Consolas, "Courier New",monospace, 微软雅黑',
  EDITOR_FONT_SIZE: 14,
  LOG_MAX_ROWS: Infinity,
  HEADER_MAGIC_TOKEN_VALUE: 'actual-token-after-login',  // 登录后被替换
  JDBC_DRIVERS: [...],       // 来自 config.json
  DATASOURCE_TYPES: [...],   // 来自 config.json
  OPTIONS: [...],            // 来自 config.json
  config: { version: '...', web: '...', ... }  // GET /config.json 响应
}
```

### 4.4 Hotkey 内部状态

```js
// hotkey.js 模块作用域
const listeners = []   // [{ target: Element, code: number, callback: Function }]
let inited = false     // 惰性初始化标志
```

### 4.5 状态转换

本模块无状态机。各子模块均为无状态工具或单例状态容器。

---

## 5. 接口契约

### 5.1 提供的接口

#### 5.1.1 bus（EventBus 实例）

| 方法 | 签名 | 说明 |
|---|---|---|
| `$on` | `(event: string, fn: Function) => void` | 订阅事件 |
| `$off` | `(event: string, fn?: Function) => void` | 注销监听（fn 为空时清空全部） |
| `$emit` | `(event: string, ...args: any[]) => void` | 发布事件，同步执行所有回调 |
| `$getStatusLog` | `() => Array<{timestamp: string, content: string}>` | 读取状态日志 |
| `$clearStatusLog` | `() => void` | 清空状态日志 |

#### 5.1.2 Store 实例

| 方法 | 签名 | 说明 |
|---|---|---|
| `set` | `(key: string, value: string | object | Array) => void` | 存储值，对象/数组自动 `JSON.stringify` |
| `get` | `(key: string) => string | null` | 读取原始字符串值 |
| `remove` | `(key: string) => void` | 删除键 |

#### 5.1.3 contants（配置对象）

纯对象，无方法。所有属性在 `contants.js:4-34` 定义初始值，运行时被 `magic-editor.vue:beforeMount` 覆盖。

#### 5.1.4 Key（快捷键注册器）

| 方法 | 签名 | 说明 |
|---|---|---|
| `bind` | `(target: Element, code: number, callback: Function) => void` | 注册快捷键，惰性初始化全局监听 |
| `unbind` | `() => void` | 清空全部监听器并移除 `keydown` 事件 |
| `init` | `() => void` | 初始化全局 `keydown` 监听（通常不直接调用） |

#### 5.1.5 utils（工具函数）

| 函数 | 签名 | 说明 |
|---|---|---|
| `replaceURL` | `(url: string) => string` | 规范化 URL 连续斜杠 |
| `isVisible` | `(elem: Element) => boolean` | 判断 DOM 元素可见性 |
| `formatJson` | `(val: string | object, defaultVal?: string) => string` | JSON 美化 |
| `formatDate` | `(val: number | Date) => string` | 日期格式化 |
| `paddingZero` | `(val: number) => string` | 数字补零 |
| `download` | `(blob: Blob, filename: string) => void` | 触发文件下载 |
| `requestGroup` | `(path: string, group: object) => Promise` | POST 分组数据 |
| `deepClone` | `(obj: any, ignoreFields?: string[]) => any` | 深度克隆 |
| `goToAnchor` | `(dom: string | Element) => void` | 滚动到锚点 |
| `getQueryVariable` | `(variable: string) => string | false` | 提取 URL 参数 |
| `replaceKeywords` | `(htmlString: string, keyword: string) => string` | HTML 关键词高亮 |

#### 5.1.6 Beautifier

| 方法 | 签名 | 说明 |
|---|---|---|
| `beautify` | `() => string` | 格式化 JavaScript 代码 |

### 5.2 消费的接口

| 接口 | 来源 | 用途 |
|---|---|---|
| `localStorage` | 浏览器 API | `store.js` 全部操作 |
| `document.createElement` / `getElementsByTagName` | 浏览器 API | `bus.js` cnzz 脚本注入 |
| `window._czc.push` | cnzz 全局对象 | `bus.js:44` 埋点上报 |
| `window.MAGIC_EDITOR_CONFIG` / `parent.MAGIC_EDITOR_CONFIG` | 全局变量 | `App.vue` 配置注入（本模块不直接读取） |
| `@/api/request` | 模块 014 | `utils.js:1` `requestGroup` 使用 |
| `VUE_APP_MA_VERSION` | 编译时环境变量 | `contants.js:1` 版本号 |

### 5.3 事件协议

本模块是 EventBus 的**生产者与消费者**。完整事件协议见 spec.md §3.2。

**事件命名约定**（constitution 第四条衍生约束）：
- `ws_*`：WebSocket 下行事件（由 014-infra-transport 发布）
- `status` / `report`：状态/埋点事件
- 其余：动词命名（`showLogin`、`doSave`、`open`、`close` 等）

---

## 6. 实现策略

### 6.1 架构模式

本模块采用**模块单例模式**：

- 每个文件通过 `export default` 导出一个单例实例
- 所有 import 得到同一对象引用
- 无类实例化，无工厂函数（除 `createEventBus()` 内部使用外）

```
src/scripts/
├── bus.js        → export default bus (EventBus 实例)
├── store.js      → export default new Store() (Store 实例)
├── contants.js   → export default contants (普通对象)
├── hotkey.js     → export default Key (函数对象)
├── utils.js      → export { ... } (具名导出工具函数)
└── beautifier/   → export { Beautifier } (具名导出类)
```

### 6.2 关键算法

#### 6.2.1 EventBus 发布/订阅

```js
// 订阅：将回调追加到事件数组
$on(event, fn) {
    (events[event] = events[event] || []).push(fn)
}

// 发布：同步遍历执行
$emit(event, ...args) {
    (events[event] || []).forEach(fn => fn(...args))
}
```

**特点**：同步执行、无优先级、无异步队列。若回调抛出异常，后续回调不会执行。

#### 6.2.2 快捷键位运算匹配

```js
// 监听器注册时存储组合码（如 Ctrl+S = 1024 | 83 = 1107）
listeners.push({ target, code, callback })

// 匹配时：先检查 keyCode 基础位，再组合修饰键
if ((listener.target.contains(e.target) || e.target === listener.target)
    && e.keyCode & listener.code === listener.code) {
    let controlKey = e.keyCode
    controlKey |= (e.ctrlKey && Key.Ctrl || 0)
    controlKey |= (e.shiftKey && Key.Shift || 0)
    controlKey |= (e.altKey && Key.Alt || 0)
    controlKey |= (e.metaKey && Key.Ctrl || 0)  // Meta → Ctrl
    if (controlKey == listener.code) {
        e.preventDefault()
        listener.callback()
        return  // 短路：不继续遍历
    }
}
```

**特点**：一次 `keydown` 事件最多触发一个监听器（短路返回）。

#### 6.2.3 关键词高亮替换

```
1. 将 HTML 字符串解析为 DOM 树（div.innerHTML）
2. 遍历 DOM 树提取所有文本节点（getTextNodeList）
3. 计算每个文本节点在拼接字符串中的起止索引（getTextInfoList）
4. 将关键词中的特殊字符转义后构建正则（getMatchList）
5. 从后向前遍历匹配结果，在对应文本节点处插入 <span class="keyword">（replaceMatchResult）
6. 返回 div.innerHTML
```

**特点**：从后向前替换避免索引偏移；支持跨文本节点匹配。

### 6.3 错误处理

| 场景 | 策略 | 源码行 |
|---|---|---|
| cnzz 脚本注入失败 | try-catch 静默忽略 | `bus.js:28-41` |
| `_czc.push` 调用失败 | try-catch 静默忽略 | `bus.js:43-47` |
| `formatDate` 输入类型不匹配 | 返回空字符串 | `utils.js:33` |
| `formatJson` 输入为空 | 返回 `defaultVal` 或空字符串 | `utils.js:14` |
| `goToAnchor` 选择器无匹配 | 静默不执行 | `utils.js:96-98` |
| `getQueryVariable` 参数不存在 | 返回 `false` | `utils.js:115` |
| `replaceKeywords` 关键词为空 | 直接返回原 HTML | `utils.js:172` |

**无 try-catch 保护的场景**：
- EventBus `$emit` 回调异常会中断后续回调执行
- `deepClone` 遇到循环引用会栈溢出
- `store.get()` 返回 `null` 时调用方未检查可能导致后续操作失败

### 6.4 性能

| 关注点 | 现状 | 说明 |
|---|---|---|
| EventBus 发布 | 同步 `forEach` | 无异步开销，但回调阻塞调用方 |
| statusLog | 无上限数组 | 长时间运行可能内存增长（NFR-002） |
| cnzz 脚本 | `async` 属性 | 不阻塞主线程 |
| 快捷键匹配 | 线性遍历 listeners 数组 | 监听器数量少（通常 <10），性能可忽略 |
| beautifier | 同步执行 | 大文件格式化可能阻塞主线程 |
| `replaceKeywords` | DOM 操作 + 正则 | 对大 HTML 字符串可能较慢 |

### 6.5 构建产物

本模块为纯 JS，两种构建模式均正常打包：

- **应用模式**（`npm run build`）：打包到 `dist-app/`，所有 JS 合并为 bundle
- **库模式**（`npm run build:lib`）：打包到 `dist/`，格式为 UMD + ES

beautifier 的 14 个文件会被 Vite 一并打包进最终产物。

---

## 7. 测试考虑

### 7.1 可测试性分析

| 子模块 | 可测试性 | 说明 |
|---|---|---|
| bus.js | 高 | 纯函数逻辑，无外部依赖（除 `document` 注入 cnzz 脚本外） |
| store.js | 中 | 依赖 `localStorage`，需 mock 或使用 `localStorage` shim |
| contants.js | 高 | 纯对象，可直接断言属性值 |
| hotkey.js | 中 | 依赖 `document.addEventListener`，需模拟 DOM 事件 |
| utils.js | 高 | 大部分为纯函数，可直接测试输入输出 |
| beautifier/ | 高 | 第三方库内嵌，可测试 `beautify()` 输入输出 |

### 7.2 建议测试类别

#### bus.js

| 测试场景 | 类型 | 说明 |
|---|---|---|
| `$on` 注册后 `$emit` 触发回调 | 单元 | 验证回调被调用且参数正确传递 |
| `$off(fn)` 移除特定监听器 | 单元 | 验证其他监听器仍有效 |
| `$off(event)` 清空全部监听器 | 单元 | 验证该事件不再触发任何回调 |
| `$emit` 同步执行顺序 | 单元 | 验证回调按注册顺序执行 |
| `$getStatusLog` / `$clearStatusLog` | 单元 | 验证状态日志的写入与清空 |
| `status` 事件自动追加时间戳 | 单元 | 验证 `formatDate` 被正确调用 |

#### store.js

| 测试场景 | 类型 | 说明 |
|---|---|---|
| `set` 对象值自动 `JSON.stringify` | 单元 | 验证存储后读取为 JSON 字符串 |
| `set` 字符串值直接存储 | 单元 | 验证不额外序列化 |
| `get` 返回原始字符串 | 单元 | 验证不自动反序列化 |
| `remove` 删除键 | 单元 | 验证删除后 `get` 返回 `null` |

#### contants.js

| 测试场景 | 类型 | 说明 |
|---|---|---|
| 默认值正确性 | 单元 | 验证所有默认值与 spec.md 一致 |
| `MAGIC_API_VERSION` 格式 | 单元 | 验证 `.` 被替换为 `_` |

#### hotkey.js

| 测试场景 | 类型 | 说明 |
|---|---|---|
| `bind` 注册后按键触发回调 | 集成 | 模拟 `keydown` 事件验证回调执行 |
| Ctrl+S 组合键匹配 | 集成 | 验证修饰键位运算正确 |
| Meta 键映射为 Ctrl | 集成 | 验证 macOS Cmd 键兼容 |
| `unbind` 清空全部监听器 | 集成 | 验证之后按键不再触发回调 |
| target 作用域限定 | 集成 | 验证事件目标不在 target 子树内时不触发 |

#### utils.js

| 测试场景 | 类型 | 说明 |
|---|---|---|
| `replaceURL` 规范化 | 单元 | 验证 `://` 保留、多余 `/` 被合并 |
| `formatDate` 13 位时间戳 | 单元 | 验证输出 `YYYY-MM-DD HH:mm:ss` |
| `formatDate` 10 位时间戳 | 单元 | 验证秒级时间戳正确处理 |
| `formatDate` Date 对象 | 单元 | 验证 Date 输入正确格式化 |
| `formatDate` 非法输入 | 单元 | 验证返回空字符串 |
| `deepClone` 嵌套对象 | 单元 | 验证深层属性被克隆 |
| `deepClone` ignoreFields | 单元 | 验证指定字段被剔除 |
| `getQueryVariable` 存在/不存在 | 单元 | 验证参数提取与 `false` 返回 |
| `replaceKeywords` 跨节点匹配 | 单元 | 验证关键词分散在多个文本节点时正确高亮 |

### 7.3 边界情况

| 场景 | 风险 | 建议 |
|---|---|---|
| EventBus 回调抛出异常 | 中断后续回调 | 在 `$emit` 中增加 try-catch |
| `deepClone` 循环引用 | 栈溢出 | 增加 visited Set 检测环 |
| `store.get()` 返回 `null` | 调用方未检查 | 调用方增加 null 检查 |
| `hotkey.js` `unbind()` 后重新 `bind()` | `inited` 被重置为 false，可重新初始化 | 当前代码已支持，但需验证 |
| `replaceKeywords` 含用户输入的 HTML | XSS 风险 | 确保输入为可信内容 |

---

## 8. 文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/scripts/bus.js` | 57 | EventBus 实现（createEventBus）、statusLog 内存数组、cnzz 脚本异步注入、report/status 事件处理、$getStatusLog/$clearStatusLog 接口 |
| `src/scripts/store.js` | 20 | Store 类封装 localStorage（set/get/remove），对象/数组自动 JSON.stringify，模块单例导出 |
| `src/scripts/contants.js` | 36 | 全局配置常量单例：BASE_URL/WEBSOCKET_SERVER/SERVER_URL/AUTO_SAVE/DECORATION_TIMEOUT/字体/Header 名/响应码/localStorage 键名/默认数组/config 对象 |
| `src/scripts/hotkey.js` | 45 | Key 对象：A-Z/F1-F12 keyCode 映射、修饰键位掩码（Alt/Ctrl/Shift）、bind/unbind/init、位运算匹配、惰性初始化、target 作用域限定 |
| `src/scripts/utils.js` | 182 | 11 个工具函数：replaceURL/isVisible/formatJson/formatDate/paddingZero/download/requestGroup/isArray/deepClone/goToAnchor/getQueryVariable/replaceKeywords |
| `src/scripts/beautifier/javascript/beautifier.js` | 1459 | JavaScript 代码格式化器主类 |
| `src/scripts/beautifier/javascript/acorn.js` | 57 | 内嵌 acorn JS 解析器 |
| `src/scripts/beautifier/javascript/options.js` | 93 | Beautifier 配置选项 |
| `src/scripts/beautifier/javascript/tokenizer.js` | 569 | JS tokenizer |
| `src/scripts/beautifier/core/output.js` | 421 | 格式化输出处理器 |
| `src/scripts/beautifier/core/inputscanner.js` | 192 | 输入扫描器 |
| `src/scripts/beautifier/core/tokenizer.js` | 139 | 核心 tokenizer 基类 |
| `src/scripts/beautifier/core/tokenstream.js` | 78 | Token 流管理器 |
| `src/scripts/beautifier/core/token.js` | 54 | Token 数据结构 |
| `src/scripts/beautifier/core/options.js` | 191 | 核心选项基类 |
| `src/scripts/beautifier/core/templatablepattern.js` | 211 | 模板模式匹配器 |
| `src/scripts/beautifier/core/whitespacepattern.js` | 105 | 空白模式匹配器 |
| `src/scripts/beautifier/core/pattern.js` | 94 | 模式匹配基类 |
| `src/scripts/beautifier/core/directives.js` | 62 | 指令处理 |
| **合计** | **4065** | 19 个文件 |
