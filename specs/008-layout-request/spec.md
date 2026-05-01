# 布局面板模块规范（As-Built）— 008-layout-request

> 模块编号：008-layout-request
> 状态：已实现
> 最后更新：2026-05-01
> 对应源码：
> - `src/components/layout/magic-options.vue`（303 行）— 底部面板容器 + Tab 路由
> - `src/components/layout/magic-request.vue`（429 行）— 请求参数面板
> - `src/components/layout/magic-run.vue`（223 行）— 运行结果面板
> - `src/components/layout/magic-function.vue`（172 行）— 函数参数面板
> - `src/components/layout/magic-event.vue`（89 行）— 事件日志面板
> - `src/components/layout/magic-group.vue`（217 行）— 分组属性面板
> - `src/components/layout/magic-option.vue`（116 行）— 接口选项面板
> - `src/components/layout/magic-log.vue`（99 行）— 运行日志面板
> - `src/components/layout/magic-debug.vue`（134 行）— 调试信息面板

---

## 1. 模块概述

### 1.1 目的

本模块提供 magic-editor 的**底部面板区域**，是用户与接口/函数/分组进行交互的核心 UI 层。具体职责：

- **请求参数编辑**：为 API 接口提供 path/query/header/body/cookie 五类参数的可视化编辑
- **运行/测试调用**：展示 HTTP 测试调用的响应体、响应头、响应结构
- **函数参数定义**：为 Function 类型资源提供参数名/类型/描述的编辑
- **事件日志浏览**：展示系统运行事件的时间线
- **分组属性管理**：为 API 分组提供路径变量与分组选项的配置与保存
- **接口选项配置**：为单个接口提供运行时选项（如缓存、事务等）
- **运行日志展示**：实时接收并渲染后端推送的日志流
- **调试信息查看**：在断点命中时展示当前变量名/值/类型

### 1.2 解决的问题

- 接口测试需要可视化地编辑各类参数，而非手写 URL/Body
- 测试调用结果需要以多种格式（JSON/二进制/结构化）展示
- 分组级别的公共路径变量需要统一管理并自动注入到子接口的 URL 替换
- 调试过程中需要实时查看变量状态
- 底部面板需要根据当前选中的资源类型（API / Function / Group）动态切换子页签

### 1.3 范围

**包含**：
- 底部面板容器（MagicOptions）的 Tab 切换逻辑与布局
- 请求参数面板（MagicRequest）的五类参数编辑 + Body JSON 编辑器
- 运行结果面板（MagicRun）的响应体/响应头/响应结构展示
- 函数参数面板（MagicFunction）的参数表格
- 事件面板（MagicEvent）的状态日志时间线
- 分组面板（MagicGroup）的路径变量 + 分组选项 + 保存
- 接口选项面板（MagicOption）的选项表格
- 运行日志面板（MagicLog）的日志流渲染
- 调试面板（MagicDebug）的变量表格 + 继续/单步按钮

**不包含**：
- HTTP 请求的实际发起（由 001-editor-core 的 `sendTestRequest()` 负责）
- 断点装饰与调试行高亮（由 001-editor-core 负责）
- WebSocket 连接管理（由 014-infra-transport 负责）
- 资源树浏览（由 003-resources-api / 004-resources-function 负责）
- 全局设置面板（MagicSettings）— 归类于 010-layout-options

---

## 2. 用户故事

| ID | 用户故事 | 源码位置 |
|---|---|---|
| US-001 | 作为开发者，我能在底部面板编辑接口的请求参数（参数/Header/路径变量/Body/描述），以便配置测试用例 | `magic-request.vue:1-175` |
| US-002 | 作为开发者，我能按 Ctrl+Q 测试接口并查看响应结果，以便验证接口逻辑 | `magic-run.vue:1-25`、`magic-script-editor.vue:528-549` |
| US-003 | 作为开发者，我能编辑函数的参数列表（参数名/类型/描述），以便定义函数签名 | `magic-function.vue:1-51` |
| US-004 | 作为开发者，我能查看系统运行事件的时间线，以便追踪操作历史 | `magic-event.vue:1-21` |
| US-005 | 作为开发者，我能编辑分组的路径变量和分组选项并保存，以便配置分组级公共参数 | `magic-group.vue:1-86` |
| US-006 | 作为开发者，我能配置接口的运行时选项（如缓存、事务），以便控制接口行为 | `magic-option.vue:1-32` |
| US-007 | 作为开发者，我能实时查看接口运行时的日志输出，以便调试问题 | `magic-log.vue:1-12` |
| US-008 | 作为开发者，我能在断点命中时查看当前变量值并执行继续/单步操作，以便调试脚本 | `magic-debug.vue:1-31` |
| US-009 | 作为开发者，我能在请求 Body 面板中使用 Monaco JSON 编辑器编辑请求体，以便构造复杂 JSON 请求 | `magic-request.vue:157-168` |
| US-010 | 作为开发者，我能通过拖拽分隔条调整底部面板高度，以便平衡编辑区与结果区的可视空间 | `magic-options.vue:3,112-128` |

