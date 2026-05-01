# API 资源树模块规范（spec.md）

> Module: 003-resources-api
> Status: Implemented
> Last Updated: 2026-05-01
> 对应源码: `src/components/resources/magic-api-list.vue` (982 行)
> 对应样式: `src/components/resources/magic-resource.css` (109 行)

---

## 1. 模块概述

### 1.1 目的

本模块提供 **API 接口资源的树形浏览与管理** 能力，是 magic-editor 左侧资源栏的核心组件之一。用户通过该组件浏览、搜索、组织、操作后端 magic-api 所管理的全部 API 接口及其分组。

### 1.2 解决的问题

- 后端 API 接口数量可能很多，需要以**树形分组结构**进行可视化组织
- 用户需要快速**定位**某个接口并在编辑器中打开
- 用户需要对接口/分组执行 **CRUD、复制、移动、锁定、导出** 等管理操作
- 需要支持**拖拽移动**接口到不同分组
- 需要与编辑器主面板**联动**（点击接口 → 编辑器打开对应脚本）

### 1.3 范围

**包含**：
- API 资源树的加载、渲染、搜索、排序
- 接口/分组的 CRUD 操作（新建、修改、删除）
- 接口复制（同组 / 跨组）、分组复制
- 拖拽移动接口/分组
- 接口锁定/解锁
- 接口路径复制（绝对/相对）
- 接口/分组右键菜单
- 与编辑器的联动（打开接口、定位接口）
- 快捷键（Alt+G 新建分组）

**不包含**：
- 接口脚本的编辑（由 001-editor-core 负责）
- 函数资源树（由 004-resources-function 负责）
- 数据源管理（由 005-resources-datasource 负责）
- 最近打开列表（由 006-resources-recent 负责）
- 分组选择对话框的内部实现（由 006-resources-recent 负责，本模块仅消费）

---

## 2. 用户故事

| ID | 用户故事 | 源码位置 |
|---|---|---|
| US-001 | 作为开发者，我能在左侧树中看到所有 API 接口及其分组，以便快速浏览 | `magic-api-list.vue:195-213` |
| US-002 | 作为开发者，我能通过关键字搜索接口名称/路径/分组名，以便快速定位 | `magic-api-list.vue:176-188` |
| US-003 | 作为开发者，我能点击接口节点在编辑器中打开该接口脚本，以便编辑 | `magic-api-list.vue:189-193` |
| US-004 | 作为开发者，我能右键点击接口/分组弹出操作菜单，以便执行管理操作 | `magic-api-list.vue:333-544` |
| US-005 | 作为开发者，我能拖拽接口到不同分组，以便重新组织接口结构 | `magic-api-list.vue:809-889` |
| US-006 | 作为开发者，我能拖拽分组到另一个分组下，以便调整分组层级 | `magic-api-list.vue:826-862` |
| US-007 | 作为开发者，我能新建/修改/删除分组，以便管理接口分类 | `magic-api-list.vue:606-704` |
| US-008 | 作为开发者，我能复制接口到同组或跨组，以便快速创建相似接口 | `magic-api-list.vue:456-567` |
| US-009 | 作为开发者，我能复制整个分组到目标位置，以便复用分组结构 | `magic-api-list.vue:569-576` |
| US-010 | 作为开发者，我能锁定/解锁接口，以便防止误修改重要接口 | `magic-api-list.vue:504-519` |
| US-011 | 作为开发者，我能复制接口的绝对/相对路径到剪贴板，以便分享给他人调用 | `magic-api-list.vue:707-721` |
| US-012 | 作为开发者，我能导出分组下所有接口为 zip 文件，以便备份或迁移 | `magic-api-list.vue:426-439` |
| US-013 | 作为开发者，我能通过 Alt+G 快捷键快速新建分组 | `magic-api-list.vue:975` |
| US-014 | 作为开发者，我能切换树节点的排序方式（升序/降序/原始），以便按偏好浏览 | `magic-api-list.vue:294-331` |
| US-015 | 作为开发者，我能一键折叠/展开所有树节点 | `magic-api-list.vue:268-293` |

