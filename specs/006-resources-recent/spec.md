# 最近打开与资源选择模块规范（spec.md）

> Module: 006-resources-recent
> Status: Implemented
> Last Updated: 2026-05-01
> 对应源码:
> - `src/components/resources/magic-recent-opened.vue` (105 行)
> - `src/components/resources/magic-resource-choose.vue` (365 行)
> - `src/components/resources/magic-group-choose.vue` (202 行)
> - `src/components/resources/magic-resource.css` (109 行，共用样式)

---

## 1. 模块概述

### 1.1 目的

本模块提供两项核心能力：

1. **最近打开列表**：记录用户最近打开过的 API 接口和函数，持久化到 localStorage，支持通过对话框快速回访。
2. **资源/分组选择对话框**：以树形结构浏览并选择 API 接口、函数、数据源及其分组，供其他模块（如复制操作）消费。

### 1.2 解决的问题

- 用户频繁切换接口/函数时，需要一种**快速回退**到最近使用资源的方式，避免在深层树中反复查找。
- 复制接口/分组到其他分组时，需要一个**统一的目标选择器**，跨资源类型（API/Function/Datasource）提供一致的树形浏览体验。
- 仅选择分组（不选资源节点）时，需要一个**轻量级单选分组选择器**。

### 1.3 范围

**包含**：
- 最近打开列表的持久化（localStorage `recent_opened`）
- 最近打开对话框的展示与交互
- 快捷键 Ctrl+E 打开最近打开对话框
- 跨资源类型（API/Function/Datasource）的统一资源选择树
- 分组选择对话框（单选模式）
- 资源选择树的全选/多选/半选状态管理

**不包含**：
- 资源树节点的 CRUD 操作（由 003/004/005 模块负责）
- 接口脚本的编辑（由 001-editor-core 负责）
- 资源数据的 HTTP 请求封装（由 014-infra-transport 负责）

---

## 2. 用户故事

| ID | 用户故事 | 源码位置 |
|---|---|---|
| US-001 | 作为开发者，我能在关闭/切换资源时自动记录到最近打开列表，以便下次快速回访 | `magic-recent-opened.vue:38-50` |
| US-002 | 作为开发者，我能通过 Ctrl+E 快捷键打开最近打开对话框 | `magic-recent-opened.vue:53` |
| US-003 | 作为开发者，我能在最近打开列表中看到接口/函数的名称、分组路径，并点击打开 | `magic-recent-opened.vue:6-11` |
| US-004 | 作为开发者，当某个资源被删除或不存在时，最近打开列表应自动清理无效条目 | `magic-recent-opened.vue:56-72` |
| US-005 | 作为开发者，我能在复制接口/分组时通过树形选择器选择目标分组 | `magic-resource-choose.vue`（被 003/004 消费） |
| US-006 | 作为开发者，我能在资源选择树中全选/取消全选某个分组及其子节点 | `magic-resource-choose.vue:206-230` |
| US-007 | 作为开发者，我能在仅需要选择分组时使用单选分组选择器 | `magic-group-choose.vue` |

---

## 3. 功能需求

### 3.1 最近打开列表持久化

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-006-001 | 系统 MUST 在收到 bus 事件 `close` 且 payload 包含 `id` 时，将该资源记录到最近打开列表 | `magic-recent-opened.vue:38-50` |
| FR-006-002 | 最近打开列表 MUST 以 `[[_type, id], ...]` 的二维数组格式存储，`_type` 为 `'api'` 或 `'function'` | `magic-recent-opened.vue:44` |
| FR-006-003 | 每次记录时，该资源 MUST 被移到列表最前面（`unshift`），实现 LRU 排序 | `magic-recent-opened.vue:44` |
| FR-006-004 | 列表最大容量 MUST 为 30 条，超出时截断尾部 | `magic-recent-opened.vue:45-47` |
| FR-006-005 | 列表 MUST 持久化到 localStorage，键为 `contants.RECENT_OPENED`（即 `'recent_opened'`） | `magic-recent-opened.vue:48,77`、`contants.js:22` |
| FR-006-006 | 读取持久化数据时 MUST 使用 `JSON.parse`，解析失败时静默忽略（空 catch） | `magic-recent-opened.vue:79-82` |
| FR-006-007 | 对话框打开时（`show()`）MUST 从 localStorage 加载最近打开列表到本地 `scripts` 数组 | `magic-recent-opened.vue:76-84` |