---

## 3. 功能需求

### 3.1 底部面板容器（MagicOptions）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-001 | 系统 MUST 根据当前资源类型（API / Function / Group）动态切换底部 Tab 集合 | `magic-options.vue:41-58,61-91` |
| FR-002 | API 类型 MUST 显示 Tab：接口信息（MagicRequest）、接口选项（MagicOption）、执行结果（MagicRun）、调试信息（MagicDebug） | `magic-options.vue:42-46` |
| FR-003 | Function 类型 MUST 显示 Tab：函数信息（MagicFunction） | `magic-options.vue:48-49` |
| FR-004 | 分组选中时 MUST 显示 Tab：分组信息（MagicGroup） | `magic-options.vue:50-51` |
| FR-005 | 所有类型 MUST 始终显示公共 Tab：运行日志（MagicLog）、全局参数（MagicSettings）、TODO（MagicTodo）、事件（MagicEvent，右对齐） | `magic-options.vue:53-58` |
| FR-006 | 系统 MUST 在收到 `opened` 事件时更新 `info` 数据并根据 `_type` 切换 Tab 集合 | `magic-options.vue:68-92` |
| FR-007 | 系统 MUST 在收到 `api-group-selected` 事件时切换到分组 Tab 集合 | `magic-options.vue:62-67` |
| FR-008 | 系统 MUST 在收到 `switch-tab` 事件时切换到指定子页签 | `magic-options.vue:93-106` |
| FR-009 | 系统 MUST 支持通过拖拽分隔条调整底部面板高度（最小 150px） | `magic-options.vue:112-128` |
| FR-010 | 系统 MUST 在 Tab 切换或面板高度变化时发射 `update-window-size` 事件 | `magic-options.vue:105,119,127,132` |
| FR-011 | 系统 MUST 在 API 资源打开时通过 bus 向子组件广播 `update-request-body-definition` / `update-request-body` / `update-response-body-definition` / `update-response-body` 事件 | `magic-options.vue:79-84` |

### 3.2 请求参数面板（MagicRequest）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-020 | 系统 MUST 提供请求方法选择（GET/POST/PUT/DELETE/HEAD/PATCH） | `magic-request.vue:4-5,209-216` |
| FR-021 | 系统 MUST 提供接口名称输入框 | `magic-request.vue:6-7` |
| FR-022 | 系统 MUST 提供请求路径输入框 | `magic-request.vue:8-9` |
| FR-023 | 系统 MUST 提供五类参数子页签：请求参数、请求 Header、路径变量、请求 Body、接口描述 | `magic-request.vue:12-14,208` |
| FR-024 | 请求参数页 MUST 以表格形式展示，列包括：必填、Key、Value、参数类型、默认值、验证方式、表达式、验证说明、描述 | `magic-request.vue:23-33` |
| FR-025 | 请求 Header 页 MUST 以表格形式展示，列包括：必填、Key、Value、参数类型、默认值、验证方式、表达式、验证说明、描述 | `magic-request.vue:70-80` |
| FR-026 | 路径变量页 MUST 以表格形式展示，列包括：Key、Value、参数类型、验证方式、表达式、验证说明、描述（无"必填"列） | `magic-request.vue:118-126` |
| FR-027 | 参数类型 MUST 支持：String、Boolean、Integer、Date、Double、Long、Short、Float、Byte | `magic-request.vue:217-227` |
| FR-028 | 请求参数的参数类型额外支持：MultipartFile、MultipartFiles | `magic-request.vue:228-240` |
| FR-029 | 验证方式 MUST 支持：不验证（pass）、表达式验证（expression）、正则验证（pattern） | `magic-request.vue:241-245` |
| FR-030 | 当参数类型为 MultipartFile/MultipartFiles 时，Value 列 MUST 渲染为文件选择组件 | `magic-request.vue:44` |
| FR-031 | 请求 Body 页 MUST 提供左右分栏布局：左侧 Monaco JSON 编辑器，右侧 MagicJson 结构化展示 | `magic-request.vue:157-168` |
| FR-032 | Monaco JSON 编辑器 MUST 在首次切换到 Body 页签时懒加载创建 | `magic-request.vue:342-372` |
| FR-033 | Body 编辑器内容变更 MUST 同步更新 `info.requestBody` 并触发 `update-request-body` 事件 | `magic-request.vue:361-364,268-271` |
| FR-034 | Body 编辑器粘贴内容时 MUST 尝试自动格式化 JSON | `magic-request.vue:365-369` |
| FR-035 | Body JSON 解析后 MUST 通过 `valueCopy()` 保留已有的验证规则/默认值/描述等元数据 | `magic-request.vue:385-413` |
| FR-036 | 接口描述页 MUST 提供多行文本编辑 | `magic-request.vue:170-172` |
| FR-037 | 系统 MUST 支持通过 +/− 按钮增删参数行 | `magic-request.vue:19-20,289-341` |
| FR-038 | 删除最后一行参数时 MUST 自动添加一行空行 | `magic-request.vue:317-319,325-327,333-335` |