---

## 3. 功能需求

### 3.1 资源树加载与渲染

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-001 | 系统 MUST 在初始化时并行请求分组列表（`GET group/list?type=1`）和接口列表（`GET list`） | `magic-api-list.vue:195-213` |
| FR-003-002 | 系统 MUST 将扁平的分组+接口数据组装为嵌套树结构，分组节点在前、接口节点在后 | `magic-api-list.vue:215-266` |
| FR-003-003 | 系统 MUST 为每个树节点计算 `level`（缩进层级）、`tmpName`（完整路径名）、`tmpPath`（完整路径前缀） | `magic-api-list.vue:215-266` |
| FR-003-004 | 系统 MUST 在数据加载期间显示 loading 状态，加载完成后隐藏 | `magic-api-list.vue:197,207` |
| FR-003-005 | 系统 MUST 默认展开所有分组节点（由 `contants.DEFAULT_EXPAND` 控制） | `magic-api-list.vue:221` |
| FR-003-006 | 系统 MUST 在无数据时显示"无数据"提示（由 MagicTree 组件提供） | `magic-tree.vue:20` |

### 3.2 搜索

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-010 | 系统 MUST 支持在搜索框输入关键字实时过滤树节点 | `magic-api-list.vue:4-5,176-188` |
| FR-003-011 | 搜索 MUST 匹配分组名称、接口名称、接口路径（含完整分组前缀） | `magic-api-list.vue:181-183` |
| FR-003-012 | 搜索匹配时，若子节点匹配则其父分组 MUST 保持可见 | `magic-api-list.vue:181` |
| FR-003-013 | 不匹配的节点 MUST 通过 `_searchShow=false` 隐藏（CSS `v-if` 控制） | `magic-api-list.vue:28,52` |
| FR-003-014 | 搜索 MUST 忽略大小写 | `magic-api-list.vue:177` |

### 3.3 接口打开与编辑器联动

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-020 | 系统 MUST 在用户点击接口节点时，通过 bus 发射 `open` 事件携带接口数据 | `magic-api-list.vue:189-193` |
| FR-003-021 | 系统 MUST 在用户点击接口节点时，通过 bus 发射 `status` 事件记录状态日志 | `magic-api-list.vue:190` |
| FR-003-022 | 系统 MUST 高亮当前选中的接口节点（`ma-tree-select` 样式类） | `magic-api-list.vue:53` |
| FR-003-023 | 系统 MUST 响应 bus 事件 `opened` 以同步当前打开的接口项 | `magic-api-list.vue:959-961` |
| FR-003-024 | 系统 MUST 响应 bus 事件 `position-api` 以定位并打开指定 ID 的接口 | `magic-api-list.vue:920-924` |
| FR-003-025 | 系统 MUST 响应 bus 事件 `delete-api` 以触发接口删除流程 | `magic-api-list.vue:962-964` |
| FR-003-026 | 系统 MUST 响应 bus 事件 `refresh-resource` 以重新加载全部数据 | `magic-api-list.vue:965-967` |
| FR-003-027 | 系统 MUST 响应 bus 事件 `update-group` 以重建分组树结构 | `magic-api-list.vue:968-972` |
| FR-003-028 | 系统 MUST 在用户点击分组节点时，通过 bus 发射 `api-group-selected` 事件 | `magic-api-list.vue:36` |

### 3.4 接口 CRUD

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-030 | 系统 MUST 支持在分组右键菜单中"新建接口"，创建临时接口节点并自动打开 | `magic-api-list.vue:338-365` |
| FR-003-031 | 新建接口 MUST 生成唯一 `tmp_id`（时间戳+随机数），`id` 为空表示未保存 | `magic-api-list.vue:343` |
| FR-003-032 | 系统 MUST 支持删除接口，已保存接口调用 `POST delete` 接口，未保存接口仅从树中移除 | `magic-api-list.vue:579-603` |
| FR-003-033 | 删除接口前 MUST 弹出确认框 | `magic-api-list.vue:581-583` |
| FR-003-034 | 删除接口后 MUST 通知编辑器关闭对应 tab（通过设置 `delete=true` 并触发 `open` 事件） | `magic-api-list.vue:590-591` |