### 3.2 最近打开对话框展示

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-006-010 | 系统 MUST 在对话框中展示最近打开的资源列表，每条显示"分组名/资源名(分组路径/资源路径)" | `magic-recent-opened.vue:10` |
| FR-006-011 | API 类型资源 MUST 在名称前显示 HTTP 方法图标（`MagicTextIcon`） | `magic-recent-opened.vue:8` |
| FR-006-012 | 函数类型资源 MUST 在名称前显示函数图标（`MagicTextIcon value="function"`） | `magic-recent-opened.vue:9` |
| FR-006-013 | 列表为空时 MUST 显示"最近没有打开过的接口或函数"提示 | `magic-recent-opened.vue:13-15` |
| FR-006-014 | 对话框尺寸 MUST 固定为 340px × 420px，内容区高度 380px 可滚动 | `magic-recent-opened.vue:2,5` |
| FR-006-015 | 点击列表项 MUST 触发 `open` bus 事件并关闭对话框 | `magic-recent-opened.vue:86-89` |
| FR-006-016 | 对话框路径中的连续斜杠 MUST 被规范化为单斜杠 | `magic-recent-opened.vue:91` |

### 3.3 无效条目自动清理

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-006-020 | 系统 MUST 在计算 `fullScripts` 时，通过 `$parent.$refs.apiList.getItemById()` 和 `$parent.$refs.functionList.getItemById()` 查找资源详情 | `magic-recent-opened.vue:57-63` |
| FR-006-021 | 若查找结果为 `undefined`（资源已被删除或不存在），该条目 MUST 被过滤掉 | `magic-recent-opened.vue:65,72` |
| FR-006-022 | 若过滤后的条目数与原始 `scripts` 长度不一致，系统 MUST 在下一个 tick 中同步清理 localStorage 中的持久化数据 | `magic-recent-opened.vue:66-71` |

### 3.4 资源选择树（MagicResourceChoose）

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-006-030 | 系统 MUST 在初始化时并行加载三类资源：API 分组+接口、Function 分组+函数、Datasource 列表 | `magic-resource-choose.vue:80-140` |
| FR-006-031 | 三类资源的根节点名称 MUST 分别为"1.接口列表"、"2.函数列表"、"3.数据源" | `magic-resource-choose.vue:85-87` |
| FR-006-032 | API 分组通过 `GET group/list?type=1` 加载，函数分组通过 `GET group/list?type=2` 加载 | `magic-resource-choose.vue:89,109` |
| FR-006-033 | API 接口通过 `GET list` 加载，函数通过 `GET function/list` 加载，数据源通过 `GET datasource/list` 加载 | `magic-resource-choose.vue:98,118,129` |
| FR-006-034 | 数据源节点 MUST 设置 `_type='datasource'`、`path=key`、`groupId='datasource'` | `magic-resource-choose.vue:131-136` |
| FR-006-035 | 分组 parentId 为 `'0'` 时，MUST 分别映射到对应的根节点（`api`/`function`） | `magic-resource-choose.vue:92,112` |
| FR-006-036 | 树结构 MUST 通过 `arrayToTree()` 递归组装，分组节点在前、资源节点在后 | `magic-resource-choose.vue:143-193` |
| FR-006-037 | 树节点 MUST 支持排序（升序/降序），分组在前、资源在后，按名称 `localeCompare('zh-CN')` 排序 | `magic-resource-choose.vue:263-294` |
| FR-006-038 | 数据源节点无分组层级，直接挂在 `datasource` 根节点下 | `magic-resource-choose.vue:129-140` |