### 3.3 运行结果面板（MagicRun）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-040 | 系统 MUST 提供三个子页签：Body、响应 Header、响应结构 | `magic-run.vue:3-5,52` |
| FR-041 | Body 页 MUST 使用只读 Monaco 编辑器展示响应文本 | `magic-run.vue:7,102-119` |
| FR-042 | 当响应为二进制类型（存在 contentType）时，Body 页 MUST 使用 iframe 展示 | `magic-run.vue:8,51` |
| FR-043 | 当响应头包含 `content-disposition` 时，系统 MUST 自动下载文件 | `magic-run.vue:86-95` |
| FR-044 | 响应 Header 页 MUST 以 Key-Value 表格展示所有响应头 | `magic-run.vue:9-22` |
| FR-045 | 响应结构页 MUST 使用 MagicJson 组件展示结构化响应体 | `magic-run.vue:23` |
| FR-046 | 系统 MUST 在收到 `update-response-body` 事件时更新响应内容与响应头 | `magic-run.vue:70-79` |
| FR-047 | 系统 MUST 在收到 `update-response-blob` 事件时处理二进制响应 | `magic-run.vue:83-99` |
| FR-048 | 系统 MUST 在收到 `update-response-body-definition` 事件时更新响应结构定义 | `magic-run.vue:80-82` |
| FR-049 | 响应体 JSON 解析后 MUST 通过 `valueCopy()` 保留已有的类型/描述等元数据 | `magic-run.vue:150-175` |

### 3.4 函数参数面板（MagicFunction）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-060 | 系统 MUST 提供返回值类型选择（数值/字符串/集合/Map/Object） | `magic-function.vue:4-5,71-77` |
| FR-061 | 系统 MUST 提供函数名称输入框 | `magic-function.vue:6-7` |
| FR-062 | 系统 MUST 提供函数路径输入框 | `magic-function.vue:8-9` |
| FR-063 | 系统 MUST 提供两个子页签：函数参数、函数描述 | `magic-function.vue:12-14,70` |
| FR-064 | 函数参数页 MUST 以表格形式展示，列包括：参数名、类型、描述 | `magic-function.vue:23-27` |
| FR-065 | 参数类型 MUST 支持：java.lang.Number、java.lang.String、java.util.Collection、java.util.Map、java.lang.Object | `magic-function.vue:71-77` |
| FR-066 | 系统 MUST 支持通过 +/− 按钮增删参数行 | `magic-function.vue:18-20,83-114` |

### 3.5 事件面板（MagicEvent）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-070 | 系统 MUST 以表格形式展示事件列表，列包括：时间、事件内容 | `magic-event.vue:8-11` |
| FR-071 | 事件数据 MUST 来自 `bus.$getStatusLog()` | `magic-event.vue:37` |
| FR-072 | 系统 MUST 在收到 `status` 事件时刷新事件列表 | `magic-event.vue:38-42` |
| FR-073 | 系统 MUST 支持清空事件日志（调用 `bus.$clearStatusLog()`） | `magic-event.vue:45-47` |

### 3.6 分组属性面板（MagicGroup）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-080 | 系统 MUST 提供分组名称输入框 | `magic-group.vue:4-5` |
| FR-081 | 系统 MUST 提供分组路径输入框 | `magic-group.vue:6-7` |
| FR-082 | 系统 MUST 提供保存按钮，点击触发分组保存 | `magic-group.vue:8,156-171` |
| FR-083 | 系统 MUST 提供两个子页签：路径变量、分组选项 | `magic-group.vue:11-13,107` |
| FR-084 | 路径变量页 MUST 以表格形式展示，列包括：Key、Value、参数类型、验证方式、表达式、验证说明、Description | `magic-group.vue:21-29` |
| FR-085 | 分组选项页 MUST 以表格形式展示，列包括：键（可搜索下拉）、值、描述 | `magic-group.vue:59-82` |
| FR-086 | 分组选项的键 MUST 支持从后端 `/options` 接口加载可选项 | `magic-group.vue:130-139` |
| FR-087 | 选择分组选项时 MUST 自动填充描述和默认值 | `magic-group.vue:142-154` |
| FR-088 | 保存 MUST 调用 `POST group/update` 接口（JSON 格式） | `magic-group.vue:167` |
| FR-089 | 保存成功后 MUST 发射 `update-group` 事件通知资源树刷新 | `magic-group.vue:168` |
| FR-090 | 保存成功后 MUST 发射 `report` 事件埋点（`group_update`） | `magic-group.vue:169` |
| FR-091 | 保存时 MUST 过滤掉 name 为空的路径变量和选项 | `magic-group.vue:164-165` |

