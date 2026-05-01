# 布局面板模块规范（As-Built）— 009-layout-debug

> 模块编号：009-layout-debug
> 状态：已实现
> 最后更新：2026-05-01
> 对应源码：
> - `src/components/layout/magic-debug.vue`（134 行）— 调试信息面板
> - `src/components/layout/magic-log.vue`（99 行）— 运行日志面板

---

## 1. 模块概述

### 1.1 目的

本模块提供 magic-editor 底部面板中的**调试与日志子面板**，是开发者在脚本测试与调试过程中获取实时反馈的核心 UI 层。具体职责：

- **调试面板（MagicDebug）**：在断点命中时展示当前作用域内的变量名/值/类型，并提供继续（F8）与单步（F6）操作入口
- **日志面板（MagicLog）**：实时接收并渲染后端通过 WebSocket 推送的运行日志流，支持语法高亮、多行折叠、右键清空

### 1.2 解决的问题

- 断点命中后需要可视化查看当前变量状态，而非仅依赖控制台输出
- 调试过程中需要快捷的继续/单步操作入口，无需依赖快捷键
- 接口运行时的后端日志需要实时推送到前端并以可读格式展示
- 长日志（如 Java 堆栈）需要默认折叠以避免面板被单条日志占满
- 日志中的时间戳、日志级别、URL、堆栈 `at` 行需要语法高亮以提升可读性

### 1.3 范围

**包含**：
- 调试面板：继续/单步按钮 + 变量表格（变量名/值/类型三列）
- 日志面板：日志流渲染、HTML 转义、语法高亮、多行折叠/展开、右键清空
- 与 WebSocket 层的 `ws_breakpoint` / `ws_log` 事件消费
- 与 001-editor-core 的调试状态共享（`info.ext.debuging` / `info.ext.variables`）

**不包含**：
- 断点装饰与调试行高亮（由 001-editor-core 负责）
- HTTP 测试请求的发起与断点 Header 注入（由 001-editor-core 负责）
- WebSocket 连接管理与帧解析（由 014-infra-transport 负责）
- 底部面板容器与 Tab 切换逻辑（由 008-layout-request 的 MagicOptions 负责）
- 事件总线与常量定义（由 015-infra-bus-store 负责）
- 变量值的结构化渲染组件 MagicStructure（由 016-common-ui 负责）

---

## 2. 用户故事

| ID | 用户故事 | 源码位置 |
|---|---|---|
| US-001 | 作为开发者，我能在断点命中时查看当前变量名/值/类型，以便理解脚本执行状态 | `magic-debug.vue:10-28` |
| US-002 | 作为开发者，我能点击继续（F8）或单步（F6）按钮控制调试流程，以便逐步排查问题 | `magic-debug.vue:4-8` |
| US-003 | 作为开发者，我能实时查看接口运行时的后端日志输出，以便调试问题 | `magic-log.vue:3-10` |
| US-004 | 作为开发者，我能看到日志中的时间戳和日志级别高亮，以便快速定位关键信息 | `magic-log.vue:40` |
| US-005 | 作为开发者，超过 3 行的长日志默认折叠，我能点击展开查看完整内容，以避免面板被占满 | `magic-log.vue:6-8,46-51` |
| US-006 | 作为开发者，我能右键清空日志面板，以便清理旧日志重新开始 | `magic-log.vue:55-63` |
| US-007 | 作为开发者，日志中的 URL 可点击跳转，以便快速访问相关链接 | `magic-log.vue:42` |
| US-008 | 作为开发者，日志中的 Java 堆栈 `at` 行带有下划线样式，以便识别文件位置 | `magic-log.vue:44` |

---

## 3. 功能需求

