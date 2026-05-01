# 009-layout-debug 技术计划（As-Built）

> 本文件以"已建成系统"视角记录 009-layout-debug 模块的实际架构、设计决策与实现策略。
> 模块：009-layout-debug
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. 技术上下文

### 1.1 运行环境

| 维度 | 值 |
|---|---|
| 运行时 | 现代浏览器（Chrome/Edge/Firefox/Safari） |
| 框架 | Vue 3.4（Options API 风格，两个组件均为 `export default { props/data/computed/methods }`） |
| 构建 | Vite 5.4.21，双 mode（app → `dist-app/`，lib → `dist/`） |
| 通信 | axios 0.21（HTTP）+ 自研 ReconnectingWebSocket（WS 事件流） |
| 状态 | 自实现 EventBus（`src/scripts/bus.js`），无 Vuex/Pinia |
| 持久化 | 无（本模块不写入 localStorage） |

### 1.2 依赖清单

| 依赖 | 版本 | 用途 | 消费组件 |
|---|---|---|---|
| `vue` | ^3.4.0 | 组件框架 | MagicDebug, MagicLog |
| `@/scripts/bus.js` | 内部 | EventBus 跨组件通信 | MagicDebug（emit `doContinue`/`doStepInto`）, MagicLog（on `ws_log`） |
| `@/components/common/magic-structure.vue` | 内部 | 变量值结构化渲染 | MagicDebug |
| `@/scripts/contants.js` | 内部 | 全局常量（`RESPONSE_CODE_DEBUG=1000`、`LOG_MAX_ROWS=Infinity` 等） | 间接（由 001-editor-core 消费） |
| `@/scripts/websocket.js` | 内部 | WebSocket 帧解析与 `ws_*` 事件广播 | 间接（通过 bus 转发） |
| `$magicContextmenu` | 全局指令 | 右键菜单 | MagicLog |

---

## 2. Constitution 合规性检查

| 宪法条款 | 合规状态 | 依据 |
|---|---|---|
| **第一条** 单一主组件 + 注入式配置 | ✅ 合规 | MagicDebug 与 MagicLog 均不声明 `props.config`，不硬编码后端地址；通过 `props.info` 接收容器注入的数据对象（`magic-debug.vue:39`、`magic-log.vue:19-21`） |
| **第二条** 前后端契约即真相 | ✅ 合规 | 本模块不持久化任何业务数据；MagicLog 的 `logs` 数组为组件本地内存状态，组件销毁即丢失；MagicDebug 的变量数据来自 `info.ext.variables`，由 001-editor-core 从后端 WS 推送获取 |
| **第三条** 通信双通道：HTTP + WebSocket | ✅ 合规 | 本模块不直接发起 HTTP 请求；MagicLog 消费 `ws_log` 事件（`magic-log.vue:28`），MagicDebug 通过 bus 发射 `doContinue`/`doStepInto` 事件（`magic-debug.vue:4,6`），由 001-editor-core 通过 WS 发送 `resume_breakpoint` 消息；不通过 WS 发起 CRUD，不通过 HTTP 长轮询 |
| **第四条** 事件总线即全局状态 | ✅ 合规 | 所有跨组件通信走 `bus.js`：MagicDebug emit `doContinue`/`doStepInto`（`magic-debug.vue:4,6`），MagicLog on `ws_log`（`magic-log.vue:28`）；无 Vuex/Pinia/Provide-Inject |
| **第五条** monaco 围绕 magic-script | ✅ 合规 | 本模块不涉及 monaco 编辑器；monaco 装饰由 001-editor-core 负责 |
| **第六条** 类型契约由 Header 表达 | ✅ 合规 | 本模块不直接设置 HTTP Header；但调试面板参与构建调试上下文——`info.ext.debuging` 与 `info.ext.variables` 的数据来源于 `RESPONSE_CODE_DEBUG=1000` 响应判定与 `ws_breakpoint` 事件，而 `Magic-Request-Session` / `Magic-Request-Breakpoints` Header 由 001-editor-core 注入（`contants.js:13-14`） |
| **第七条** 国际化只信构建期 | ⚠️ 部分 | 本模块 UI 文案全部中文硬编码（"变量名"、"变量值"、"变量类型"、"no message."、"继续(F8)"、"单步(F6)"、"清空日志"、"点击显示/隐藏"）；符合 overall-spec 的中文界面约定，但未使用 i18n 机制 |
| **第八条** 双构建产物共存 | ✅ 合规 | 本模块组件通过 `src/components/layout/` 目录统一打包，应用模式与库模式均包含；CSS 无 hash（`vite.config.js:assetFileNames`） |
| **第九条** 错误反馈走模态框 + Bus | ✅ 合规 | 本模块无错误弹出场景；日志面板的 HTML 转义（`magic-log.vue:36-39`）为预防性安全措施，非错误反馈 |
| **第十条** 源代码即文档真相 | ✅ 合规 | 本文档所有论断均附源码路径/行号；待澄清事项显式标记（见 spec.md §9） |

