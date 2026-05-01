# 布局面板模块规范（As-Built）— 010-layout-options

> 模块编号：010-layout-options
> 状态：已实现
> 最后更新：2026-05-01
> 对应源码：
> - `src/components/layout/magic-settings.vue`（147 行）— 全局参数/全局 Header 编辑面板
> - `src/components/layout/magic-search.vue`（238 行）— 全局搜索对话框
> - `src/components/layout/magic-todo.vue`（152 行）— TODO 列表面板
> - `src/components/layout/magic-options.vue`（303 行）— 底部面板容器（Tab 注册与布局）
> - `src/components/layout/magic-option.vue`（116 行）— 接口选项编辑面板
> - `src/components/common/magic-bottom-panel.vue`（63 行）— 子面板外壳组件
> - `src/scripts/contants.js`（36 行）— 全局可写常量
> - `src/scripts/store.js`（21 行）— localStorage 持久化封装
> - `src/scripts/bus.js`（57 行）— 全局事件总线

---

## 1. 模块概述

### 1.1 目的

本模块提供 magic-editor 中**底部面板的公共子页签**以及**顶部全局搜索**能力，具体职责：

- **全局设置（MagicSettings）**：管理全局请求参数与全局请求 Header，持久化到 localStorage，自动注入到所有测试调用中
- **全局搜索（MagicSearch）**：跨接口/函数全文搜索，支持代码语法高亮预览，双击打开目标资源
- **TODO 列表（MagicTodo）**：聚合所有脚本中的 TODO/FIXME 注释，点击可跳转至对应脚本
- **底部面板容器（MagicOptions）**：作为底部区域的 Tab 容器，负责根据资源类型（API / Function / Group）动态拼接子页签集合，管理面板高度拖拽
- **接口选项（MagicOption）**：为单个 API 接口提供运行时选项配置（如缓存、事务等）

### 1.2 解决的问题

- 测试调用需要注入公共参数/Header（如 token、租户 ID），避免在每个接口中重复配置
- 项目接口/函数数量增多后，需要全文搜索快速定位目标脚本
- 代码中的 TODO/FIXME 注释需要集中查看与导航，避免遗漏
- 底部面板需要根据当前选中的资源类型动态切换子页签，同时保持公共页签始终可用
- 面板高度需要支持用户自定义拖拽调整

### 1.3 范围

**包含**：
- 全局请求参数编辑（键/值/描述表格，localStorage 持久化）
- 全局请求 Header 编辑（键/值/描述表格，localStorage 持久化）
- 全局搜索对话框（输入关键词 → 后端搜索 → 语法高亮预览 → 双击打开）
- TODO 列表（后端聚合 → 点击跳转至对应接口/函数）
- 底部面板容器 Tab 路由与高度拖拽
- 接口选项表格（键可搜索下拉/值/描述）
- 子面板外壳组件（标题栏 + 最小化按钮 + 内容插槽）

**不包含**：
- 请求参数面板（MagicRequest：五类参数编辑）→ 模块 008-layout-request
- 运行结果面板（MagicRun）→ 模块 008-layout-request
- 函数参数面板（MagicFunction）→ 模块 008-layout-request
- 分组属性面板（MagicGroup）→ 模块 008-layout-request
- 运行日志面板（MagicLog）→ 模块 008-layout-request
- 调试信息面板（MagicDebug）→ 模块 008-layout-request
- 事件面板（MagicEvent）→ 模块 008-layout-request
- HTTP 测试调用的实际发起 → 模块 001-editor-core
- monaco 语言服务注册 → 模块 012-script-language
- 主题注册与切换 → 模块 007-layout-header

---

## 2. 用户故事

| ID | 用户故事 | 源码位置 |
|---|---|---|
| US-001 | 作为开发者，我能编辑全局请求参数（键/值/描述），以便所有接口测试时自动注入这些参数 | `magic-settings.vue:14-32` |
| US-002 | 作为开发者，我能编辑全局请求 Header（键/值/描述），以便所有接口测试时自动携带公共 Header | `magic-settings.vue:34-53` |
| US-003 | 作为开发者，全局参数/Header 的修改能自动保存，无需手动点击保存按钮 | `magic-settings.vue:118-131` |
| US-004 | 作为开发者，我能点击顶部搜索图标打开全局搜索对话框，输入关键词搜索所有接口和函数 | `magic-header.vue:14-15`、`magic-search.vue:3-26` |
| US-005 | 作为开发者，搜索结果能以语法高亮形式预览代码片段，以便确认是否为目标文件 | `magic-search.vue:69-87,106-112` |
| US-006 | 作为开发者，我能双击搜索结果直接打开对应接口/函数进行编辑 | `magic-search.vue:158-167` |
| US-007 | 作为开发者，我能查看 TODO 列表，了解所有脚本中待处理的 TODO/FIXME 注释 | `magic-todo.vue:1-35` |
| US-008 | 作为开发者，我能点击 TODO 条目跳转到对应脚本的编辑页面 | `magic-todo.vue:75-82` |
| US-009 | 作为开发者，我能通过拖拽分隔条调整底部面板高度，以平衡编辑区与结果区的可视空间 | `magic-options.vue:3,112-128` |
| US-010 | 作为开发者，我能配置接口的运行时选项（如缓存、事务），以控制接口行为 | `magic-option.vue:1-32` |

