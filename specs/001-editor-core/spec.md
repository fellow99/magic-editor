# 001-editor-core 模块规范（As-Built）

> 模块编号：001-editor-core
> 状态：已实现
> 最后更新：2026-05-01
> 对应源码：`src/components/editor/magic-script-editor.vue`（1050 行）

---

## 1. 模块概述

### 1.1 目的

本模块是 magic-editor 的**核心编辑器组件**，负责：

- 以多标签页（Tab）形式管理已打开的接口（API）与函数（Function）脚本
- 提供基于 monaco-editor 的 magic-script 代码编辑体验（语法高亮、自动补全、实时校验、格式化）
- 支持断点设置、调试会话管理、变量查看
- 提供脚本保存、测试执行、历史记录恢复等核心操作
- 作为全局事件总线（bus）的**主要消费者与生产者**，协调编辑器与布局/调试/请求面板之间的交互

### 1.2 解决的问题

- 为 magic-script 语言提供 IDE 级编辑体验（而非纯文本 textarea）
- 多脚本并行编辑，通过 Tab 切换上下文，保留各自的滚动位置、断点、调试状态
- 将编辑、保存、测试、调试等用户操作统一为可被快捷键/外部面板触发的标准化流程
- 通过实时语法校验在保存前发现语法错误

### 1.3 范围

**包含**：
- Tab 栏管理（打开/关闭/拖拽排序/右键菜单）
- monaco 编辑器实例生命周期
- 脚本保存（API / Function 两种路径）
- 脚本测试（含路径变量替换、Header/参数拼装、文件上传、RequestBody）
- 断点设置与调试会话（进入断点、继续、单步）
- 历史记录查看与恢复
- 实时语法校验

**不包含**：
- monaco 语言服务注册（completion/hover/signature/folding/highlight）→ 模块 012-script-language
- magic-script 词法/语法解析器 → 模块 011-script-parser
- 请求面板 UI（参数表单/Header/Cookie 等）→ 模块 008-layout-request
- 调试日志面板 → 模块 009-layout-debug
- 历史记录 diff 对比 UI → 模块 002-editor-history

---

## 2. 用户场景与用例

### US-001：打开脚本进行编辑

- **角色**：开发者
- **前置条件**：用户已登录，资源树已加载
- **流程**：
  1. 用户在资源树中点击某个接口/函数，或从"最近打开"列表中点击
  2. 系统通过 `bus.$emit('open', item)` 触发打开
  3. 编辑器在 Tab 栏新增/激活对应标签，monaco 加载脚本内容
  4. 若脚本未保存过（新增），自动初始化 parameters/headers/paths 等元数据结构
- **后置条件**：脚本内容显示在编辑器中，Tab 栏显示该脚本标签

### US-002：编辑脚本并实时校验

- **角色**：开发者
- **前置条件**：脚本已打开
- **流程**：
  1. 用户在 monaco 中编辑代码
  2. 每次内容变更后 500ms 防抖，触发语法校验
  3. 若校验失败，在编辑器中标记错误位置与消息
  4. 若校验通过，清除所有校验标记
- **后置条件**：编辑器显示或清除语法错误标记

### US-003：保存脚本

- **角色**：开发者
- **前置条件**：脚本已打开且有未保存变更
- **流程**：
  1. 用户按 Ctrl+S 或从外部触发 `bus.$emit('doSave')`
  2. 系统根据脚本类型（API / Function）调用不同保存接口
  3. 保存成功后更新脚本 ID，清除未保存标记（`*`）
  4. 状态条显示保存成功消息
- **后置条件**：脚本持久化到后端，Tab 标签不再显示 `*`

### US-004：测试脚本

- **角色**：开发者
- **前置条件**：API 类型脚本已打开
- **流程**：
  1. 用户按 Ctrl+Q 或从外部触发 `bus.$emit('doTest')`
  2. 若 AUTO_SAVE 开启且脚本未锁定，先自动保存
  3. 切换到请求面板（`bus.$emit('switch-tab', 'request')`）
  4. 拼装请求配置（URL 路径变量替换、Header、参数、RequestBody）
  5. 发送 HTTP 请求，携带断点行号与 Session ID
  6. 切换到日志面板（`bus.$emit('switch-tab', 'log')`）
  7. 接收响应后切换到结果面板，展示响应体
- **后置条件**：测试结果展示在结果面板，状态条显示耗时/大小/状态码

### US-005：设置与清除断点

- **角色**：开发者
- **前置条件**：脚本已打开
- **流程**：
  1. 用户点击编辑器左侧行号区域（offsetX 0-90）
  2. 若该行已有断点则清除，否则添加断点装饰
  3. 断点信息持久化到脚本的 ext.decorations