### 例外登记

本模块无新增例外。

---

## 3. 项目结构

### 3.1 模块文件

```
src/components/layout/
├── magic-debug.vue          ← MagicDebug 组件（134 行）
│   ├── <template>           继续/单步按钮 + 变量表格
│   ├── <script>             Options API：props(info), computed(debuging/variables)
│   └── <style scoped>       容器布局、按钮样式、表格样式、斑马纹
└── magic-log.vue            ← MagicLog 组件（99 行）
    ├── <template>           日志列表 + 折叠/展开 + 右键菜单
    ├── <script>             Options API：data(logs), mounted(ws_log 订阅), methods
    └── <style scoped>       容器、日志行高、折叠/展开样式
```

### 3.2 与相邻模块的物理边界

```
001-editor-core (magic-script-editor.vue)
    │
    ├── 共享 info 对象（v-model:info 从 008-layout-request 传递）
    │   ├── info.ext.debuging    ← 调试态标志
    │   └── info.ext.variables   ← 调试变量列表
    │
    ├── bus 事件
    │   ├── doContinue / doStepInto  ← 本模块 emit → 001 消费
    │   ├── ws_breakpoint            ← 001 消费（设置 info.ext）
    │   └── ws_log                   ← 本模块消费（追加日志）
    │
    └── WS 消息
        └── resume_breakpoint        ← 001 通过 WS 发送

008-layout-request (magic-options.vue)
    │
    └── v-model:info 传递 + Tab 注册（"调试信息"、"运行日志"）

014-infra-transport (websocket.js)
    │
    └── 下行帧解析 → bus.$emit('ws_log', args) / bus.$emit('ws_breakpoint', args)

015-infra-bus-store (contants.js)
    │
    ├── RESPONSE_CODE_DEBUG = 1000    ← 断点响应码
    ├── HEADER_REQUEST_SESSION        ← 调试会话 Header
    ├── HEADER_REQUEST_BREAKPOINTS    ← 断点行号 Header
    └── LOG_MAX_ROWS = Infinity       ← 日志行数上限（未消费）

016-common-ui
    ├── magic-structure.vue           ← 变量值结构化渲染
    └── magic-contextmenu/            ← $magicContextmenu 右键菜单
```

---

## 4. Phase 0 研究发现

### 4.1 调试控制完整事件流

**决策**：调试控制采用"按钮 → bus → 001-editor-core → WS → 后端 → WS → bus → 001-editor-core → info.ext → 本模块渲染"的完整闭环。

**实现**（源码追踪）：