### 3.7 接口选项面板（MagicOption）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-100 | 系统 MUST 以表格形式展示接口选项，列包括：键（可搜索下拉）、值、描述 | `magic-option.vue:9-13` |
| FR-101 | 选项键 MUST 支持从后端 `/options` 接口加载可选项 | `magic-option.vue:56-66` |
| FR-102 | 选择选项时 MUST 自动填充描述和默认值 | `magic-option.vue:69-81` |
| FR-103 | 系统 MUST 支持通过 +/− 按钮增删选项行 | `magic-option.vue:5-6,83-103` |

### 3.8 运行日志面板（MagicLog）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-110 | 系统 MUST 在收到 `ws_log` WebSocket 事件时追加日志 | `magic-log.vue:28` |
| FR-111 | 日志内容 MUST 进行 HTML 转义以防止 XSS | `magic-log.vue:36-39` |
| FR-112 | 日志 MUST 对时间戳 + 日志级别进行语法高亮 | `magic-log.vue:40` |
| FR-113 | 日志中的 URL MUST 渲染为可点击链接 | `magic-log.vue:42` |
| FR-114 | 日志中的 Java 堆栈 `at` 行 MUST 对文件位置添加下划线样式 | `magic-log.vue:44` |
| FR-115 | 超过 3 行的日志 MUST 默认折叠，提供"点击显示/隐藏"切换 | `magic-log.vue:46-51,6-8` |
| FR-116 | 新日志追加后 MUST 自动滚动到底部 | `magic-log.vue:52-53` |
| FR-117 | 系统 MUST 支持右键菜单清空日志 | `magic-log.vue:55-63` |

### 3.9 调试信息面板（MagicDebug）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-120 | 系统 MUST 提供继续（F8）和单步（F6）两个操作按钮 | `magic-debug.vue:4-8` |
| FR-121 | 继续/单步按钮在非调试态 MUST 显示为禁用 | `magic-debug.vue:4-6,48-49` |
| FR-122 | 点击继续 MUST 发射 `doContinue` bus 事件 | `magic-debug.vue:4` |
| FR-123 | 点击单步 MUST 发射 `doStepInto` bus 事件 | `magic-debug.vue:6` |
| FR-124 | 系统 MUST 以表格形式展示调试变量，列包括：变量名、变量值、变量类型 | `magic-debug.vue:11-27` |
| FR-125 | 变量值 MUST 使用 MagicStructure 组件进行结构化展示 | `magic-debug.vue:24` |
| FR-126 | 无变量时 MUST 显示 "no message." 占位文本 | `magic-debug.vue:19-21` |
| FR-127 | 调试态 MUST 从 `info.ext.debuging` 读取 | `magic-debug.vue:48-49` |
| FR-128 | 变量列表 MUST 从 `info.ext.variables` 读取 | `magic-debug.vue:51-52` |

---

## 4. 非功能需求

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-001 | 性能 | Monaco Body 编辑器 MUST 懒加载（仅在首次切换到 Body 页签时创建） | `magic-request.vue:342-343` |
| NFR-002 | 性能 | Monaco 编辑器 MUST 禁用小地图（`minimap.enabled: false`） | `magic-request.vue:346-348`、`magic-run.vue:104-106` |
| NFR-003 | 可用性 | 底部面板高度 MUST 支持拖拽调整，最小 150px | `magic-options.vue:115` |
| NFR-004 | 可用性 | 日志内容 MUST 进行 HTML 转义（`& < >`）以防止 XSS | `magic-log.vue:36-39` |
| NFR-005 | 可用性 | 参数表格行 MUST 在获得焦点时显示视觉高亮（`focus` 样式类） | `magic-request.vue:40,87,130` |
| NFR-006 | 兼容性 | 编辑器主题 MUST 跟随全局 `store.get('skin')` 设置 | `magic-request.vue:357`、`magic-run.vue:118` |
| NFR-007 | 可配置性 | 编辑器字体族/字号 MUST 使用 `contants.EDITOR_FONT_FAMILY` / `EDITOR_FONT_SIZE` | `magic-request.vue:354-355` |
| NFR-008 | 性能 | Body 编辑器内容变更 MUST 通过 `parseJson()` 增量解析，避免全量重绘 | `magic-request.vue:379-383` |
| NFR-009 | 可用性 | 响应为二进制且含 `content-disposition` 时 MUST 自动触发下载而非展示 | `magic-run.vue:86-95` |

---

## 5. 关键实体

| 实体 | 描述 | 关键属性 |
|---|---|---|
| **API 接口对象（info）** | 当前选中的 API 接口数据 | `method`, `name`, `path`, `parameters[]`, `headers[]`, `paths[]`, `requestBody`, `requestBodyDefinition`, `responseBody`, `responseBodyDefinition`, `description`, `option[]`, `ext{debuging,variables,sessionId,requestConfig,decorations}` |
| **参数行（parameter/header/path）** | 参数表格中的一行 | `name`, `value`, `dataType`, `defaultValue`, `validateType`, `expression`, `error`, `description`, `required` |
| **函数对象（info）** | 当前选中的 Function 数据 | `name`, `path`, `returnType`, `parameters[]`, `description` |
| **分组对象（info）** | 当前选中的 API 分组 | `id`, `name`, `path`, `paths[]`, `options[]` |
| **选项行（option）** | 选项表格中的一行 | `name`, `value`, `description` |
| **事件日志条目** | 事件面板中的一行 | `timestamp`, `content` |
| **运行日志条目** | 日志面板中的一行 | `html`, `multiple`, `lines`, `showMore` |
| **调试变量** | 调试面板中的一行 | `name`, `value`, `type` |
| **Tab 配置对象** | 底部面板的 Tab 定义 | `id`, `name`, `icon`, `component`, `right?` |