### 3.1 调试面板（MagicDebug）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-001 | 系统 MUST 提供继续（F8）和单步（F6）两个操作按钮，位于面板左侧工具条 | `magic-debug.vue:3-8` |
| FR-002 | 继续/单步按钮在非调试态（`info.ext.debuging !== true`）MUST 显示为禁用（`disabled` 样式类） | `magic-debug.vue:4,6,48-49` |
| FR-003 | 点击继续按钮 MUST 发射 `bus.$emit('doContinue')` 事件 | `magic-debug.vue:4` |
| FR-004 | 点击单步按钮 MUST 发射 `bus.$emit('doStepInto')` 事件 | `magic-debug.vue:6` |
| FR-005 | 系统 MUST 以表格形式展示调试变量，列包括：变量名、变量值、变量类型 | `magic-debug.vue:11-27` |
| FR-006 | 变量值 MUST 使用 MagicStructure 组件进行结构化展示，支持 java.lang 类型直显与 JSON 对象/数组展开 | `magic-debug.vue:24` |
| FR-007 | 无变量时 MUST 显示 "no message." 占位文本，居中显示 | `magic-debug.vue:19-21` |
| FR-008 | 调试态标志 MUST 从 `info.ext.debuging` 读取（计算属性） | `magic-debug.vue:48-49` |
| FR-009 | 变量列表 MUST 从 `info.ext.variables` 读取（计算属性），每项包含 `name`、`value`、`type` 三字段 | `magic-debug.vue:51-52` |
| FR-010 | 变量表格 MUST 支持偶数行斑马纹背景 | `magic-debug.vue:130-132` |
| FR-011 | 变量表格列之间 MUST 显示垂直分隔线 | `magic-debug.vue:114-117` |

### 3.2 日志面板（MagicLog）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-020 | 系统 MUST 在收到 `ws_log` WebSocket 事件时追加日志条目 | `magic-log.vue:28` |
| FR-021 | 日志内容 MUST 进行 HTML 转义（`&` → `&amp;`、`<` → `&lt;`、`>` → `&gt;`）以防止 XSS | `magic-log.vue:36-39` |
| FR-022 | 日志 MUST 对时间戳 + 日志级别进行语法高亮（正则匹配 `YYYY-MM-DD HH:mm:ss.SSS LEVEL` 格式） | `magic-log.vue:40` |
| FR-023 | 日志中的 URL（`http://` 或 `https://` 开头）MUST 渲染为可点击链接（`target="blank"`） | `magic-log.vue:42` |
| FR-024 | 日志中的 Java 堆栈 `at` 行（`\tat (file:line)` 格式）MUST 对文件位置添加灰色下划线样式 | `magic-log.vue:44` |
| FR-025 | 超过 3 行的日志 MUST 默认折叠（`max-height: 60px; overflow: hidden`），提供"点击显示/隐藏"切换链接 | `magic-log.vue:6-8,46-51,86-91` |
| FR-026 | 新日志追加后 MUST 自动滚动到底部（`container.scrollTop = container.scrollHeight`） | `magic-log.vue:52-53` |
| FR-027 | 系统 MUST 支持右键菜单清空日志（`this.logs.splice(0)`） | `magic-log.vue:55-63` |
| FR-028 | 每条日志条目 MUST 记录 `multiple`（是否多行）、`lines`（被隐藏的行数）、`showMore`（展开状态） | `magic-log.vue:46-51` |
| FR-029 | 日志行高 MUST 为 20px（`line-height: 20px`） | `magic-log.vue:84` |
| FR-030 | 日志面板背景色 MUST 使用 CSS 变量 `--run-log-background` | `magic-log.vue:74` |

### 3.3 断点协议（HTTP Header 注入）

> 本节描述 001-editor-core 在发起测试调用时注入的调试相关 Header，本模块的面板数据参与构建这些 Header 的值。

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-040 | 系统 MUST 在测试调用时通过 HTTP Header `Magic-Request-Session` 传递唯一会话 ID | `contants.js:13`、`magic-script-editor.vue:626-627` |
| FR-041 | 会话 ID MUST 由时间戳 + 4 位随机数生成，格式为 `<timestamp><random4>` | `magic-script-editor.vue:626` |
| FR-042 | 系统 MUST 在测试调用时通过 HTTP Header `Magic-Request-Breakpoints` 传递断点行号列表 | `contants.js:14`、`magic-script-editor.vue:702-707` |
| FR-043 | 断点行号列表 MUST 以逗号分隔的字符串格式传递（如 `"10,25,42"`） | `magic-script-editor.vue:702-707` |
| FR-044 | 断点行号 MUST 从 monaco 编辑器的 decoration 中提取，筛选条件为 `linesDecorationsClassName === 'breakpoints'` | `magic-script-editor.vue:704-706` |
| FR-045 | 会话 ID 生成后 MUST 通过 `bus.$emit('message', 'set_session_id', sessionId)` 通知 WebSocket 层建立会话关联 | `magic-script-editor.vue:627` |

