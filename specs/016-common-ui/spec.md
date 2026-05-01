# 016-common-ui 模块规范（As-Built）

> 模块编号：016-common-ui
> 状态：已实现
> 最后更新：2026-05-01
> 对应源码：
> - `src/components/common/modal/index.js`（58 行）
> - `src/components/common/modal/magic-dialog.vue`（239 行）
> - `src/components/common/modal/magic-confirm.vue`（85 行）
> - `src/components/common/modal/magic-alert.vue`（69 行）
> - `src/components/common/magic-contextmenu/index.js`（45 行）
> - `src/components/common/magic-contextmenu/Contextmenu.vue`（154 行）
> - `src/components/common/magic-contextmenu/Submenu.vue`（294 行）
> - `src/components/common/magic-contextmenu/util.js`（24 行）
> - `src/components/common/magic-contextmenu/constant.js`（5 行）
> - `src/components/common/magic-tree.vue`（98 行）
> - `src/components/common/magic-tree-item.vue`（27 行）
> - `src/components/common/magic-input.vue`（81 行）
> - `src/components/common/magic-textarea.vue`（42 行）
> - `src/components/common/magic-select.vue`（161 行）
> - `src/components/common/magic-checkbox.vue`（82 行）
> - `src/components/common/magic-file.vue`（56 行）
> - `src/components/common/magic-loading.vue`（141 行）
> - `src/components/common/magic-bottom-panel.vue`（63 行）
> - `src/components/common/magic-text-icon.vue`（44 行）
> - `src/components/common/magic-json.vue`（242 行）
> - `src/components/common/magic-json-tree.vue`（110 行）
> - `src/components/common/magic-json-tree-format.vue`（39 行）
> - `src/components/common/magic-structure.vue`（86 行）
> - `src/components/common/magic-structure-object.vue`（90 行）
> - `src/components/common/magic-structure-array.vue`（101 行）
> - `src/index.js`（23 行）— 插件注册入口
> - `src/main.js`（11 行）— 应用模式插件注册

---

## 1. 模块概述

### 1.1 目的

本模块是 magic-editor 的**通用 UI 组件库**，提供一组可复用的基础 UI 组件和全局插件，供上层布局组件、资源管理组件、编辑器组件消费。按功能可分为六大族群：

1. **对话框族群（modal/）**：可拖拽对话框、Alert、Confirm、通用 Dialog
2. **右键菜单族群（magic-contextmenu/）**：动态右键菜单、多级子菜单、自动定位
3. **表单输入族群**：输入框、多行文本、下拉选择、复选框、文件选择
4. **树形组件族群**：通用树、树节点、JSON 树、JSON 树缩进线
5. **数据结构展示族群**：JSON 查看器（双面板）、对象/数组结构化展示
6. **辅助组件族群**：Loading 覆盖层、底部面板、HTTP 方法文本图标

### 1.2 解决的问题

- 避免上层组件重复实现对话框、右键菜单、表单控件等通用 UI 逻辑
- 通过 `createApp` 动态挂载实现**命令式调用**（`$magicAlert`/`$magicConfirm`/`$magicDialog`/`$magicContextmenu`），无需在模板中预声明组件
- 统一 CSS 变量命名体系（`--input-border-color`、`--select-background` 等），与主题系统联动
- JSON 查看器提供"树形浏览 + 属性编辑"双面板联动，用于请求参数/响应体的可视化编辑
- 大数据量数组（>100 项）自动分块渲染，避免 DOM 节点爆炸

### 1.3 范围

**包含**：
- 对话框/Alert/Confirm 组件及其命令式 API
- 右键菜单组件及其命令式 API
- 表单输入组件（Input/Textarea/Select/Checkbox/File）
- 树组件（MagicTree/MagicTreeItem）
- JSON 查看器与 JSON 树
- 数据结构展示（MagicStructure/Object/Array）
- Loading 覆盖层、底部面板、HTTP 方法图标

**不包含**：
- monaco 编辑器组件 → 模块 001-editor-core
- 资源列表组件（API/Function/Datasource）→ 模块 003/004/005
- 布局组件（Header/Options/Request/Debug/Log）→ 模块 007/008/009/010
- 请求封装（axios）、EventBus、store → 模块 014/015