- **后置条件**：断点行显示断点图标，行背景高亮

### US-006：调试会话（命中断点 → 继续/单步）

- **角色**：开发者
- **前置条件**：测试执行中命中断点
- **流程**：
  1. 后端通过 WebSocket 推送 `ws_breakpoint` 事件
  2. 编辑器高亮当前执行行，切换到调试面板
  3. 用户按 F8（继续）或 F6（单步）
  4. 系统通过 WS 发送 `resume_breakpoint` 消息，携带单步标志与断点行号列表
  5. 清除调试高亮，恢复编辑态
- **后置条件**：调试会话继续或结束

### US-007：查看与恢复历史版本

- **角色**：开发者
- **前置条件**：脚本已保存过（有 ID）
- **流程**：
  1. 用户触发 `bus.$emit('viewHistory')`
  2. 系统拉取该脚本的历史备份时间戳列表
  3. 弹出历史记录对话框，展示 monaco diff 对比
  4. 用户选择某个历史版本并点击"恢复"
  5. 编辑器内容替换为历史版本
- **后置条件**：编辑器显示历史版本内容

### US-008：管理 Tab 标签

- **角色**：开发者
- **前置条件**：至少一个脚本已打开
- **流程**：
  1. 用户可点击 Tab 切换脚本
  2. 中键点击关闭 Tab
  3. 右键弹出菜单：关闭/定位/关闭其他/关闭左侧/关闭右侧/全部关闭
  4. 拖拽 Tab 调整顺序
  5. 登出时自动关闭所有 Tab
- **后置条件**：Tab 栏状态与用户操作一致

---

## 3. 功能需求

### 3.1 Tab 管理

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-001 | 系统 MUST 以数组 `scripts` 维护已打开脚本列表，支持 API 与 Function 两种类型 | `magic-script-editor.vue:95` |
| FR-002 | 系统 MUST 在用户点击/拖拽/中键关闭 Tab 时更新选中状态与列表 | `magic-script-editor.vue:11,12,14-17` |
| FR-003 | 系统 MUST 在 Tab 标签上显示未保存标记（`*`），当 `item.script !== item.ext.tmpScript` 或 `!item.id` 时显示 | `magic-script-editor.vue:22` |
| FR-004 | 系统 MUST 在脚本被锁定时显示锁图标（`item.lock === '1'`） | `magic-script-editor.vue:21` |
| FR-005 | 系统 MUST 支持 Tab 拖拽排序，拖拽结束后重排 `scripts` 数组 | `magic-script-editor.vue:921-946` |
| FR-006 | 系统 MUST 在右键菜单中提供：关闭、定位、关闭其他、关闭左侧、关闭右侧、全部关闭 | `magic-script-editor.vue:822-883` |
| FR-007 | 系统 MUST 在关闭当前选中 Tab 后自动切换到相邻 Tab（优先左侧） | `magic-script-editor.vue:767-785` |
| FR-008 | 系统 MUST 在所有 Tab 关闭后触发 `bus.$emit('opened', {empty: true})` | `magic-script-editor.vue:786-788` |
| FR-009 | 系统 MUST 将最近打开的脚本 ID 列表持久化到 localStorage（键 `recent_opened_tab`） | `magic-script-editor.vue:343,786` |
| FR-010 | 系统 MUST 在存在同名脚本时显示 `groupName/name` 格式的全名以区分 | `magic-script-editor.vue:424-429,789-799` |

### 3.2 编辑器初始化与配置

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-011 | 系统 MUST 在 mounted 时创建 monaco 编辑器实例，语言为 `magicscript` | `magic-script-editor.vue:108-123` |
| FR-012 | 系统 MUST 使用 `store.get('skin')` 获取主题，默认为 `default` | `magic-script-editor.vue:116` |
| FR-013 | 系统 MUST 使用 `contants.EDITOR_FONT_FAMILY` 和 `contants.EDITOR_FONT_SIZE` 配置字体 | `magic-script-editor.vue:117-118` |
| FR-014 | 系统 MUST 启用代码折叠（`folding: true`）、自动换行（`wordWrap: 'on'`）、字体连字（`fontLigatures: true`） | `magic-script-editor.vue:113-119` |
| FR-015 | 系统 MUST 禁用小地图（`minimap.enabled: false`） | `magic-script-editor.vue:109-111` |
| FR-016 | 系统 MUST 在窗口大小变化时调用 `bus.$emit('update-window-size')` 并触发编辑器 `layout()` | `magic-script-editor.vue:214-215` |