### 3.4 断点响应码处理（RESPONSE_CODE_DEBUG = 1000）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-050 | 当 HTTP 测试响应 `code === 1000`（`RESPONSE_CODE_DEBUG`）时，系统 MUST 判定为断点命中 | `contants.js:23` |
| FR-051 | 断点命中后，后端通过 WebSocket 推送 `ws_breakpoint` 事件，携带变量列表与执行行范围 | `magic-script-editor.vue:229`、`websocket.js:39` |
| FR-052 | 收到 `ws_breakpoint` 后，系统 MUST 设置 `info.ext.debuging = true` 进入调试态 | `magic-script-editor.vue:281` |
| FR-053 | 收到 `ws_breakpoint` 后，系统 MUST 将变量列表存入 `info.ext.variables` | `magic-script-editor.vue:283` |
| FR-054 | 收到 `ws_breakpoint` 后，系统 MUST 在编辑器中高亮当前执行行（`debug-line` 样式） | `magic-script-editor.vue:285-294` |
| FR-055 | 收到 `ws_breakpoint` 后，系统 MUST 通过 `bus.$emit('switch-tab', 'debug')` 切换到调试面板 | `magic-script-editor.vue:295` |
| FR-056 | 收到 `ws_breakpoint` 后，系统 MUST 在状态条显示"进入断点..." | `magic-script-editor.vue:279` |

### 3.5 WebSocket 消息处理

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-060 | 系统 MUST 消费 `ws_breakpoint` 事件，处理函数为 `onBreakpoint(rows[0])` | `magic-script-editor.vue:229` |
| FR-061 | 系统 MUST 消费 `ws_exception` 事件，处理函数为 `onException(args[0])` | `magic-script-editor.vue:230` |
| FR-062 | 系统 MUST 消费 `ws_log` 事件，处理函数为 `onLogReceived(rows[0])` | `magic-log.vue:28` |
| FR-063 | WebSocket 下行帧解析规则：第一个逗号为 msgType，后续逗号分隔参数，遇到 `[` 或 `{` 开头的段解析为 JSON | `websocket.js:24-39` |
| FR-064 | 解析后的消息通过 `bus.$emit('ws_' + msgType, args)` 广播，args 为参数数组 | `websocket.js:39` |
| FR-065 | `ws_breakpoint` 的 args[0] 结构包含：`variables`（变量数组）、`range`（执行行范围 `[lineNo, ...]`） | `magic-script-editor.vue:283-284` |
| FR-066 | `ws_exception` 的 args 结构包含：`args[0]`（sessionId）、`args[1]`（异常消息）、`args[2]`（位置 `[startLine, endLine, startCol, endCol]`） | `magic-script-editor.vue:257-259` |
| FR-067 | `ws_log` 的 args[0] 为日志文本字符串 | `magic-log.vue:35` |

### 3.6 Bus 事件协议

#### 本模块发射（emit）的事件

| ID | 事件 | 触发时机 | 参数 | 源码位置 |
|---|---|---|---|---|
| FR-070 | `doContinue` | 调试面板点击继续按钮 | 无 | `magic-debug.vue:4` |
| FR-071 | `doStepInto` | 调试面板点击单步按钮 | 无 | `magic-debug.vue:6` |

#### 本模块监听（on）的事件

| ID | 事件 | 来源 | 处理 | 源码位置 |
|---|---|---|---|---|
| FR-072 | `ws_breakpoint` | WebSocket（经 bus 转发） | 001-editor-core 处理，设置 `info.ext.debuging` / `info.ext.variables` | `magic-script-editor.vue:229` |
| FR-073 | `ws_exception` | WebSocket（经 bus 转发） | 001-editor-core 处理，显示异常装饰 | `magic-script-editor.vue:230` |
| FR-074 | `ws_log` | WebSocket（经 bus 转发） | 本模块追加日志条目 | `magic-log.vue:28` |
| FR-075 | `switch-tab` | 001-editor-core | 008-layout-request 切换到调试面板 | `magic-script-editor.vue:295` |

#### 调试控制事件流转