---

## 2. 用户场景与用例

### US-016-01：操作失败时弹出错误提示

- **角色**：开发者
- **前置条件**：执行某项操作（保存/上传/推送等）失败
- **流程**：
  1. 系统调用 `modal.magicAlert({ title: '错误', content: '错误信息' })`
  2. 页面中央弹出 Alert 对话框，显示标题和错误内容
  3. 用户点击"OK"按钮关闭对话框
- **后置条件**：对话框从 DOM 中移除

### US-016-02：删除资源前二次确认

- **角色**：开发者
- **前置条件**：用户点击删除按钮
- **流程**：
  1. 系统调用 `modal.magicConfirm({ title: '提示', content: '确认删除？', onOk: fn })`
  2. 弹出 Confirm 对话框，显示"是"/"否"按钮
  3. 用户点击"是" → 执行 `onOk` 回调
  4. 用户点击"否" → 关闭对话框，不执行回调
- **后置条件**：根据用户选择执行或取消删除

### US-016-03：资源树上右键操作

- **角色**：开发者
- **前置条件**：用户在资源树节点上右键点击
- **流程**：
  1. 系统调用 `$magicContextmenu({ event, menus: [...] })`
  2. 在鼠标位置弹出右键菜单
  3. 用户点击某个菜单项 → 执行对应 `onClick` 回调 → 菜单自动关闭
  4. 用户点击菜单外区域 → 菜单自动关闭
- **后置条件**：执行选中操作

### US-016-04：查看/编辑 JSON 请求参数

- **角色**：开发者
- **前置条件**：打开请求面板的 Body/参数页签
- **流程**：
  1. 左侧显示 JSON 树形结构，按数据类型着色
  2. 用户点击某个 JSON 节点 → 右侧属性面板显示该节点的 Key/Value/类型/是否必填/默认值/验证方式/注释
  3. 用户在右侧面板修改属性 → 数据双向绑定更新
- **后置条件**：JSON 结构数据被修改

### US-016-05：查看调试响应中的复杂对象

- **角色**：开发者
- **前置条件**：脚本执行后返回复杂 JSON 响应
- **流程**：
  1. 系统使用 `MagicStructure` 组件渲染响应数据
  2. 简单类型（String/Number/Boolean）直接着色显示
  3. 对象/数组显示为可展开结构，点击展开图标逐层展开
  4. 超大数组（>100 项）自动分块为 `[0...99]`、`[100...199]` 等区间
- **后置条件**：用户可逐层浏览复杂数据结构

### US-016-06：启动时显示 Loading 动画

- **角色**：开发者
- **前置条件**：应用启动，等待后端响应
- **流程**：
  1. `MagicLoading` 组件覆盖整个视口（z-index: 9999999）
  2. 显示"Loading"逐字动画 + "By magic-editor x.x.x"版本信息
  3. 登录/资源加载完成后隐藏
- **后置条件**：Loading 层消失，主界面可见

---

## 3. 功能需求（FR）