### 3.3 快捷键与自定义命令

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-020 | 系统 MUST 注册 `Alt + /` 为代码提示快捷键，同时触发参数提示与补全列表 | `magic-script-editor.vue:135-149` |
| FR-021 | 系统 MUST 注册 `Ctrl/Cmd + Alt + L` 为文档格式化快捷键 | `magic-script-editor.vue:154` |
| FR-022 | 系统 MUST 注册 `Ctrl/Cmd + F8` 为下一个标记跳转快捷键 | `magic-script-editor.vue:155` |
| FR-023 | 系统 MUST 重写 monaco 内置的 `triggerParameterHints`、`triggerSuggest`、`toggleSuggestionDetails` 快捷键绑定为 `Alt + /` | `magic-script-editor.vue:150-167` |
| FR-024 | 系统 MUST 注册自定义 action `editor.action.triggerSuggest.extension` 用于代码提示 | `magic-script-editor.vue:124-131` |
| FR-025 | 系统 MUST 注册 `editor.action.scrollUp1Line` 命令，每次滚动 22px | `magic-script-editor.vue:132-134` |

### 3.4 断点管理

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-030 | 系统 MUST 在用户点击编辑器左侧装饰区域（offsetX 0-90）时切换断点 | `magic-script-editor.vue:169-203` |
| FR-031 | 系统 MUST 使用 monaco decoration 的 `linesDecorationsClassName: 'breakpoints'` 标识断点 | `magic-script-editor.vue:184,195` |
| FR-032 | 系统 MUST 在添加断点时为整行添加 `breakpoint-line` 样式类 | `magic-script-editor.vue:196` |
| FR-033 | 系统 MUST 将断点装饰列表持久化到 `this.info.ext.decorations` | `magic-script-editor.vue:202` |
| FR-034 | 系统 MUST 在切换脚本时恢复该脚本的断点装饰 | `magic-script-editor.vue:375` |

### 3.5 实时语法校验

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-040 | 系统 MUST 在编辑器内容变更后 500ms 防抖触发语法校验 | `magic-script-editor.vue:205-213` |
| FR-041 | 系统 MUST 使用自研 Parser + Tokenizer + TokenStream 进行语法解析 | `magic-script-editor.vue:299` |
| FR-042 | 系统 MUST 在解析成功时清除所有校验标记 | `magic-script-editor.vue:301` |
| FR-043 | 系统 MUST 在解析失败时通过 `monaco.editor.setModelMarkers` 标记错误位置与消息 | `magic-script-editor.vue:302-315` |

### 3.6 脚本保存

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-050 | 系统 MUST 根据 `info._type` 区分 API（`doSaveApi`）与 Function（`doSaveFunction`）保存路径 | `magic-script-editor.vue:519-527` |
| FR-051 | API 保存 MUST 通过 `POST /save` 接口，请求体为 JSON | `magic-script-editor.vue:478-483` |
| FR-052 | Function 保存 MUST 通过 `POST /function/save` 接口，请求体为 JSON | `magic-script-editor.vue:501-506` |
| FR-053 | 保存时 MUST 剔除内部属性（ext/groupName/groupPath/_type/level/tmp_id/optionMap/responseHeader/running） | `magic-script-editor.vue:446-452,458-460` |
| FR-054 | API 保存 MUST 过滤空 name 的 parameters/paths/headers | `magic-script-editor.vue:462,470,471` |
| FR-055 | 保存成功后 MUST 更新脚本 ID 并缓存 tmpScript | `magic-script-editor.vue:492-493,515-516` |
| FR-056 | 保存成功后 MUST 触发 `bus.$emit('report', 'script_save'/'script_add'/'function_save'/'function_add')` 埋点 | `magic-script-editor.vue:486-489,508-511` |
| FR-057 | 保存成功后 MUST 在状态条显示完整路径名（`groupName/name(groupPath/path)`） | `magic-script-editor.vue:490-491,513-514` |
| FR-058 | 当 `contants.config.persistenceResponseBody === false` 时，保存 MUST 剔除 responseBody 与 responseBodyDefinition | `magic-script-editor.vue:474-477` |