| ID | 事件 | 触发方 | 消费方 | 效果 | 源码位置 |
|---|---|---|---|---|---|
| FR-080 | `doContinue` | 本模块（按钮）或快捷键（F8） | 001-editor-core | 清除调试装饰，通过 WS 发送 `resume_breakpoint` | `magic-debug.vue:4`、`magic-script-editor.vue:657-673` |
| FR-081 | `doStepInto` | 本模块（按钮）或快捷键（F6） | 001-editor-core | 调用 `doContinue(true)`，传入 step=true | `magic-debug.vue:6`、`magic-script-editor.vue:674-676` |
| FR-082 | `message` → `resume_breakpoint` | 001-editor-core | 014-infra-transport（WebSocket） | 向服务端发送 `resume_breakpoint,<step>,<breakpoints>` | `magic-script-editor.vue:666-671` |

### 3.7 resume_breakpoint 消息格式

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-090 | `resume_breakpoint` 消息格式 MUST 为：`resume_breakpoint,<step>,<breakpoints>` | `magic-script-editor.vue:666-671` |
| FR-091 | `<step>` MUST 为 `'1'`（单步）或 `'0'`（继续） | `magic-script-editor.vue:666` |
| FR-092 | `<breakpoints>` MUST 为当前所有断点行号，以 `|` 分隔 | `magic-script-editor.vue:668-671` |
| FR-093 | 发送 `resume_breakpoint` 前 MUST 清除调试装饰（`deltaDecorations`）并设置 `debuging = false` | `magic-script-editor.vue:663-665` |
| FR-094 | 发送 `resume_breakpoint` 前 MUST 清空变量列表（`target.ext.variables = []`） | `magic-script-editor.vue:665` |

---

## 4. 非功能需求

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-001 | 安全性 | 日志内容 MUST 进行 HTML 转义（`& < >`）以防止 XSS 攻击 | `magic-log.vue:36-39` |
| NFR-002 | 可用性 | 超过 3 行的日志 MUST 默认折叠，避免单条日志占满面板 | `magic-log.vue:46-51,86-89` |
| NFR-003 | 可用性 | 新日志追加后 MUST 自动滚动到底部，确保用户始终看到最新日志 | `magic-log.vue:52-53` |
| NFR-004 | 可用性 | 调试按钮在非调试态 MUST 视觉禁用，避免用户误操作 | `magic-debug.vue:4,6,48-49` |
| NFR-005 | 可用性 | 日志中的 URL MUST 可点击，堆栈文件位置 MUST 有下划线提示 | `magic-log.vue:42,44` |
| NFR-006 | 性能 | 日志面板无行数上限（`LOG_MAX_ROWS` 默认 `Infinity`），大量日志时需注意内存占用 | `contants.js:26` |
| NFR-007 | 可配置性 | 日志面板最大行数 MUST 通过 `contants.LOG_MAX_ROWS` 配置（当前默认 `Infinity`） | `contants.js:26` |
| NFR-008 | 兼容性 | 调试面板变量值展示 MUST 兼容 java.lang 基本类型与复杂对象/数组 | `magic-structure.vue:21-36` |

---

## 5. 关键实体

| 实体 | 描述 | 关键属性 |
|---|---|---|
| **调试变量（Variable）** | 断点命中时后端推送的当前作用域变量 | `name`（变量名）、`value`（JSON 字符串）、`type`（Java 类型，如 `java.lang.String`） |
| **运行日志条目（LogEntry）** | 日志面板中的一条记录 | `html`（转义+高亮后的 HTML）、`multiple`（是否超过 3 行）、`lines`（被隐藏的行数）、`showMore`（展开状态） |
| **断点装饰（BreakpointDecoration）** | monaco 编辑器中的断点标记 | `range`（行范围）、`options.linesDecorationsClassName`（`'breakpoints'`） |
| **调试行装饰（DebugLineDecoration）** | 断点命中时的执行行高亮 | `range`（执行行）、`options.isWholeLine`、`options.className`（`'debug-line'`） |
| **调试会话（DebugSession）** | 一次测试调用的调试上下文 | `sessionId`（时间戳+随机数）、`debuging`（是否处于调试态）、`variables`（当前变量列表） |

---

## 6. 接受场景

### 场景 1：断点命中 → 查看变量 → 继续执行