### 3.1 对话框族群

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-016-001 | 对话框 MUST 支持标题、内容、自定义 CSS 类名、宽度/高度/最大宽高、内边距 | `magic-dialog.vue:24-74` |
| FR-016-002 | 对话框 MUST 支持可拖拽移动（通过标题栏 mousedown/mousemove/mouseup） | `magic-dialog.vue:91-116` |
| FR-016-003 | 对话框拖拽范围 MUST 限制在 `.ma-container` 根容器内，不可拖出视口 | `magic-dialog.vue:95-109` |
| FR-016-004 | 对话框 MUST 支持 `v-model` 双向绑定可见性 | `magic-dialog.vue:46-49, 85-88` |
| FR-016-005 | 对话框 MUST 提供 `content` 插槽和 `buttons` 插槽 | `magic-dialog.vue:12-16` |
| FR-016-006 | 对话框 MUST 支持可选遮罩层（`shade` prop，默认关闭） | `magic-dialog.vue:71-74` |
| FR-016-007 | 对话框 MUST 支持关闭按钮显隐控制（`showClose`，默认显示） | `magic-dialog.vue:29-32` |
| FR-016-008 | 对话框关闭时 MUST 触发 `onClose` 回调和 `change` 事件 | `magic-dialog.vue:129-135` |
| FR-016-009 | Alert 对话框 MUST 仅显示一个"OK"按钮，内容以纯文本显示（不解析 HTML） | `magic-alert.vue:3-8` |
| FR-016-010 | Confirm 对话框 MUST 显示"是"/"否"两个按钮，内容以 HTML 渲染（支持 `v-html`） | `magic-confirm.vue:3-9` |
| FR-016-011 | Alert/Confirm/Dialog 的按钮文字 MUST 可通过 props 自定义（`ok`/`cancel`） | `magic-alert.vue:26-28`、`magic-confirm.vue:27-33` |
| FR-016-012 | `$magicAlert`/`$magicConfirm`/`$magicDialog` MUST 通过 `createApp` 动态挂载到 `document.body`，并尝试追加到 `.ma-container` 内 | `modal/index.js:6-35` |
| FR-016-013 | 命令式调用 MUST 将传入 options 展开为组件 props，`visible` 默认设为 `true` | `modal/index.js:12-25` |
| FR-016-014 | Modal 插件 MUST 注册为 Vue 全局属性（`$magicAlert`/`$magicConfirm`/`$magicDialog`）和导出对象（`modal.magicAlert` 等） | `modal/index.js:42-57` |

### 3.2 右键菜单族群

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-016-020 | 右键菜单 MUST 接受菜单项数组（`menus`），每项包含 `label`、`icon`（可选）、`onClick`、`disabled`、`hidden`、`divided`、`children`（子菜单） | `Submenu.vue:10-61` |
| FR-016-021 | 菜单项 MUST 支持三种状态：可点击（available）、禁用（disabled）、含子菜单（expand） | `Submenu.vue:12-60` |
| FR-016-022 | 子菜单 MUST 在鼠标悬停时自动展开，同一时刻仅保持一个子菜单打开 | `Submenu.vue:153-197` |
| FR-016-023 | 子菜单打开方向 MUST 自动检测：优先向右，空间不足时向左；超出视口底部时自动上翻 | `Submenu.vue:114-151` |
| FR-016-024 | 菜单 MUST 在点击菜单外区域、鼠标滚轮滚动、mousedown 非菜单区域时自动关闭 | `Contextmenu.vue:78-112` |
| FR-016-025 | 同一时刻 MUST 仅存在一个右键菜单实例（新调用自动销毁旧实例） | `magic-contextmenu/index.js:26` |
| FR-016-026 | 菜单位置 MUST 从鼠标事件 `clientX/clientY` 或显式 `x/y` 参数获取 | `magic-contextmenu/index.js:16-17` |
| FR-016-027 | 菜单 MUST 支持自定义 `zIndex`、`minWidth`、`customClass` | `Contextmenu.vue:14-17` |
| FR-016-028 | `$magicContextmenu` MUST 通过 `createApp` 动态挂载，并提供 `ContextmenuProxy.destroy()` 静态方法 | `magic-contextmenu/index.js:9-37` |
| FR-016-029 | 菜单插件 MUST 注册为 Vue 全局属性 `$magicContextmenu` | `magic-contextmenu/index.js:39-44` |