### 3.7 脚本测试

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-060 | 系统 MUST 在 `doTest` 时检查是否有选中的脚本，无则提示"请打开接口在执行测试" | `magic-script-editor.vue:528-533` |
| FR-061 | 系统 MUST 仅对 API 类型脚本执行测试，Function 类型直接返回 | `magic-script-editor.vue:534` |
| FR-062 | 若 `contants.AUTO_SAVE` 为真且脚本未锁定，测试前 MUST 先自动保存 | `magic-script-editor.vue:538-548` |
| FR-063 | 测试 MUST 替换 URL 中的路径变量（`{name}` 格式），先替换接口级再替换分组级 | `magic-script-editor.vue:562-571` |
| FR-064 | 若 URL 中仍有未替换的 `{`，MUST 提示"请填写路径变量后在测试！"并中止 | `magic-script-editor.vue:572-578` |
| FR-065 | 测试 MUST 将 parameters 中 FileList 类型参数转为 FormData 并设置 `multipart/form-data` | `magic-script-editor.vue:590-601` |
| FR-066 | 若存在 requestBody 且为合法 JSON，MUST 设置 `Content-Type: application/json` 并将 requestBody 作为请求体 | `magic-script-editor.vue:609-623` |
| FR-067 | 测试 MUST 生成唯一 sessionId（时间戳 + 随机数）并通过 Header `Magic-Request-Session` 发送 | `magic-script-editor.vue:626-627,699` |
| FR-068 | 测试 MUST 将当前断点行号列表通过 Header `Magic-Request-Breakpoints` 发送（逗号分隔） | `magic-script-editor.vue:702-707` |
| FR-069 | 测试 MUST 注入全局参数与全局 Header（从 localStorage `global-parameters`/`global-headers` 读取） | `magic-script-editor.vue:677-693` |
| FR-070 | 测试 MUST 注入 `magic-token` Header 与 `HEADER_MAGIC_TOKEN_VALUE` | `magic-script-editor.vue:700` |
| FR-071 | 测试响应 MUST 支持 blob 类型（文件下载）与 JSON 类型两种处理方式 | `magic-script-editor.vue:747-758` |
| FR-072 | 测试完成后 MUST 触发 `bus.$emit('update-response-body', ...)` 或 `bus.$emit('update-response-blob', ...)` | `magic-script-editor.vue:752,757` |
| FR-073 | 测试完成后 MUST 触发 `bus.$emit('update-response-body-definition', ...)` | `magic-script-editor.vue:751` |

### 3.8 调试会话

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-080 | 系统 MUST 在收到 `ws_breakpoint` 事件时进入调试态，设置 `info.ext.debuging = true` | `magic-script-editor.vue:229,281` |
| FR-081 | 调试命中时 MUST 高亮当前执行行（`debug-line` 样式），并将行居中显示 | `magic-script-editor.vue:285-294,271` |
| FR-082 | 调试命中时 MUST 将变量列表存入 `info.ext.variables` | `magic-script-editor.vue:283` |
| FR-083 | 调试命中时 MUST 触发 `bus.$emit('switch-tab', 'debug')` 切换到调试面板 | `magic-script-editor.vue:295` |
| FR-084 | 调试命中时 MUST 在状态条显示"进入断点..." | `magic-script-editor.vue:279` |
| FR-085 | 继续执行（`doContinue`）MUST 清除调试装饰，通过 WS 发送 `resume_breakpoint` 消息 | `magic-script-editor.vue:657-673` |
| FR-086 | 单步执行（`doStepInto`）MUST 调用 `doContinue(true)`，即传入 step=true | `magic-script-editor.vue:674-676` |
| FR-087 | 收到 `ws_exception` 事件时，MUST 在对应代码位置显示错误波浪线装饰，并在 `DECORATION_TIMEOUT` 后自动清除 | `magic-script-editor.vue:230,256-276` |
| FR-088 | 异常装饰的 hover 消息 MUST 显示异常详情 | `magic-script-editor.vue:265-267` |

### 3.9 历史记录

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-090 | 系统 MUST 在 `viewHistory` 时检查脚本是否有 ID，无则提示"当前是新增脚本,无法查看历史记录" | `magic-script-editor.vue:630-639` |
| FR-091 | 历史记录拉取路径 MUST 根据类型区分：API 用 `backups?id=`，Function 用 `function/backups?id=` | `magic-script-editor.vue:640-644` |
| FR-092 | 若无历史备份，MUST 提示"当前脚本无历史记录" | `magic-script-editor.vue:649-654` |
| FR-093 | 恢复历史版本 MUST 调用 `$refs.history.reset()` 将编辑器内容替换为历史版本 | `magic-script-editor.vue:52-57` |

### 3.10 环境上下文

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-100 | 系统 MUST 通过 `RequestParameter.setEnvironment` 注册环境函数，返回当前 API 的参数与路径变量的 Java 类型映射 | `magic-script-editor.vue:242-253` |
| FR-101 | Java 类型映射 MUST 覆盖 String/Integer/Double/Long/Byte/Short/Float/MultipartFile/MultipartFiles | `magic-script-editor.vue:231-241` |
| FR-102 | 未识别的类型 MUST 映射为 `java.lang.Object` | `magic-script-editor.vue:247,249` |

---

