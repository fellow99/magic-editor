# 编辑器历史版本模块规范（Editor History Specification）

> 模块编号：002-editor-history
> 状态：已实现（As-Built）
> 最后更新：2026-05-01
> 源码入口：`src/components/editor/magic-history.vue`（158 行）

---

## 1. 模块概述

### 1.1 目的

为用户提供脚本历史版本的**查看、对比与回滚**能力。用户在编辑器中触发"查看历史"后，系统以 diff 视图展示当前脚本与任一历史版本的差异，并允许用户将历史版本内容回滚至编辑器。

### 1.2 解决的问题

- 用户误改/误删脚本后无法恢复到之前的版本
- 无法直观对比当前脚本与历史版本之间的差异
- 缺少版本变更的时间线与操作者信息

### 1.3 范围

**包含**：
- 历史版本列表展示（时间 + 创建者）
- 基于 monaco diff editor 的版本对比视图
- 选中历史版本后拉取远端内容并渲染 diff
- 将历史版本内容回滚至编辑器

**不包含**：
- 历史版本的创建/删除/管理（由后端 magic-api 负责）
- 多文件 diff（仅单脚本对比）
- 三方合并（three-way merge）
- 历史版本的分支/标签管理

---

## 2. 用户故事

| ID | 用户故事 | 源码证据 |
|---|---|---|
| US-001 | 作为脚本编辑者，我希望查看脚本的所有历史版本列表，以便了解变更时间线 | `magic-history.vue:3-7` |
| US-002 | 作为脚本编辑者，我希望点击某个历史版本后看到与当前版本的差异对比，以便确认变更内容 | `magic-history.vue:13, 55-70` |
| US-003 | 作为脚本编辑者，我希望将历史版本的内容恢复到编辑器中，以便撤销误操作 | `magic-history.vue:92-94` |

---

## 3. 功能需求

### 3.1 历史版本列表

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-002-001 | 系统 MUST 在左侧面板以列表形式展示所有历史版本，每项显示格式化日期时间（`YYYY-MM-DD HH:mm:ss`）和创建者（未知时显示 `guest`） | 功能 | `magic-history.vue:3-7` |
| FR-002-002 | 系统 MUST 对当前选中的历史版本施加 `selected` 样式高亮 | 功能 | `magic-history.vue:4` |
| FR-002-003 | 系统 MUST 在列表顶部区域显示当前选中版本的完整时间线和创建者信息，并标注"当前版本"标签 | 功能 | `magic-history.vue:9-12` |

### 3.2 Diff 对比视图

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-002-010 | 系统 MUST 使用 monaco diff editor 渲染对比视图，左侧为历史版本内容（original），右侧为当前编辑器内容（modified） | 功能 | `magic-history.vue:13, 39-51, 65-68` |
| FR-002-011 | 系统 MUST 在 diff editor 中禁用 minimap、代码折叠、空白字符渲染 | 功能 | `magic-history.vue:41-47` |
| FR-002-012 | 系统 MUST 使用项目统一的字体族（`contants.EDITOR_FONT_FAMILY`）和字号（`contants.EDITOR_FONT_SIZE`）渲染 diff editor | 功能 | `magic-history.vue:48-49` |
| FR-002-013 | 系统 MUST 将 diff editor 的语言模式设置为 `magicscript` | 功能 | `magic-history.vue:64, 76` |
| FR-002-014 | 系统 MUST 在 diff editor 可见时调用 `layout()` 方法重新计算布局 | 功能 | `magic-history.vue:85-90` |

### 3.3 历史版本拉取

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-002-020 | 系统 MUST 在用户点击历史版本列表项时，向后端发起请求获取该版本的脚本内容 | 功能 | `magic-history.vue:55-70` |
| FR-002-021 | 系统 MUST 根据资源类型（接口/函数）选择对应的后端路径：接口使用 `backup/get`，函数使用 `function/backup/get` | 功能 | `magic-history.vue:58` |
| FR-002-022 | 系统 MUST 将请求参数 `id`（资源 ID）和 `timestamp`（版本时间戳）传递给后端 | 功能 | `magic-history.vue:59-61` |
| FR-002-023 | 系统 MUST 将后端返回的 `content` 字段解析为 JSON，并从中提取 `script` 字段作为历史版本内容 | 功能 | `magic-history.vue:63` |