---

## 3. 功能需求

### 3.1 全局设置面板（MagicSettings）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-001 | 系统 MUST 提供两个子页签：全局请求参数、全局请求 Header | `magic-settings.vue:4-7,14,34` |
| FR-002 | 全局请求参数页 MUST 以表格形式展示，列包括：键、值、描述 | `magic-settings.vue:15-19` |
| FR-003 | 全局请求 Header 页 MUST 以表格形式展示，列包括：键、值、描述 | `magic-settings.vue:35-39` |
| FR-004 | 系统 MUST 在组件初始化时从 localStorage 读取 `global-parameters` 和 `global-headers` 并解析为数组 | `magic-settings.vue:71-72` |
| FR-005 | 系统 MUST 在参数或 Header 数据发生深度变更时自动持久化到 localStorage | `magic-settings.vue:118-131` |
| FR-006 | 持久化键 `global-parameters` 的值 MUST 为 JSON 字符串格式的数组 | `magic-settings.vue:84`、`store.js:6-8` |
| FR-007 | 持久化键 `global-headers` 的值 MUST 为 JSON 字符串格式的数组 | `magic-settings.vue:85`、`store.js:6-8` |
| FR-008 | 系统 MUST 支持通过 +/− 按钮增删参数行或 Header 行 | `magic-settings.vue:11-12,87-116` |
| FR-009 | 删除最后一行时 MUST 自动添加一行空行，保持表格始终至少有一行 | `magic-settings.vue:100-102,108-110` |
| FR-010 | 每行数据 MUST 包含三个字段：`name`（键）、`value`（值）、`description`（描述） | `magic-settings.vue:23,26,29` |

### 3.2 全局搜索（MagicSearch）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-020 | 系统 MUST 提供模态对话框形式的全局搜索界面，标题为"全局搜索" | `magic-search.vue:3` |
| FR-021 | 搜索输入框 MUST 支持实时搜索，输入变更后 600ms 防抖发起请求 | `magic-search.vue:57-60,114-125` |
| FR-022 | 搜索请求 MUST 通过 `POST search` 接口发送，请求体包含 `keyword` 字段 | `magic-search.vue:117` |
| FR-023 | 搜索结果 MUST 以列表形式展示，每项包含：代码片段（高亮）、所属接口/函数名称、行号 | `magic-search.vue:8-12` |
| FR-024 | 搜索结果中的代码片段 MUST 使用 monaco 的 `tokenizeToString` 进行 magic-script 语法高亮 | `magic-search.vue:106-112` |
| FR-025 | 搜索结果中的关键词 MUST 通过 `replaceKeywords()` 函数进行额外高亮标记（黄色背景） | `magic-search.vue:137`、`utils.js:171-181` |
| FR-026 | 单击搜索结果项 MUST 在下方 monaco 只读编辑器中预览完整代码，并高亮匹配项 | `magic-search.vue:150-155,89-104` |
| FR-027 | 双击搜索结果项 MUST 关闭对话框并发射 `search-open` bus 事件 | `magic-search.vue:158-167` |
| FR-028 | `search-open` 事件的载荷 MUST 包含 `type`（1=接口，2=函数）和 `id` 字段 | `magic-search.vue:167`、`magic-editor.vue:212-218` |
| FR-029 | 搜索结果项 MUST 缓存对应的资源对象（通过 `$parent.$parent.$refs.apiList.getItemById()` 或 `functionList.getItemById()`） | `magic-search.vue:139-143` |
| FR-030 | 搜索结果列表 MUST 限制高度为 200px，超出部分可滚动 | `magic-search.vue:197-198` |
| FR-031 | 代码预览编辑器 MUST 高度为 300px，只读模式，启用自动换行 | `magic-search.vue:18,71-86` |
| FR-032 | 代码预览编辑器 MUST 使用 `contants.EDITOR_FONT_FAMILY` 和 `contants.EDITOR_FONT_SIZE` 配置字体 | `magic-search.vue:84-85` |
| FR-033 | 代码预览编辑器 MUST 使用 `store.get('skin')` 获取主题，默认为 `default` | `magic-search.vue:86` |
| FR-034 | 无搜索结果时 MUST 显示"没有搜索到内容"占位文本 | `magic-search.vue:20-22` |
| FR-035 | 搜索对话框关闭时 MUST 销毁 monaco 编辑器实例 | `magic-search.vue:184-187` |
| FR-036 | 搜索结果项的显示文本 MUST 格式化为 `groupName/name(groupPath/path)` 并去除多余斜杠 | `magic-search.vue:177-181` |