## 4. 非功能需求

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-001 | 性能 | 语法校验 MUST 在内容变更后 500ms 防抖执行，避免频繁解析 | `magic-script-editor.vue:211` |
| NFR-002 | 性能 | Tab 栏滚动 MUST 通过水平滚动（非垂直）处理溢出，滚轮事件转换为水平位移 | `magic-script-editor.vue:885-895` |
| NFR-003 | 可用性 | 选中 Tab 变更时 MUST 通过 MutationObserver 自动滚动到可视区域 | `magic-script-editor.vue:897-919` |
| NFR-004 | 兼容性 | 编辑器 MUST 支持 `window.onresize` 触发的布局重算 | `magic-script-editor.vue:214` |
| NFR-005 | 可用性 | 编辑器 layout() MUST 在 `$refs.editor` 可见时才执行，避免隐藏状态下的布局异常 | `magic-script-editor.vue:318-324` |
| NFR-006 | 可配置性 | 断点异常装饰的自动清除超时 MUST 通过 `contants.DECORATION_TIMEOUT` 配置（默认 10000ms），负值表示不自动清除 | `magic-script-editor.vue:273-275`、`contants.js:9` |
| NFR-007 | 可配置性 | 编辑器字体族与字号 MUST 通过 `contants.EDITOR_FONT_FAMILY` / `EDITOR_FONT_SIZE` 配置 | `contants.js:31-32` |
| NFR-008 | 可配置性 | 测试前自动保存 MUST 通过 `contants.AUTO_SAVE` 开关控制 | `contants.js:8`、`magic-script-editor.vue:538` |
| NFR-009 | 安全性 | 测试请求 MUST 携带 `magic-token` Header 用于鉴权 | `magic-script-editor.vue:700` |
| NFR-010 | 可维护性 | 脚本切换时 MUST 保存并恢复各自的 scrollTop 位置 | `magic-script-editor.vue:336,376` |

---

## 5. 数据与事件依赖

### 5.1 组件 Props / Emits / Exposed

本组件**不声明任何 props、emits 或 exposed**。它完全通过 bus 事件与外部通信，是一个"自闭合"的 bus 驱动组件。

### 5.2 订阅的 Bus 事件（输入）

| 事件名 | 处理函数 | 说明 | 源码行 |
|---|---|---|---|
| `update-window-size` | `this.layout` | 窗口大小变化时重排编辑器 | `vue:215` |
| `open` | `this.open` | 打开脚本 | `vue:216` |
| `changed` | `this.changed` | 脚本数据变更（外部更新） | `vue:217` |
| `doSave` | `this.doSave` | 保存脚本 | `vue:218` |
| `viewHistory` | `this.viewHistory` | 查看历史记录 | `vue:219` |
| `doTest` | `this.doTest` | 测试脚本 | `vue:220` |
| `doContinue` | `this.doContinue` | 调试继续执行 | `vue:221` |
| `doStepInto` | `this.doStepInto` | 调试单步执行 | `vue:222` |
| `logout` | `this.closeAll` | 登出时关闭所有 Tab | `vue:223` |
| `ready-delete` | （匿名函数） | 准备删除时触发 `delete-api` 事件 | `vue:224-228` |
| `ws_breakpoint` | `this.onBreakpoint` | WebSocket 断点命中事件 | `vue:229` |
| `ws_exception` | `this.onException` | WebSocket 异常事件 | `vue:230` |

### 5.3 发出的 Bus 事件（输出）

| 事件名 | 触发场景 | 参数 | 源码行 |
|---|---|---|---|
| `update-window-size` | `window.onresize` | 无 | `vue:214` |
| `delete-api` | `ready-delete` 时 | `this.info` | `vue:226` |
| `status` | 保存成功/进入断点/测试开始/测试结束/请求出错 | 状态文案字符串（可含 HTML） | `vue:279,491,514,630,730,743,762` |
| `switch-tab` | 调试命中/测试开始/测试结束 | `'debug'` / `'request'` / `'result'` / `'log'` | `vue:295,537,750,756,696` |
| `opened` | 脚本打开/全部关闭 | `item` 或 `{empty: true}` | `vue:380,434,787` |
| `close` | 关闭单个 Tab | `item` | `vue:770` |
| `message` | 设置 Session ID / 调试继续 | `'set_session_id', sessionId` / `'resume_breakpoint', payload` | `vue:627,666` |
| `report` | 保存/新增埋点 | `'script_save'` / `'script_add'` / `'function_save'` / `'function_add'` | `vue:486-489,508-511` |
| `update-response-body-definition` | 测试完成后 | `target.responseBodyDefinition` | `vue:751` |
| `update-response-body` | 测试完成后（JSON 响应） | `responseBody, headers` | `vue:752` |
| `update-response-blob` | 测试完成后（文件下载） | `contentType, data, headers` | `vue:757` |

### 5.4 内部数据状态