---

## 6. 接受场景

### 场景 1：编辑 API 请求参数

- Given 用户在资源树中选中一个 API 接口
- When 底部面板显示"接口信息"Tab
- Then 用户可在"请求参数"页编辑参数行，在"请求 Header"页编辑 Header，在"路径变量"页编辑路径变量，在"请求 Body"页编辑 JSON 请求体

### 场景 2：测试接口并查看结果

- Given 用户已编辑好请求参数
- When 用户按 Ctrl+Q 或点击"运行"按钮
- Then 系统切换到"运行日志"Tab 显示实时日志，测试完成后切换到"执行结果"Tab 展示响应体

### 场景 3：断点命中调试

- Given 用户在编辑器中设置了断点并执行测试
- When 后端响应 `code=1000`（命中断点）
- Then 系统切换到"调试信息"Tab，展示当前变量名/值/类型，用户可点击继续或单步

### 场景 4：保存分组配置

- Given 用户在资源树中选中一个分组
- When 底部面板显示"分组信息"Tab
- Then 用户可编辑分组名称/路径/路径变量/分组选项，点击"保存"按钮后调用 `POST group/update`

### 场景 5：二进制响应下载

- Given 接口返回二进制数据且响应头包含 `content-disposition`
- When 测试完成
- Then 系统自动下载文件而非在 iframe 中展示

### 场景 6：Body JSON 编辑器保留元数据

- Given 用户已在 Body 中定义了字段验证规则和默认值
- When 用户修改 Body JSON 结构（增删字段）
- Then 系统通过 `valueCopy()` 保留同名字段的验证规则/默认值/描述

---

## 7. 假设与约束

### 7.1 假设

- A-001：`info.parameters` / `info.headers` / `info.paths` 等属性在接口打开时已初始化为数组（由 001-editor-core 在 `open()` 中注入）
- A-002：后端 `/options` 接口返回格式为 `[[选项名, 描述, 默认值], ...]` 的二维数组
- A-003：`contants.OPTIONS` 数组提供前端内置的选项列表（`magic-group.vue:133`、`magic-option.vue:59`）
- A-004：分组路径变量在测试调用时由 001-editor-core 通过 `this.$parent.$refs.apiList.getGroupsById()` 读取并替换 URL（`magic-script-editor.vue:566-571`）

### 7.2 约束

- C-001：所有面板组件均为 Options API 风格（`export default { data/mounted/methods }`）
- C-002：面板组件不直接发起 HTTP 请求（除 MagicGroup 的保存和 MagicOption/MagicGroup 的 `/options` 加载外），测试调用由 001-editor-core 统一发起
- C-003：跨组件通信统一使用 EventBus（constitution 第四条）
- C-004：Body 编辑器使用 monaco-editor 的 `esm/vs/editor/editor.api` 直接创建实例，非通过 Vue 组件封装

---

## 8. 依赖

### 8.1 上游依赖

| 模块 | 依赖内容 | 性质 |
|---|---|---|
| **001-editor-core** | `info` 对象（API/Function 数据）、`doTest` 触发测试调用、`switch-tab` 事件 | 消费 + 被消费 |
| **003-resources-api** | `api-group-selected` 事件（分组选中）、`update-group` 事件（分组刷新） | 消费 + 被消费 |
| **014-infra-transport** | `request.send()` HTTP 请求（`/options`、`group/update`） | 消费 |
| **015-infra-bus-store** | `bus` EventBus、`contants`（Header 常量/字体/业务码）、`store`（localStorage） | 消费 |
| **016-common-ui** | `MagicInput`、`MagicSelect`、`MagicCheckbox`、`MagicFile`、`MagicTextarea`、`MagicJson`、`MagicBottomPanel`、`MagicStructure`、`$magicAlert`、`$magicContextmenu` | 消费 |

### 8.2 下游消费者

| 模块 | 消费内容 | 性质 |
|---|---|---|
| **001-editor-core** | 读取 `info.parameters` / `info.headers` / `info.paths` / `info.requestBody` 拼装测试请求 | 被消费 |
| **001-editor-core** | 通过 `switch-tab` 事件切换到请求/日志/结果面板 | 被消费 |
| **009-layout-debug** | 共享 `info.ext.debuging` / `info.ext.variables` 调试状态 | 被消费 |
| **010-layout-options** | MagicOptions 容器同时管理本模块所有子面板的 Tab 切换 | 被消费 |

### 8.3 总线事件清单