- Given 用户在编辑器中设置了断点（行号 10、25）
- When 用户按 Ctrl+Q 测试接口，后端响应 `code=1000`
- Then 系统通过 WS 推送 `ws_breakpoint` 事件
- And 系统设置 `info.ext.debuging = true`，变量列表存入 `info.ext.variables`
- And 系统切换到"调试信息"Tab，展示变量名/值/类型
- And 编辑器高亮当前执行行
- When 用户点击继续按钮（或按 F8）
- Then 系统发射 `doContinue` 事件
- And 001-editor-core 清除调试装饰，通过 WS 发送 `resume_breakpoint,0,10|25`
- And `info.ext.debuging` 恢复为 `false`

### 场景 2：断点命中 → 单步执行

- Given 系统已处于调试态（`info.ext.debuging = true`）
- When 用户点击单步按钮（或按 F6）
- Then 系统发射 `doStepInto` 事件
- And 001-editor-core 调用 `doContinue(true)`
- And 通过 WS 发送 `resume_breakpoint,1,10|25`（step='1'）

### 场景 3：接收运行日志

- Given 用户执行了接口测试
- When 后端通过 WS 推送 `ws_log` 事件，内容为 `"2024-01-01 12:00:00.000 INFO  --- [http-nio-8080-exec-1] c.s.m.e.ScriptExecutor : 开始执行脚本"`
- Then 日志面板追加该条目，时间戳和 `INFO` 级别高亮显示
- And 面板自动滚动到底部

### 场景 4：多行日志折叠与展开

- Given 后端推送了一条 10 行的 Java 异常堆栈日志
- Then 日志面板默认仅显示前 3 行（`max-height: 60px`）
- And 显示"有 6 行日志被隐藏 点击显示"链接
- When 用户点击该链接
- Then 日志完整展开（`max-height: none`）
- And 链接文字变为"点击隐藏多行日志"

### 场景 5：清空日志

- Given 日志面板中有多条日志
- When 用户在日志面板上右键
- Then 弹出上下文菜单，显示"清空日志"选项
- When 用户点击"清空日志"
- Then 所有日志条目被清除（`logs.splice(0)`）

---

## 7. 假设与约束

### 7.1 假设

- A-001：`info.ext.variables` 中的 `value` 字段为 JSON 字符串格式，由后端序列化后推送
- A-002：`info.ext.variables` 中的 `type` 字段为 Java 类型全限定名（如 `java.lang.String`、`java.util.List`）
- A-003：`ws_log` 事件的 args[0] 为纯文本字符串，不含结构化数据
- A-004：日志时间戳格式固定为 `YYYY-MM-DD HH:mm:ss.SSS`（与 `magic-log.vue:40` 的正则匹配）
- A-005：`LOG_MAX_ROWS` 当前默认值为 `Infinity`，即无行数上限；若后端推送大量日志，前端内存可能增长
- A-006：调试面板的 `info` prop 由 008-layout-request 的 MagicOptions 容器通过 `v-model:info` 传递

### 7.2 约束

- C-001：MagicDebug 组件为 Options API 风格（`export default { props/data/computed }`），非 Composition API
- C-002：MagicLog 组件为 Options API 风格，日志状态存储在组件本地 `data().logs` 数组中
- C-003：MagicLog 的 `mounted` 钩子仅订阅 `ws_log` 事件，**未实现 `$off` 清理**（组件销毁时可能存在内存泄漏风险）
- C-004：日志面板无行数截断机制，`LOG_MAX_ROWS` 常量虽存在但**未在 MagicLog 中使用**（`contants.js:26` 定义了但未消费）
- C-005：调试按钮的禁用状态完全依赖 `info` prop 的存在性与 `info.ext.debuging` 的值，若 `info` 为 `null` 则按钮禁用

---

## 8. 与其他模块的边界

### 8.1 与 001-editor-core 的边界

- **001-editor-core 负责**：
  - 接收 `ws_breakpoint` / `ws_exception` 事件并更新 `info.ext` 状态（`debuging`、`variables`、`debugDecorations`）
  - 在 monaco 编辑器中渲染调试行高亮与异常波浪线装饰
  - 消费 `doContinue` / `doStepInto` 事件，通过 WS 发送 `resume_breakpoint` 消息
  - 生成 Session ID 并通过 `Magic-Request-Session` Header 传递给后端
  - 收集断点行号并通过 `Magic-Request-Breakpoints` Header 传递给后端
  - 处理 `code=1000`（`RESPONSE_CODE_DEBUG`）的响应判定