| 字段 | 类型 | 说明 | 源码行 |
|---|---|---|---|
| `scripts` | Array | 已打开脚本列表 | `vue:95` |
| `selected` | Object\|null | 当前选中的脚本引用 | `vue:96` |
| `info` | Object\|null | 当前活跃脚本的详细信息（与 selected 指向同一对象） | `vue:97` |
| `editor` | MonacoEditor | monaco 编辑器实例 | `vue:98` |
| `showHsitoryDialog` | boolean | 历史记录对话框显隐 | `vue:99` |
| `draggableItem` | Object | 拖拽源 Tab 项 | `vue:101` |
| `draggableTargetItem` | Object | 拖拽目标 Tab 项 | `vue:102` |

### 5.5 脚本扩展属性（ext 对象）

每个脚本对象在打开时被注入 `ext` 扩展属性：

| 属性 | 类型 | 说明 | 源码行 |
|---|---|---|---|
| `logs` | Array | 日志列表 | `vue:340` |
| `debuging` | boolean | 是否处于调试态 | `vue:341` |
| `sessionId` | string | 当前调试会话 ID | `vue:342` |
| `variables` | Array | 调试变量列表 | `vue:343` |
| `decorations` | Array | 断点装饰列表 | `vue:344` |
| `debugDecorations` | Array | 调试行高亮装饰 | `vue:345` |
| `debugDecoration` | Object | 当前调试行装饰定义 | `vue:346` |
| `save` | boolean | 是否已保存过 | `vue:347` |
| `loading` | boolean | 是否正在加载脚本内容 | `vue:348` |
| `scrollTop` | number | 上次滚动位置 | `vue:349` |
| `tmpScript` | string\|null | 缓存的未修改前脚本内容（用于比对未保存标记） | `vue:350` |
| `tabDraggable` | boolean | Tab 是否处于拖拽高亮态 | `vue:351` |
| `requestConfig` | Object | 最后一次测试的请求配置 | `vue:697` |

---

## 6. 与其他模块的边界

### 6.1 与 002-editor-history 的边界

- **本模块负责**：触发历史记录对话框（`viewHistory`）、传递脚本信息与 monaco 实例给 history 组件、调用 `reset()` 恢复历史版本
- **002-editor-history 负责**：拉取历史备份列表、渲染 monaco diff 编辑器、用户选择历史版本
- **交互方式**：通过 `$refs.history` 直接调用（`vue:47,54,647`），非 bus 通信
- **边界清晰点**：本模块不关心 diff 渲染逻辑，history 模块不关心脚本保存/测试逻辑

### 6.2 与 008-layout-request 的边界

- **本模块负责**：拼装完整的 `requestConfig`（URL、Header、参数、RequestBody、断点行号、Session ID）、发起 HTTP 请求
- **008-layout-request 负责**：展示参数编辑表单、Header 编辑、Cookie 编辑、路径变量编辑等 UI
- **交互方式**：
  - 本模块通过 `bus.$emit('switch-tab', 'request')` 通知切换到请求面板（`vue:537`）
  - 本模块直接读取 `this.info.parameters` / `this.info.headers` / `this.info.paths` 等数据（这些数据由 008-layout-request 编辑后写入同一 `info` 对象）
  - 本模块通过 `this.$parent.$refs.apiList.getGroupsById()` 读取分组路径变量（`vue:566`）
- **边界模糊点**：[NEEDS CLARIFICATION: `this.$parent.$refs.apiList` 的跨组件直接引用是否应改为 bus 事件或共享 store？当前通过父组件 ref 直接调用，耦合度较高]

### 6.3 与 009-layout-debug 的边界

- **本模块负责**：接收 `ws_breakpoint` / `ws_exception` 事件、在编辑器中高亮调试行/异常行、通过 WS 发送 `resume_breakpoint` 消息
- **009-layout-debug 负责**：展示调试变量面板、展示调用堆栈、展示控制台日志
- **交互方式**：
  - 本模块通过 `bus.$emit('switch-tab', 'debug')` 通知切换到调试面板（`vue:295`）
  - 调试变量数据存储在 `this.info.ext.variables` 中，由 009-layout-debug 读取
  - 双方通过 bus 事件 `ws_breakpoint` / `ws_exception` 接收 WebSocket 推送
- **边界清晰点**：本模块只负责编辑器内的视觉反馈（行高亮），不负责变量面板渲染

### 6.4 与 011-script-parser 的边界

- **本模块负责**：在 `doValidate()` 中调用 Parser 进行语法校验，将结果转换为 monaco markers
- **011-script-parser 负责**：提供 `Parser`、`tokenizer`、`TokenStream` 等解析能力
- **交互方式**：直接 import 调用（`vue:77-79,299`）
- **边界清晰点**：本模块不关心解析器内部实现，只消费解析结果（成功/异常+span）