### 3.4 版本回滚

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-002-030 | 系统 MUST 提供 `reset()` 方法，将编辑器内容替换为当前选中历史版本的内容 | 功能 | `magic-history.vue:92-94` |

### 3.5 初始化与加载

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-002-040 | 系统 MUST 通过 `load(timestampes, item, scriptEditor, isApi)` 方法接收外部传入的历史版本数据、资源信息、编辑器实例和资源类型 | 功能 | `magic-history.vue:72-83` |
| FR-002-041 | 系统 MUST 在 `load()` 方法中创建当前编辑器内容的 monaco model 作为 diff 的 modified 侧 | 功能 | `magic-history.vue:76` |
| FR-002-042 | 系统 MUST 将传入的时间戳数组映射为包含 `id`、`timestamp`、`dateTime`、`createBy` 的列表项 | 功能 | `magic-history.vue:78-80` |
| FR-002-043 | 系统 MUST 在历史版本列表非空时自动打开第一个版本 | 功能 | `magic-history.vue:81-83` |

---

## 4. 关键实体

| 实体 | 描述 | 关键属性 | 源码证据 |
|---|---|---|---|
| `timestampes` | 历史版本列表 | `id`, `timestamp`, `dateTime`, `createBy` | `magic-history.vue:29, 78-80` |
| `currentItem` | 当前选中的历史版本 | 同 `timestampes` 单项结构 | `magic-history.vue:30` |
| `scriptModel` | monaco model，代表当前编辑器内容 | monaco ITextModel | `magic-history.vue:33, 76` |
| `originalModel` | monaco model，代表历史版本内容 | monaco ITextModel | `magic-history.vue:34, 64` |
| `diffEditor` | monaco diff editor 实例 | monaco IDiffEditor | `magic-history.vue:32, 39-51` |
| `scriptEditor` | 外部传入的 monaco 编辑器实例（父组件） | monaco IStandaloneCodeEditor | `magic-history.vue:31, 75` |

---

## 5. 接口契约

### 5.1 组件方法（被父组件调用）

| 方法 | 签名 | 用途 | 调用方 | 源码证据 |
|---|---|---|---|---|
| `load` | `(timestampes: Array, item: Object, scriptEditor: MonacoEditor, isApi: boolean) => void` | 初始化历史面板数据并创建 diff model | `magic-script-editor.vue:647` | `magic-history.vue:72-83` |
| `reset` | `() => void` | 将编辑器内容回滚为当前选中历史版本 | `magic-script-editor.vue:54` | `magic-history.vue:92-94` |

### 5.2 内部方法

| 方法 | 签名 | 用途 | 源码证据 |
|---|---|---|---|
| `open` | `(item: HistoryItem) => void` | 用户点击列表项时拉取历史版本内容并更新 diff | `magic-history.vue:55-70` |
| `layout` | `() => void` | 在 diff editor 可见时重新计算布局 | `magic-history.vue:85-90` |

### 5.3 组件 Emit

本组件**不定义任何 emit**。所有交互通过父组件直接调用 `$refs.history` 方法完成。

### 5.4 事件总线订阅

| 事件 | 用途 | 源码证据 |
|---|---|---|
| `update-window-size` | 窗口尺寸变化时触发 diff editor 重新布局 | `magic-history.vue:52` |

### 5.5 HTTP 调用

| 方法 | 路径 | 参数 | 响应处理 | 源码证据 |
|---|---|---|---|---|
| POST | `backup/get`（接口）或 `function/backup/get`（函数） | `{ id, timestamp }` | `JSON.parse(info.content).script` → 创建 monaco model | `magic-history.vue:57-70` |

