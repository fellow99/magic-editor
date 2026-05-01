# 函数资源管理模块规范（Function Resource Module Specification）

> Module: 004-resources-function
> Status: Implemented
> Last Updated: 2026-05-01
> 对应源码: `src/components/resources/magic-function-list.vue` (883 行)

---

## 1. 模块概述

### 1.1 目的

本模块为 magic-editor 提供**函数（Function）资源**的可视化管理能力。函数是 magic-api 后端中可复用的脚本单元，本模块以树形结构展示函数分组与函数条目，支持用户对函数资源进行浏览、搜索、创建、编辑、复制、移动、锁定、删除等全生命周期操作，并与脚本编辑器联动实现资源定位跳转。

### 1.2 解决的问题

- 函数资源以扁平列表存储在后端，用户需要层级化的分组视图来组织和管理大量函数。
- 函数与接口（API）属于不同资源类型，需要独立的资源面板和操作流程。
- 编辑器中通过搜索/全局搜索/外部引用定位到某个函数时，需要自动展开树并高亮对应节点。
- 函数脚本可能被多处引用，需要锁定机制防止误改。

### 1.3 范围

**包含**：
- 函数分组树（folder）与函数条目（file）的渲染与交互
- 分组的 CRUD（创建、修改、删除、复制、移动）
- 函数的 CRUD（新建、复制、删除）与锁定/解锁
- 树的关键字搜索过滤
- 树的排序（升序/降序）与折叠
- 拖拽移动分组/函数
- 与脚本编辑器的联动（`open` 事件、`position-function` 定位事件）
- 向 `JavaClass` 模块注册在线函数列表（用于编辑器自动补全）

**不包含**：
- 函数脚本的实际编辑（由 001-editor-core 模块负责）
- 函数脚本的解析与语法高亮（由 011-script-parser / 012-script-language 模块负责）
- 函数运行/调试（由 008-layout-request / 009-layout-debug 模块负责）
- 分组选择器 UI 组件本身（`magic-group-choose.vue` 属 006-resources-recent 模块范围，本模块仅消费）

---

## 2. 用户故事

| ID | 用户故事 | 对应源码 |
|---|---|---|
| US-004-01 | 作为开发者，我能在左侧资源面板看到按分组组织的函数树，以便快速浏览所有函数 | `magic-function-list.vue:2-71` |
| US-004-02 | 作为开发者，我能通过关键字搜索函数名/路径，以便在大量函数中快速定位 | `magic-function-list.vue:4-5, 165-177` |
| US-004-03 | 作为开发者，我能在某个分组下右键新建函数，以便快速创建可复用脚本 | `magic-function-list.vue:331-351` |
| US-004-04 | 作为开发者，我能新建/修改/删除/复制/移动函数分组，以便组织函数结构 | `magic-function-list.vue:326-418, 495-503, 532-626` |
| US-004-05 | 作为开发者，我能复制/删除/锁定/解锁函数，以便管理函数生命周期 | `magic-function-list.vue:421-493` |
| US-004-06 | 作为开发者，我点击函数节点后能在编辑器中打开该函数脚本，以便进行编辑 | `magic-function-list.vue:182-186` |
| US-004-07 | 作为开发者，当我从搜索结果或外部引用定位到某个函数时，资源树能自动展开并高亮该节点 | `magic-function-list.vue:827-851` |
| US-004-08 | 作为开发者，我能通过拖拽将函数或分组移动到另一个分组下，以便调整组织结构 | `magic-function-list.vue:731-807` |
| US-004-09 | 作为开发者，我能切换树的排序方式（升序/降序），以便按习惯浏览 | `magic-function-list.vue:17-22, 287-324` |
| US-004-10 | 作为开发者，我能在编辑器中通过自动补全看到可用的函数列表 | `magic-function-list.vue:855-863` |

---

## 3. 功能需求

### 3.1 函数资源树展示