### 3.5 分组 CRUD

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-040 | 系统 MUST 支持新建分组，通过弹窗输入分组名称和前缀 | `magic-api-list.vue:606-659` |
| FR-003-041 | 新建分组 MUST 校验名称非空 | `magic-api-list.vue:623-626` |
| FR-003-042 | 新建分组 MUST 调用 `POST group/create`，返回新分组 ID | `magic-api-list.vue:641` |
| FR-003-043 | 修改分组 MUST 调用 `POST group/update` | `magic-api-list.vue:629` |
| FR-003-044 | 删除分组 MUST 调用 `POST group/delete`，并递归通知编辑器关闭该分组下所有接口 tab | `magic-api-list.vue:676-704` |
| FR-003-045 | 删除分组前 MUST 弹出确认框 | `magic-api-list.vue:678-680` |
| FR-003-046 | 新建/修改分组后 MUST 自动滚动到新分组位置（锚点定位） | `magic-api-list.vue:635,651` |

### 3.6 复制

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-050 | 系统 MUST 支持复制接口（同组），复制品名称追加"(复制)"后缀 | `magic-api-list.vue:456-473` |
| FR-003-051 | 复制接口前 MUST 校验接口已保存（`id` 非空），否则提示"请先保存在复制！" | `magic-api-list.vue:459-462` |
| FR-003-052 | 系统 MUST 支持"复制接口到..."，弹出分组选择对话框选择目标分组 | `magic-api-list.vue:476-486,546-567` |
| FR-003-053 | 系统 MUST 支持复制分组，弹出分组选择对话框选择目标位置 | `magic-api-list.vue:390-396,569-576` |
| FR-003-054 | 复制分组 MUST 调用 `POST group/copy` 携带 `src` 和 `target` 参数 | `magic-api-list.vue:573` |

### 3.7 拖拽移动

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-060 | 系统 MUST 支持拖拽接口节点到分组节点，移动后调用 `POST api/move` | `magic-api-list.vue:863-886` |
| FR-003-061 | 系统 MUST 支持拖拽分组节点到另一个分组节点，移动后调用 `POST group/update` | `magic-api-list.vue:826-862` |
| FR-003-062 | 拖拽分组时 MUST 检测不能移入自己的子分组（防止循环引用） | `magic-api-list.vue:829-841` |
| FR-003-063 | 拖拽接口到同一分组时 MUST 不执行任何操作 | `magic-api-list.vue:866` |
| FR-003-064 | 拖拽目标 MUST 为分组类型（`folder=true`），拖拽到接口节点无效 | `magic-api-list.vue:824` |
| FR-003-065 | 拖拽过程中 MUST 在目标节点上显示视觉反馈（红色边框） | `magic-resource.css:23-25` |
| FR-003-066 | 移动成功后 MUST 自动滚动到移动后的节点位置 | `magic-api-list.vue:856,881` |

### 3.8 锁定/解锁

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-070 | 系统 MUST 支持锁定接口，调用 `POST lock` 携带接口 ID | `magic-api-list.vue:509` |
| FR-003-071 | 系统 MUST 支持解锁接口，调用 `POST unlock` 携带接口 ID | `magic-api-list.vue:509` |
| FR-003-072 | 锁定状态 MUST 在树节点上显示锁图标（`ma-icon-lock`） | `magic-api-list.vue:69` |
| FR-003-073 | 锁定/解锁操作 MUST 通过 bus 发射 `report` 事件埋点 | `magic-api-list.vue:512` |