### 6.5 与 012-script-language 的边界

- **本模块负责**：在 mounted 时调用 `initializeMagicScript()` 初始化语言服务
- **012-script-language 负责**：注册 monaco 语言、completion/hover/signature/folding/highlight/theme
- **交互方式**：通过 `initializeMagicScript()` 函数调用（`vue:69,107`）
- **边界清晰点**：本模块不注册任何语言服务，只负责编辑器实例生命周期

---

## 7. 假设与约束

### 7.1 假设

- A-001：后端 magic-api 始终可用，本模块无离线编辑能力
- A-002：脚本的 `id` 字段为空字符串（`''`）表示新增脚本，有值表示已保存脚本
- A-003：`tmp_id` 是前端生成的临时唯一标识，用于区分未保存的脚本
- A-004：API 类型脚本的 `parameters`/`headers`/`paths` 等属性为数组格式（v0.5.0+），旧版本可能为对象格式（`vue:401-406` 有兼容处理）

### 7.2 约束

- C-001：本组件为 Options API 风格（`export default { data/mounted/methods }`），非 Composition API
- C-002：组件内部使用 `this.$set` 进行响应式属性注入（Vue 2 兼容写法，在 Vue 3 中仍可用但非必需）
- C-003：快捷键绑定直接修改了 monaco 内部私有属性 `KeybindingsRegistry._coreKeybindings`（`vue:161-168`），升级 monaco 版本时可能破坏
- C-004：`window.onresize` 被直接覆盖（`vue:214`），若页面中其他代码也覆盖此事件会产生冲突

---

## 8. 待澄清

| ID | 位置 | 描述 |
|---|---|---|
| NC-001 | `vue:566` | `this.$parent.$refs.apiList.getGroupsById()` 通过父组件 ref 直接调用，耦合度高。是否应改为 bus 事件或共享数据通道？ |
| NC-002 | `vue:161-168` | 直接修改 `KeybindingsRegistry._coreKeybindings` 私有数组。此 hack 在 monaco 升级时是否已知风险？是否有替代方案？ |
| NC-003 | `vue:214` | `window.onresize` 被直接赋值覆盖。若宿主环境（jar 模式或库模式）有其他 resize 监听器，会被静默覆盖。是否应改为 `addEventListener`？ |

---

## 9. 依赖清单

| 依赖 | 类型 | 用途 | 源码行 |
|---|---|---|---|
| `monaco-editor` | 外部库 | 编辑器核心 | `vue:68` |
| `monaco-editor/esm/vs/platform/commands/common/commands` | 内部模块 | CommandsRegistry（快捷键重写） | `vue:81` |
| `monaco-editor/esm/vs/platform/keybinding/common/keybindingsRegistry.js` | 内部模块 | KeybindingsRegistry（快捷键重写） | `vue:82` |
| `monaco-editor/esm/vs/platform/contextkey/common/contextkey.js` | 内部模块 | ContextKeyExpr（快捷键条件） | `vue:83` |
| `@/scripts/editor/magic-script.js` | 内部模块 | `initializeMagicScript()` 语言初始化 | `vue:69,107` |
| `@/scripts/bus.js` | 内部模块 | 全局事件总线 | `vue:70` |
| `@/scripts/contants.js` | 内部模块 | 全局常量（字体/超时/URL/Header 名等） | `vue:74` |
| `@/scripts/store.js` | 内部模块 | localStorage 封装（主题/最近打开/全局参数） | `vue:76` |
| `@/scripts/utils.js` | 内部模块 | 工具函数（`isVisible`/`replaceURL`/`formatJson`） | `vue:75` |
| `@/scripts/parsing/parser.js` | 内部模块 | 语法解析器（实时校验） | `vue:77` |
| `@/scripts/parsing/tokenizer.js` | 内部模块 | 词法分析器（实时校验） | `vue:78` |
| `@/scripts/parsing/index.js` | 内部模块 | TokenStream / ParseException | `vue:79` |
| `@/scripts/editor/request-parameter.js` | 内部模块 | 环境函数注册（Java 类型映射） | `vue:80` |
| `@/api/request.js` | 内部模块 | HTTP 请求封装 | `vue:73` |
| `@/components/common/modal/magic-dialog.vue` | 内部组件 | 历史记录对话框 | `vue:71` |
| `@/components/editor/magic-history.vue` | 内部组件 | 历史版本 diff 对比 | `vue:72` |
| `@/components/common/magic-text-icon.vue` | 内部组件 | Tab 图标（api/function） | `vue:84` |

---

## 附录：源码引用清单