| ID | 需求 | 追溯 |
|---|---|---|
| FR-004-001 | 系统 MUST 以树形结构展示函数资源，节点分为两类：分组（folder）和函数（file） | `magic-function-list.vue:26-70` |
| FR-004-002 | 分组节点 MUST 显示名称和路径，支持展开/折叠 | `magic-function-list.vue:27-47` |
| FR-004-003 | 函数节点 MUST 显示名称、路径，锁定状态的函数 MUST 显示锁定图标 | `magic-function-list.vue:49-70` |
| FR-004-004 | 树初始化时 MUST 先加载分组列表（`type=2`），再加载函数列表，两者完成后构建树结构 | `magic-function-list.vue:188-206` |
| FR-004-005 | 分组在前端树中 MUST 按 `parentId` 递归构建层级关系 | `magic-function-list.vue:232-257` |
| FR-004-006 | 未归属任何分组的函数 MUST 出现在树的根级别（root 节点） | `magic-function-list.vue:226-229` |
| FR-004-007 | 树的默认排序 MUST 为分组在前、函数在后，组内按名称字母排序 | `magic-function-list.vue:292-324` |

### 3.2 搜索与过滤

| ID | 需求 | 追溯 |
|---|---|---|
| FR-004-010 | 系统 MUST 提供搜索输入框，支持按函数名/路径/分组名进行模糊匹配 | `magic-function-list.vue:4-5, 165-177` |
| FR-004-011 | 搜索匹配时 MUST 忽略大小写 | `magic-function-list.vue:166` |
| FR-004-012 | 搜索时，若分组本身不匹配但其子节点匹配，该分组 MUST 保持可见 | `magic-function-list.vue:170` |
| FR-004-013 | 不匹配的节点 MUST 通过 `_searchShow=false` 隐藏，而非从树中删除 | `magic-function-list.vue:28, 51` |

### 3.3 分组 CRUD

| ID | 需求 | 追溯 |
|---|---|---|
| FR-004-020 | 系统 MUST 支持在根级别或任意分组下新建子分组 | `magic-function-list.vue:362-366, 532-544` |
| FR-004-021 | 新建/修改分组时，系统 MUST 校验名称非空 | `magic-function-list.vue:549-552` |
| FR-004-022 | 修改分组时，系统 MUST 发送更新请求并刷新树结构 | `magic-function-list.vue:554-565` |
| FR-004-023 | 删除分组时，系统 MUST 弹出确认框，确认后递归通知所有子函数关闭对应编辑器标签 | `magic-function-list.vue:598-626` |
| FR-004-024 | 复制分组时，系统 MUST 弹出目标选择器，用户选择目标分组后执行复制 | `magic-function-list.vue:88-96, 495-503` |
| FR-004-025 | 移动分组至根节点时，系统 MUST 将 `parentId` 设为 `'0'` 并发送更新请求 | `magic-function-list.vue:393-409` |

### 3.4 函数 CRUD

| ID | 需求 | 追溯 |
|---|---|---|
| FR-004-030 | 系统 MUST 支持在分组下新建函数，新建的函数以临时 ID 标识（未保存状态） | `magic-function-list.vue:334-350` |
| FR-004-031 | 复制函数时，系统 MUST 在名称后追加 `(复制)` 后缀，并生成新的临时 ID | `magic-function-list.vue:428-443` |
| FR-004-032 | 复制未保存的函数时，系统 MUST 提示用户先保存 | `magic-function-list.vue:429-431` |
| FR-004-033 | 删除函数时，系统 MUST 弹出确认框；已保存的函数调用后端删除接口，未保存的仅从前端树移除 | `magic-function-list.vue:505-529` |
| FR-004-034 | 锁定/解锁函数时，系统 MUST 调用对应后端接口并更新本地状态 | `magic-function-list.vue:454-468` |
| FR-004-035 | 复制函数路径时，系统 MUST 将完整路径（`/分组路径/函数路径`）写入剪贴板 | `magic-function-list.vue:629-643` |

### 3.5 拖拽移动