#### 本模块发射（emit）的事件

| 事件 | 触发时机 | 参数 | 源码位置 |
|---|---|---|---|
| `status` | 保存分组成功 | 状态文案 | `magic-group.vue:166,170` |
| `update-group` | 分组保存成功 | 无 | `magic-group.vue:168` |
| `report` | 分组保存埋点 | `'group_update'` | `magic-group.vue:169` |
| `doContinue` | 调试面板点击继续 | 无 | `magic-debug.vue:4` |
| `doStepInto` | 调试面板点击单步 | 无 | `magic-debug.vue:6` |
| `update-window-size` | 面板高度/Tab 变化 | 无 | `magic-options.vue:105,119,127,132` |

#### 本模块监听（on）的事件

| 事件 | 来源 | 处理 | 源码位置 |
|---|---|---|---|
| `opened` | 001-editor-core | 更新 `info` 数据，切换 Tab 集合，广播 body/response 事件 | `magic-options.vue:68-92` |
| `api-group-selected` | 003-resources-api | 切换到分组 Tab 集合 | `magic-options.vue:62-67` |
| `switch-tab` | 001-editor-core / 主组件 | 切换到指定子页签 | `magic-options.vue:93-106` |
| `update-request-body` | 内部（MagicRequest） | 更新 Body 编辑器内容 | `magic-request.vue:268-271` |
| `update-request-body-definition` | 内部 / 001-editor-core | 更新 Body 结构化定义 | `magic-request.vue:273-275` |
| `update-response-body` | 001-editor-core | 更新响应体与响应头 | `magic-run.vue:70-79` |
| `update-response-body-definition` | 001-editor-core | 更新响应结构定义 | `magic-run.vue:80-82` |
| `update-response-blob` | 001-editor-core | 处理二进制响应 | `magic-run.vue:83-99` |
| `ws_log` | WebSocket | 追加运行日志 | `magic-log.vue:28` |
| `status` | 全局 bus | 刷新事件列表 | `magic-event.vue:38-42` |
| `update-window-size` | 全局 bus | 重排 Monaco 编辑器 | `magic-request.vue:371`、`magic-run.vue:120` |

---

## 9. HTTP 端点清单

> 以下端点均为 `baseURL` 前缀下的相对路径。

| 方法 | 路径 | 用途 | 请求体 | 源码位置 |
|---|---|---|---|---|
| GET | `options` | 加载接口/分组可选项列表 | 无 | `magic-group.vue:131`、`magic-option.vue:58` |
| POST | `group/update` | 保存分组配置 | JSON: `{id, name, path, paths[], options[]}` | `magic-group.vue:167` |

> 注：`group/update` 通过 `requestGroup()` 工具函数发起，使用 `Content-Type: application/json`（`utils.js:45-61`）。

---

## 10. 测试调用 Header 详解

本节描述 001-editor-core 在发起测试调用（`sendTestRequest()`）时注入的自定义 Header，这些 Header 的值由本模块的面板数据参与构建。

### 10.1 `Magic-Request-Session`

- **常量名**：`contants.HEADER_REQUEST_SESSION`（`contants.js:13`）
- **值来源**：`info.ext.sessionId`，由 `internalTest()` 生成（时间戳 + 4 位随机数）（`magic-script-editor.vue:626`）
- **用途**：标识一次测试调用的唯一会话，后端用于关联调试上下文
- **关联 WS 消息**：生成后通过 `bus.$emit('message', 'set_session_id', sessionId)` 通知 WebSocket 层（`magic-script-editor.vue:627`）

### 10.2 `Magic-Request-Breakpoints`

- **常量名**：`contants.HEADER_REQUEST_BREAKPOINTS`（`contants.js:14`）
- **值来源**：编辑器中所有断点装饰的行号，以逗号分隔（`magic-script-editor.vue:702-707`）
- **获取方式**：`editor.getModel().getAllDecorations().filter(it => it.options.linesDecorationsClassName === 'breakpoints').map(it => it.range.startLineNumber).join(',')`
- **用途**：告知后端需要在哪些行设置断点

### 10.3 `ma-content-type`

- **常量名**：`contants.HEADER_RESPONSE_MAGIC_CONTENT_TYPE`（`contants.js:15`）
- **方向**：响应 Header（后端 → 前端）
- **用途**：标识后端实际响应内容类型，前端用于决定展示方式（JSON 文本 vs 二进制）
- **前端处理**：在 `sendTestRequest()` 的 `transformResponse` 中，通过 `res.headers['content-type']` 读取标准 Content-Type，结合 `ma-content-type` 判断响应类型（`magic-script-editor.vue:744`）

### 10.4 `ma-content-disposition`

- **常量名**：`contants.HEADER_CONTENT_DISPOSITION`（`contants.js:17`）
- **方向**：响应 Header（后端 → 前端）
- **用途**：文件下载时的文件名元数据
- **前端处理**：
  - 在 `sendTestRequest()` 的 `transformResponse` 中，若存在 `content-disposition` 则直接返回 Blob（`magic-script-editor.vue:714-715`）
  - 在 MagicRun 组件中，解析 `content-disposition` 提取文件名并触发下载（`magic-run.vue:87-94`）