### 3.3 TODO 列表（MagicTodo）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-040 | 系统 MUST 在组件挂载后通过 `GET todo` 接口加载 TODO 列表 | `magic-todo.vue:56-58` |
| FR-041 | 用户登录后 MUST 自动刷新 TODO 列表 | `magic-todo.vue:53` |
| FR-042 | TODO 列表 MUST 以表格形式展示，列包括：名称（接口/函数名+路径）、行号：内容 | `magic-todo.vue:8-11` |
| FR-043 | 每条 TODO 记录 MUST 包含 `type` 字段（1=接口，2=函数）用于区分资源类型 | `magic-todo.vue:15-16,63-67` |
| FR-044 | TODO 内容文本 MUST 以斜体显示，颜色使用 CSS 变量 `--todo-color` | `magic-todo.vue:112-113` |
| FR-045 | 点击 TODO 条目 MUST 通过 `apiList.openItemById(id)` 或 `functionList.openItemById(id)` 打开对应资源 | `magic-todo.vue:75-82` |
| FR-046 | TODO 列表加载时 MUST 显示 loading 动画（旋转图标 + "加载中..."） | `magic-todo.vue:28-33` |
| FR-047 | 无 TODO 数据时 MUST 显示"暂无数据"占位文本 | `magic-todo.vue:34` |
| FR-048 | TODO 列表 MUST 提供刷新按钮（侧边栏刷新图标） | `magic-todo.vue:5` |
| FR-049 | TODO 条目 MUST 缓存对应的资源对象（通过 `$parent.$parent.$parent.$refs.apiList.getItemById()` 或 `functionList.getItemById()`） | `magic-todo.vue:60-69` |
| FR-050 | 表格偶数行 MUST 使用 CSS 变量 `--table-even-background` 作为背景色 | `magic-todo.vue:108-109` |

### 3.4 底部面板容器（MagicOptions）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-060 | 系统 MUST 根据当前资源类型动态切换底部 Tab 集合 | `magic-options.vue:41-58,61-91` |
| FR-061 | API 类型 MUST 显示 Tab：接口信息、接口选项、执行结果、调试信息 | `magic-options.vue:42-46` |
| FR-062 | Function 类型 MUST 显示 Tab：函数信息 | `magic-options.vue:48-49` |
| FR-063 | 分组选中时 MUST 显示 Tab：分组信息 | `magic-options.vue:50-51` |
| FR-064 | 所有类型 MUST 始终显示公共 Tab：运行日志、全局参数、TODO、事件（右对齐） | `magic-options.vue:53-58` |
| FR-065 | 系统 MUST 在收到 `opened` bus 事件时更新 `info` 数据并根据 `_type` 切换 Tab 集合 | `magic-options.vue:68-92` |
| FR-066 | 系统 MUST 在收到 `api-group-selected` bus 事件时切换到分组 Tab 集合 | `magic-options.vue:62-67` |
| FR-067 | 系统 MUST 在收到 `switch-tab` bus 事件时切换到指定子页签 | `magic-options.vue:93-106` |
| FR-068 | 系统 MUST 支持通过拖拽分隔条调整底部面板高度，最小高度 150px | `magic-options.vue:112-128` |
| FR-069 | 系统 MUST 在 Tab 切换或面板高度变化时发射 `update-window-size` bus 事件 | `magic-options.vue:105,119,127,132` |
| FR-070 | 系统 MUST 在 API 资源打开时通过 bus 向子组件广播 `update-request-body-definition` / `update-request-body` / `update-response-body-definition` / `update-response-body` 事件 | `magic-options.vue:79-84` |
| FR-071 | 点击已选中的 Tab MUST 切换为收起状态（`selectedTab = null`） | `magic-options.vue:12` |
| FR-072 | 底部面板默认高度 MUST 为 300px | `magic-options.vue:38` |

### 3.5 接口选项面板（MagicOption）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-080 | 系统 MUST 以表格形式展示接口选项，列包括：键（可搜索下拉）、值、描述 | `magic-option.vue:9-13` |
| FR-081 | 选项键 MUST 支持从后端 `GET /options` 接口加载可选项列表 | `magic-option.vue:56-66` |
| FR-082 | 后端返回的选项 MUST 与 `contants.OPTIONS` 数组合并 | `magic-option.vue:59-60` |
| FR-083 | 选择选项键时 MUST 自动填充描述和默认值（如果存在） | `magic-option.vue:69-81` |
| FR-084 | 系统 MUST 支持通过 +/− 按钮增删选项行 | `magic-option.vue:5-6,83-103` |
| FR-085 | 添加选项行时若 `info.option` 不存在，MUST 提示"请先添加或选择接口" | `magic-option.vue:84-89` |
| FR-086 | 每行选项数据 MUST 包含三个字段：`name`（键）、`value`（值）、`description`（描述） | `magic-option.vue:17,22,25` |