### 3.9 路径复制

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-080 | 系统 MUST 支持复制接口绝对路径（`SERVER_URL + groupPath + path`） | `magic-api-list.vue:707-721` |
| FR-003-081 | 系统 MUST 支持复制接口相对路径（仅 `groupPath + path`） | `magic-api-list.vue:707-721` |
| FR-003-082 | 路径复制 MUST 使用 `document.execCommand('copy')` 写入剪贴板 | `magic-api-list.vue:710-716` |
| FR-003-083 | 路径复制失败 MUST 弹出包含路径内容的提示框 | `magic-api-list.vue:719` |
| FR-003-084 | 路径 MUST 经过 `replaceURL` 处理以规范化连续斜杠 | `magic-api-list.vue:708` |

### 3.10 导出

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-090 | 系统 MUST 支持导出分组下所有接口为 zip 文件 | `magic-api-list.vue:426-439` |
| FR-003-091 | 导出 MUST 调用 `GET /download?groupId=<id>`，响应类型为 blob | `magic-api-list.vue:430-434` |
| FR-003-092 | 导出文件名 MUST 为 `<分组名称>.zip` | `magic-api-list.vue:436` |

### 3.11 排序与折叠

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-100 | 系统 MUST 支持切换排序方式：升序 → 降序 → 原始（null） | `magic-api-list.vue:294-297` |
| FR-003-101 | 排序 MUST 保证分组节点始终在接口节点之前 | `magic-api-list.vue:299-329` |
| FR-003-102 | 排序 MUST 使用 `localeCompare('zh-CN')` 以支持中文拼音排序 | `magic-api-list.vue:304` |
| FR-003-103 | 系统 MUST 支持一键折叠所有分组（`rebuildTree(true)`） | `magic-api-list.vue:268-293` |
| FR-003-104 | 双击分组节点 MUST 切换展开/折叠状态 | `magic-api-list.vue:37` |

### 3.12 右键菜单

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-110 | 系统 MUST 在分组节点右键时显示分组操作菜单（新建接口、刷新、新建分组、修改分组、复制分组、删除分组、移动到根节点、导出） | `magic-api-list.vue:333-448` |
| FR-003-111 | 系统 MUST 在接口节点右键时显示接口操作菜单（复制接口、复制接口到...、复制路径、复制相对路径、锁定/解锁、刷新接口、删除接口） | `magic-api-list.vue:451-544` |
| FR-003-112 | 右键菜单 MUST 使用 016-common-ui 的 `$magicContextmenu` 组件 | `magic-api-list.vue:335,453` |
| FR-003-113 | 右键菜单关闭后 MUST 清除节点的 `selectRightItem` 高亮状态 | `magic-api-list.vue:344-346,540-542` |

### 3.13 快捷键

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-120 | 系统 MUST 在 `.ma-container` 元素上注册 Alt+G 快捷键以打开新建分组弹窗 | `magic-api-list.vue:975` |

### 3.14 登出清理

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-130 | 系统 MUST 在收到 bus 事件 `logout` 时清空树数据 | `magic-api-list.vue:958` |

### 3.15 JavaClass API 发现器

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-003-140 | 系统 MUST 在挂载时向 JavaClass 注册 API 发现器回调，提供所有接口的路径/名称/方法列表 | `magic-api-list.vue:949-957` |
| FR-003-141 | API 发现器返回的数据 MUST 经过 `replaceURL` 处理路径 | `magic-api-list.vue:952-953` |

---

## 4. 关键实体

| 实体 | 描述 | 关键属性 |
|---|---|---|
| **分组节点 (Folder)** | 树中的分组/目录节点 | `id`, `name`, `path`, `parentId`, `type`, `folder=true`, `level`, `tmpName`, `tmpPath`, `opened`, `children[]` |
| **接口节点 (File)** | 树中的 API 接口节点 | `id`/`tmp_id`, `name`, `path`, `method`, `groupId`, `groupName`, `groupPath`, `lock`, `level`, `_type='api'`, `script`, `parameters`, `headers`, `requestBody`, `responseBody` |
| **新建分组对象** | 新建/修改分组弹窗的表单数据 | `visible`, `id`, `name`, `path`, `parentId`, `type`, `children[]`, `paths[]`, `options[]` |
| **树节点通用属性** | 所有树节点共享 | `_searchShow`（搜索可见性）, `selectRightItem`（右键高亮）, `level`（缩进层级） |