### 3.3 表单输入族群

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-016-040 | 输入框 MUST 支持 `type`（默认 text）、`placeholder`、`value`（v-model）、`readonly`、`width`、`icon` | `magic-input.vue:13-47` |
| FR-016-041 | 输入框右侧图标 MUST 可点击（触发 `onClick` 回调） | `magic-input.vue:3,6` |
| FR-016-042 | 输入框 MUST 在 Enter 键按下时触发 `onEnter` 回调 | `magic-input.vue:5` |
| FR-016-043 | 输入框 MUST 触发 `update:value` 和 `input` 两个事件 | `magic-input.vue:4` |
| FR-016-044 | 多行文本框 MUST 支持 `placeholder`、`value`（v-model）、`focus` 回调，禁止拖拽缩放 | `magic-textarea.vue:2-3, 34` |
| FR-016-045 | 下拉选择器 MUST 接受 `options` 数组（每项含 `value`/`text`），支持 `v-model:value` | `magic-select.vue:6, 17-20` |
| FR-016-046 | 下拉选择器 MUST 支持可输入模式（`inputable=true` 时显示 input 而非 span） | `magic-select.vue:3-4, 26-28` |
| FR-016-047 | 下拉选择器 MUST 自动计算下拉列表位置，当超出视口底部时自动翻转到上方显示 | `magic-select.vue:51-53` |
| FR-016-048 | 下拉选择器 MUST 在点击根元素外部时自动关闭列表 | `magic-select.vue:40` |
| FR-016-049 | 下拉选择器 MUST 支持 `defaultValue` 作为无选中值时的回退显示 | `magic-select.vue:19, 69-80` |
| FR-016-050 | 复选框 MUST 支持 `value`（v-model）、`checkedHalf`（半选状态），使用 CSS 伪元素渲染勾选/半选图标 | `magic-checkbox.vue:3-4, 74-81` |
| FR-016-051 | 复选框 MUST 在点击时阻止事件冒泡 | `magic-checkbox.vue:2` |
| FR-016-052 | 文件选择器 MUST 封装原生 `<input type="file">`，通过 `MagicInput` 显示已选文件名 | `magic-file.vue:2-5` |
| FR-016-053 | 文件选择器 MUST 支持 `accept`（文件类型过滤）和 `multiple`（多选） | `magic-file.vue:18-25` |
| FR-016-054 | 文件选择器 MUST 提供 `getFile()` 和 `getFiles()` 方法获取原生 File 对象 | `magic-file.vue:41-44` |

### 3.4 树形组件族群

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-016-060 | 树组件 MUST 接受 `data` 数组，每项包含 `id`、`folder`（是否为文件夹）、`opened`（是否展开）、`children` | `magic-tree.vue:6`、`magic-tree-item.vue:3-6` |
| FR-016-061 | 树组件 MUST 支持 `loading` 状态，带延迟隐藏（`loadingTime`，默认 500ms）防止闪烁 | `magic-tree.vue:33-40, 51-58` |
| FR-016-062 | 树组件 MUST 在数据为空时显示"无数据"提示 | `magic-tree.vue:20` |
| FR-016-063 | 树组件 MUST 支持 `forceUpdate` prop 强制刷新子组件 | `magic-tree.vue:4, 32` |
| FR-016-064 | 树节点 MUST 支持具名插槽 `folder`（文件夹节点）和 `file`（文件节点），以及默认插槽 | `magic-tree-item.vue:3-5` |
| FR-016-065 | 树组件 MUST 将父组件的所有插槽透传给子节点 | `magic-tree.vue:8-10`、`magic-tree-item.vue:9-11` |
| FR-016-066 | JSON 树 MUST 接受 `jsonData` 数组，递归渲染 Object/Array 类型节点 | `magic-json-tree.vue:3, 20-22` |
| FR-016-067 | JSON 树 MUST 按数据类型着色：数值类（粉红）、布尔（橙色）、字符串（绿色） | `magic-json-tree.vue:57-73` |
| FR-016-068 | JSON 树 MUST 在点击节点时触发 `jsonClick` 事件并传递节点数据 | `magic-json-tree.vue:79-86` |
| FR-016-069 | JSON 树缩进线 MUST 使用 GIF 图片（elbow/end/line/s）渲染树形连接线 | `magic-json-tree-format.vue:2-7` |