### 3.6 子面板外壳（MagicBottomPanel）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-090 | 系统 MUST 为每个子面板提供标题栏，显示面板标题 | `magic-bottom-panel.vue:4` |
| FR-091 | 标题栏 MUST 支持显示操作按钮（通过 `buttons` prop 传入） | `magic-bottom-panel.vue:5-6` |
| FR-092 | 标题栏 MUST 提供最小化按钮，点击后通过 `update:selectedTab` 事件通知父组件收起面板 | `magic-bottom-panel.vue:7` |
| FR-093 | 面板内容区域 MUST 通过 slot 插槽渲染子组件内容 | `magic-bottom-panel.vue:9-11` |

---

## 4. 非功能需求

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-001 | 性能 | 搜索请求 MUST 在输入变更后 600ms 防抖执行，避免频繁请求 | `magic-search.vue:114-116` |
| NFR-002 | 性能 | 搜索结果的语法高亮 MUST 异步执行（`async getHighlight`），避免阻塞 UI | `magic-search.vue:106-112,134` |
| NFR-003 | 可用性 | 全局参数/Header 的修改 MUST 自动保存（deep watch），无需手动保存 | `magic-settings.vue:118-131` |
| NFR-004 | 可用性 | 底部面板高度拖拽 MUST 限制最小 150px | `magic-options.vue:115` |
| NFR-005 | 可用性 | TODO 列表条目 MUST 支持 hover 背景高亮 | `magic-todo.vue:115-116` |
| NFR-006 | 可用性 | 搜索结果列表 MUST 限制高度 200px，超出可滚动 | `magic-search.vue:197-198` |
| NFR-007 | 可用性 | 代码预览编辑器 MUST 禁用小地图（`minimap.enabled: false`） | `magic-search.vue:72-74` |
| NFR-008 | 可配置性 | 搜索预览编辑器字体族/字号 MUST 使用 `contants.EDITOR_FONT_FAMILY` / `EDITOR_FONT_SIZE` | `magic-search.vue:84-85` |
| NFR-009 | 可配置性 | 搜索预览编辑器主题 MUST 跟随全局 `store.get('skin')` 设置 | `magic-search.vue:86` |
| NFR-010 | 兼容性 | 所有面板 MUST 使用 CSS 变量（`--background`、`--color` 等）支持主题切换 | 各组件 style 段 |
| NFR-011 | 性能 | TODO 列表加载 MUST 显示 loading 状态，避免空白闪烁 | `magic-todo.vue:28-33,70-72` |

---

## 5. 关键实体

| 实体 | 描述 | 关键属性 |
|---|---|---|
| **全局参数行** | 全局请求参数表格中的一行 | `name`（键）、`value`（值）、`description`（描述） |
| **全局 Header 行** | 全局请求 Header 表格中的一行 | `name`（键）、`value`（值）、`description`（描述） |
| **搜索结果项** | 全局搜索返回的一条匹配记录 | `id`、`type`（1=接口/2=函数）、`text`（高亮代码片段）、`line`（行号）、`cache`（缓存的资源对象） |
| **TODO 条目** | 代码中 TODO/FIXME 注释的聚合记录 | `id`、`type`（1=接口/2=函数）、`text`（注释内容）、`line`（行号）、`cache`（缓存的资源对象）、`method`（HTTP 方法） |
| **接口选项行** | 接口选项表格中的一行 | `name`（键）、`value`（值）、`description`（描述） |
| **Tab 配置对象** | 底部面板的 Tab 定义 | `id`、`name`、`icon`、`component`、`right?` |
| **可选项元数据** | 从后端 `/options` 加载的选项定义 | `[选项名, 描述, 默认值]` 三元组 |

---

## 6. 可写字段清单（contants）

> 以下字段定义在 `src/scripts/contants.js` 中，可在运行期被 `magic-editor.vue:beforeMount` 覆盖。