---

## 5. 接受场景

### 场景 1：加载 API 资源树

- Given 后端存在若干 API 分组和接口
- When 模块初始化（`initData()`）
- Then 树形结构正确渲染，分组在前接口在后，默认全部展开

### 场景 2：搜索接口

- Given 树中有接口 "用户查询"（路径 `/user/query`）位于分组 "用户管理"
- When 用户在搜索框输入 "user"
- Then "用户管理" 分组和 "用户查询" 接口均可见，不匹配的节点隐藏

### 场景 3：点击接口打开编辑器

- Given 用户浏览 API 资源树
- When 用户点击某个接口节点
- Then bus 发射 `open` 事件，编辑器加载该接口脚本，该节点高亮

### 场景 4：拖拽接口到另一分组

- Given 接口 A 位于分组 X
- When 用户拖拽接口 A 到分组 Y
- Then 调用 `POST api/move`，接口 A 从分组 X 移至分组 Y，树自动更新

### 场景 5：拖拽分组到其子分组（非法操作）

- Given 分组 A 下有子分组 B
- When 用户尝试拖拽分组 A 到分组 B
- Then 弹出提示"不能移到 B"，不执行移动

### 场景 6：新建接口

- Given 用户在分组节点上右键选择"新建接口"
- When 操作完成
- Then 树中出现一个临时接口节点（`id` 为空），编辑器自动打开该节点

### 场景 7：锁定接口

- Given 接口 A 当前未锁定
- When 用户在右键菜单中选择"锁定接口"
- Then 调用 `POST lock`，接口 A 显示锁图标，菜单项变为"解锁"

### 场景 8：复制接口路径

- Given 接口 A 的完整路径为 `http://host/api/user/query`
- When 用户在右键菜单中选择"复制路径"
- Then 该路径被写入剪贴板，状态条显示"接口路径...复制成功"

### 场景 9：通过 URL 参数定位接口

- Given URL 中包含 `?openIds=<id>`
- When 页面加载完成
- Then 对应接口节点被自动打开并滚动到可视区域

---

## 6. 非功能需求

| ID | 类别 | 需求 | 源码位置 |
|---|---|---|---|
| NFR-003-001 | 性能 | 接口列表和分组列表 MUST 并行加载（由主组件 `Promise.all` 触发） | `magic-editor.vue:96` |
| NFR-003-002 | 可用性 | 树节点缩进 MUST 按 `level * 17px` 计算，保证层级清晰 | `magic-api-list.vue:32,56` |
| NFR-003-003 | 可用性 | 树节点 MUST 支持 hover 高亮和选中高亮两种视觉状态 | `magic-resource.css:26-33` |
| NFR-003-004 | 兼容性 | 搜索 MUST 支持中文拼音排序（`localeCompare('zh-CN')`） | `magic-api-list.vue:304` |
| NFR-003-005 | 安全性 | 路径复制使用 `document.execCommand('copy')`（已废弃 API，但功能可用） | `magic-api-list.vue:716` |

---

## 7. 假设与约束

- **假设 1**：后端 magic-api 始终返回正确的分组和接口数据格式；若返回空数组，树显示"无数据"。
- **假设 2**：接口的 `lock` 字段为字符串 `'0'` 或 `'1'`（非布尔值）。
- **假设 3**：分组的 `parentId` 为 `'0'` 时表示根级分组。
- **约束 1**：本模块不持有业务数据持久化，所有 CRUD 操作均通过 HTTP 请求后端（constitution 第二条）。
- **约束 2**：跨组件通信统一使用 EventBus（constitution 第四条）。
- **约束 3**：错误反馈统一走模态框（constitution 第九条）。

---

## 8. 依赖

### 8.1 上游依赖