### 3.5 数据结构展示族群

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-016-080 | JSON 查看器 MUST 采用左右双面板布局：左侧 JSON 树、右侧属性编辑面板 | `magic-json.vue:2-87` |
| FR-016-081 | JSON 查看器右侧面板 MUST 根据节点类型显示不同字段：基本类型显示 Key/Value/参数类型/是否必填/默认值/验证方式/表达式/验证说明/注释；Object/Array 仅显示 Key/对象注释/是否必填 | `magic-json.vue:11-86` |
| FR-016-082 | JSON 查看器 MUST 在 `type='request'` 时显示请求参数字段（是否必填/默认值/验证方式等） | `magic-json.vue:27-57, 78-85` |
| FR-016-083 | JSON 查看器 MUST 提供参数类型下拉选项（String/Integer/Double/Long/Short/Float/Byte/Boolean） | `magic-json.vue:116-125` |
| FR-016-084 | JSON 查看器 MUST 提供验证方式下拉选项（不验证/表达式验证/正则验证） | `magic-json.vue:111-115` |
| FR-016-085 | 数据结构展示 MUST 自动识别数据类型：`java.lang.*` 前缀的类型直接显示为文本，其余尝试 JSON 解析 | `magic-structure.vue:24-32` |
| FR-016-086 | 对象展示 MUST 支持简单模式（单行 `{...}`）和展开模式（逐行显示属性），点击展开图标切换 | `magic-structure-object.vue:3, 20-36` |
| FR-016-087 | 数组展示 MUST 在元素数量 >100 时自动分块，每块 100 项，显示为 `[start...end]` 区间 | `magic-structure-array.vue:59-71` |
| FR-016-088 | 数据结构展示 MUST 按类型着色：number（变量色）、string（字符串色）、boolean（布尔色）、property/key（键名色） | `magic-structure.vue:62-80` |

### 3.6 辅助组件族群

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-016-100 | Loading 组件 MUST 显示"Loading"逐字拉伸动画和版本信息 | `magic-loading.vue:3-14` |
| FR-016-101 | Loading 组件 MUST 接受 `title` 和 `version` props | `magic-loading.vue:21-26` |
| FR-016-102 | Loading 组件 MUST 覆盖整个视口（z-index: 9999999） | `magic-loading.vue:32-39` |
| FR-016-103 | 底部面板 MUST 显示标题、操作按钮图标数组、最小化按钮 | `magic-bottom-panel.vue:3-8` |
| FR-016-104 | 底部面板最小化按钮 MUST 触发 `update:selectedTab` 事件设为 `null` | `magic-bottom-panel.vue:7` |
| FR-016-105 | 底部面板 MUST 提供默认插槽用于放置面板内容 | `magic-bottom-panel.vue:10` |
| FR-016-106 | HTTP 方法文本图标 MUST 根据 `value`（GET/POST/DELETE/PUT/function）显示不同颜色和缩写文本 | `magic-text-icon.vue:14-21` |
| FR-016-107 | HTTP 方法文本图标 MUST 对 DELETE 显示"DEL"、对 function 显示"Fn" | `magic-text-icon.vue:17-19` |

### 3.7 插件注册

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-016-120 | Modal 和 Contextmenu 插件 MUST 在 `install()` 中通过 `app.use()` 注册 | `index.js:11-12` |
| FR-016-121 | 库模式下，插件 MUST 在 `window.Vue` 存在时自动 `window.Vue.use(plugin)` | `index.js:19-21` |
| FR-016-122 | 应用模式下，插件 MUST 在 `main.js` 中显式 `app.use()` 注册 | `main.js:8-9` |

---

## 4. 关键实体

### 4.1 对话框相关

| 实体 | 描述 | 关键属性 | 源码证据 |
|---|---|---|---|
| `DialogOptions` | 对话框配置对象 | `title`, `content`, `className`, `width`, `height`, `maxWidth`, `maxHeight`, `padding`, `moveable`, `shade`, `showClose`, `align`, `onClose` | `magic-dialog.vue:23-74` |
| `AlertOptions` | Alert 配置 | `title`（默认"提示"）, `content`, `ok`（默认"OK"）, `onOk`, `onClose` | `magic-alert.vue:19-40` |
| `ConfirmOptions` | Confirm 配置 | `title`（默认"提示"）, `content`, `ok`（默认"是"）, `cancel`（默认"否"）, `onOk`, `onCancel`, `onClose` | `magic-confirm.vue:21-49` |

### 4.2 右键菜单相关