| 字段 | 默认值 | 类型 | 用途 | 源码行 |
|---|---|---|---|---|
| `AUTO_SAVE` | `true` | boolean | 测试前是否自动保存脚本 | `contants.js:8` |
| `DECORATION_TIMEOUT` | `10000` | number | 断点/异常装饰自动清除超时（ms），负值表示不自动清除 | `contants.js:9` |
| `EDITOR_FONT_FAMILY` | `'JetBrainsMono, Consolas, "Courier New",monospace, 微软雅黑'` | string | 编辑器字体族 | `contants.js:31` |
| `EDITOR_FONT_SIZE` | `14` | number | 编辑器字号（px） | `contants.js:32` |
| `DEFAULT_EXPAND` | `true` | boolean | 资源树默认展开 | `contants.js:27` |
| `LOG_MAX_ROWS` | `Infinity` | number | 日志面板最大行数 | `contants.js:26` |
| `API_DEFAULT_METHOD` | `'GET'` | string | 新建接口默认 HTTP 方法 | `contants.js:10` |
| `OPTIONS` | `[]` | array | 前端内置的接口/分组可选项列表 | `contants.js:30` |
| `JDBC_DRIVERS` | `[]` | array | JDBC 驱动列表（由后端 config 注入） | `contants.js:28` |
| `DATASOURCE_TYPES` | `[]` | array | 数据源类型列表（由后端 config 注入） | `contants.js:29` |
| `BASE_URL` | `''` | string | 后端 web 路径 | `contants.js:5` |
| `WEBSOCKET_SERVER` | `''` | string | WebSocket 服务地址 | `contants.js:6` |
| `SERVER_URL` | `''` | string | 接口实际路径 | `contants.js:7` |
| `config` | `{}` | object | 后端 `/config.json` 响应缓存 | `contants.js:33` |

---

## 7. localStorage 持久化键

> 所有访问通过 `src/scripts/store.js` 封装；对象/数组值自动 `JSON.stringify`。

| Key | 值类型 | 写入位置 | 读取位置 | 说明 |
|---|---|---|---|---|
| `global-parameters` | string (JSON array) | `magic-settings.vue:84`（deep watch 自动保存） | `magic-settings.vue:71`、`magic-script-editor.vue:678` | 全局请求参数，测试调用时自动注入 |
| `global-headers` | string (JSON array) | `magic-settings.vue:85`（deep watch 自动保存） | `magic-settings.vue:72`、`magic-script-editor.vue:679` | 全局请求 Header，测试调用时自动注入 |
| `skin` | string | `magic-header.vue:241`（主题切换时） | `magic-search.vue:86`、`magic-script-editor.vue:116` | 当前主题名（`default` / `dark` / 自定义） |
| `magic-token` | string | 登录成功后 | `magic-editor.vue:304` | 鉴权令牌 |
| `recent_opened_tab` | string (JSON array) | 资源打开/关闭时 | `magic-editor.vue:353` | 上次打开的资源 id 列表 |
| `recent_opened` | string (JSON) | 最近打开组件 | `magic-recent-opened.vue` | 最近打开历史 |
| `ignore-version` | string | 用户拒绝版本更新 | `magic-editor.vue:321,331` | 跳过的版本号 |

---

## 8. 接受场景

### 场景 1：配置全局请求参数

- Given 用户打开底部"全局参数"Tab
- When 用户在"全局请求参数"页签中添加键值对
- Then 数据自动持久化到 localStorage（键 `global-parameters`），后续所有接口测试调用自动注入这些参数

### 场景 2：全局搜索并打开接口

- Given 用户点击顶部搜索图标
- When 用户在搜索框中输入关键词并等待 600ms
- Then 系统向后端发起 `POST search` 请求，返回结果以语法高亮形式展示
- When 用户双击某条搜索结果
- Then 系统关闭对话框，发射 `search-open` bus 事件，主组件切换到对应资源类型并打开该接口

### 场景 3：查看并跳转 TODO

- Given 用户已登录
- When 用户切换到底部"TODO"Tab
- Then 系统加载所有脚本中的 TODO/FIXME 注释并展示
- When 用户点击某条 TODO 记录
- Then 系统打开对应的接口/函数进行编辑

### 场景 4：调整底部面板高度

- Given 底部面板已展开
- When 用户拖拽面板上方的分隔条
- Then 面板高度跟随鼠标移动变化，最小不低于 150px
- When 用户松开鼠标
- Then 高度固定，并发射 `update-window-size` 事件通知编辑器重排

### 场景 5：配置接口运行时选项

- Given 用户在资源树中选中一个 API 接口
- When 用户切换到底部"接口选项"Tab
- Then 用户可添加选项行，键支持从后端 `/options` 加载的可搜索下拉选择
- When 用户选择某个选项键
- Then 系统自动填充对应的描述和默认值

---

## 9. 假设与约束

### 9.1 假设