> 注：实际请求通过 `src/api/request.js` 的 `send()` 方法发起，遵循 form-urlencoded 编码 + `magic-token` Header 约定（参见 `overall-api.md §2`）。

---

## 6. 非功能需求

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-002-001 | 布局响应性 | 系统 MUST 在窗口尺寸变化时重新计算 diff editor 布局，且仅在 diff editor DOM 可见时执行 | `magic-history.vue:52, 85-90` |
| NFR-002-002 | 视觉一致性 | diff editor 的字体族、字号必须与主编辑器保持一致，使用 `contants` 中的全局配置 | `magic-history.vue:48-49` |
| NFR-002-003 | 面板尺寸 | 历史面板固定高度为 485px，左侧列表宽度为 210px | `magic-history.vue:104, 111` |

---

## 7. 假设与约束

| ID | 描述 | 依据 |
|---|---|---|
| AS-001 | 后端返回的 `content` 字段为 JSON 字符串，其中包含 `script` 字段 | `magic-history.vue:63` |
| AS-002 | 历史版本时间戳为秒级 Unix 时间戳（需 `* 1` 转为毫秒） | `magic-history.vue:79` |
| AS-003 | 父组件（`magic-script-editor.vue`）保证在调用 `load()` 时传入有效的 monaco editor 实例 | `magic-history.vue:75-76` |
| AS-004 | 历史版本列表由父组件通过 HTTP `backups` 端点预先拉取，本模块不负责拉取列表 | `magic-script-editor.vue:640-645` |

---

## 8. 依赖与边界

### 8.1 上游依赖

| 模块 | 依赖内容 | 边界说明 |
|---|---|---|
| **001-editor-core**（`magic-script-editor.vue`） | 父组件调用 `load()` 传入 `timestampes`、`info`、`editor` 实例、`isApi` 标志；调用 `reset()` 执行回滚 | 本模块不主动获取编辑器内容，完全依赖父组件传入的 `scriptEditor.getValue()` |
| **003-resources-api**（`magic-api-list.vue`） | 间接依赖：资源类型（`_type === 'api'`）由父组件从资源列表传递，决定 HTTP 路径前缀 | 本模块不直接访问资源列表组件 |
| **014-infra-transport**（`api/request.js`） | 通过 `request.send()` 发起 HTTP 请求获取历史版本内容 | 本模块不直接操作 axios，仅使用 `request.send().success()` 链式调用 |

### 8.2 下游依赖

| 模块 | 被依赖内容 |
|---|---|
| monaco-editor | 通过 `monaco.editor.createDiffEditor()` 和 `monaco.editor.createModel()` 创建 diff 视图 |

### 8.3 全局依赖

| 模块 | 用途 | 源码证据 |
|---|---|---|
| `bus.js` | 订阅 `update-window-size` 事件 | `magic-history.vue:52` |
| `contants.js` | 读取 `EDITOR_FONT_FAMILY`、`EDITOR_FONT_SIZE` | `magic-history.vue:48-49` |
| `utils.js` | 使用 `formatDate()` 格式化时间、`isVisible()` 判断 DOM 可见性 | `magic-history.vue:20, 87` |

---

## 9. 待澄清事项

| ID | 问题 | 影响范围 |
|---|---|---|
| NC-001 | `reset()` 方法仅将编辑器内容替换为历史版本文本，但**未触发保存**。用户是否需要手动保存？还是应自动保存？ | 用户体验 / 数据一致性 |
| NC-002 | `open()` 方法中 `originalModel` 在每次点击时被重新创建，但旧 model 未调用 `dispose()` 释放。是否存在内存泄漏风险？ | 性能 / 内存 |
| NC-003 | 面板高度固定为 485px，未随窗口或父容器自适应。是否为设计意图还是遗留硬编码？ | 布局响应性 |

---

## 10. 接受场景