### 3.5 多选/全选状态管理

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-006-040 | 每个树节点 MUST 具有 `selected`（是否选中）和 `checkedHalf`（半选状态）属性 | `magic-resource-choose.vue:93-95,102-103,113-114,121-122,132-133` |
| FR-006-041 | 选中/取消选中节点时，MUST 递归更新其所有子节点的选中状态 | `magic-resource-choose.vue:217-223` |
| FR-006-042 | 选中/取消选中节点后，MUST 向上回溯更新所有父节点的 `selected` 和 `checkedHalf` 状态 | `magic-resource-choose.vue:227-230` |
| FR-006-043 | 父节点的 `selected` MUST 为 `true` 当且仅当至少一个子节点被选中 | `magic-resource-choose.vue:228` |
| FR-006-044 | 父节点的 `checkedHalf` MUST 为 `true` 当存在未选中或半选的子节点 | `magic-resource-choose.vue:229` |
| FR-006-045 | 全选/取消全选 MUST 递归设置所有节点的 `selected` 状态，分组节点的 `checkedHalf` 重置为 `false` | `magic-resource-choose.vue:206-215` |
| FR-006-046 | `getSelected()` MUST 返回所有选中节点（含分组和资源）的 `{type, id}` 数组，递归遍历子树 | `magic-resource-choose.vue:194-205` |

### 3.6 分组选择对话框（MagicGroupChoose）

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-006-050 | 系统 MUST 仅加载指定类型的分组树（通过 `type` prop 控制：`'1'`=API, `'2'`=Function） | `magic-group-choose.vue:69-85` |
| FR-006-051 | 根节点名称 MUST 通过 `rootName` prop 传入 | `magic-group-choose.vue:73` |
| FR-006-052 | 分组选择为**单选模式**，点击分组节点时设置 `selectedItem` 为该节点 `id` | `magic-group-choose.vue:131-133` |
| FR-006-053 | `getSelected()` MUST 返回当前选中的分组 `id`（字符串） | `magic-group-choose.vue:128-130` |
| FR-006-054 | `unDoSelected()` MUST 清除当前选中状态 | `magic-group-choose.vue:134-136` |
| FR-006-055 | 分组树 MUST 支持排序（升序/降序），按名称 `localeCompare('zh-CN')` 排序 | `magic-group-choose.vue:138-169` |

### 3.7 快捷键

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-006-060 | 系统 MUST 在 `.ma-container` 元素上注册 Ctrl+E 快捷键以打开最近打开对话框 | `magic-recent-opened.vue:51-53` |

### 3.8 登出清理

| ID | 需求 | 源码位置 |
|---|---|---|
| FR-006-070 | [NEEDS CLARIFICATION: 当前源码中未见 `logout` 事件监听，需确认最近打开列表是否需要在登出时清空] | — |

---

## 4. 关键实体

| 实体 | 描述 | 关键属性 |
|---|---|---|
| **最近打开条目** | 记录在 localStorage 中的资源引用 | `[_type: 'api'\|'function', id: string]` |
| **最近打开完整条目** | 通过 ID 查找后的完整资源对象 | `_type`, `id`, `name`, `path`, `method`(api), `groupName`, `groupPath` |
| **资源树节点** | 资源选择树中的节点（分组或资源） | `id`, `name`, `path`, `parentId`, `_type`, `folder`(分组), `selected`, `checkedHalf`, `level`, `children[]`, `tmpName`, `tmpPath` |
| **分组选择节点** | 分组选择对话框中的节点 | `id`, `name`, `path`, `parentId`, `_type='group'`, `folder=true`, `level`, `children[]` |

---

## 5. 接受场景

### 场景 1：记录最近打开的资源

- Given 用户正在编辑一个 API 接口
- When 该接口被关闭（bus 发射 `close` 事件携带 `{id, _type}`）
- Then 该接口被添加到最近打开列表最前面，列表持久化到 localStorage

### 场景 2：通过快捷键打开最近打开对话框

- Given 用户已打开过若干接口/函数
- When 用户按下 Ctrl+E
- Then 弹出最近打开对话框，显示按时间倒序的资源列表

### 场景 3：点击最近打开列表项

- Given 最近打开对话框已打开
- When 用户点击列表中的某个资源项
- Then bus 发射 `open` 事件携带该资源数据，对话框关闭

### 场景 4：自动清理无效条目

- Given localStorage 中保存了 5 条最近打开记录，其中 2 条对应的资源已被删除
- When 用户打开最近打开对话框
- Then 仅显示 3 条有效资源，localStorage 中的无效条目被自动清理

### 场景 5：资源选择树全选分组

- Given 资源选择树已加载
- When 用户选中"1.接口列表"根节点
- Then 所有 API 分组和接口节点均被选中，`getSelected()` 返回全部节点