- **本模块负责**：
  - 展示 `info.ext.variables` 中的变量数据（只读消费）
  - 提供继续/单步按钮并发射 `doContinue` / `doStepInto` 事件
  - 展示 `ws_log` 推送的运行日志
- **交互方式**：
  - 共享 `info` 对象（通过 `v-model:info` 从 008-layout-request 传递）
  - 通过 bus 事件 `doContinue` / `doStepInto` 单向通信
  - 双方各自独立订阅 `ws_*` 事件（`ws_breakpoint` 由 001 处理，`ws_log` 由本模块处理）
- **边界清晰点**：本模块不修改 `info.ext` 状态，不发起 WS 消息，不处理编辑器装饰

### 8.2 与 008-layout-request 的边界

- **008-layout-request 负责**：
  - 底部面板容器（MagicOptions）的 Tab 管理与切换
  - 注册"调试信息"（MagicDebug）和"运行日志"（MagicLog）为公共 Tab
  - 通过 `v-model:info` 向子面板传递当前资源对象
  - 监听 `switch-tab` 事件切换到调试面板
- **本模块负责**：
  - MagicDebug 和 MagicLog 子面板的内部渲染与交互
- **交互方式**：
  - `info` prop 由 008 传入，本模块只读
  - `switch-tab` 事件由 001-editor-core 发射，008 消费并切换 Tab
- **边界清晰点**：本模块不负责 Tab 切换逻辑，不负责面板容器布局

### 8.3 与 014-infra-transport 的边界

- **014-infra-transport 负责**：
  - WebSocket 连接管理（ReconnectingWebSocket）
  - 上行帧发送：`bus.$emit('message', msgType, content)` → `socket.send(...)`
  - 下行帧解析：`msgType,arg1,...,jsonPayload` → `bus.$emit('ws_' + msgType, args)`
  - `resume_breakpoint` 消息的 WS 层传输
- **本模块负责**：
  - 消费 `ws_log` 事件（由 014 解析后广播）
- **交互方式**：
  - 纯 bus 事件通信，无直接引用
  - 本模块不直接操作 WebSocket 实例
- **边界清晰点**：本模块不关心 WS 连接状态、重连逻辑、帧解析规则

### 8.4 与 015-infra-bus-store 的边界

- **015-infra-bus-store 负责**：
  - EventBus 实现（`bus.$on` / `bus.$emit` / `bus.$off`）
  - 全局常量定义（`contants.RESPONSE_CODE_DEBUG`、`contants.HEADER_REQUEST_SESSION`、`contants.HEADER_REQUEST_BREAKPOINTS`、`contants.LOG_MAX_ROWS`）
  - localStorage 偏好存储
- **本模块负责**：
  - 通过 `bus` 发射 `doContinue` / `doStepInto` 事件
  - 通过 `bus` 订阅 `ws_log` 事件
- **交互方式**：
  - `import bus from '@/scripts/bus.js'` 直接导入
  - `contants` 常量在本模块中**未被直接引用**（`LOG_MAX_ROWS` 未消费）
- **边界清晰点**：本模块不定义事件名常量，不实现总线逻辑

### 8.5 与 016-common-ui 的边界

- **016-common-ui 负责**：
  - MagicStructure 组件：变量值的结构化渲染（支持 java.lang 类型直显、JSON 对象/数组展开）
  - MagicStructureArray / MagicStructureObject 子组件
  - `$magicContextmenu` 右键菜单指令
- **本模块负责**：
  - 在 MagicDebug 中引用 MagicStructure 展示变量值
  - 在 MagicLog 中使用 `$magicContextmenu` 实现右键清空
- **交互方式**：
  - `import MagicStructure from '@/components/common/magic-structure.vue'` 组件引用
  - `this.$magicContextmenu({...})` 全局指令调用
- **边界清晰点**：本模块不实现变量值的渲染逻辑，不实现右键菜单的 DOM 渲染

---

## 9. 待澄清