### 10.5 测试调用完整 Header 注入流程

```
1. internalTest() 创建 requestConfig.headers = {}
2. 从 info.headers 填充用户自定义 Header
3. 若存在 FileList 参数 → Content-Type = multipart/form-data
4. 若存在 requestBody → Content-Type = application/json
5. 否则 → Content-Type = application/x-www-form-urlencoded
6. sendTestRequest() 注入:
   - Magic-Request-Session = sessionId
   - magic-token = HEADER_MAGIC_TOKEN_VALUE
   - Magic-Request-Breakpoints = 断点行号(逗号分隔)
7. mergeGlobalSettings() 注入全局 Header 和参数
8. request.execute(requestConfig) 发起请求
   → request.js 自动注入 magic-token Header（request.js:112）
```

### 10.6 业务码语义

| code | 语义 | 处理 | 源码位置 |
|---|---|---|---|
| `1` | 成功 | 正常展示响应 | `request.js:147` |
| `1000` | 断点命中（`RESPONSE_CODE_DEBUG`） | 进入调试态，展示变量 | `contants.js:23` |
| `-1000` | 脚本错误（`RESPONSE_CODE_SCRIPT_ERROR`） | 展示错误信息 | `contants.js:24` |
| `-10` | 无权限（`RESPONSE_NO_PERMISSION`） | 提示权限不足 | `contants.js:25` |

---

## 11. 与其他模块的边界

### 11.1 与 001-editor-core 的边界

- **001-editor-core 负责**：发起 HTTP 测试调用、拼装完整 requestConfig（URL 路径变量替换、Header 注入、断点行号、Session ID）、处理响应并分发到各面板
- **本模块负责**：提供参数编辑 UI（`info.parameters` / `info.headers` / `info.paths` / `info.requestBody`），001-editor-core 直接读取这些属性
- **交互方式**：
  - 001-editor-core 通过 `bus.$emit('switch-tab', 'request')` 切换到请求面板（`magic-script-editor.vue:537`）
  - 001-editor-core 通过 `bus.$emit('update-response-body', ...)` / `update-response-blob` / `update-response-body-definition` 将测试结果推送至本模块
  - 双方共享同一 `info` 对象（通过 `v-model:info` 传递），无额外数据拷贝
- **边界清晰点**：本模块不发起测试请求，不处理响应解析；001-editor-core 不渲染参数编辑 UI

### 11.2 与 003-resources-api 的边界

- **003-resources-api 负责**：在用户点击分组节点时发射 `api-group-selected` 事件
- **本模块负责**：监听该事件以切换到分组 Tab 集合（`magic-options.vue:62-67`）
- **交互方式**：纯 bus 事件通信
- **边界清晰点**：本模块不渲染资源树，不处理分组 CRUD（除 MagicGroup 的保存外）

### 11.3 与 004-resources-function 的边界

- **004-resources-function 负责**：函数资源树的浏览与管理
- **本模块负责**：当函数被选中时，通过 `opened` 事件接收函数数据并切换到函数 Tab（`magic-options.vue:85-90`）
- **边界清晰点**：本模块仅展示函数参数编辑 UI，不处理函数资源的 CRUD

### 11.4 与 009-layout-debug 的边界

- **本模块负责**：MagicDebug 组件展示调试变量表格 + 继续/单步按钮
- **009-layout-debug 负责**：[NEEDS CLARIFICATION: 当前 magic-debug.vue 已包含调试面板的完整实现（变量表格 + 按钮），与 009-layout-debug 模块的边界需要确认——是否 009 模块仅包含调用堆栈/控制台等其他调试 UI，而变量展示归本模块？]
- **共享数据**：`info.ext.debuging`（调试态标志）、`info.ext.variables`（变量列表）
- **交互方式**：通过 `bus.$emit('switch-tab', 'debug')` 切换到调试面板

### 11.5 与 010-layout-options 的边界

- **本模块的 MagicOptions 组件**同时是底部面板的容器管理者，负责 Tab 集合的动态切换
- **010-layout-options 模块**涵盖 MagicSettings（全局参数）、MagicSearch（全局搜索）、MagicTodo（待办事项）等面板
- **边界清晰点**：MagicOptions 是容器组件，同时注册本模块和 010 模块的子面板 Tab；两者通过 `tabs` 数组的拼接实现共存（`magic-options.vue:62,91`）

---

## 12. 待澄清