- A-001：`global-parameters` 和 `global-headers` 在 localStorage 中不存在时，默认值为空数组 `[]`（`magic-settings.vue:71-72`）
- A-002：后端 `/options` 接口返回格式为 `[[选项名, 描述, 默认值], ...]` 的二维数组（`magic-option.vue:58-65`）
- A-003：`contants.OPTIONS` 数组提供前端内置的选项列表，与后端返回的选项合并（`magic-option.vue:59-60`）
- A-004：TODO 列表中的 `type` 字段：1 表示接口，2 表示函数（`magic-todo.vue:63-67`）
- A-005：搜索结果中的 `type` 字段：1 表示接口，2 表示函数（`magic-search.vue:139-143`）
- A-006：搜索组件通过 `$parent.$parent.$refs` 跨两级父组件引用资源列表（`magic-search.vue:133`）
- A-007：TODO 组件通过 `$parent.$parent.$parent.$refs` 跨三级父组件引用资源列表（`magic-todo.vue:60`）

### 9.2 约束

- C-001：所有面板组件均为 Options API 风格（`export default { data/mounted/methods }`）
- C-002：跨组件通信统一使用 EventBus（constitution 第四条）
- C-003：全局参数/Header 的持久化通过 deep watch 自动触发，无手动保存按钮
- C-004：搜索预览编辑器使用 monaco-editor 直接创建实例，非通过 Vue 组件封装
- C-005：TODO 注释的识别由后端负责（`GET todo` 接口），前端仅展示与跳转

---

## 10. 与其他模块的边界

### 10.1 与 001-editor-core 的边界

- **001-editor-core 负责**：发起 HTTP 测试调用，在 `mergeGlobalSettings()` 中读取 `global-parameters` / `global-headers` 并注入到请求中（`magic-script-editor.vue:677-693`）
- **本模块负责**：提供全局参数/Header 的编辑 UI（MagicSettings），数据持久化到 localStorage
- **交互方式**：双方通过 localStorage 共享数据，无直接通信
- **边界清晰点**：本模块不发起测试请求，不处理请求拼装；001-editor-core 不渲染参数编辑 UI

### 10.2 与 007-layout-header 的边界

- **007-layout-header 负责**：顶部 Header 栏（运行/保存/搜索图标/主题切换/上传/导出/推送等）
- **本模块负责**：MagicSearch 组件（搜索对话框），被 MagicHeader 引用（`magic-header.vue:80`）
- **交互方式**：MagicHeader 通过 `$refs.search.show()` 调用 MagicSearch 的 `show()` 方法打开对话框（`magic-header.vue:14`）
- **边界清晰点**：本模块不渲染 Header 栏，不处理主题切换；007 模块不处理搜索逻辑

### 10.3 与 008-layout-request 的边界

- **008-layout-request 负责**：请求参数面板（MagicRequest）、运行结果（MagicRun）、函数参数（MagicFunction）、分组属性（MagicGroup）、运行日志（MagicLog）、调试信息（MagicDebug）、事件面板（MagicEvent）
- **本模块负责**：全局设置（MagicSettings）、全局搜索（MagicSearch）、TODO 列表（MagicTodo）、接口选项（MagicOption）
- **共享容器**：MagicOptions 组件同时注册两个模块的子面板 Tab（`magic-options.vue:41-58`）
- **边界清晰点**：本模块的 Tab 注册在 `commonTabs` 数组中（`magic-options.vue:53-58`），008 模块的 Tab 注册在 `apiTabs` / `functionTabs` / `apiGroupTabs` 中

### 10.4 与 015-infra-bus-store 的边界

- **015-infra-bus-store 负责**：提供 `bus`（EventBus）、`store`（localStorage 封装）、`contants`（全局常量）、`hotkey`（快捷键）、`utils`（工具函数）
- **本模块负责**：消费上述基础设施能力
- **交互方式**：
  - 通过 `bus.$emit()` / `bus.$on()` 进行跨组件通信（`search-open`、`update-window-size`、`login` 等）
  - 通过 `store.get()` / `store.set()` 读写 localStorage（`global-parameters`、`global-headers`、`skin`）
  - 通过 `contants.EDITOR_FONT_FAMILY` / `EDITOR_FONT_SIZE` 获取编辑器字体配置
  - 通过 `utils.replaceKeywords()` 进行搜索结果关键词高亮
- **边界清晰点**：本模块不修改 bus/store/contants 的实现，仅作为消费者

### 10.5 与 016-common-ui 的边界

- **016-common-ui 负责**：提供通用 UI 组件（MagicInput、MagicSelect、MagicDialog、MagicTextIcon、MagicBottomPanel 等）
- **本模块负责**：消费上述通用组件
- **交互方式**：
  - MagicSettings 使用 `MagicInput` 编辑键/值/描述（`magic-settings.vue:23,26,29`）
  - MagicOption 使用 `MagicInput` + `MagicSelect` 编辑选项（`magic-option.vue:17,22,25`）
  - MagicSearch 使用 `MagicDialog` + `MagicInput`（`magic-search.vue:3,6`）
  - MagicTodo 使用 `MagicTextIcon` 显示接口/函数类型图标（`magic-todo.vue:15-16`）
  - 所有子面板使用 `MagicBottomPanel` 作为外壳（`magic-options.vue:5-9`）