| 实体 | 描述 | 关键属性 | 源码证据 |
|---|---|---|---|
| `MenuItem` | 菜单项配置 | `label`, `icon`（可选）, `onClick`, `disabled`, `hidden`, `divided`, `children`（子菜单数组）, `minWidth`, `customClass` | `Submenu.vue:10-61` |
| `ContextmenuOptions` | 右键菜单配置 | `menus`, `x`/`y` 或 `event`, `customClass`, `minWidth`, `zIndex`, `destroy` | `magic-contextmenu/index.js:13-22` |

### 4.3 表单相关

| 实体 | 描述 | 关键属性 | 源码证据 |
|---|---|---|---|
| `SelectOption` | 下拉选项项 | `value`, `text` | `magic-select.vue:6, 69-79` |
| `BodyType` | JSON 参数类型选项 | `value`: String/Integer/Double/Long/Short/Float/Byte/Boolean | `magic-json.vue:116-125` |
| `ValidateType` | JSON 验证方式选项 | `value`: pass/expression/pattern | `magic-json.vue:111-115` |

### 4.4 树/JSON 相关

| 实体 | 描述 | 关键属性 | 源码证据 |
|---|---|---|---|
| `TreeNode` | 树节点数据 | `id`, `folder`, `opened`, `children` | `magic-tree.vue:6`、`magic-tree-item.vue:3-6` |
| `JsonNode` | JSON 树节点数据 | `name`, `value`, `dataType`, `children`, `selected`, `level`, `required`, `defaultValue`, `validateType`, `expression`, `error`, `description` | `magic-json-tree.vue:3-17`、`magic-json.vue:11-86` |

---

## 5. 非功能需求（NFR）

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-016-001 | 主题一致性 | 所有组件 MUST 使用 CSS 变量（`var(--xxx)`）定义颜色/边框/背景，不得硬编码色值（Loading 组件除外） | 各组件 `<style>` 段 |
| NFR-016-002 | 性能 | 数组元素超过 100 项时 MUST 自动分块渲染，避免一次性创建过多 DOM 节点 | `magic-structure-array.vue:59-71` |
| NFR-016-003 | 性能 | Loading 动画 MUST 使用 CSS `animation` 而非 JavaScript 定时器 | `magic-loading.vue:70-103` |
| NFR-016-004 | 可用性 | 右键菜单 MUST 在窗口边界自动调整位置，确保不超出视口 | `Submenu.vue:107-151` |
| NFR-016-005 | 可用性 | 对话框拖拽 MUST 限制在根容器范围内，不可拖出可视区域 | `magic-dialog.vue:95-109` |
| NFR-016-006 | 内存安全 | 右键菜单新实例创建前 MUST 销毁旧实例，防止内存泄漏 | `magic-contextmenu/index.js:26`、`Contextmenu.vue:62-72` |
| NFR-016-007 | 防闪烁 | 树组件的 loading 状态 MUST 支持延迟隐藏（默认 500ms），避免快速切换时的视觉闪烁 | `magic-tree.vue:37-40, 51-58` |
| NFR-016-008 | z-index 层级 | 对话框 z-index MUST 为 999999，Loading 覆盖层 MUST 为 9999999，确保在最上层 | `magic-dialog.vue:159`、`magic-loading.vue:37` |

---

## 6. 假设与约束

- **假设 A-016-001**：所有组件的 CSS 变量由根组件 `magic-editor.vue` 通过 `defineTheme()` 注册的主题提供，组件本身不定义默认色值（除 Loading 组件硬编码 `#fff`/`#0075ff`/`#889aa4`）。
- **假设 A-016-002**：`MagicTree` 的 `data` 数组中每项的 `id` 字段用于 Vue `:key` 绑定，必须唯一。
- **假设 A-016-003**：`MagicJson` 的 `jsonData` 是经过预处理的树形结构数组（非原始 JSON 对象），每项包含 `name`/`value`/`dataType`/`children` 等字段。
- **约束 C-016-001**：对话框的拖拽功能依赖 `.ma-container` 根容器的存在；若该容器不存在，拖拽范围计算将失败（`magic-dialog.vue:137`）。
- **约束 C-016-002**：右键菜单的自动关闭逻辑依赖全局 `document` 事件监听，多个菜单实例不会共存。
- **约束 C-016-003**：`MagicCheckbox` 的 `cboId` 使用 `Date.now() + random` 生成，在极短时间内创建多个复选框时可能产生 ID 冲突。
- **约束 C-016-004**：`MagicSelect` 的下拉列表使用 `position: fixed` 定位，在滚动容器内可能出现位置偏移。