| ID | 位置 | 描述 |
|---|---|---|
| NC-001 | `magic-debug.vue` vs 009-layout-debug | MagicDebug 组件（变量表格 + 继续/单步按钮）物理位于本模块目录，但按模块命名约定"layout-debug"应归 009 模块。当前归类依据是 SPECS_CHECKLIST.md 的模块范围定义（008 包含 debug/event/group），需确认是否应调整模块边界 |
| NC-002 | `magic-log.vue` vs 009-layout-debug | MagicLog 组件同理，按命名应归 009 模块，但当前按 SPECS_CHECKLIST 归入 008 |
| NC-003 | `magic-settings.vue` | 全局参数面板未在本模块详细分析（归类于 010-layout-options），但其 Tab 注册在 MagicOptions 的 `commonTabs` 中，需确认是否需要在 010 模块 spec 中补充 |

---

## 附录：源码引用清单

| 文件 | 行号范围 | 引用说明 |
|---|---|---|
| `src/components/layout/magic-options.vue` | 1-16 | 模板：底部容器 + 分隔条 + Tab 栏 |
| `src/components/layout/magic-options.vue` | 18-60 | import + 组件定义 + Tab 配置（apiTabs/functionTabs/apiGroupTabs/commonTabs） |
| `src/components/layout/magic-options.vue` | 61-107 | mounted 钩子：bus 事件订阅（api-group-selected / opened / switch-tab） |
| `src/components/layout/magic-options.vue` | 111-134 | 分隔条拖拽 + watch selectedTab |
| `src/components/layout/magic-request.vue` | 1-176 | 模板：请求方法/名称/路径 + 五类参数子页签 |
| `src/components/layout/magic-request.vue` | 178-257 | import + 组件定义 + data（navs/options/types/validates 等） |
| `src/components/layout/magic-request.vue` | 259-276 | watch requestBody + mounted bus 事件订阅 |
| `src/components/layout/magic-request.vue` | 278-341 | 方法：layout / addRow / removeRow |
| `src/components/layout/magic-request.vue` | 342-413 | 方法：initRequestBodyDom / updateRequestBody / valueCopy |
| `src/components/layout/magic-request.vue` | 414-429 | destroyed 钩子 + 样式 |
| `src/components/layout/magic-run.vue` | 1-25 | 模板：三个子页签（Body/响应Header/响应结构） |
| `src/components/layout/magic-run.vue` | 27-56 | import + 组件定义 + data |
| `src/components/layout/magic-run.vue` | 57-100 | watch responseBody + updated + mounted bus 事件订阅 |
| `src/components/layout/magic-run.vue` | 101-176 | 方法：createEditor / layout / updateSize / updateResponseBody / valueCopy |
| `src/components/layout/magic-run.vue` | 177-223 | destroyed 钩子 + 样式 |
| `src/components/layout/magic-function.vue` | 1-51 | 模板：返回值/名称/路径 + 函数参数/描述子页签 |
| `src/components/layout/magic-function.vue` | 53-81 | import + 组件定义 + data |
| `src/components/layout/magic-function.vue` | 82-117 | 方法：addRow / removeRow + 样式 |
| `src/components/layout/magic-event.vue` | 1-21 | 模板：事件列表表格 + 清空按钮 |
| `src/components/layout/magic-event.vue` | 23-51 | import + 组件定义 + mounted / methods + 样式 |
| `src/components/layout/magic-group.vue` | 1-86 | 模板：分组名称/路径/保存 + 路径变量/分组选项子页签 |
| `src/components/layout/magic-group.vue` | 88-128 | import + 组件定义 + data |
| `src/components/layout/magic-group.vue` | 129-140 | mounted：加载 /options 列表 |
| `src/components/layout/magic-group.vue` | 141-217 | 方法：onSelect / doSave / addRow / removeRow |
| `src/components/layout/magic-option.vue` | 1-32 | 模板：选项表格 + 增删按钮 |
| `src/components/layout/magic-option.vue` | 34-67 | import + 组件定义 + mounted 加载 /options |
| `src/components/layout/magic-option.vue` | 68-116 | 方法：onSelect / addRow / removeRow + 样式 |
| `src/components/layout/magic-log.vue` | 1-12 | 模板：日志列表 + 折叠/展开 |
| `src/components/layout/magic-log.vue` | 14-30 | import + 组件定义 + mounted 订阅 ws_log |
| `src/components/layout/magic-log.vue` | 31-66 | 方法：onLogReceived / onContextMenu + 样式 |
| `src/components/layout/magic-debug.vue` | 1-31 | 模板：继续/单步按钮 + 变量表格 |
| `src/components/layout/magic-debug.vue` | 33-56 | import + 组件定义 + computed（debuging / variables） |
| `src/components/layout/magic-debug.vue` | 57-134 | 样式 |
| `src/scripts/bus.js` | 1-57 | EventBus 实现 + statusLog + cnzz 统计 |
| `src/scripts/contants.js` | 1-36 | 全局常量定义（Header 名 / 业务码 / 字体等） |
| `src/api/request.js` | 1-194 | HTTP 请求封装（axios + Qs + HttpResponse） |
| `src/scripts/utils.js` | 45-61 | `requestGroup()` 工具函数（JSON 格式 POST） |
| `src/components/editor/magic-script-editor.vue` | 528-766 | doTest / internalTest / sendTestRequest（测试调用完整流程） |