### 场景 6：分组选择对话框单选

- Given 分组选择对话框已加载 API 分组树
- When 用户点击某个分组节点
- Then 该分组被选中，之前选中的分组取消选中，`getSelected()` 返回该分组 ID

---

## 6. 非功能需求

| ID | 类别 | 需求 | 源码位置 |
|---|---|---|---|
| NFR-006-001 | 性能 | 三类资源树加载 MUST 并行发起（由主组件 `Promise.all` 触发） | `magic-editor.vue:96` |
| NFR-006-002 | 可用性 | 最近打开列表最大 30 条，避免 localStorage 数据过大 | `magic-recent-opened.vue:45-47` |
| NFR-006-003 | 可用性 | 资源选择树加载期间 MUST 显示 loading 状态（`showLoading` 计数器） | `magic-resource-choose.vue:75,81,106,126,139` |
| NFR-006-004 | 健壮性 | JSON.parse 失败 MUST 静默处理，不阻断对话框打开 | `magic-recent-opened.vue:79-82` |
| NFR-006-005 | 兼容性 | 树排序 MUST 支持中文拼音排序（`localeCompare('zh-CN')`） | `magic-resource-choose.vue:268`、`magic-group-choose.vue:143` |

---

## 7. 假设与约束

- **假设 1**：`$parent.$refs.apiList` 和 `$parent.$refs.functionList` 始终存在且暴露 `getItemById(id)` 方法。
- **假设 2**：`close` bus 事件的 payload 格式为 `{id, _type, ...}`，由编辑器或资源列表组件发射。
- **假设 3**：数据源列表中每个条目均包含 `id` 和 `key` 字段（`magic-resource-choose.vue:131` 的 `.filter(it => it.id)` 过滤了无 id 的条目）。
- **约束 1**：本模块不持有业务数据持久化，仅允许 localStorage 存储用户偏好（constitution 第二条）。
- **约束 2**：跨组件通信统一使用 EventBus（constitution 第四条）。
- **约束 3**：最近打开列表仅记录 API 和 Function 类型，不记录 Datasource 类型（源码中未见 datasource 的 close 事件处理）。

---

## 8. 依赖

### 8.1 上游依赖

| 模块 | 依赖内容 | 性质 |
|---|---|---|
| **014-infra-transport** | `request.send()` HTTP 请求封装 | 消费（MagicResourceChoose） |
| **015-infra-bus-store** | `bus` EventBus、`contants`（RECENT_OPENED、DEFAULT_EXPAND）、`Key` 快捷键、`store` localStorage 封装 | 消费 |
| **016-common-ui** | `MagicTree`、`MagicDialog`、`MagicCheckbox`、`MagicTextIcon` | 消费 |

### 8.2 下游消费者

| 模块 | 消费内容 | 性质 |
|---|---|---|
| **003-resources-api** | 消费 `MagicGroupChoose` 用于复制接口/分组时的目标选择 | 消费本模块 |
| **004-resources-function** | 消费 `MagicGroupChoose` 用于复制函数/分组时的目标选择 | 消费本模块 |
| **001-editor-core** | 消费 `open` bus 事件以打开资源 | 消费本模块 |

### 8.3 总线事件清单

#### 本模块发射（emit）的事件

| 事件 | 触发时机 | 参数 | 源码位置 |
|---|---|---|---|
| `open` | 用户点击最近打开列表项 | 资源节点对象 | `magic-recent-opened.vue:87` |

#### 本模块监听（on）的事件

| 事件 | 来源 | 处理 | 源码位置 |
|---|---|---|---|
| `close` | 编辑器/资源列表 | 记录到最近打开列表 | `magic-recent-opened.vue:38-50` |

### 8.4 Props / Emit 接口

#### MagicRecentOpened

| 类型 | 名称 | 说明 | 源码位置 |
|---|---|---|---|
| Props | 无 | 本组件无 props | — |
| Emit | 无 | 通过 bus 通信，无 Vue emit | — |
| Methods | `show()` | 打开对话框并加载 localStorage 数据 | `magic-recent-opened.vue:76-84` |

#### MagicResourceChoose