| 模块 | 依赖内容 | 性质 |
|---|---|---|
| **014-infra-transport** | `request.send()` HTTP 请求封装 | 消费 |
| **015-infra-bus-store** | `bus` EventBus、`contants`（SERVER_URL、DEFAULT_EXPAND）、`Key` 快捷键 | 消费 |
| **015-infra-bus-store** | `utils.js` 中的 `replaceURL`、`download`、`requestGroup`、`deepClone`、`goToAnchor` | 消费 |
| **016-common-ui** | `MagicTree`、`MagicDialog`、`MagicInput`、`MagicTextIcon`、`$magicContextmenu`、`$magicAlert`、`$magicConfirm` | 消费 |
| **006-resources-recent** | `MagicGroupChoose` 组件（复制接口/分组时的目标选择器） | 消费 |
| **012-script-language** | `JavaClass.setApiFinder()` 注册 API 发现器 | 消费 |

### 8.2 下游消费者

| 模块 | 消费内容 | 性质 |
|---|---|---|
| **001-editor-core** | 通过 `open` bus 事件接收接口数据以打开编辑 | 被消费 |
| **008-layout-request** | 通过 `api-group-selected` bus 事件接收分组选中 | 被消费 |
| **008-layout-request** | 通过 `delete-api` bus 事件触发删除 | 被消费 |
| **010-layout-options** | 通过 `api-group-selected` bus 事件切换底部选项卡 | 被消费 |

### 8.3 总线事件清单

#### 本模块发射（emit）的事件

| 事件 | 触发时机 | 参数 | 源码位置 |
|---|---|---|---|
| `status` | 加载/操作/搜索等状态日志 | 字符串消息 | `magic-api-list.vue:190,196,202,208,411,421,429,437,511,580,588,647,677,685,717,845,858,867,883` |
| `open` | 用户点击接口节点 | 接口节点对象 | `magic-api-list.vue:191` |
| `api-group-selected` | 用户点击分组节点 | 分组节点对象 | `magic-api-list.vue:36` |
| `report` | 埋点上报（分组 CRUD、接口锁定/删除） | 事件 ID 字符串 | `magic-api-list.vue:413,512,589,630,646,684,847` |

#### 本模块监听（on）的事件

| 事件 | 来源 | 处理 | 源码位置 |
|---|---|---|---|
| `logout` | 主组件 | 清空树数据 | `magic-api-list.vue:958` |
| `opened` | 编辑器组件 | 同步当前打开的接口项 | `magic-api-list.vue:959-961` |
| `delete-api` | 编辑器组件 | 触发接口删除流程 | `magic-api-list.vue:962-964` |
| `refresh-resource` | 头部菜单 | 重新加载全部数据 | `magic-api-list.vue:965-967` |
| `update-group` | 分组管理面板 | 重建分组树结构 | `magic-api-list.vue:968-972` |
| `position-api` | 主组件 | 定位并打开指定 ID 的接口 | `magic-editor.vue:224-226` → `magic-api-list.vue:920-924` |

---

## 9. HTTP 端点清单

> 以下端点均为 `baseURL` 前缀下的相对路径，由 `request.send()` 发起。

| 方法 | 路径 | 用途 | 请求体 | 源码位置 |
|---|---|---|---|---|
| GET | `group/list?type=1` | 获取 API 分组列表 | 无 | `magic-api-list.vue:200` |
| GET | `list` | 获取 API 接口列表 | 无 | `magic-api-list.vue:203` |
| POST | `group/create` | 新建分组 | JSON: `{id, name, path, type, parentId, paths, options}` | `magic-api-list.vue:641` |
| POST | `group/update` | 修改分组 / 移动分组 | JSON: 同上 | `magic-api-list.vue:629,412,846` |
| POST | `group/delete` | 删除分组 | `{groupId}` | `magic-api-list.vue:682` |
| POST | `group/copy` | 复制分组 | `{src, target}` | `magic-api-list.vue:573` |
| POST | `delete` | 删除接口 | `{id}` | `magic-api-list.vue:586` |
| POST | `lock` | 锁定接口 | `{id}` | `magic-api-list.vue:509` |
| POST | `unlock` | 解锁接口 | `{id}` | `magic-api-list.vue:509` |
| POST | `api/move` | 移动接口到目标分组 | `{id, groupId}` | `magic-api-list.vue:868-870` |
| GET | `/download?groupId=<id>` | 导出分组下接口为 zip | 无 | `magic-api-list.vue:430` |