| ID | 需求 | 追溯 |
|---|---|---|
| FR-004-040 | 系统 MUST 支持拖拽分组到另一个分组下以改变其父级 | `magic-function-list.vue:747-782` |
| FR-004-041 | 系统 MUST 支持拖拽函数到另一个分组下以改变其所属分组 | `magic-function-list.vue:783-804` |
| FR-004-042 | 拖拽分组时，系统 MUST 检测目标是否为该分组的子级（防止循环嵌套），若是则拒绝并提示 | `magic-function-list.vue:751-763, 781` |
| FR-004-043 | 拖拽操作成功后，系统 MUST 重新构建树结构并滚动到目标位置 | `magic-function-list.vue:773-778, 796-801` |

### 3.6 排序与折叠

| ID | 需求 | 追溯 |
|---|---|---|
| FR-004-050 | 系统 MUST 支持切换排序方式：升序 ↔ 降序 ↔ 不排序（保持原始顺序） | `magic-function-list.vue:17-22, 287-290` |
| FR-004-051 | 排序 MUST 保证分组始终在函数之前 | `magic-function-list.vue:292-324` |
| FR-004-052 | 系统 MUST 支持一键折叠所有分组 | `magic-function-list.vue:14, 261-286` |

### 3.7 编辑器联动

| ID | 需求 | 追溯 |
|---|---|---|
| FR-004-060 | 用户点击函数节点时，系统 MUST 通过 bus 发出 `open` 事件，携带函数对象 | `magic-function-list.vue:182-186` |
| FR-004-061 | 用户点击函数节点时，系统 MUST 通过 bus 发出 `status` 事件，记录状态日志 | `magic-function-list.vue:184` |
| FR-004-062 | 系统 MUST 监听 `position-function` 事件，收到后重建路径并定位到指定函数 | `magic-function-list.vue:827-831` |
| FR-004-063 | 定位函数时，若数据尚未加载完成，系统 MUST 缓存目标 ID，待加载完成后自动打开 | `magic-function-list.vue:835-851` |
| FR-004-064 | 系统 MUST 向 `JavaClass` 模块注册函数查找器（`doFindFunction`），供编辑器自动补全使用 | `magic-function-list.vue:855` |
| FR-004-065 | 系统 MUST 向 `JavaClass` 模块注册函数列表获取器（`setFunctionFinder`），返回所有函数的路径和名称 | `magic-function-list.vue:856-863` |

### 3.8 快捷键

| ID | 需求 | 追溯 |
|---|---|---|
| FR-004-070 | 系统 MUST 支持 `Alt+G` 快捷键打开新建分组对话框 | `magic-function-list.vue:876` |

### 3.9 生命周期与事件监听

| ID | 需求 | 追溯 |
|---|---|---|
| FR-004-080 | 系统 MUST 监听 `logout` 事件，登出时清空函数树 | `magic-function-list.vue:864` |
| FR-004-081 | 系统 MUST 监听 `opened` 事件，同步当前打开的文件项 | `magic-function-list.vue:865-867` |
| FR-004-082 | 系统 MUST 监听 `delete-api` 事件，触发函数删除流程 | `magic-function-list.vue:868-870` |
| FR-004-083 | 系统 MUST 监听 `refresh-resource` 事件，触发全量数据刷新 | `magic-function-list.vue:871-873` |

---

## 4. 关键实体

| 实体 | 描述 | 关键属性 |
|---|---|---|
| **FunctionGroup（函数分组）** | 树中的 folder 节点，用于组织函数 | `id`, `name`, `path`, `parentId`, `type='2'`, `folder=true`, `level`, `tmpName`, `tmpPath`, `opened` |
| **Function（函数）** | 树中的 file 节点，代表一个可复用脚本 | `id`/`tmp_id`, `name`, `path`, `groupId`, `groupName`, `groupPath`, `script`, `parameters`, `description`, `lock`, `_type='function'`, `level` |
| **TreeNode（树节点）** | 前端树结构的统一抽象，分组和函数均继承 | `folder`（区分类型）, `level`, `_searchShow`, `selectRightItem`, `children`（仅分组） |
| **CreateGroupObj（新建分组表单）** | 分组创建/编辑的临时状态对象 | `visible`, `id`, `name`, `path`, `parentId`, `type`, `children` |