| ID | 位置 | 描述 |
|---|---|---|
| NC-001 | `magic-log.vue:28` | MagicLog 的 `mounted` 钩子仅订阅 `ws_log` 事件，**未实现 `beforeDestroy`/`unmounted` 中的 `$off` 清理**。组件销毁后回调仍保留在 bus 中，可能导致内存泄漏。是否应添加清理逻辑？ |
| NC-002 | `contants.js:26` vs `magic-log.vue` | `contants.LOG_MAX_ROWS` 默认值为 `Infinity`，但 MagicLog 组件**未消费此常量**，日志数组无上限增长。是否应在 `onLogReceived` 中添加截断逻辑（如 `if (this.logs.length > LOG_MAX_ROWS) this.logs.shift()`）？ |
| NC-003 | `magic-debug.vue` | 调试面板仅展示变量表格，**无调用堆栈（Call Stack）面板**。后端 `ws_breakpoint` 推送的数据中是否包含堆栈信息？若有，是否应在本模块中增加堆栈展示？ |

---

## 10. 依赖清单

| 依赖 | 类型 | 用途 | 源码行 |
|---|---|---|---|
| `@/scripts/bus.js` | 内部模块 | 全局事件总线 | `magic-debug.vue:34`、`magic-log.vue:15` |
| `@/components/common/magic-structure.vue` | 内部组件 | 变量值结构化渲染 | `magic-debug.vue:35` |
| `@/scripts/contants.js` | 内部模块 | 全局常量（`RESPONSE_CODE_DEBUG`、`LOG_MAX_ROWS` 等） | 间接引用（由 001-editor-core 消费） |
| `@/scripts/websocket.js` | 内部模块 | WebSocket 帧解析与转发 | 间接引用（通过 bus `ws_*` 事件） |
| `$magicContextmenu` | 全局指令 | 右键菜单 | `magic-log.vue:56` |

---

## 附录：源码引用清单

| 文件 | 行号范围 | 引用说明 |
|---|---|---|
| `src/components/layout/magic-debug.vue` | 1-31 | 模板：继续/单步按钮 + 变量表格 |
| `src/components/layout/magic-debug.vue` | 33-56 | 脚本：import、组件定义、computed（debuging / variables） |
| `src/components/layout/magic-debug.vue` | 57-134 | 样式：容器布局、按钮样式、表格样式、斑马纹 |
| `src/components/layout/magic-log.vue` | 1-12 | 模板：日志列表 + 折叠/展开 + 右键菜单 |
| `src/components/layout/magic-log.vue` | 14-30 | 脚本：import、组件定义、mounted 订阅 ws_log |
| `src/components/layout/magic-log.vue` | 31-66 | 方法：onLogReceived（转义/高亮/折叠）/ onContextMenu |
| `src/components/layout/magic-log.vue` | 67-99 | 样式：容器、日志行高、折叠/展开样式 |
| `src/components/common/magic-structure.vue` | 1-86 | MagicStructure 组件：变量值结构化渲染 |
| `src/components/editor/magic-script-editor.vue` | 229-230 | bus 订阅 ws_breakpoint / ws_exception |
| `src/components/editor/magic-script-editor.vue` | 256-296 | onException() / onBreakpoint() 调试处理 |
| `src/components/editor/magic-script-editor.vue` | 657-676 | doContinue() / doStepInto() 调试控制 |
| `src/components/editor/magic-script-editor.vue` | 626-627 | Session ID 生成与 set_session_id 消息 |
| `src/components/editor/magic-script-editor.vue` | 702-707 | Magic-Request-Breakpoints Header 注入 |
| `src/scripts/bus.js` | 1-57 | EventBus 实现 |
| `src/scripts/contants.js` | 13-14 | HEADER_REQUEST_SESSION / HEADER_REQUEST_BREAKPOINTS 常量 |
| `src/scripts/contants.js` | 23 | RESPONSE_CODE_DEBUG = 1000 |
| `src/scripts/contants.js` | 26 | LOG_MAX_ROWS = Infinity |
| `src/scripts/websocket.js` | 7-13 | 上行帧发送（bus.$emit('message') → socket.send） |
| `src/scripts/websocket.js` | 24-39 | 下行帧解析（msgType 解析 + bus.$emit('ws_*')） |