```
用户点击继续按钮 (magic-debug.vue:4)
  → bus.$emit('doContinue')
  → 001-editor-core 在 mounted 中监听 (magic-script-editor.vue:657)
  → doContinue() 函数:
     1. deltaDecorations(debugDecorations, []) 清除调试装饰 (663)
     2. target.ext.variables = [] 清空变量 (665)
     3. target.ext.debuging = false 退出调试态 (665)
     4. 收集断点行号 (668-671)
     5. bus.$emit('message', 'resume_breakpoint', `0,${breakpoints}`) (666)
  → websocket.js 监听 'message' 事件 (7-13)
  → socket.send('resume_breakpoint,0,10|25')
  → 后端恢复执行
  → 下次断点命中 → ws_breakpoint 事件 → 重新进入调试态
```

单步执行（F6）路径相同，仅 `step` 参数为 `'1'`（`magic-script-editor.vue:674-676`）。

**理由**（推断）：
- 调试面板仅负责 UI 展示与用户交互入口，不直接操作 WS 连接
- 通过 bus 解耦，使调试面板可独立于 WS 实现进行替换
- 001-editor-core 作为"调试控制器"集中管理调试状态与 WS 通信

**后果**：
- 优点：职责清晰，调试面板为纯展示组件
- 缺点：事件链路较长（按钮 → bus → 001 → WS → 后端 → WS → bus → 001 → info → 面板），排查问题时需跨多个文件

### 4.2 日志正则高亮的精确匹配规则

**决策**：MagicLog 使用三条正则分别处理时间戳+级别、URL、堆栈 `at` 行。

**实现**（`magic-log.vue:40-44`）：

```js
// 1. 时间戳 + 日志级别（Spring Boot 默认格式）
/(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}.\d{3}\s+)([^\s]+)( --- \[)(.{15})(] )(.{40})/gm
// 捕获组: $1=时间戳, $2=级别, $3= --- [, $4=线程名(15字符), $5=] + 分隔, $6=日志内容(40字符)
// 替换: $1 <span class="log-$2">$2</span>$3$4$5<span class="log-cyan">$6</span>

// 2. URL 链接
/(https?:\/\/[^\s]+)/gm
// 替换: <a class="log-link" href="$1" target="blank">$1</a>

// 3. Java 堆栈 at 行
/(\tat .*\()(.*?:\d+)(\).*?[\r\n])/g
// 捕获组: $1=\tat ... (, $2=文件名:行号, $3=)...
// 替换: $1<span style="color:#808080;text-decoration: underline;">$2</span>$3
```

**注意事项**：
- 时间戳正则中的 `.` 未转义，会匹配任意字符（应为 `\.` 匹配毫秒分隔符）
- `.{40}` 仅匹配前 40 个字符的日志内容，超长日志的后续部分不会被 `log-cyan` 着色
- `.{15}` 线程名固定 15 字符，若线程名长度变化则匹配失败
- 三条正则按顺序执行，URL 替换在时间戳之后，堆栈在 URL 之后

### 4.3 MagicLog 的内存泄漏风险

**发现**：`magic-log.vue:28` 在 `mounted` 中订阅 `ws_log` 事件，但**未实现 `beforeDestroy`/`unmounted` 中的 `$off` 清理**。

```js
mounted() {
  bus.$on('ws_log', rows => this.onLogReceived(rows[0]))
}
// ❌ 缺少 beforeDestroy() { bus.$off('ws_log', this.onLogReceived) }
```

**影响**：
- 每次切换 Tab（销毁并重建 MagicLog 组件）都会新增一个 bus 监听器
- 旧监听器仍保留在 bus 中，导致同一条日志被追加多次
- 随着切换次数增加，日志重复追加次数线性增长

**缓解**（当前未实施）：
- 在 `beforeDestroy` 或 `unmounted` 钩子中调用 `bus.$off('ws_log', ...)`
- 或使用具名函数替代箭头函数以便引用

### 4.4 LOG_MAX_ROWS 常量未消费

**发现**：`contants.js:26` 定义了 `LOG_MAX_ROWS = Infinity`，但 MagicLog 组件**未引用此常量**。