- **边界清晰点**：本模块不定义通用组件，仅组合使用

---

## 11. HTTP 端点清单

> 以下端点均为 `baseURL` 前缀下的相对路径。

| 方法 | 路径 | 用途 | 请求体 | 源码位置 |
|---|---|---|---|---|
| POST | `search` | 全文搜索接口/函数脚本 | JSON: `{ keyword: string }` | `magic-search.vue:117` |
| GET | `todo` | 获取所有脚本中的 TODO/FIXME 注释列表 | 无 | `magic-todo.vue:58` |
| GET | `options` | 加载接口/分组可选项列表 | 无 | `magic-option.vue:58` |
| GET | `get?id=<id>` | 获取接口/函数脚本详情（搜索预览用） | 无 | `magic-search.vue:172` |
| GET | `function/get?id=<id>` | 获取函数脚本详情（搜索预览用） | 无 | `magic-search.vue:172` |

---

## 12. 总线事件清单

### 12.1 本模块发射（emit）的事件

| 事件 | 触发时机 | 参数 | 源码位置 |
|---|---|---|---|
| `search-open` | 双击搜索结果项 | `{ type: 1\|2, id, ... }` | `magic-search.vue:167` |
| `update-window-size` | Tab 切换 / 面板高度变化 | 无 | `magic-options.vue:105,119,127,132` |

### 12.2 本模块监听（on）的事件

| 事件 | 来源 | 处理 | 源码位置 |
|---|---|---|---|
| `opened` | 001-editor-core | 更新 `info` 数据，切换 Tab 集合，广播 body/response 事件 | `magic-options.vue:68-92` |
| `api-group-selected` | 003-resources-api | 切换到分组 Tab 集合 | `magic-options.vue:62-67` |
| `switch-tab` | 001-editor-core / 主组件 | 切换到指定子页签 | `magic-options.vue:93-106` |
| `login` | 主组件 | 刷新 TODO 列表 | `magic-todo.vue:53` |
| `update-window-size` | 全局 bus | 重排 Monaco 编辑器（搜索预览） | `magic-search.vue`（间接通过 watch） |

### 12.3 被本模块消费的关键事件（由主组件处理）

| 事件 | 消费者 | 处理 | 源码位置 |
|---|---|---|---|
| `search-open` | `magic-editor.vue` | 根据 `type` 切换工具栏索引（0=接口，1=函数） | `magic-editor.vue:212-218` |

---

## 13. 待澄清

| ID | 位置 | 描述 |
|---|---|---|
| NC-001 | `magic-search.vue:133` | 搜索组件通过 `$parent.$parent.$refs.apiList` 跨两级父组件直接引用资源列表，耦合度高。是否应改为通过 bus 事件或共享数据通道获取？ |
| NC-002 | `magic-todo.vue:60` | TODO 组件通过 `$parent.$parent.$parent.$refs` 跨三级父组件直接引用资源列表，耦合度更高。是否应改为 bus 事件通信？ |
| NC-003 | `magic-settings.vue` | 全局参数/Header 通过 deep watch 自动持久化，但 `save()` 方法（`vue:83-86`）从未被显式调用。是否应保留手动保存能力作为兜底？ |
| NC-004 | `magic-search.vue:137` | `replaceKeywords()` 函数在 `utils.js` 中实现，但搜索组件通过 `import {replaceKeywords} from "@/scripts/utils"` 直接引用。该函数是否应归类为 015-infra-bus-store 的公开 API？ |

---

## 14. 依赖清单

| 依赖 | 类型 | 用途 | 源码行 |
|---|---|---|---|
| `monaco-editor` | 外部库 | 搜索预览编辑器核心 | `magic-search.vue:30` |
| `monaco-editor/esm/vs/editor/common/modes.js` | 内部模块 | TokenizationRegistry（语法高亮） | `magic-search.vue:36` |
| `monaco-editor/esm/vs/editor/common/modes/textToHtmlTokenizer.js` | 内部模块 | tokenizeToString（语法高亮） | `magic-search.vue:37` |
| `@/scripts/bus.js` | 内部模块 | 全局事件总线 | `magic-options.vue:30`、`magic-search.vue:35`、`magic-todo.vue:40` |
| `@/scripts/store.js` | 内部模块 | localStorage 封装（主题/全局参数） | `magic-settings.vue:59`、`magic-search.vue:33` |
| `@/scripts/contants.js` | 内部模块 | 全局常量（字体/选项等） | `magic-option.vue:38`、`magic-search.vue:38` |
| `@/scripts/utils.js` | 内部模块 | replaceKeywords（关键词高亮） | `magic-search.vue:39` |
| `@/api/request.js` | 内部模块 | HTTP 请求封装 | `magic-option.vue:35`、`magic-search.vue:34`、`magic-todo.vue:39` |
| `@/components/common/magic-input.vue` | 内部组件 | 输入框 | `magic-settings.vue:60`、`magic-option.vue:36`、`magic-search.vue:32` |
| `@/components/common/magic-select.vue` | 内部组件 | 可搜索下拉选择 | `magic-option.vue:37` |
| `@/components/common/magic-bottom-panel.vue` | 内部组件 | 子面板外壳 | `magic-options.vue:19` |
| `@/components/common/modal/magic-dialog.vue` | 内部组件 | 搜索对话框 | `magic-search.vue:31` |
| `@/components/common/magic-text-icon.vue` | 内部组件 | 资源类型图标 | `magic-todo.vue:41` |