---

## 7. 依赖关系

### 7.1 上游依赖（本模块消费）

| 模块 | 依赖内容 | 证据 |
|---|---|---|
| **015-infra-bus-store** | `utils.js` 中的 `deepClone` 函数（JSON 树缩进计算） | `magic-json-tree.vue:31` |
| **主题系统** | CSS 变量（`--input-border-color`、`--select-background`、`--dialog-border-color` 等）由各主题 JS 文件定义 | 各组件 `<style>` 段 |
| **静态资源** | 树形连接线 GIF（`elbow.gif`/`elbow-end.gif`/`elbow-line.gif`/`s.gif`）、JSON 类型图标（`array.gif`/`object.gif`） | `magic-json-tree-format.vue:12-15`、`magic-json-tree.vue:29-30` |

### 7.2 下游依赖（消费本模块）

| 模块 | 消费的组件/API | 使用场景 | 证据 |
|---|---|---|---|
| **001-editor-core** | `MagicDialog` | 调试变量查看 | `magic-script-editor.vue:71` |
| **003-resources-api** | `$magicAlert`/`$magicConfirm`/`MagicDialog`/`$magicContextmenu`/`MagicInput`/`MagicSelect`/`MagicCheckbox`/`MagicTree` | 接口 CRUD、右键菜单、搜索过滤、复制/移动对话框 | `magic-api-list.vue` |
| **004-resources-function** | `$magicAlert`/`$magicConfirm`/`MagicDialog`/`$magicContextmenu`/`MagicInput`/`MagicSelect`/`MagicTree` | 函数 CRUD、右键菜单、搜索过滤 | `magic-function-list.vue` |
| **005-resources-datasource** | `$magicAlert`/`$magicConfirm`/`MagicDialog`/`$magicContextmenu`/`MagicInput`/`MagicSelect`/`MagicTree` | 数据源 CRUD、右键菜单 | `magic-datasource-list.vue` |
| **006-resources-recent** | `MagicDialog`/`MagicTree` | 最近打开列表、资源选择器 | `magic-recent-opened.vue`、`magic-resource-choose.vue` |
| **007-layout-header** | `MagicDialog`/`MagicInput`/`MagicFile` | 上传/导出/推送对话框 | `magic-header.vue:91-95` |
| **008-layout-request** | `MagicJson`/`MagicInput`/`MagicSelect`/`MagicCheckbox`/`MagicTextarea` | 请求参数编辑面板 | `magic-request.vue` |
| **009-layout-debug** | `MagicStructure`/`MagicStructureObject`/`MagicStructureArray` | 调试变量/响应数据展示 | `magic-debug.vue` |
| **010-layout-options** | `MagicBottomPanel`/`MagicInput`/`MagicSelect`/`MagicTextarea` | 底部 Options 子面板 | `magic-option.vue`、`magic-options.vue` |
| **014-infra-transport** | `modal.magicAlert` | HTTP 错误提示 | `request.js:62-66, 117-127` |
| **全局** | `MagicLoading` | 启动 Loading 覆盖层 | `magic-editor.vue` |
| **全局** | `MagicTextIcon` | 资源树 HTTP 方法图标 | `magic-api-list.vue`、`magic-function-list.vue` |

### 7.3 模块边界说明

| 边界 | 说明 |
|---|---|
| **与 014-infra-transport** | `request.js` 直接导入 `modal` 对象调用 `magicAlert`，不通过 Vue 实例。这是模块间直接 JS 导入的唯一场景。 |
| **与主题系统** | 本组件不定义颜色默认值（Loading 除外），完全依赖 CSS 变量。主题变更时组件自动响应，无需额外逻辑。 |
| **与 008-layout-request** | `MagicJson` 组件内部组合了 `MagicInput`/`MagicSelect`/`MagicCheckbox`/`MagicJsonTree`，是表单输入族群的"消费者"。 |

---

## 8. 待澄清