```js
// contants.js:26
LOG_MAX_ROWS: Infinity

// magic-log.vue — 未 import contants，未使用 LOG_MAX_ROWS
this.logs.push({ html, multiple, lines, showMore })  // 无上限
```

**影响**：
- 日志数组无上限增长，长时间调试可能导致内存占用过高
- 常量定义与实际消费脱节

### 4.5 RESPONSE_CODE_DEBUG = 1000 的断点判定链路

**决策**：后端通过 HTTP 响应 `code=1000` 告知前端进入调试模式，随后通过 WS 推送变量数据。

**实现**（源码追踪）：

```
001-editor-core 发起测试请求 (magic-script-editor.vue:626-627)
  → Header: Magic-Request-Session = <timestamp><random4>
  → Header: Magic-Request-Breakpoints = "10,25,42"

后端响应:
  { "code": 1000, "message": "断点命中" }
  → 001-editor-core 判定 code === RESPONSE_CODE_DEBUG (1000)
  → 等待 ws_breakpoint 事件

后端通过 WS 推送:
  ws_breakpoint,<sessionId>,{"variables":[...],"range":[lineNo,...]}
  → websocket.js 解析 → bus.$emit('ws_breakpoint', args)
  → 001-editor-core onBreakpoint(args[0]) (magic-script-editor.vue:229)
     1. statusShow("进入断点...") (279)
     2. target.ext.debuging = true (281)
     3. target.ext.variables = rows[0].variables (283)
     4. 高亮执行行 (285-294)
     5. bus.$emit('switch-tab', 'debug') (295)
  → 008-layout-request 切换到"调试信息"Tab
  → MagicDebug 渲染变量表格（computed 自动响应 info.ext 变化）
```

**关键点**：
- `code=1000` 仅作为"即将进入调试"的信号，实际变量数据通过 WS 推送
- 这是 HTTP + WS 双通道协作的典型场景（符合 constitution 第三条）
- `Magic-Request-Session` Header 确保 WS 推送的 `ws_breakpoint` 与当前测试调用关联

---

## 5. Phase 1 设计输出

### 5.1 数据模型

#### 5.1.1 调试变量（Variable）

```ts
interface Variable {
  name: string    // 变量名，如 "user", "list", "result"
  value: string   // JSON 字符串，由后端序列化
  type: string    // Java 类型全限定名，如 "java.lang.String", "java.util.List"
}
```

来源：`ws_breakpoint` 事件的 `variables` 字段（`magic-script-editor.vue:283`）。

#### 5.1.2 运行日志条目（LogEntry）

```ts
interface LogEntry {
  html: string       // HTML 转义 + 语法高亮后的内容
  multiple: boolean  // 是否超过 3 行
  lines: number      // 被隐藏的行数（总行数 - 4）
  showMore: boolean  // 是否展开
}
```

来源：`onLogReceived()` 方法构造（`magic-log.vue:46-51`）。

#### 5.1.3 共享 info.ext 调试扩展

```ts
interface InfoExt {
  debuging: boolean           // 是否处于调试态
  variables: Variable[]       // 当前断点的变量列表
  // 以下由 001-editor-core 管理，本模块只读：
  sessionId: string           // 调试会话 ID
  decorations: any[]          // 断点装饰
  debugDecorations: any[]     // 调试行装饰
  debugDecoration: any        // 当前调试行装饰
}
```

#### 5.1.4 状态流转

```
[非调试态]
    │
    │ 用户 Ctrl+Q 测试 → 后端响应 code=1000
    │ → WS 推送 ws_breakpoint
    │ → 001-editor-core 设置 info.ext.debuging=true, info.ext.variables=[...]
    ▼
[调试态]
    │
    │ MagicDebug 按钮启用（!debuging → false）
    │ 变量表格渲染
    │
    ├─ 点击继续(F8) → doContinue → WS resume_breakpoint,0 → 退出调试态
    │
    └─ 点击单步(F6) → doStepInto → WS resume_breakpoint,1 → 保持/重新进入调试态
```