| 类型 | 名称 | 类型 | 必填 | 说明 | 源码位置 |
|---|---|---|---|---|---|
| Props | `height` | String | 是 | 树容器高度 | `magic-resource-choose.vue:46-49` |
| Props | `maxHeight` | String | 是 | 树容器最大高度 | `magic-resource-choose.vue:50-53` |
| Props | `refreshData` | Boolean | 否 | 触发数据刷新 | `magic-resource-choose.vue:54` |
| Methods | `initData()` | — | — | 初始化加载三类资源树 | `magic-resource-choose.vue:80-140` |
| Methods | `getSelected()` | `{type, id}[]` | — | 获取所有选中节点 | `magic-resource-choose.vue:194-205` |
| Methods | `doSelectAll(flag)` | — | — | 全选/取消全选 | `magic-resource-choose.vue:206-215` |
| Methods | `rebuildTree(folding?)` | — | — | 重建树结构（可选折叠） | `magic-resource-choose.vue:233-257` |
| Methods | `treeSortHandle(flag)` | — | — | 切换排序方式 | `magic-resource-choose.vue:258-261` |
| Methods | `pushFileItemToGroup(tree, newItem)` | boolean | — | 将资源节点插入对应分组 | `magic-resource-choose.vue:297-313` |

#### MagicGroupChoose

| 类型 | 名称 | 类型 | 必填 | 说明 | 源码位置 |
|---|---|---|---|---|---|
| Props | `height` | String | 是 | 树容器高度 | `magic-group-choose.vue:30-33` |
| Props | `maxHeight` | String | 是 | 树容器最大高度 | `magic-group-choose.vue:34-37` |
| Props | `rootName` | String | 是 | 根节点显示名称 | `magic-group-choose.vue:38-41` |
| Props | `type` | String | 是 | 资源类型（`'1'`=API, `'2'`=Function） | `magic-group-choose.vue:42-45` |
| Methods | `initData()` | — | — | 初始化加载分组树 | `magic-group-choose.vue:69-85` |
| Methods | `getSelected()` | string | — | 获取选中的分组 ID | `magic-group-choose.vue:128-130` |
| Methods | `doSelected(item)` | — | — | 选中指定分组 | `magic-group-choose.vue:131-133` |
| Methods | `unDoSelected()` | — | — | 清除选中状态 | `magic-group-choose.vue:134-136` |

### 8.5 localStorage 读写清单

| 操作 | 键（常量） | 键值 | 值类型 | 组件 | 源码位置 |
|---|---|---|---|---|---|
| 读 | `RECENT_OPENED` | `recent_opened` | `JSON string` → `[[_type, id], ...]` | MagicRecentOpened | `magic-recent-opened.vue:77-82` |
| 写 | `RECENT_OPENED` | `recent_opened` | `JSON string` | MagicRecentOpened | `magic-recent-opened.vue:48,69` |

---

## 9. HTTP 端点清单

> 以下端点由 MagicResourceChoose 和 MagicGroupChoose 发起，均为 `baseURL` 前缀下的相对路径。

| 方法 | 路径 | 用途 | 组件 | 源码位置 |
|---|---|---|---|---|
| GET | `group/list?type=1` | 获取 API 分组列表 | MagicResourceChoose | `magic-resource-choose.vue:89` |
| GET | `list` | 获取 API 接口列表 | MagicResourceChoose | `magic-resource-choose.vue:98` |
| GET | `group/list?type=2` | 获取函数分组列表 | MagicResourceChoose | `magic-resource-choose.vue:109` |
| GET | `function/list` | 获取函数列表 | MagicResourceChoose | `magic-resource-choose.vue:118` |
| GET | `datasource/list` | 获取数据源列表 | MagicResourceChoose | `magic-resource-choose.vue:129` |
| GET | `group/list?type={type}` | 获取指定类型分组列表 | MagicGroupChoose | `magic-group-choose.vue:75` |

---

## 10. 模块边界

### 10.1 与 003-resources-api 的边界

- 本模块提供 `MagicGroupChoose` 组件供 003 模块消费，用于"复制接口到..."和"复制分组"场景。
- 003 模块通过 `$refs` 调用 `MagicGroupChoose` 的 `initData()`、`getSelected()`、`unDoSelected()` 方法。
- 本模块**不关心** 003 模块中 API 资源树的 CRUD 逻辑，仅提供目标分组选择能力。
- 003 模块的 `magic-api-list.vue` 在用户点击接口时发射 `close` bus 事件，本模块的 `MagicRecentOpened` 监听该事件以记录最近打开。