| 文件 | 行号范围 | 引用说明 |
|---|---|---|
| `src/components/editor/magic-script-editor.vue` | 1-65 | 模板：Tab 栏、编辑器容器、空状态快捷键提示、历史记录对话框 |
| `src/components/editor/magic-script-editor.vue` | 67-84 | import 声明：monaco、bus、contants、store、parser、request 等 |
| `src/components/editor/magic-script-editor.vue` | 86-104 | 组件定义：name、components、data（scripts/selected/info/editor 等） |
| `src/components/editor/magic-script-editor.vue` | 105-254 | mounted 钩子：编辑器创建、快捷键注册、断点点击监听、内容变更监听、bus 事件订阅、RequestParameter 环境注册 |
| `src/components/editor/magic-script-editor.vue` | 256-276 | `onException()`：WS 异常事件处理，显示错误波浪线装饰 |
| `src/components/editor/magic-script-editor.vue` | 278-296 | `onBreakpoint()`：WS 断点事件处理，高亮执行行，切换调试面板 |
| `src/components/editor/magic-script-editor.vue` | 297-317 | `doValidate()`：实时语法校验，Parser 解析 + monaco markers |
| `src/components/editor/magic-script-editor.vue` | 318-324 | `layout()`：编辑器布局重算 |
| `src/components/editor/magic-script-editor.vue` | 325-441 | `open()`：打开脚本，处理新增/已有/远程加载三种场景 |
| `src/components/editor/magic-script-editor.vue` | 342-344 | `resetRecentOpenedTab()`：持久化最近打开 Tab 列表 |
| `src/components/editor/magic-script-editor.vue` | 445-452 | `deleteWrapperProperties()`：剔除内部属性 |
| `src/components/editor/magic-script-editor.vue` | 453-495 | `doSaveApi()`：API 类型脚本保存 |
| `src/components/editor/magic-script-editor.vue` | 496-518 | `doSaveFunction()`：Function 类型脚本保存 |
| `src/components/editor/magic-script-editor.vue` | 519-527 | `doSave()`：保存入口，根据类型分发 |
| `src/components/editor/magic-script-editor.vue` | 528-550 | `doTest()`：测试入口，自动保存判断 |
| `src/components/editor/magic-script-editor.vue` | 551-629 | `internalTest()`：拼装请求配置，处理路径变量/参数/RequestBody/文件上传 |
| `src/components/editor/magic-script-editor.vue` | 630-656 | `viewHistory()`：查看历史记录 |
| `src/components/editor/magic-script-editor.vue` | 657-673 | `doContinue()`：调试继续执行 |
| `src/components/editor/magic-script-editor.vue` | 674-676 | `doStepInto()`：调试单步执行 |
| `src/components/editor/magic-script-editor.vue` | 677-694 | `mergeGlobalSettings()`：注入全局参数与 Header |
| `src/components/editor/magic-script-editor.vue` | 695-766 | `sendTestRequest()`：发送测试请求，处理响应 |
| `src/components/editor/magic-script-editor.vue` | 767-801 | `close()`：关闭单个 Tab |
| `src/components/editor/magic-script-editor.vue` | 802-807 | `closeAll()`：关闭所有 Tab |
| `src/components/editor/magic-script-editor.vue` | 808-820 | `changed()`：外部数据变更同步 |
| `src/components/editor/magic-script-editor.vue` | 821-883 | `tabsContextmenuHandle()`：Tab 右键菜单 |
| `src/components/editor/magic-script-editor.vue` | 884-920 | `addScrollEventListener()`：Tab 栏滚动监听 + MutationObserver |
| `src/components/editor/magic-script-editor.vue` | 921-946 | `tabDraggable()`：Tab 拖拽排序 |
| `src/components/editor/magic-script-editor.vue` | 951-1050 | 样式定义 |
| `src/scripts/bus.js` | 1-57 | EventBus 实现 + statusLog + cnzz 统计 |
| `src/scripts/contants.js` | 1-36 | 全局常量定义（BASE_URL/SERVER_URL/AUTO_SAVE/字体/Header 名等） |
| `src/scripts/store.js` | 1-21 | localStorage 封装 |
| `src/scripts/editor/magic-script.js` | 1-97 | monaco 语言注册（magicscript） |
| `src/scripts/editor/request-parameter.js` | 1-5 | 环境函数注册接口 |
| `src/scripts/parsing/parser.js` | 1-954 | 语法解析器 |
| `src/scripts/parsing/tokenizer.js` | 1-365 | 词法分析器 |
| `src/scripts/parsing/index.js` | 1-552 | TokenStream / ParseException / AST 入口 |
| `src/components/editor/magic-history.vue` | 1-158 | 历史记录 diff 对比组件 |