| ID | 问题 | 影响范围 |
|---|---|---|
| Q-016-001 | `MagicTree` 的 `data` 数组中 `id` 字段的生成规则未在组件内部定义，由调用方（资源列表组件）负责提供。`id` 是否保证全局唯一？若重复是否会导致 Vue key 冲突？ | 树渲染正确性 |
| Q-016-002 | `MagicJson` 组件中 `fieldObj` 的修改直接 mutate 了 `jsonData` 中的引用对象（`magic-json.vue:176`），这种直接 mutate 是否符合 Vue 3 的响应式最佳实践？是否应使用深拷贝？ | 数据一致性 |
| Q-016-003 | `MagicSelect` 组件在 `mounted` 时监听 `$root.$el` 的 click 事件来关闭下拉列表（`magic-select.vue:40`），但未在 `unmounted` 时移除。是否存在内存泄漏风险？ | 内存安全 |

---

## 9. 源码引用清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/components/common/modal/index.js` | 58 | Modal 插件注册：`$magicAlert`/`$magicConfirm`/`$magicDialog` 命令式 API |
| `src/components/common/modal/magic-dialog.vue` | 239 | 通用对话框：可拖拽、可定制、支持插槽 |
| `src/components/common/modal/magic-alert.vue` | 69 | Alert 对话框：单按钮、纯文本内容 |
| `src/components/common/modal/magic-confirm.vue` | 85 | Confirm 对话框：双按钮、HTML 内容 |
| `src/components/common/magic-contextmenu/index.js` | 45 | Contextmenu 插件注册：`$magicContextmenu` 命令式 API |
| `src/components/common/magic-contextmenu/Contextmenu.vue` | 154 | 右键菜单容器：事件监听、实例管理 |
| `src/components/common/magic-contextmenu/Submenu.vue` | 294 | 子菜单组件：多级菜单、自动定位、悬停展开 |
| `src/components/common/magic-contextmenu/util.js` | 24 | DOM 工具：`hasClass`、`getElementsByClassName` |
| `src/components/common/magic-contextmenu/constant.js` | 5 | 常量：子菜单偏移量、打开方向、组件名 |
| `src/components/common/magic-tree.vue` | 98 | 树组件：数据渲染、loading 状态、空数据提示 |
| `src/components/common/magic-tree-item.vue` | 27 | 树节点：递归渲染、插槽透传 |
| `src/components/common/magic-input.vue` | 81 | 输入框：支持图标、Enter 回调、v-model |
| `src/components/common/magic-textarea.vue` | 42 | 多行文本框：不可缩放、v-model |
| `src/components/common/magic-select.vue` | 161 | 下拉选择器：可输入模式、自动翻转、v-model |
| `src/components/common/magic-checkbox.vue` | 82 | 复选框：半选状态、CSS 伪元素图标 |
| `src/components/common/magic-file.vue` | 56 | 文件选择器：封装原生 input、显示文件名 |
| `src/components/common/magic-loading.vue` | 141 | Loading 覆盖层：逐字动画、版本信息 |
| `src/components/common/magic-bottom-panel.vue` | 63 | 底部面板：标题栏、操作按钮、最小化 |
| `src/components/common/magic-text-icon.vue` | 44 | HTTP 方法文本图标：颜色映射、缩写 |
| `src/components/common/magic-json.vue` | 242 | JSON 查看器：双面板、属性编辑、请求参数模式 |
| `src/components/common/magic-json-tree.vue` | 110 | JSON 树：递归渲染、类型着色、点击事件 |
| `src/components/common/magic-json-tree-format.vue` | 39 | JSON 树缩进线：GIF 图片连接线 |
| `src/components/common/magic-structure.vue` | 86 | 数据结构展示：类型识别、分发到 Object/Array |
| `src/components/common/magic-structure-object.vue` | 90 | 对象展示：简单/展开模式、逐行属性 |
| `src/components/common/magic-structure-array.vue` | 101 | 数组展示：分块渲染（>100 项）、展开模式 |
| `src/index.js` | 23 | 库模式入口：组件注册 + 插件安装 |
| `src/main.js` | 11 | 应用模式入口：插件安装 + 挂载 |