### 场景 1：查看历史版本差异

- **Given** 用户已打开一个接口/函数脚本，且该脚本存在至少一个历史版本
- **When** 用户触发"查看历史"操作
- **Then** 系统弹出历史面板，左侧显示版本列表，右侧显示第一个历史版本与当前内容的 diff 对比

### 场景 2：切换历史版本对比

- **Given** 历史面板已打开且显示某个历史版本的 diff
- **When** 用户点击列表中的另一个历史版本
- **Then** 系统拉取该版本内容并更新 diff 视图的 original 侧，modified 侧保持当前编辑器内容不变

### 场景 3：回滚到历史版本

- **Given** 用户已选中某个历史版本
- **When** 用户触发回滚操作（调用 `reset()`）
- **Then** 编辑器内容被替换为选中历史版本的完整文本

---

## 附录 A：源码引用清单

| 文件 | 行号 | 引用内容 |
|---|---|---|
| `src/components/editor/magic-history.vue` | 1-158 | 模块完整源码（template + script + style） |
| `src/components/editor/magic-history.vue` | 3-7 | 历史版本列表渲染（`v-for` + 点击事件） |
| `src/components/editor/magic-history.vue` | 9-12 | 当前版本信息展示区 |
| `src/components/editor/magic-history.vue` | 13 | diff editor 容器 DOM |
| `src/components/editor/magic-history.vue` | 18 | monaco-editor 导入 |
| `src/components/editor/magic-history.vue` | 19 | bus 事件总线导入 |
| `src/components/editor/magic-history.vue` | 20 | `formatDate`、`isVisible` 工具函数导入 |
| `src/components/editor/magic-history.vue` | 21 | request HTTP 客户端导入 |
| `src/components/editor/magic-history.vue` | 22 | contants 全局常量导入 |
| `src/components/editor/magic-history.vue` | 39-51 | monaco diff editor 初始化配置 |
| `src/components/editor/magic-history.vue` | 52 | `update-window-size` 事件订阅 |
| `src/components/editor/magic-history.vue` | 55-70 | `open()` 方法：拉取历史版本并更新 diff |
| `src/components/editor/magic-history.vue` | 58 | HTTP 路径选择逻辑（接口 vs 函数） |
| `src/components/editor/magic-history.vue` | 63 | `JSON.parse(info.content)` 解析响应 |
| `src/components/editor/magic-history.vue` | 64-68 | monaco model 创建与 diff model 设置 |
| `src/components/editor/magic-history.vue` | 72-83 | `load()` 方法：初始化入口 |
| `src/components/editor/magic-history.vue` | 79 | 时间戳格式化（`t.createDate * 1`） |
| `src/components/editor/magic-history.vue` | 85-90 | `layout()` 方法：布局重算 |
| `src/components/editor/magic-history.vue` | 92-94 | `reset()` 方法：版本回滚 |
| `src/components/editor/magic-history.vue` | 99-158 | CSS 样式（面板布局、列表样式、diff editor 定位） |
| `src/components/editor/magic-script-editor.vue` | 47 | `<magic-history ref="history"/>` 组件引用 |
| `src/components/editor/magic-script-editor.vue` | 54 | `$refs.history.reset()` 调用点 |
| `src/components/editor/magic-script-editor.vue` | 72 | `MagicHistory` 组件导入 |
| `src/components/editor/magic-script-editor.vue` | 640-655 | 父组件拉取历史列表并调用 `load()` |
| `src/api/request.js` | 132-191 | `request.send()` 方法实现 |
| `src/scripts/contants.js` | 31-32 | `EDITOR_FONT_FAMILY` / `EDITOR_FONT_SIZE` 定义 |
| `src/scripts/utils.js` | 4 | `isVisible()` 函数实现 |
| `src/scripts/utils.js` | 17-33 | `formatDate()` 函数实现 |
| `src/scripts/bus.js` | 6-23 | EventBus 实现（`$on/$off/$emit`） |