---

## 附录：源码引用清单

| 文件 | 行号范围 | 引用说明 |
|---|---|---|
| `src/components/layout/magic-settings.vue` | 1-56 | 模板：导航栏 + 全局参数表格 + 全局 Header 表格 |
| `src/components/layout/magic-settings.vue` | 58-81 | import + 组件定义 + data（parameters/headers/navs 等） |
| `src/components/layout/magic-settings.vue` | 82-117 | 方法：save / addRow / removeRow |
| `src/components/layout/magic-settings.vue` | 118-147 | watch（deep）自动保存 + 样式 |
| `src/components/layout/magic-search.vue` | 1-27 | 模板：搜索对话框 + 结果列表 + 代码预览编辑器 |
| `src/components/layout/magic-search.vue` | 29-56 | import + 组件定义 + data |
| `src/components/layout/magic-search.vue` | 57-61 | watch inputText 防抖搜索 |
| `src/components/layout/magic-search.vue` | 62-88 | 方法：show / close / initEditor |
| `src/components/layout/magic-search.vue` | 89-112 | 方法：setValue / getHighlight（语法高亮） |
| `src/components/layout/magic-search.vue` | 113-148 | 方法：getResult / buildSearchList |
| `src/components/layout/magic-search.vue` | 149-183 | 方法：resultItemHandle / resultItemDbHandle / getDetail / getDisplayText |
| `src/components/layout/magic-search.vue` | 184-238 | destroyed 钩子 + 样式 |
| `src/components/layout/magic-todo.vue` | 1-36 | 模板：TODO 列表表格 + loading + 无数据占位 |
| `src/components/layout/magic-todo.vue` | 38-51 | import + 组件定义 + data |
| `src/components/layout/magic-todo.vue` | 52-54 | mounted：订阅 login 事件 |
| `src/components/layout/magic-todo.vue` | 55-85 | 方法：getTodoList / openItem + 样式 |
| `src/components/layout/magic-options.vue` | 1-16 | 模板：底部容器 + 分隔条 + Tab 栏 |
| `src/components/layout/magic-options.vue` | 18-60 | import + 组件定义 + Tab 配置（apiTabs/functionTabs/apiGroupTabs/commonTabs） |
| `src/components/layout/magic-options.vue` | 61-107 | mounted 钩子：bus 事件订阅（api-group-selected / opened / switch-tab） |
| `src/components/layout/magic-options.vue` | 108-136 | 方法：doResizeY + watch selectedTab |
| `src/components/layout/magic-options.vue` | 137-303 | 样式（含 .ma-layout 通用布局样式） |
| `src/components/layout/magic-option.vue` | 1-32 | 模板：选项表格 + 增删按钮 |
| `src/components/layout/magic-option.vue` | 34-67 | import + 组件定义 + mounted 加载 /options |
| `src/components/layout/magic-option.vue` | 68-116 | 方法：onSelect / addRow / removeRow + 样式 |
| `src/components/common/magic-bottom-panel.vue` | 1-63 | 模板 + 脚本 + 样式：子面板外壳（标题栏 + 最小化按钮 + slot） |
| `src/scripts/contants.js` | 1-36 | 全局可写常量定义（AUTO_SAVE / EDITOR_FONT_FAMILY / EDITOR_FONT_SIZE 等） |
| `src/scripts/store.js` | 1-21 | localStorage 封装（set/get/remove） |
| `src/scripts/bus.js` | 1-57 | EventBus 实现 + statusLog + cnzz 统计 |
| `src/scripts/utils.js` | 171-181 | replaceKeywords 函数（搜索结果关键词高亮） |
| `src/components/magic-editor.vue` | 212-218 | search-open 事件消费（切换工具栏索引） |
| `src/components/layout/magic-header.vue` | 14-15,80 | 搜索图标点击触发 + MagicSearch 组件引用 |
| `src/components/editor/magic-script-editor.vue` | 677-693 | mergeGlobalSettings 读取全局参数/Header |