### 5.2 接口契约

#### 5.2.1 提供的接口

本模块不对外导出 API。所有能力通过 bus 事件和 `props.info` 暴露：

| 接口 | 类型 | 说明 |
|---|---|---|
| `props.info` | Object | 接收容器注入的资源对象，包含 `ext.debuging` / `ext.variables` |
| `bus.$emit('doContinue')` | 事件 | 继续执行（F8） |
| `bus.$emit('doStepInto')` | 事件 | 单步执行（F6） |

#### 5.2.2 消费的接口

| 来源 | 接口 | 消费方式 | 消费组件 |
|---|---|---|---|
| 008-layout-request | `info` 对象 | `props.info` 单向传入 | MagicDebug, MagicLog |
| 014-infra-transport | `ws_log` 事件 | `bus.$on('ws_log', ...)` | MagicLog |
| 016-common-ui | `MagicStructure` 组件 | `import` 引用 | MagicDebug |
| 016-common-ui | `$magicContextmenu` 指令 | `this.$magicContextmenu(...)` | MagicLog |

#### 5.2.3 WebSocket 消息协议对齐

| msgType | 方向 | 格式 | 本模块角色 |
|---|---|---|---|
| `ws_breakpoint` | 下行 | `ws_breakpoint,<sessionId>,{"variables":[...],"range":[...]}` | 001-editor-core 消费，本模块通过 `info.ext` 间接消费 |
| `ws_log` | 下行 | `ws_log,<text>` | 本模块直接消费（`magic-log.vue:28`） |
| `ws_exception` | 下行 | `ws_exception,<sessionId>,<message>,[startLine,endLine,startCol,endCol]` | 001-editor-core 消费 |
| `resume_breakpoint` | 上行 | `resume_breakpoint,<step>,<breakpoints>` | 001-editor-core 通过 bus 发送 |

### 5.3 FR 映射表

| Spec FR | 实现文件 | 实现方式 | 合规状态 |
|---|---|---|---|
| FR-001 | `magic-debug.vue:3-8` | `<ul>` 中两个 `<li>` 按钮，带 icon 与 title | ✅ |
| FR-002 | `magic-debug.vue:4,6,48-49` | `:class="{ disabled: !debuging }"` | ✅ |
| FR-003 | `magic-debug.vue:4` | `@click="bus.$emit('doContinue')"` | ✅ |
| FR-004 | `magic-debug.vue:6` | `@click="bus.$emit('doStepInto')"` | ✅ |
| FR-005 | `magic-debug.vue:11-27` | `<table>` 三列（变量名/值/类型） | ✅ |
| FR-006 | `magic-debug.vue:24` | `<magic-structure :data="item.value" :type="item.type"/>` | ✅ |
| FR-007 | `magic-debug.vue:19-21` | `v-if="variables.length === 0"` 显示 "no message." | ✅ |
| FR-008 | `magic-debug.vue:48-49` | `computed.debuging` 读取 `this.info.ext.debuging` | ✅ |
| FR-009 | `magic-debug.vue:51-52` | `computed.variables` 读取 `this.info.ext.variables` | ✅ |
| FR-010 | `magic-debug.vue:130-132` | `table tbody tr:nth-child(even)` 斑马纹 | ✅ |
| FR-011 | `magic-debug.vue:114-117` | `th:not(:last-child), td:not(:last-child)` 右边框 | ✅ |
| FR-020 | `magic-log.vue:28` | `bus.$on('ws_log', rows => this.onLogReceived(rows[0]))` | ✅ |
| FR-021 | `magic-log.vue:36-39` | `text.replace(/[&<>]/gm, ...)` HTML 转义 | ✅ |
| FR-022 | `magic-log.vue:40` | 正则匹配时间戳+级别，添加 `<span class="log-LEVEL">` | ✅ |
| FR-023 | `magic-log.vue:42` | 正则匹配 URL，渲染为 `<a target="blank">` | ✅ |
| FR-024 | `magic-log.vue:44` | 正则匹配 `\tat ... (file:line)`，添加灰色下划线 | ✅ |
| FR-025 | `magic-log.vue:6-8,46-51,86-91` | `multiple` 类控制 `max-height: 60px`，点击切换 `showMore` | ✅ |
| FR-026 | `magic-log.vue:52-53` | `$nextTick(() => container.scrollTop = container.scrollHeight)` | ✅ |
| FR-027 | `magic-log.vue:55-63` | `$magicContextmenu` 右键菜单，`this.logs.splice(0)` | ✅ |
| FR-028 | `magic-log.vue:46-51` | LogEntry 对象包含 `multiple`/`lines`/`showMore` | ✅ |
| FR-029 | `magic-log.vue:84` | `.ma-log > div pre { line-height: 20px }` | ✅ |
| FR-030 | `magic-log.vue:74` | `background: var(--run-log-background)` | ✅ |
| FR-040~045 | 001-editor-core | 由 001-editor-core 实现，本模块间接参与 | ✅ |
| FR-050~056 | 001-editor-core | 由 001-editor-core 实现，本模块通过 `info.ext` 消费 | ✅ |
| FR-060~067 | 001/014/本模块 | `ws_breakpoint` 由 001 消费，`ws_log` 由本模块消费 | ✅ |
| FR-070~075 | 见上 | bus 事件发射/监听 | ✅ |
| FR-080~082 | 001-editor-core | 由 001-editor-core 实现 | ✅ |
| FR-090~094 | 001-editor-core | 由 001-editor-core 实现 | ✅ |