---

## 5. 接受场景

### 场景 1：新建函数并编辑

- **Given** 用户在函数分组上右键
- **When** 选择"新建函数"
- **Then** 树中出现一个临时函数节点（`tmp_id` 生成），编辑器自动打开该函数
- **And** 函数节点的 `groupId`/`groupName`/`groupPath` 正确指向父分组

### 场景 2：搜索函数

- **Given** 树中有分组 `/用户管理/getUserInfo` 和 `/订单管理/getOrderInfo`
- **When** 用户在搜索框输入 `user`
- **Then** `/用户管理/` 分组及其子节点 `getUserInfo` 保持可见
- **And** `/订单管理/` 分组及其子节点被隐藏（`_searchShow=false`）

### 场景 3：拖拽分组到子级（循环检测）

- **Given** 分组 A 下有子分组 B
- **When** 用户尝试将分组 A 拖拽到分组 B 下
- **Then** 系统拒绝操作并弹出提示"不能移到 B"
- **And** 树结构保持不变

### 场景 4：定位函数（数据未加载完成）

- **Given** 函数树正在加载（`listChildrenData` 为空）
- **When** 收到 `position-function` 事件，携带目标函数 ID
- **Then** 系统将目标 ID 缓存到 `tmpOpenId` 数组
- **And** 数据加载完成后，自动打开对应函数并滚动到可视区域

### 场景 5：删除已保存函数

- **Given** 用户右键点击一个已保存的函数（`id` 非空）
- **When** 选择"删除函数"并确认
- **Then** 系统调用 `POST function/delete` 接口
- **And** 删除成功后，从树中移除该节点
- **And** 通知编辑器关闭对应标签

### 场景 6：锁定/解锁函数

- **Given** 函数当前状态为未锁定（`lock='0'`）
- **When** 用户右键选择"锁定"
- **Then** 系统调用 `POST function/lock` 接口
- **And** 成功后，函数节点显示锁定图标，`lock` 变为 `'1'`

---

## 6. 非功能需求

| ID | 类别 | 需求 | 追溯 |
|---|---|---|---|
| NFR-004-01 | 性能 | 函数树初始化时，分组加载与函数加载 MUST 串行执行（先分组后函数），以确保树构建正确 | `magic-function-list.vue:193-204` |
| NFR-004-02 | 性能 | 搜索操作 MUST 在前端完成，不发起后端请求 | `magic-function-list.vue:165-177` |
| NFR-004-03 | 可用性 | 树节点名称过长时，MUST 通过 `title` 属性展示完整名称+路径 | `magic-function-list.vue:33, 57` |
| NFR-004-04 | 可用性 | 删除操作 MUST 经过二次确认（`$magicConfirm`） | `magic-function-list.vue:507-509, 600-602` |
| NFR-004-05 | 可观测性 | 关键操作（创建/删除/锁定/解锁分组或函数）MUST 通过 bus `report` 事件触发埋点 | `magic-function-list.vue:399, 461, 515, 556, 570, 606` |
| NFR-004-06 | 可观测性 | 所有用户操作 MUST 通过 bus `status` 事件记录状态日志 | `magic-function-list.vue:184, 191, 195, 201, 397, 407, 433, 460, 506, 514, 571, 599, 607, 639` |

---

## 7. 假设与约束

