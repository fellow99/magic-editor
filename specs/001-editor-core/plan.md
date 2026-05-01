# 001-editor-core 技术实现计划（As-Built）

> 本文件以"已建成系统"视角记录 001-editor-core 模块的实际技术实现。
> 模块编号：001-editor-core
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. Technical Context

### 1.1 Runtime Environment

| 维度 | 值 | 来源 |
|---|---|---|
| 运行环境 | 浏览器（现代浏览器，ES2020+） | [TECH.md §7](../TECH.md#7-浏览器目标) |
| 前端框架 | Vue 3.4.x（Options API 风格） | `src/components/editor/magic-script-editor.vue:86` |
| 编辑器内核 | monaco-editor 0.29.1 | `vue:68` |
| 模块系统 | ES Modules（Vite 构建） | [TECH.md §2](../TECH.md#2-构建工具链) |
| 语言 | JavaScript（无 TypeScript） | 源码全为 `.js`/`.vue` |

### 1.2 Dependencies

#### 直接依赖（源码 import）

| 依赖 | 版本 | 路径 | 用途 |
|---|---|---|---|
| `monaco-editor` | ^0.29.1 | `vue:68` | 编辑器核心实例 |
| `monaco-editor/esm/vs/platform/commands/common/commands` | 同上 | `vue:81` | CommandsRegistry（快捷键重写） |
| `monaco-editor/esm/vs/platform/keybinding/common/keybindingsRegistry.js` | 同上 | `vue:82` | KeybindingsRegistry（快捷键重写） |
| `monaco-editor/esm/vs/platform/contextkey/common/contextkey.js` | 同上 | `vue:83` | ContextKeyExpr（快捷键条件） |
| `@/scripts/editor/magic-script.js` | 内部 | `vue:69` | `initializeMagicScript()` 语言初始化 |
| `@/scripts/bus.js` | 内部 | `vue:70` | 全局 EventBus |
| `@/scripts/contants.js` | 内部 | `vue:74` | 全局常量（字体/超时/URL/Header 名等） |
| `@/scripts/store.js` | 内部 | `vue:76` | localStorage 封装 |
| `@/scripts/utils.js` | 内部 | `vue:75` | 工具函数（`isVisible`/`replaceURL`/`formatJson`） |
| `@/scripts/parsing/parser.js` | 内部 | `vue:77` | 语法解析器（实时校验） |
| `@/scripts/parsing/tokenizer.js` | 内部 | `vue:78` | 词法分析器（实时校验） |
| `@/scripts/parsing/index.js` | 内部 | `vue:79` | TokenStream / ParseException |
| `@/scripts/editor/request-parameter.js` | 内部 | `vue:80` | 环境函数注册（Java 类型映射） |
| `@/api/request.js` | 内部 | `vue:73` | HTTP 请求封装 |
| `@/components/common/modal/magic-dialog.vue` | 内部 | `vue:71` | 历史记录对话框容器 |
| `@/components/editor/magic-history.vue` | 内部 | `vue:72` | 历史版本 diff 对比组件 |
| `@/components/common/magic-text-icon.vue` | 内部 | `vue:84` | Tab 图标（api/function） |

#### 间接依赖

| 依赖 | 版本 | 用途 |
|---|---|---|
| `vue` | ^3.4.0 | 视图层（库模式下 external） |
| `axios` | ^0.21.0 | HTTP 客户端（通过 `request.js`） |
| `qs` | ^6.9.4 | URL 序列化（通过 `request.js`） |

---

## 2. Constitution Check

| 原则编号 | 原则名称 | 合规状态 | 依据 |
|---|---|---|---|
| 第一条 | 单一主组件 + 注入式配置 | ✅ Compliant | 本模块不声明 props/config，通过 `contants` 单例读取注入配置（`vue:116-118`），无硬编码后端地址 |
| 第二条 | 前后端契约即真相 | ✅ Compliant | 业务数据（脚本内容/parameters/headers）全部通过 HTTP 从后端加载（`vue:399`），localStorage 仅持久化 `recent_opened_tab`（`vue:343`） |
| 第三条 | 通信双通道：HTTP + WebSocket | ✅ Compliant | HTTP 用于保存/测试/历史拉取（`vue:478,501,640`），WS 仅用于调试事件（`vue:229-230` 订阅 `ws_breakpoint`/`ws_exception`） |
| 第四条 | 事件总线即全局状态 | ✅ Compliant | 所有跨组件通信走 `bus.js`（`vue:214-230` 订阅 12 个事件，发出 10+ 个事件），无 Vuex/Pinia |
| 第五条 | monaco 一切围绕 magic-script | ✅ Compliant | 编辑器语言固定为 `magicscript`（`vue:112`），解析器/校验器均为 magic-script 专用（`vue:299`） |
| 第六条 | 类型契约由 Header 表达 | ✅ Compliant | 测试请求注入 `Magic-Request-Session`/`Magic-Request-Breakpoints`/`magic-token` Header（`vue:699-707`） |
| 第七条 | 国际化只信语言包索引化 | ✅ Compliant | 本模块不涉及 monaco i18n 切换，语言服务由 012-script-language 模块初始化（`vue:107`） |
| 第八条 | 双构建产物共存 | ✅ Compliant | 本模块为纯组件，无构建模式差异代码 |
| 第九条 | 错误反馈走模态框 + Bus | ✅ Compliant | 测试路径变量未填/RequestBody 有误/无选中脚本均通过 `$magicAlert` 弹框（`vue:530,573,617,635,650`）；状态反馈通过 `bus.$emit('status', ...)`（`vue:279,491,514,730,743,762`） |
| 第十条 | 源代码即文档真相 | ✅ Compliant | 本文档所有论断均附源码行号 |

### 例外登记

| ID | 违反条款 | 现状 | 备注 |
|---|---|---|---|
| E-001-C1 | 第四条（衍生约束） | `vue:566` 通过 `this.$parent.$refs.apiList.getGroupsById()` 直接跨组件引用 | 已在 spec.md NC-001 登记，耦合度高但功能正常 |
| E-002-C3 | 第五条（衍生约束） | `vue:161-168` 直接修改 `KeybindingsRegistry._coreKeybindings` 私有数组 | 已在 spec.md NC-002 登记，monaco 升级风险已知 |
| E-003-C4 | 工程实践 | `vue:214` 直接覆盖 `window.onresize` | 已在 spec.md NC-003 登记，可能与宿主环境冲突 |

---

## 3. Project Structure

### 3.1 模块文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/components/editor/magic-script-editor.vue` | 1050 | 核心编辑器组件：Tab 管理、monaco 实例、保存/测试/调试/历史/校验 |
| `src/components/editor/magic-history.vue` | 158 | 历史版本 diff 对比组件（通过 `$refs.history` 调用） |

### 3.2 组件内部结构

```
magic-script-editor.vue (1050 行)
├── <template> (65 行)
│   ├── Tab 栏（ul.ma-tab，支持拖拽/右键/中键关闭）
│   ├── monaco 容器（div.ref="editor"）
│   ├── 空状态快捷键提示（v-show="!scripts.length"）
│   └── 历史记录对话框（magic-dialog + magic-history）
├── <script> (884 行)
│   ├── import 声明 (17 个依赖)
│   ├── data() (8 个响应式字段)
│   ├── mounted() (149 行)
│   │   ├── 编辑器创建 + 配置
│   │   ├── 自定义 action + 命令注册
│   │   ├── 快捷键重写（5 组）
│   │   ├── 断点点击监听
│   │   ├── 内容变更监听（防抖校验）
│   │   ├── window.onresize 覆盖
│   │   ├── bus 事件订阅（12 个）
│   │   └── RequestParameter 环境注册
│   └── methods (22 个方法)
│       ├── onException / onBreakpoint    — WS 事件处理
│       ├── doValidate                    — 实时语法校验
│       ├── layout                        — 编辑器布局
│       ├── open / close / closeAll       — Tab 生命周期
│       ├── changed                       — 外部数据同步
│       ├── doSave / doSaveApi / doSaveFunction — 保存
│       ├── doTest / internalTest         — 测试入口
│       ├── sendTestRequest               — 请求发送
│       ├── mergeGlobalSettings           — 全局参数注入
│       ├── viewHistory                   — 历史记录
│       ├── doContinue / doStepInto       — 调试控制
│       ├── tabsContextmenuHandle         — 右键菜单
│       ├── addScrollEventListener        — Tab 滚动 + MutationObserver
│       ├── tabDraggable                  — Tab 拖拽排序
│       ├── resetRecentOpenedTab          — 持久化最近打开
│       └── deleteWrapperProperties       — 保存前清理
└── <style scoped> (100 行)
    └── Tab 栏 + 编辑器容器 + 空状态样式
```

### 3.3 与相邻模块的物理边界

```
src/components/editor/
├── magic-script-editor.vue    ← 001-editor-core（本模块）
└── magic-history.vue          ← 002-editor-history（通过 $refs 调用）

src/scripts/parsing/           ← 011-script-parser（import 调用）
src/scripts/editor/            ← 012-script-language（initializeMagicScript）
src/components/layout/         ← 008/009（通过 bus 事件通信）
```

---

## 4. Phase 0 Research

### 4.1 已解决的技术决策

| 决策点 | 选择 | 理由 | 源码证据 |
|---|---|---|---|
| 编辑器 API 风格 | Options API | 项目整体采用 Options API（主组件 `magic-editor.vue` 亦然），保持一致性 | `vue:86-948` |
| Tab 状态管理 | 数组 `scripts` + 引用 `selected`/`info` | 简单直接，无需引入状态管理库 | `vue:95-97` |
| 跨组件通信 | EventBus（bus.js） | 宪法第四条强制要求，避免 Vuex/Pinia | `vue:214-230` |
| 语法校验方式 | 自研 Parser + 500ms 防抖 | 避免频繁解析，Parser 为 magic-script 专用 | `vue:205-213,299` |
| 断点持久化 | monaco decoration → `ext.decorations` 数组 | 利用 monaco 内置装饰系统，切换脚本时恢复 | `vue:188-202,375` |
| 调试通信 | WS 事件 → bus → 组件订阅 | 宪法第三条：WS 仅用于调试事件流 | `vue:229-230,278-296` |
| 测试请求构建 | 前端拼装完整 RequestConfig | 后端仅接收标准 HTTP 请求，前端负责路径变量替换/参数拼装 | `vue:551-629` |
| 快捷键定制 | 直接修改 monaco 内部 KeybindingsRegistry | monaco 0.29.x 无公开 API 支持快捷键覆盖 | `vue:157-168` |

### 4.2 已识别的技术债（与 spec.md NC 对齐）

| NC 编号 | 问题 | 风险等级 | 缓解建议 |
|---|---|---|---|
| NC-001 | `this.$parent.$refs.apiList` 跨组件直接引用 | 中 | 改为 bus 事件或共享 store 读取分组路径变量 |
| NC-002 | 修改 `KeybindingsRegistry._coreKeybindings` 私有数组 | 高 | monaco 升级时必须验证；考虑迁移到 `IKeybindingService` 公开 API |
| NC-003 | `window.onresize` 直接赋值覆盖 | 中 | 改为 `addEventListener('resize', ...)` |

---

## 5. Phase 1 Design Outputs

### 5.1 Data Model（引用）

本模块涉及的数据模型已在以下文档中定义：

- **脚本对象模型**：[overall-data-model.md §9 UI 状态模型](../overall-data-model.md#9-ui-状态模型主组件) + [spec.md §5.4 内部数据状态](./spec.md#54-内部数据状态)
- **脚本 ext 扩展属性**：[spec.md §5.5 脚本扩展属性](./spec.md#55-脚本扩展属性ext-对象)
- **配置常量模型**：[overall-data-model.md §2 配置常量模型](../overall-data-model.md#2-配置常量模型contants)
- **localStorage 持久化**：[overall-data-model.md §3 localStorage 持久化条目](../overall-data-model.md#3-localstorage-持久化条目)
- **Bus 事件载荷**：[overall-data-model.md §6 EventBus 事件载荷](../overall-data-model.md#6-eventbus-事件载荷)
- **WS 帧数据模型**：[overall-data-model.md §5 WebSocket 帧数据模型](../overall-data-model.md#5-websocket-帧数据模型)

### 5.2 Contracts（引用）

本模块消费/生产的接口契约已在以下文档中定义：

- **HTTP 通用约定**：[overall-api.md §2 HTTP 通用约定](../overall-api.md#2-http-通用约定)
- **HTTP 自定义 Header**：[overall-api.md §2.3 通用请求 Header](../overall-api.md#23-通用请求-header)
- **WS 接口契约**：[overall-api.md §4 WebSocket 接口契约](../overall-api.md#4-websocket-接口契约)
- **模块级 Bus 事件**：[spec.md §5.2 订阅的 Bus 事件](./spec.md#52-订阅的-bus-事件输入) / [§5.3 发出的 Bus 事件](./spec.md#53-发出的-bus-事件输出)
- **模块间边界**：[spec.md §6 与其他模块的边界](./spec.md#6-与其他模块的边界)

### 5.3 Quickstart

本模块为组件级模块，无独立运行方式。使用方式：

1. 确保 `magic-editor.vue` 主组件已挂载
2. 确保 `bus.js`、`contants.js`、`store.js` 等基础设施已初始化
3. 确保 `initializeMagicScript()` 已调用（`vue:107`）
4. 通过 `bus.$emit('open', item)` 打开脚本，编辑器自动渲染

开发调试：
```bash
npm run serve        # 启动 dev server
# 访问 http://localhost:5173（需后端 magic-api 运行在 :9999）
```

---

## 6. FR 实现策略映射

本节将 spec.md 中定义的每个 FR 映射到具体实现策略。

### 6.1 Tab 管理（FR-001 ~ FR-010）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-001 | `scripts` 数组维护已打开脚本列表，`data()` 初始化为 `[]` | `vue:95` |
| FR-002 | `@click="open(item)"` 切换选中，`@mousedown.middle.stop="close(...)"` 中键关闭，拖拽事件更新状态 | `vue:11-17` |
| FR-003 | 模板中 `v-show="!item.id \|\| item.script !== item.ext.tmpScript"` 条件渲染 `*` | `vue:22` |
| FR-004 | 模板中 `v-if="item.lock === '1'"` 渲染锁图标 | `vue:21` |
| FR-005 | `tabDraggable()` 方法处理 dragstart/dragenter/dragend，通过 `splice` 重排数组 | `vue:921-946` |
| FR-006 | `tabsContextmenuHandle()` 调用 `$magicContextmenu` 渲染 6 项菜单 | `vue:822-883` |
| FR-007 | `close()` 方法中 `index > 0 ? scripts[index-1] : scripts[0]` 优先左侧切换 | `vue:774-782` |
| FR-008 | `close()` 中 `scripts.length === 0` 时触发 `bus.$emit('opened', {empty: true})` | `vue:786-788` |
| FR-009 | `resetRecentOpenedTab()` 过滤有 id 的脚本，`store.set(contants.RECENT_OPENED_TAB, ...)` | `vue:342-344` |
| FR-010 | `open()` 中遍历 `scripts` 检测同名，设置 `displayName = groupName + '/' + name` | `vue:424-429,789-799` |

### 6.2 编辑器初始化与配置（FR-011 ~ FR-016）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-011 | `mounted()` 中 `monaco.editor.create(this.$refs.editor, { language: 'magicscript', ... })` | `vue:108-123` |
| FR-012 | `theme: store.get('skin') \|\| 'default'` | `vue:116` |
| FR-013 | `fontFamily: contants.EDITOR_FONT_FAMILY`, `fontSize: contants.EDITOR_FONT_SIZE` | `vue:117-118` |
| FR-014 | `folding: true`, `wordWrap: 'on'`, `fontLigatures: true` | `vue:113-119` |
| FR-015 | `minimap: { enabled: false }` | `vue:109-111` |
| FR-016 | `window.onresize` 触发 `bus.$emit('update-window-size')`，bus 订阅调用 `this.layout()` | `vue:214-215` |

### 6.3 快捷键与自定义命令（FR-020 ~ FR-025）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-020 | `editor.addCommand(monaco.KeyMod.Alt \| monaco.KeyCode.US_SLASH, ...)` 同时触发 parameterHints 和 suggest | `vue:135-149` |
| FR-021 | `updateKeys` 数组中 `['editor.action.formatDocument', CtrlCmd+Alt+L]` 动态绑定 | `vue:154` |
| FR-022 | `updateKeys` 数组中 `['editor.action.marker.nextInFiles', CtrlCmd+F8]` 动态绑定 | `vue:155` |
| FR-023 | `updateKeys.forEach` 遍历，从 `KeybindingsRegistry._coreKeybindings` 移除旧绑定，`addDynamicKeybinding` 注册新绑定 | `vue:157-167` |
| FR-024 | `editor.addAction({ id: 'editor.action.triggerSuggest.extension', ... })` | `vue:124-131` |
| FR-025 | `CommandsRegistry.registerCommand('editor.action.scrollUp1Line', ...)` 每次 -22px | `vue:132-134` |

### 6.4 断点管理（FR-030 ~ FR-034）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-030 | `editor.onMouseDown` 监听，判断 `offsetX >= 0 && offsetX <= 90` | `vue:169-203` |
| FR-031 | decoration options 中 `linesDecorationsClassName: 'breakpoints'` | `vue:184,195` |
| FR-032 | 添加断点时同时设置 `className: 'breakpoint-line'` | `vue:196` |
| FR-033 | `this.info.ext.decorations = this.editor.getModel().getAllDecorations()` | `vue:202` |
| FR-034 | `open()` 中 `this.editor.getModel().deltaDecorations([], item.ext.decorations)` 恢复 | `vue:375` |

### 6.5 实时语法校验（FR-040 ~ FR-043）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-040 | `onDidChangeModelContent` 中 `clearTimeout` + `setTimeout(..., 500)` 防抖 | `vue:205-213` |
| FR-041 | `new Parser(new TokenStream(tokenizer(this.editor.getValue())))` | `vue:299` |
| FR-042 | 解析成功时 `setModelMarkers(..., [{}])` 清除标记 | `vue:301` |
| FR-043 | catch 中 `e.span` 提取行号列号，`setModelMarkers` 标记 Error 级别 | `vue:302-315` |

### 6.6 脚本保存（FR-050 ~ FR-058）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-050 | `doSave()` 中 `this.info._type === 'api' ? doSaveApi() : doSaveFunction()` | `vue:519-527` |
| FR-051 | `doSaveApi()` 中 `request.send('/save', JSON.stringify(saveObj), { method: 'post', headers: {'Content-Type': 'application/json'} })` | `vue:478-483` |
| FR-052 | `doSaveFunction()` 中 `request.send('/function/save', ...)` | `vue:501-506` |
| FR-053 | `deleteWrapperProperties()` 删除 ext/groupName/groupPath/_type/level/tmp_id，额外删除 optionMap/responseHeader/running | `vue:446-460` |
| FR-054 | `saveObj.parameters.filter(it => it.name)` / `paths.filter(it => it.name)` / `headers.filter(it => it.name)` | `vue:462,470-471` |
| FR-055 | 保存成功后 `thisInfo.id = id` + `this.info.ext.tmpScript = saveObj.script` | `vue:492-493,515-516` |
| FR-056 | 根据 `saveObj.id` 是否存在区分 save/add，触发对应 report 事件 | `vue:486-489,508-511` |
| FR-057 | `utils.replaceURL(...)` 生成全名，`bus.$emit('status', ...)` 显示 | `vue:490-491,513-514` |
| FR-058 | `if (contants.config.persistenceResponseBody === false)` 时删除 responseBody/responseBodyDefinition | `vue:474-477` |

### 6.7 脚本测试（FR-060 ~ FR-073）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-060 | `doTest()` 中 `!this.selected` 时 `$magicAlert` 提示 | `vue:528-533` |
| FR-061 | `this.info.running \|\| this.info._type !== 'api'` 时 return | `vue:534` |
| FR-062 | `contants.AUTO_SAVE && this.info.lock !== '1'` 时先 `doSave()`，在 `end()` 回调中调用 `internalTest()` | `vue:538-548` |
| FR-063 | `this.info.paths.forEach` 替换接口级 → `groups.forEach` 替换分组级 | `vue:562-571` |
| FR-064 | `requestConfig.url.indexOf('{') > -1` 时 `$magicAlert` 并 return | `vue:572-578` |
| FR-065 | `Object.values(params).some(it => it instanceof FileList)` 时构建 FormData | `vue:590-601` |
| FR-066 | `JSON.parse(this.info.requestBody)` 成功时设置 `Content-Type: application/json` | `vue:609-623` |
| FR-067 | `new Date().getTime() + '' + Math.floor(Math.random() * 100000)` 生成 sessionId | `vue:626-627` |
| FR-068 | `getAllDecorations().filter(...).map(...).join(',')` 生成断点行号列表 | `vue:702-707` |
| FR-069 | `mergeGlobalSettings()` 从 `store.get('global-parameters'/'global-headers')` 读取并注入 | `vue:677-693` |
| FR-070 | `requestConfig.headers[contants.HEADER_MAGIC_TOKEN] = contants.HEADER_MAGIC_TOKEN_VALUE` | `vue:700` |
| FR-071 | `transformResponse` 中判断 Blob vs JSON，分别处理 | `vue:712-729` |
| FR-072 | 非 Blob 时 `bus.$emit('update-response-body', ...)`，Blob 时 `bus.$emit('update-response-blob', ...)` | `vue:752,757` |
| FR-073 | 非 Blob 时 `bus.$emit('update-response-body-definition', ...)` | `vue:751` |

### 6.8 调试会话（FR-080 ~ FR-088）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-080 | `bus.$on('ws_breakpoint', ...)` 调用 `onBreakpoint()`，设置 `this.info.ext.debuging = true` | `vue:229,281` |
| FR-081 | `onBreakpoint()` 中创建 `debug-line` 样式 decoration，`revealRangeInCenter` | `vue:285-294` |
| FR-082 | `this.info.ext.variables = data.variables` | `vue:283` |
| FR-083 | `bus.$emit('switch-tab', 'debug')` | `vue:295` |
| FR-084 | `bus.$emit('status', '进入断点...')` | `vue:279` |
| FR-085 | `doContinue()` 清除 debugDecorations，`bus.$emit('message', 'resume_breakpoint', ...)` | `vue:657-673` |
| FR-086 | `doStepInto()` 调用 `this.doContinue(true)` | `vue:674-676` |
| FR-087 | `onException()` 中创建 `squiggly-error` 样式 decoration，`setTimeout` 自动清除 | `vue:256-276` |
| FR-088 | decoration options 中 `hoverMessage: { value: args[1] }` | `vue:265-267` |

### 6.9 历史记录（FR-090 ~ FR-093）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-090 | `viewHistory()` 中 `!this.info.id` 时 `$magicAlert` 提示 | `vue:630-639` |
| FR-091 | API 用 `backups?id=`，Function 用 `function/backups?id=` | `vue:640-644` |
| FR-092 | `timestampes.length === 0` 时 `$magicAlert` 提示 | `vue:649-654` |
| FR-093 | 恢复按钮调用 `$refs.history.reset()` | `vue:52-57` |

### 6.10 环境上下文（FR-100 ~ FR-102）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-100 | `RequestParameter.setEnvironment(() => { ... })` 注册环境函数 | `vue:242-253` |
| FR-101 | `javaTypes` 对象映射 9 种 Java 类型 | `vue:231-241` |
| FR-102 | 未识别类型 fallback 为 `'java.lang.Object'` | `vue:247,249` |

---

## 7. Complexity Tracking

### 7.1 复杂度热点

| 区域 | 复杂度来源 | 行数 | 说明 |
|---|---|---|---|
| `internalTest()` | 请求配置拼装逻辑分支多（路径变量/参数类型/RequestBody/文件上传） | 79 行（vue:551-629） | 包含 4 层条件分支，处理 4 种请求体类型 |
| `sendTestRequest()` | 响应处理（Blob vs JSON）、状态反馈、bus 事件触发 | 72 行（vue:695-766） | 包含自定义 `transformResponse` 函数 |
| `open()` | 脚本打开的三种场景（新增/已有/远程加载） | 117 行（vue:325-441） | 包含 v0.5.0 兼容处理、同名检测、远程加载回调 |
| 快捷键重写 | 直接操作 monaco 内部私有 API | 18 行（vue:150-168） | 修改 `_coreKeybindings` 数组，升级风险高 |

### 7.2 圈复杂度评估

| 方法 | 分支数 | 评估 |
|---|---|---|
| `open()` | 8+ | 高 — 三种打开场景 + 兼容处理 + 同名检测 |
| `internalTest()` | 6+ | 高 — 路径变量/参数类型/RequestBody 多分支 |
| `sendTestRequest()` | 4+ | 中 — Blob/JSON 分支 + 错误处理 |
| `close()` | 3+ | 中 — 关闭后自动切换逻辑 |
| `tabsContextmenuHandle()` | 6 | 低 — 6 个菜单项，各自独立 |
| `tabDraggable()` | 3 | 低 — switch 三态 |

---

## 8. Progress Tracking

### 8.1 文档完成状态

| 章节 | 状态 | 备注 |
|---|---|---|
| 1. Technical Context | ✅ 完成 | 依赖清单完整，附源码行号 |
| 2. Constitution Check | ✅ 完成 | 10 条原则逐一检查，3 条例外登记 |
| 3. Project Structure | ✅ 完成 | 文件清单 + 内部结构 + 物理边界 |
| 4. Phase 0 Research | ✅ 完成 | 8 项技术决策 + 3 项技术债 |
| 5. Phase 1 Design Outputs | ✅ 完成 | data-model/contracts/quickstart 引用对齐 |
| 6. FR 实现策略映射 | ✅ 完成 | 全部 43 个 FR 一一映射到实现策略 |
| 7. Complexity Tracking | ✅ 完成 | 4 个复杂度热点 + 圈复杂度评估 |
| 8. Progress Tracking | ✅ 完成 | 本章节 |

### 8.2 与总体文档对齐检查

| 对齐项 | 状态 | 说明 |
|---|---|---|
| overall-data-model.md 脚本 ext 属性 | ✅ 对齐 | spec.md §5.5 与 overall-data-model §9 一致 |
| overall-api.md HTTP Header 约定 | ✅ 对齐 | FR-067/068/070 使用的 Header 名与 overall-api §2.3 一致 |
| overall-api.md WS 帧协议 | ✅ 对齐 | FR-080/085 的 `ws_breakpoint`/`resume_breakpoint` 与 overall-api §4.3 一致 |
| overall-plan.md 构建顺序 | ✅ 对齐 | 本模块依赖基础设施层（contants/bus/store）和领域脚本层（parsing/editor），构建顺序正确 |
| constitution.md 原则 | ✅ 对齐 | 10 条原则全部检查，3 条例外已登记 |
| spec.md FR 编号 | ✅ 对齐 | FR-001~FR-102 共 43 个需求全部映射 |