---

## 6. 复杂度追踪

| 复杂度维度 | 评级 | 说明 |
|---|---|---|
| **UI 复杂度** | 低 | MagicDebug 为简单表格 + 两个按钮；MagicLog 为列表 + 正则替换 |
| **状态复杂度** | 低 | MagicDebug 无本地状态（纯 computed）；MagicLog 仅 `logs` 数组 |
| **通信复杂度** | 中 | 涉及 bus 事件（`doContinue`/`doStepInto`/`ws_log`）与 WS 消息（`resume_breakpoint`）的跨模块协作 |
| **调试协议复杂度** | 中 | `RESPONSE_CODE_DEBUG=1000` + `Magic-Request-Session` + `Magic-Request-Breakpoints` + `ws_breakpoint` + `resume_breakpoint` 五要素协同 |
| **安全风险** | 低 | 日志 HTML 转义已实现（FR-021）；`target="blank"` 缺少 `rel="noopener noreferrer"`（轻微风险） |
| **内存风险** | 中 | MagicLog 无 `$off` 清理（NC-001）；`LOG_MAX_ROWS` 未消费（NC-002） |

---

## 7. 进度追踪

| 阶段 | 状态 | 说明 |
|---|---|---|
| spec.md 生成 | ✅ 完成 | 包含 8 个用户故事、30+ 功能需求、5 个接受场景 |
| plan.md 生成 | ✅ 完成 | 本文档 |
| Constitution 合规检查 | ✅ 完成 | 10 条宪法全部检查，1 条部分合规（第七条 i18n） |
| FR 一一映射 | ✅ 完成 | 所有 FR 均已源码证据对齐 |
| 待澄清登记 | ✅ 完成 | 3 项（NC-001/002/003），见 spec.md §9 |

---

## 8. 文件清单

| 文件 | 目的 | 行数 |
|---|---|---|
| `src/components/layout/magic-debug.vue` | 调试信息面板（继续/单步按钮 + 变量表格） | 134 |
| `src/components/layout/magic-log.vue` | 运行日志面板（日志流渲染 + 语法高亮 + 折叠/展开 + 右键清空） | 99 |

**总计**：2 个文件，233 行。