| ID | 描述 | 追溯 |
|---|---|---|
| AS-004-01 | 函数分组的 `type` 固定为 `'2'`，与接口分组的 `type` 值不同（接口为 `'1'`，[NEEDS CLARIFICATION]） | `magic-function-list.vue:145, 593`；`magic-group-choose.vue:75` |
| AS-004-02 | 后端返回的分组数据中，`parentId` 为 `'0'` 表示根级分组 | `magic-function-list.vue:237, 396` |
| AS-004-03 | 函数的 `lock` 字段为字符串 `'0'`/`'1'`，非布尔值 | `magic-function-list.vue:68, 454-462` |
| AS-004-04 | 未保存的函数使用 `tmp_id`（时间戳+随机数）作为前端唯一标识 | `magic-function-list.vue:336, 439` |
| AS-004-05 | `replaceURL` 工具函数用于规范化路径中的连续斜杠 | `magic-function-list.vue:107, 172, 179, 630, 859-860` |
| AS-004-06 | 函数资源与接口资源共用同一套分组后端 API（`group/list`, `group/create`, `group/update`, `group/delete`, `group/copy`），通过 `type` 参数区分 | `magic-function-list.vue:193, 398, 555, 567, 604, 499` |

---

## 8. 依赖

### 8.1 上游依赖

| 模块 | 依赖内容 | 追溯 |
|---|---|---|
| **003-resources-api** | 共用分组后端 API（`group/*`），通过 `type` 参数区分函数分组（`type=2`）与接口分组（`type=1`） | `magic-function-list.vue:193` |
| **011-script-parser** | 无直接依赖；但本模块向 `JavaClass` 注册的函数列表供编辑器自动补全使用，间接影响补全体验 | `magic-function-list.vue:855-863` |
| **008-layout-request** | 请求面板中可通过 `position-function` 事件触发本模块的定位功能 | `magic-editor.vue:228-231` |
| **006-resources-recent** | 消费 `magic-group-choose.vue` 组件用于复制分组时的目标选择 | `magic-function-list.vue:91, 496` |
| **014-infra-transport** | 通过 `request.send()` 发起 HTTP 请求；通过 `requestGroup()` 封装分组请求（JSON body） | `magic-function-list.vue:103, 107` |

### 8.2 下游依赖

| 模块 | 被依赖内容 | 追溯 |
|---|---|---|
| **001-editor-core** | 本模块发出 `open` 事件，编辑器监听后打开对应函数脚本 | `magic-function-list.vue:183` |
| **012-script-language** | 本模块注册的函数列表（`setFunctionFinder`）被语言服务用于自动补全 | `magic-function-list.vue:856-863` |

### 8.3 组件依赖

| 组件 | 用途 | 追溯 |
|---|---|---|
| `magic-tree` | 通用树组件，渲染分组/函数节点 | `magic-function-list.vue:25` |
| `magic-dialog` | 弹窗组件，用于分组创建/编辑 | `magic-function-list.vue:72-86` |
| `magic-input` | 输入框组件，用于分组名称/路径输入 | `magic-function-list.vue:77, 80` |
| `magic-group-choose` | 分组选择器，用于复制分组目标选择 | `magic-function-list.vue:91` |
| `magic-text-icon` | 函数类型图标 | `magic-function-list.vue:65` |

---

## 9. HTTP 端点清单

| 方法 | 路径 | 用途 | 请求体 | 追溯 |
|---|---|---|---|---|
| GET | `group/list?type=2` | 获取函数分组列表 | 无 | `magic-function-list.vue:193` |
| GET | `function/list` | 获取函数列表 | 无 | `magic-function-list.vue:196` |
| POST | `group/create` | 创建函数分组 | JSON: `{id, name, path, type, parentId, ...}` | `magic-function-list.vue:567` |
| POST | `group/update` | 修改/移动函数分组 | JSON: 同上 | `magic-function-list.vue:398, 555, 767` |
| POST | `group/delete` | 删除函数分组 | `{groupId: id}` | `magic-function-list.vue:604` |
| POST | `group/copy` | 复制函数分组 | `{src: srcId, target: targetId}` | `magic-function-list.vue:499` |
| POST | `function/delete` | 删除函数 | `{id: functionId}` | `magic-function-list.vue:512` |
| POST | `function/lock` | 锁定函数 | `{id: functionId}` | `magic-function-list.vue:458` |
| POST | `function/unlock` | 解锁函数 | `{id: functionId}` | `magic-function-list.vue:458` |
| POST | `function/move` | 移动函数到另一个分组 | `{id: functionId, groupId: targetGroupId}` | `magic-function-list.vue:787-789` |