> 注：`group/create`、`group/update`、`group/update`（移动）均通过 `requestGroup()` 工具函数发起，使用 `Content-Type: application/json`（`utils.js:45-61`），其余端点通过 `request.send()` 使用默认的 `application/x-www-form-urlencoded`。

---

## 10. 模块边界

### 10.1 与 006-resources-recent 的边界

- **MagicGroupChoose** 组件物理位于 `src/components/resources/magic-group-choose.vue`，按 STRUCTURE.md 归类于 006-resources-recent 模块。
- 本模块**消费** MagicGroupChoose 用于"复制接口到..."和"复制分组"两个场景（`magic-api-list.vue:88-105`）。
- MagicGroupChoose 的 `initData()`、`getSelected()`、`unDoSelected()` 方法由本模块通过 `$refs` 调用。
- 本模块**不关心** MagicGroupChoose 内部如何加载分组树，仅将其视为目标选择器。

### 10.2 与 008-layout-request 的边界

- 本模块在用户点击分组节点时发射 `api-group-selected` 事件（`magic-api-list.vue:36`）。
- 008-layout-request 中的 `magic-options.vue` 监听该事件以切换底部选项卡（`magic-options.vue:63`）。
- 本模块**不直接**参与请求面板、运行结果、调试面板的渲染，这些由 008-layout-request 负责。

### 10.3 与 016-common-ui 的边界

- 本模块**消费**以下通用组件：
  - `MagicTree` — 树形渲染容器（`magic-api-list.vue:25`）
  - `MagicDialog` — 弹窗容器（`magic-api-list.vue:73,88,97`）
  - `MagicInput` — 表单输入（`magic-api-list.vue:78,81`）
  - `MagicTextIcon` — HTTP 方法图标（`magic-api-list.vue:66`）
  - `$magicContextmenu` — 右键菜单（`magic-api-list.vue:335,453`）
  - `$magicAlert` — 提示框（`magic-api-list.vue:460,480,516,594,624,681,700,719,861`）
  - `$magicConfirm` — 确认框（`magic-api-list.vue:581,678`）
- 本模块**不修改**这些通用组件的实现，仅通过 props/事件与其交互。

---

## 11. 待澄清

| ID | 问题 | 影响范围 |
|---|---|---|
| C-003-001 | `request.send('list')` 返回的接口列表中，`method` 字段是否可能为空？当前 `MagicTextIcon` 对空 method 的渲染行为未明确 | 接口节点显示 |
| C-003-002 | `pushFileItemToGroup()` 在递归查找分组时，若树中存在 `id` 重复的分组节点，行为未定义（会停在第一个匹配项） | 新建接口 |
| C-003-003 | `openItemById()` 中的 `tmpOpenId` 缓存机制在快速连续调用时可能产生竞态（先到的数据后处理），是否需要队列化 | 接口定位 |

---

## 12. 源码引用清单

| 文件 | 行数 | 说明 |
|---|---|---|
| `src/components/resources/magic-api-list.vue` | 982 | 主组件：模板(107行) + 脚本(872行) + 样式(3行) |
| `src/components/resources/magic-resource.css` | 109 | 共用样式：树容器、工具栏、节点样式 |
| `src/components/resources/magic-group-choose.vue` | 202 | 分组选择对话框（006 模块，本模块消费） |
| `src/components/common/magic-tree.vue` | 98 | 树容器组件（016 模块，本模块消费） |
| `src/scripts/bus.js` | 57 | EventBus（015 模块） |
| `src/scripts/contants.js` | 36 | 全局常量（015 模块） |
| `src/scripts/hotkey.js` | 46 | 快捷键（015 模块） |
| `src/scripts/utils.js` | 182 | 工具函数（015 模块） |
| `src/components/magic-editor.vue` | 448 | 主组件，消费本模块的 bus 事件 |