### 10.2 与 004-resources-function 的边界

- 同 003 模块，004 模块消费 `MagicGroupChoose` 用于函数复制场景。
- 004 模块的函数列表组件同样发射 `close` bus 事件，被本模块监听。

### 10.3 与 005-resources-datasource 的边界

- `MagicResourceChoose` 组件加载数据源列表（`GET datasource/list`），但数据源节点**不参与**最近打开列表（源码中未见 datasource 类型的 close 事件处理）。
- 数据源在资源选择树中作为第三类根节点展示，但无分组层级。

### 10.4 与 001-editor-core 的边界

- 本模块通过 bus 发射 `open` 事件（`magic-recent-opened.vue:87`），001 模块监听该事件以打开资源。
- 本模块通过 `$parent.$refs.apiList.getItemById()` 和 `$parent.$refs.functionList.getItemById()` 反向查找资源详情，形成对 003/004 模块的隐式依赖。

### 10.5 与 016-common-ui 的边界

- 本模块**消费**以下通用组件：
  - `MagicTree` — 树形渲染容器（`magic-resource-choose.vue:2`、`magic-group-choose.vue:2`）
  - `MagicDialog` — 对话框容器（`magic-recent-opened.vue:2`）
  - `MagicCheckbox` — 复选框（`magic-resource-choose.vue:10,24`、`magic-group-choose.vue:10`）
  - `MagicTextIcon` — 文本图标（`magic-recent-opened.vue:8-9`、`magic-resource-choose.vue:25-26`）
- 本模块**不修改**这些通用组件的实现。

---

## 11. 待澄清

| ID | 问题 | 影响范围 |
|---|---|---|
| C-006-001 | `close` bus 事件的确切发射方是谁？当前源码中 `magic-recent-opened.vue:38` 监听 `close` 事件，但发射方未在三个源文件中出现。推测由编辑器组件（001 模块）或资源列表组件在关闭 tab 时发射 | 最近打开记录触发时机 |
| C-006-002 | 最近打开列表是否需要在登出（`logout` 事件）时清空？当前 `magic-recent-opened.vue` 中未见 `logout` 监听器，而 003 模块有（`magic-api-list.vue:958`） | 登出清理行为 |
| C-006-003 | `MagicResourceChoose` 组件是否有对外 `emit` 事件？当前源码中未见 `this.$emit(...)` 调用，消费者通过 `$refs` 调用方法获取选中结果。是否应统一为 emit 模式 | 组件接口设计 |

---

## 12. 源码引用清单

| 文件 | 行数 | 说明 |
|---|---|---|
| `src/components/resources/magic-recent-opened.vue` | 105 | 最近打开对话框主组件：模板(19行) + 脚本(75行) + 样式(11行) |
| `src/components/resources/magic-resource-choose.vue` | 365 | 跨资源类型选择树：模板(33行) + 脚本(307行) + 样式(25行) |
| `src/components/resources/magic-group-choose.vue` | 202 | 分组单选选择器：模板(18行) + 脚本(157行) + 样式(27行) |
| `src/components/resources/magic-resource.css` | 109 | 共用样式：树容器、工具栏、节点样式（被本模块三个组件共享） |
| `src/scripts/bus.js` | 57 | EventBus（015 模块） |
| `src/scripts/contants.js` | 36 | 全局常量，定义 `RECENT_OPENED` / `RECENT_OPENED_TAB` 键（015 模块） |
| `src/scripts/store.js` | 21 | localStorage 封装（015 模块） |
| `src/scripts/hotkey.js` | 46 | 快捷键封装（015 模块） |
| `src/api/request.js` | ~180 | HTTP 请求封装（014 模块） |
| `src/components/common/magic-tree.vue` | 98 | 树容器组件（016 模块，本模块消费） |
| `src/components/common/magic-dialog.vue` | — | 对话框组件（016 模块，本模块消费） |
| `src/components/common/magic-checkbox.vue` | — | 复选框组件（016 模块，本模块消费） |
| `src/components/common/magic-text-icon.vue` | — | 文本图标组件（016 模块，本模块消费） |