> **注意**：分组相关请求通过 `requestGroup()` 工具函数发送，请求体为 JSON 格式（`Content-Type: application/json`），与默认 `form-urlencoded` 不同。详见 `utils.js:45-59`。

---

## 10. Bus 事件清单

### 10.1 发出的事件（Emit）

| 事件 | 参数 | 时机 | 追溯 |
|---|---|---|---|
| `open` | `item`（函数对象） | 用户点击函数节点 | `magic-function-list.vue:183` |
| `status` | 状态文案字符串 | 各操作节点记录日志 | 多处（见 NFR-004-06） |
| `report` | 埋点事件 ID（如 `group_create`, `function_delete`） | 关键操作完成后 | 多处（见 NFR-004-05） |

### 10.2 监听的事件（On）

| 事件 | 处理 | 追溯 |
|---|---|---|
| `logout` | 清空函数树（`this.tree = []`） | `magic-function-list.vue:864` |
| `opened` | 同步 `currentFileItem` | `magic-function-list.vue:865-867` |
| `delete-api` | 触发函数删除流程 | `magic-function-list.vue:868-870` |
| `refresh-resource` | 触发全量数据刷新（`initData()`） | `magic-function-list.vue:871-873` |
| `position-function` | 定位到指定函数（由 `magic-editor.vue:228-231` 转发调用 `position(id)`） | `magic-function-list.vue:827-831` |

---

## 11. 模块边界

### 11.1 与 003-resources-api（接口资源）的边界

| 维度 | 003-resources-api | 004-resources-function |
|---|---|---|
| 资源类型 | 接口（API） | 函数（Function） |
| 分组 type 参数 | `type=1` | `type=2` |
| 后端 API 前缀 | `api/*`（如 `api/save`, `api/delete`） | `function/*`（如 `function/lock`, `function/move`） |
| 共用 API | `group/*`（通过 `type` 区分） | `group/*`（通过 `type` 区分） |
| 编辑器联动事件 | `position-api` | `position-function` |

### 11.2 与 008-layout-request（请求面板）的边界

- **008-layout-request** 负责发起函数运行/测试请求，展示请求参数和响应结果。
- **004-resources-function** 负责函数资源的组织和管理。
- 两者通过 `position-function` 事件联动：请求面板中引用某个函数时，可触发资源树定位。

### 11.3 与 011-script-parser（脚本解析器）的边界

- **011-script-parser** 负责 magic-script 语言的词法/语法/AST 解析。
- **004-resources-function** 不直接调用解析器，但通过 `JavaClass.setFunctionFinder()` 向编辑器语言服务提供函数列表，用于自动补全。
- 函数脚本的实际解析和编辑由 001-editor-core + 012-script-language 负责。

---

## 12. 待澄清

| ID | 问题 | 影响范围 |
|---|---|---|
| C-004 | 接口分组的 `type` 值是否确为 `'1'`？源码中仅在函数模块看到 `type='2'`，未在接口模块找到显式 `type='1'` 的证据 | 模块边界定义（§11.1） |
| C-005 | `function/move` 端点是否仅改变函数的 `groupId`，还是也支持跨分组的其他属性变更？当前代码仅传 `id` 和 `groupId` | FR-004-041 需求描述精度 |
| C-006 | `position-function` 事件的 `id` 参数是函数的 `id`（后端 ID）还是 `tmp_id`（前端临时 ID）？从 `magic-editor.vue:228-231` 看传入的是 `id`，但新建函数时 `id` 为空 | FR-004-062/063 定位逻辑 |

---

## 13. 源码引用清单

| 文件 | 行号范围 | 说明 |
|---|---|---|
| `src/components/resources/magic-function-list.vue` | 1-98 | 模板：工具栏、树、对话框 |
| `src/components/resources/magic-function-list.vue` | 100-162 | 脚本：导入、组件注册、data 定义 |
| `src/components/resources/magic-function-list.vue` | 165-177 | `doSearch()` — 关键字搜索 |
| `src/components/resources/magic-function-list.vue` | 178-181 | `doFindFunction()` — 按路径查找函数（供 JavaClass 使用） |
| `src/components/resources/magic-function-list.vue` | 182-186 | `open()` — 打开函数（发出 bus 事件） |
| `src/components/resources/magic-function-list.vue` | 188-206 | `initData()` — 初始化数据（分组+函数） |
| `src/components/resources/magic-function-list.vue` | 208-259 | `initTreeData()` — 构建树结构 |
| `src/components/resources/magic-function-list.vue` | 261-286 | `rebuildTree()` — 重建路径/名称 |
| `src/components/resources/magic-function-list.vue` | 287-324 | `treeSortHandle()` / `sortTree()` — 排序 |
| `src/components/resources/magic-function-list.vue` | 326-418 | `folderRightClickHandle()` — 分组右键菜单 |
| `src/components/resources/magic-function-list.vue` | 421-493 | `fileRightClickHandle()` — 函数右键菜单 |
| `src/components/resources/magic-function-list.vue` | 495-503 | `copyGroup()` — 复制分组 |
| `src/components/resources/magic-function-list.vue` | 505-529 | `deleteApiInfo()` — 删除函数 |
| `src/components/resources/magic-function-list.vue` | 532-584 | `openCreateGroupModal()` / `createGroupAction()` — 分组创建/编辑 |
| `src/components/resources/magic-function-list.vue` | 586-596 | `initCreateGroupObj()` — 重置分组表单 |
| `src/components/resources/magic-function-list.vue` | 598-626 | `deleteGroupAction()` — 删除分组 |
| `src/components/resources/magic-function-list.vue` | 629-643 | `copyPathToClipboard()` — 复制路径到剪贴板 |
| `src/components/resources/magic-function-list.vue` | 646-663 | `pushFileItemToGroup()` — 将函数放入分组 |
| `src/components/resources/magic-function-list.vue` | 665-726 | `deleteOrAddGroupToTree()` — 树的增删操作 |
| `src/components/resources/magic-function-list.vue` | 728-730 | `changeForceUpdate()` — 强制更新树组件 |
| `src/components/resources/magic-function-list.vue` | 731-807 | `draggable()` — 拖拽逻辑 |
| `src/components/resources/magic-function-list.vue` | 810-825 | `getItemById()` — 按 ID 查找树节点 |
| `src/components/resources/magic-function-list.vue` | 827-831 | `position()` — 定位函数 |
| `src/components/resources/magic-function-list.vue` | 833-852 | `openItemById()` — 按 ID 打开函数 |
| `src/components/resources/magic-function-list.vue` | 854-877 | `mounted()` — 生命周期：注册 JavaClass、监听 bus 事件、绑定快捷键 |
| `src/scripts/bus.js` | 1-57 | EventBus 实现 + statusLog + cnzz 埋点 |
| `src/api/request.js` | 1-194 | HTTP 请求封装（axios + Qs） |
| `src/scripts/utils.js:45-59` | `requestGroup()` | 分组请求封装（JSON body） |
| `src/scripts/contants.js` | 1-36 | 全局常量（DEFAULT_EXPAND, HEADER 等） |
| `src/scripts/editor/java-class.js:260-272` | `setupOnlineFunction` / `setFunctionFinder` | 函数注册接口 |
| `src/components/magic-editor.vue:228-231` | `position-function` 事件监听 | 根组件转发定位事件 |
| `src/components/resources/magic-group-choose.vue` | 1-202 | 分组选择器组件（复制分组用） |
