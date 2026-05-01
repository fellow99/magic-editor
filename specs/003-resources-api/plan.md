# 003-resources-api 技术实现计划（As-Built）

> 本文档为反向归纳的技术计划，描述实际已构建的架构、设计决策与实现策略。
> 模块：003-resources-api
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01
> 源码入口：`src/components/resources/magic-api-list.vue`（982 行）
> 对应样式：`src/components/resources/magic-resource.css`（109 行）

---

## 1. 技术上下文

### 1.1 运行环境

| 维度 | 值 | 证据 |
|---|---|---|
| 运行时 | 现代浏览器（Chrome/Edge/Firefox/Safari） | `vite.config.js`，无 polyfill |
| 框架 | Vue 3.4.0（Options API） | `package.json:22`、`magic-api-list.vue:122-977` |
| 构建工具 | Vite 5.4.21 | `package.json:28` |
| 交付形态 | jar 内嵌 SPA（`dist-app/`）+ NPM 库（`dist/`） | `vite.config.js:118-207` |

### 1.2 依赖清单

| 依赖 | 版本 | 用途 | 类型 | 源码证据 |
|---|---|---|---|---|
| `vue` | ^3.4.0 | 组件框架 | 直接 | `magic-api-list.vue:122` |
| `axios` | ^0.21.0 | HTTP 请求（通过 `request.js` 封装） | 间接 | `request.js:1` |
| `qs` | ^6.9.4 | 请求体 form-urlencoded 编码 | 间接 | `request.js:2, 31` |

**间接依赖（通过项目内部模块）**：

| 模块 | 文件 | 用途 | 源码证据 |
|---|---|---|---|
| bus | `src/scripts/bus.js` | 发射/订阅跨组件事件（`status`/`open`/`report`/`api-group-selected`/`logout`/`opened`/`delete-api`/`refresh-resource`/`update-group`/`position-api`） | `magic-api-list.vue:110,189-191,337,340,364,413,512,589,646,684,717,847,858,867,883,958-972` |
| contants | `src/scripts/contants.js` | 读取 `DEFAULT_EXPAND`（树默认展开）、`SERVER_URL`（路径复制） | `magic-api-list.vue:117,221,708,750,773` |
| hotkey | `src/scripts/hotkey.js` | `Key.bind()` 注册 Alt+G 快捷键 | `magic-api-list.vue:118,975` |
| utils | `src/scripts/utils.js` | `replaceURL`（路径规范化）、`download`（导出 zip）、`requestGroup`（分组 CRUD）、`deepClone`（复制接口）、`goToAnchor`（锚点滚动） | `magic-api-list.vue:116,183,436,554,635,651,708,856,881` |
| request | `src/api/request.js` | HTTP 请求封装（`send().success()` 链式调用） | `magic-api-list.vue:112,200,203,430,509,586,682,868` |
| JavaClass | `src/scripts/editor/java-class.js` | `setApiFinder()` 注册 API 发现器 | `magic-api-list.vue:119,949-957` |

**消费的通用 UI 组件（016-common-ui 模块）**：

| 组件 | 用途 | 源码证据 |
|---|---|---|
| `MagicTree` | 树形渲染容器（`#folder`/`#file` 插槽） | `magic-api-list.vue:25-71` |
| `MagicDialog` | 新建分组/复制接口/复制分组弹窗容器 | `magic-api-list.vue:73-105` |
| `MagicInput` | 分组名称/前缀输入框 | `magic-api-list.vue:78,81` |
| `MagicTextIcon` | HTTP 方法图标渲染 | `magic-api-list.vue:66` |
| `$magicContextmenu` | 右键菜单（分组/接口） | `magic-api-list.vue:335,453` |
| `$magicAlert` | 提示框（复制校验、锁定失败、删除失败等） | `magic-api-list.vue:460,480,516,594,624,681,700,719,861` |
| `$magicConfirm` | 确认框（删除接口/删除分组） | `magic-api-list.vue:581,678` |

**消费的其他模块组件**：

| 组件 | 模块 | 用途 | 源码证据 |
|---|---|---|---|
| `MagicGroupChoose` | 006-resources-recent | 复制接口/分组时的目标分组选择器 | `magic-api-list.vue:88-105,547-548,570` |

---

## 2. Constitution 合规性检查

| 条款 | 状态 | 检查项 | 判定依据 |
|---|---|---|---|
| **第一条** 单一主组件 + 注入式配置 | ✅ 合规 | 本模块不暴露根组件，不硬编码后端地址 | 所有 HTTP 路径通过 `request.send()` 相对路径发起；`SERVER_URL` 从 `contants` 读取（由主组件注入） |
| **第二条** 前后端契约即真相 | ✅ 合规 | 不持久化业务数据，所有 CRUD 走 HTTP | 分组/接口 CRUD 均通过 `request.send()` 或 `requestGroup()` 发起；无 localStorage 写入业务数据 |
| **第三条** 通信双通道 | ✅ 合规 | 资源树加载/CRUD 走 HTTP，不走 WebSocket | 所有端点（`group/list`、`list`、`group/create`、`delete`、`lock`、`unlock`、`api/move`、`group/copy`、`group/delete`、`group/update`、`/download`）均通过 HTTP |
| **第四条** 事件总线即全局状态 | ✅ 合规 | 跨组件通信统一通过 bus | 发射 `status`/`open`/`report`/`api-group-selected`；订阅 `logout`/`opened`/`delete-api`/`refresh-resource`/`update-group`/`position-api`；组件内部状态使用 Vue `data()` |
| **第五条** monaco 围绕 magic-script | ✅ 合规 | 本模块不涉及编辑器内核 | 仅通过 `JavaClass.setApiFinder()` 注册 API 发现器，不触碰 monaco 语言服务 |
| **第六条** Header 表达类型契约 | ✅ 合规 | 不自行设置 Header（除导出时显式设 `Content-Type: application/json`） | `request.js:112` 自动注入 `magic-token`；导出时 `request.send('/download?...', null, { headers: { 'Content-Type': 'application/json' } })` 为合理例外 |
| **第七条** 国际化语言包索引化 | ✅ 合规 | 不涉及 monaco 语言切换 | 无 `monaco.editor.setLocale()` 调用 |
| **第八条** 双构建产物共存 | ✅ 合规 | 组件为纯 Vue SFC，两种构建模式均可打包 | 无构建模式特定代码；`@import './magic-resource.css'` 为相对路径 |
| **第九条** 错误反馈走模态框 + Bus | ⚠️ 部分合规 | 大部分错误通过 `$magicAlert`/`$magicConfirm` 弹出；但 `copyPathToClipboard()` 中 `console.error(e)` 作为额外输出（第九条禁止 `console.error` 作为**唯一**反馈，此处有 `$magicAlert` 兜底，故不违规）；`deleteApiInfo()` 中删除失败弹框合规 | `magic-api-list.vue:460,516,594,624,681,700,719,861` 均使用 `$magicAlert`；`request.js` 统一处理 HTTP 错误 |
| **第十条** 源代码即文档真相 | ✅ 合规 | 本文档所有论断均可溯源 | 每条均附 file:line |

---

## 3. 项目结构

### 3.1 模块文件

| 文件 | 用途 | 行数 |
|---|---|---|
| `src/components/resources/magic-api-list.vue` | 模块主组件：模板(107行) + 脚本(872行) + 样式引用(3行) | 982 |
| `src/components/resources/magic-resource.css` | 共用样式：树容器、工具栏、节点、拖拽、hover/选中状态 | 109 |

### 3.2 组件内部结构

```
magic-api-list.vue
├── <template> (L1-L107)
│   ├── .ma-tree-wrapper                    ← 根容器
│   │   ├── .ma-tree-toolbar                ← 工具栏（搜索 + 按钮组）
│   │   │   ├── .ma-tree-toolbar-search     ← 搜索框
│   │   │   └── 5 个 .ma-tree-toolbar-btn   ← 新建分组/刷新/折叠/排序
│   │   └── <magic-tree>                    ← 树形渲染（#folder / #file 插槽）
│   ├── <magic-dialog> × 3                  ← 新建分组 / 复制接口到组 / 复制分组
│
├── <script> (L109-L977)
│   ├── imports (L110-L120)                 ← 10 个依赖
│   ├── export default (L122-L977)
│   │   ├── name: 'MagicApiList'
│   │   ├── props: { apis: Array }          ← 声明但未在模板中使用
│   │   ├── components: 5 个子组件
│   │   ├── data(): 18 个状态字段
│   │   └── methods: 20 个方法
│   │       ├── doSearch()                  ← 搜索过滤
│   │       ├── open()                      ← 打开接口
│   │       ├── initData()                  ← 初始化数据
│   │       ├── initTreeData()              ← 组装树结构
│   │       ├── rebuildTree()               ← 重建树（折叠/重建路径）
│   │       ├── treeSortHandle()            ← 排序切换
│   │       ├── sortTree()                  ← 排序执行
│   │       ├── folderRightClickHandle()    ← 分组右键菜单
│   │       ├── fileRightClickHandle()      ← 接口右键菜单
│   │       ├── copyApi()                   ← 跨组复制接口
│   │       ├── copyGroup()                 ← 复制分组
│   │       ├── deleteApiInfo()             ← 删除接口
│   │       ├── openCreateGroupModal()      ← 打开新建分组弹窗
│   │       ├── createGroupAction()         ← 保存/修改分组
│   │       ├── initCreateGroupObj()        ← 重置分组表单
│   │       ├── deleteGroupAction()         ← 删除分组
│   │       ├── copyPathToClipboard()       ← 复制路径
│   │       ├── pushFileItemToGroup()       ← 递归添加接口到分组
│   │       ├── deleteOrAddGroupToTree()    ← 递归增删树节点
│   │       ├── changeForceUpdate()         ← 强制子组件更新
│   │       ├── draggable()                 ← 拖拽处理
│   │       ├── getItemById()               ← 按 ID 查找节点
│   │       ├── getGroupsById()             ← 按 ID 获取分组路径链
│   │       ├── position()                  ← 定位并打开接口
│   │       └── openItemById()              ← 按 ID 打开接口
│   └── mounted(): 注册 API 发现器 + bus 订阅 + 快捷键
│
└── <style> (L980-L982)
    └── @import './magic-resource.css'
```

### 3.3 data() 状态字段

| 字段 | 类型 | 初始值 | 用途 |
|---|---|---|---|
| `bus` | EventBus | `bus` 单例 | 模板中引用（实际可直接 import） |
| `listGroupData` | Array | `[]` | 原始分组列表 |
| `listChildrenData` | Array | `[]` | 原始接口列表 |
| `tree` | Array | `[]` | 组装后的嵌套树数据 |
| `treeSort` | boolean/null | `true` | 排序方式：`true`=升序, `false`=降序, `null`=原始 |
| `apiCopyGroupChooseVisible` | boolean | `false` | 复制接口到组弹窗可见性 |
| `groupChooseVisible` | boolean | `false` | 复制分组弹窗可见性 |
| `srcItem` | Object | `{}` | 复制接口的源接口对象 |
| `srcId` | string | `''` | 复制分组的源分组 ID |
| `createGroupObj` | Object | 表单对象 | 新建/修改分组的表单数据 |
| `tempGroupObj` | Object | `{}` | 修改分组时的原始对象引用 |
| `currentFileItem` | Object | `{}` | 当前打开的接口节点 |
| `forceUpdate` | boolean | `true` | 触发 MagicTree 强制更新的标志 |
| `draggableItem` | Object | `{}` | 拖拽源节点 |
| `draggableTargetItem` | Object | `{}` | 拖拽目标节点 |
| `showLoading` | boolean | `true` | 树 loading 状态 |
| `dragging` | boolean | `false` | 是否正在拖拽 |
| `tmpOpenId` | Array | `[]` | 待打开的接口 ID 缓存 |

---

## 4. Phase 0 研究发现

### 4.1 树结构组装算法（`initTreeData`）

**决策**：采用三阶段扁平→嵌套转换。

**实现细节**：
1. **阶段 1**：将 `listGroupData` 的每个分组 ID 作为 key 存入 `groupItem` map，值为空数组（用于后续存放该分组下的接口）；同时为每个分组标记 `folder=true`、`opened=contants.DEFAULT_EXPAND`、缓存 `tmpName`/`tmpPath`。
2. **阶段 2**：遍历 `listChildrenData`，将每个接口按其 `groupId` 放入对应分组的 children 数组；无分组的接口放入 `groupItem['root']`。
3. **阶段 3**：通过 `arrayToTree()` 递归将扁平分组列表转为嵌套树，并在递归过程中将接口 children 插入对应分组节点。最终 `this.tree = [...分组树, ...root 级接口]`。

**关键设计**：
- `tmpName`/`tmpPath` 用于搜索时构建完整路径名（含所有祖先分组前缀）。
- `level` 字段用于计算缩进（`17 * item.level` px）。
- 分组节点始终在接口节点之前（`[...分组树, ...root 接口]` 的拼接顺序）。

**源码证据**：`magic-api-list.vue:215-266`

### 4.2 搜索算法（`doSearch`）

**决策**：自底向上标记可见性（`_searchShow`），子节点匹配则父分组自动可见。

**实现细节**：
1. 关键字转小写。
2. 递归遍历树：对分组节点，先递归所有子节点，然后 `row._searchShow = 自身名匹配 || 任一子节点._searchShow`；对接口节点，匹配完整路径名（`parentName + '/' + name`）或完整路径前缀（`parentPath + '/' + path`），均经过 `replaceURL` 处理。
3. 模板中通过 `v-if="item._searchShow !== false"` 控制节点显隐。

**源码证据**：`magic-api-list.vue:176-188`

### 4.3 拖拽移动策略（`draggable`）

**决策**：HTML5 Drag & Drop API，通过 `dragstart`/`dragenter`/`dragend` 三阶段处理。

**实现细节**：
- `dragstart`：记录 `draggableItem`。
- `dragenter`：记录 `draggableTargetItem`，设置 `dragging=true`（触发 CSS 红色边框视觉反馈）。
- `dragend`：
  - 目标必须是分组类型（`folder=true`）。
  - **移动分组**：检测不能移入自己的子分组（`checkChildrenFolder` 递归遍历 `children` 数组）；调用 `POST group/update` 更新 `parentId`；先 `deleteOrAddGroupToTree(tree, item, true)` 删除旧位置，再 `deleteOrAddGroupToTree(tree, params)` 添加到新位置；`rebuildTree()` 重建路径；`goToAnchor` 滚动到新位置。
  - **移动接口**：调用 `POST api/move` 携带 `{id, groupId}`；同样先删后加；`goToAnchor` 滚动。
  - 接口拖到同一分组时不执行任何操作（`some()` 检查已存在）。

**源码证据**：`magic-api-list.vue:809-889`

### 4.4 强制更新机制（`changeForceUpdate`）

**决策**：通过切换 `forceUpdate` 布尔值（`true ↔ false`）触发 MagicTree 组件的 `watch` 或 `computed` 重新计算。

**理由**：Vue 3 的响应式系统对深层嵌套数组的变更检测有时不够及时，尤其是通过 `splice`/`push` 修改树结构后。通过 props 传递一个翻转的布尔值，强制子组件重新渲染。

**源码证据**：`magic-api-list.vue:164,330,732,766,777,795,807`

### 4.5 右键菜单与高亮联动

**决策**：右键时通过 `$set(item, 'selectRightItem', true)` 标记高亮；菜单 `destroy` 回调中清除。

**实现细节**：
- 分组右键菜单：8 个操作项（新建接口、刷新接口、新建分组、修改分组、复制分组、删除分组、移动到根节点、导出）。
- 接口右键菜单：7 个操作项（复制接口、复制接口到...、复制路径、复制相对路径、锁定/解锁、刷新接口、删除接口）。
- 菜单项通过 `divided: true` 分隔。

**源码证据**：`magic-api-list.vue:333-448`（分组）、`magic-api-list.vue:451-544`（接口）

### 4.6 新建接口临时节点策略

**决策**：新建接口时生成临时节点（`id=''`，`tmp_id=时间戳+随机数`），直接插入树并自动打开编辑器。

**含义**：
- `id` 为空表示未保存，删除时不调用后端 API 仅从树中移除。
- 复制接口时校验 `id` 非空，防止复制未保存的临时接口。
- 临时接口节点包含完整的接口数据结构（`method`、`path`、`script`、`parameters` 等），以便编辑器能正常渲染。

**源码证据**：`magic-api-list.vue:341-362`

### 4.7 删除分组递归通知策略

**决策**：删除分组时，通过 `noticeCloseTab` 递归遍历该分组下所有接口节点，为每个接口设置 `delete=true` 并触发 `open(item)` 事件，通知编辑器关闭对应 tab。

**源码证据**：`magic-api-list.vue:688-696`

### 4.8 API 发现器注册

**决策**：在 `mounted` 钩子中调用 `JavaClass.setApiFinder()`，返回一个回调函数，该函数将 `listChildrenData` 过滤为非分组类型后，映射为 `{path, name, method}` 数组供 JavaClass 模块消费。

**含义**：这使得 JavaClass 模块能够知道所有已注册的 API 接口，用于代码补全等场景。

**源码证据**：`magic-api-list.vue:949-957`

### 4.9 `openItemById` 缓存机制

**决策**：使用 `tmpOpenId` 数组缓存待打开的接口 ID。当数据未加载完成时（`listChildrenData.length === 0`），将 ID 推入缓存；数据加载完成后，遍历缓存中的 ID，通过 `getItemById` 查找节点并打开。

**风险**：快速连续调用时可能产生竞态（先到的数据后处理），但实际场景中 `initData()` 是串行 Promise 链，竞态概率极低。

**源码证据**：`magic-api-list.vue:927-946`

---

## 5. 数据模型

### 5.1 分组节点（FolderNode）

```js
{
  id: string,           // 分组 ID（后端返回）
  name: string,         // 分组名称
  path: string,         // 分组前缀（URL 路径片段）
  parentId: string,     // 父分组 ID（'0' 表示根级）
  type: string,         // 类型标识（'1' 表示 API 分组）
  folder: true,         // 固定为 true，标识分组类型
  level: number,        // 缩进层级（0 = 根级）
  tmpName: string,      // 完整路径名（如 '/用户管理/用户接口'）
  tmpPath: string,      // 完整路径前缀（如 '/user/api'）
  opened: boolean,      // 展开/折叠状态
  children: [],         // 子节点（分组 + 接口）
  paths: [],            // 接口路径列表（后端返回）
  options: [],          // 接口选项列表（后端返回）
  selectRightItem: bool // 右键高亮标志
}
```

**转换逻辑**（`initTreeData`）：
- `tmpName`：若 `name` 以 `/` 开头则直接使用，否则前缀 `/`。
- `tmpPath`：同上。
- `opened`：默认 `contants.DEFAULT_EXPAND`（`true`）。

### 5.2 接口节点（FileNode）

```js
{
  id: string,           // 接口 ID（后端返回；未保存时为空字符串）
  tmp_id: string,       // 临时 ID（`Date.now() + Math.random()`，用于未保存节点的唯一标识）
  _type: 'api',         // 固定标识
  name: string,         // 接口名称
  path: string,         // 接口路径（URL 片段）
  method: string,       // HTTP 方法（GET/POST/PUT/DELETE 等）
  groupId: string,      // 所属分组 ID
  groupName: string,    // 所属分组完整路径名
  groupPath: string,    // 所属分组完整路径前缀
  lock: '0' | '1',     // 锁定状态（字符串，非布尔值）
  level: number,        // 缩进层级
  script: string|null,  // 接口脚本源码
  parameters: any|null, // 请求参数定义
  headers: any|null,    // 请求头定义
  requestBody: any|null,// 请求体定义
  responseBody: any|null,// 响应体定义
  responseHeader: any|null,// 响应头定义
  description: any|null,// 描述
  paths: any|null,      // 路径参数
  option: any|null,     // 选项
  copy: boolean,        // 是否为复制品（仅临时标记）
  delete: boolean,      // 是否被删除（用于通知编辑器关闭 tab）
  selectRightItem: bool,// 右键高亮标志
  _searchShow: boolean  // 搜索可见性
}
```

### 5.3 新建分组表单对象（CreateGroupObj）

```js
{
  visible: boolean,     // 弹窗可见性
  id: string,           // 分组 ID（修改时非空，新建时为空）
  name: string,         // 分组名称
  path: string,         // 分组前缀
  parentId: string,     // 父分组 ID
  type: '1',            // 固定为 '1'
  children: [],         // 子分组列表
  paths: [],            // 接口路径列表
  options: []           // 接口选项列表
}
```

### 5.4 后端响应结构

```js
// GET group/list?type=1 响应
{ code: 1, data: [FolderNode, ...] }

// GET list 响应
{ code: 1, data: [FileNode, ...] }

// POST group/create 响应
{ code: 1, data: string }  // 新分组 ID

// POST group/update / group/delete / group/copy / delete / lock / unlock / api/move 响应
{ code: 1, data: boolean } // 操作是否成功

// GET /download?groupId=<id> 响应
Blob (application/zip)
```

---

## 6. 接口契约

### 6.1 提供的接口（被外部调用）

| 方法 | 签名 | 调用方式 | 源码证据 |
|---|---|---|---|
| `initData` | `() => Promise<void>` | 父组件或 bus 事件触发 | `magic-api-list.vue:195-213` |
| `position` | `(id: string) => void` | bus 事件 `position-api` 间接调用 | `magic-api-list.vue:920-924` |
| `getItemById` | `(id: string) => Object\|undefined` | 内部使用，也可被外部 `$refs` 调用 | `magic-api-list.vue:891-907` |
| `getGroupsById` | `(id: string) => Array<FolderNode>` | 内部使用 | `magic-api-list.vue:908-919` |

### 6.2 消费的接口

| 来源 | 接口 | 用途 | 源码证据 |
|---|---|---|---|
| `request` | `send(url, params?).success(cb)` | 所有 HTTP 请求 | `magic-api-list.vue:200,203,430,509,586,682,868` |
| `requestGroup` | `(path, groupObj) => request` | 分组 CRUD（JSON body） | `magic-api-list.vue:629,641,846` |
| `bus` | `$emit(event, ...args)` | 跨组件通信 | 全文 30+ 处 |
| `bus` | `$on(event, handler)` | 订阅外部事件 | `magic-api-list.vue:958-972` |
| `JavaClass` | `setApiFinder(callback)` | 注册 API 发现器 | `magic-api-list.vue:949-957` |
| `Key` | `bind(target, code, callback)` | 注册快捷键 | `magic-api-list.vue:975` |
| `utils` | `replaceURL(url)` | 路径规范化 | `magic-api-list.vue:183,708,952-953` |
| `utils` | `download(blob, filename)` | 导出 zip 文件 | `magic-api-list.vue:436` |
| `utils` | `deepClone(obj)` | 复制接口时深拷贝 | `magic-api-list.vue:465,554` |
| `utils` | `goToAnchor(dom)` | 锚点滚动 | `magic-api-list.vue:635,651,856,881,940` |
| `contants` | `DEFAULT_EXPAND`, `SERVER_URL` | 默认展开/路径前缀 | `magic-api-list.vue:221,708,750,773` |

### 6.3 事件协议

#### 本模块发射（emit）的事件

| 事件 | 触发时机 | 载荷 | 源码证据 |
|---|---|---|---|
| `status` | 状态日志（加载/操作/搜索等） | 字符串消息 | 全文 30+ 处 |
| `open` | 用户点击接口节点 | 接口节点对象 | `magic-api-list.vue:191` |
| `api-group-selected` | 用户点击分组节点 | 分组节点对象 | `magic-api-list.vue:36` |
| `report` | 埋点上报 | 事件 ID 字符串 | `magic-api-list.vue:413,512,589,630,646,684,847` |

#### 本模块监听（on）的事件

| 事件 | 来源 | 处理 | 源码证据 |
|---|---|---|---|
| `logout` | 主组件 | 清空树数据（`this.tree = []`） | `magic-api-list.vue:958` |
| `opened` | 编辑器组件 | 同步当前打开的接口项（`this.currentFileItem = item`） | `magic-api-list.vue:959-961` |
| `delete-api` | 编辑器组件 | 触发接口删除流程（`this.deleteApiInfo(item)`） | `magic-api-list.vue:962-964` |
| `refresh-resource` | 头部菜单 | 重新加载全部数据（`this.initData()`） | `magic-api-list.vue:965-967` |
| `update-group` | 分组管理面板 | 重建分组树结构（`rebuildTree()` + 重置表单 + 强制更新） | `magic-api-list.vue:968-972` |
| `position-api` | 主组件 | 定位并打开指定 ID 的接口（`this.position(id)`） | `magic-editor.vue:224-226` → `magic-api-list.vue:920-924` |

### 6.4 HTTP 端点清单

| 方法 | 路径 | 用途 | 请求体 | 发起方式 | 源码证据 |
|---|---|---|---|---|---|
| GET | `group/list?type=1` | 获取 API 分组列表 | 无 | `request.send()` | `magic-api-list.vue:200` |
| GET | `list` | 获取 API 接口列表 | 无 | `request.send()` | `magic-api-list.vue:203` |
| POST | `group/create` | 新建分组 | JSON: `{id, name, path, type, parentId, paths, options}` | `requestGroup()` | `magic-api-list.vue:641` |
| POST | `group/update` | 修改分组 / 移动分组 | JSON: 同上 | `requestGroup()` | `magic-api-list.vue:629,846` |
| POST | `group/delete` | 删除分组 | `{groupId}` | `request.send()` | `magic-api-list.vue:682` |
| POST | `group/copy` | 复制分组 | `{src, target}` | `request.send()` | `magic-api-list.vue:573` |
| POST | `delete` | 删除接口 | `{id}` | `request.send()` | `magic-api-list.vue:586` |
| POST | `lock` | 锁定接口 | `{id}` | `request.send()` | `magic-api-list.vue:509` |
| POST | `unlock` | 解锁接口 | `{id}` | `request.send()` | `magic-api-list.vue:509` |
| POST | `api/move` | 移动接口到目标分组 | `{id, groupId}` | `request.send()` | `magic-api-list.vue:868-870` |
| GET | `/download?groupId=<id>` | 导出分组下接口为 zip | 无 | `request.send()` (blob) | `magic-api-list.vue:430-434` |

> **请求体编码差异**：`group/create`、`group/update`（修改/移动）通过 `requestGroup()` 使用 `Content-Type: application/json` + `JSON.stringify`；其余端点通过 `request.send()` 使用默认的 `application/x-www-form-urlencoded`（由 `request.js` 配置）。

### 6.5 与父组件的交互协议

```
父组件 (magic-editor.vue / magic-script-editor.vue)          本模块 (magic-api-list.vue)
    │                                                              │
    │── initData() ──────────────────────────────────────────────→ │
    │                                                              │── GET group/list?type=1
    │                                                              │── GET list
    │                                                              │── initTreeData()
    │                                                              │── openItemById()
    │←── 树渲染完成                                                 │
    │                                                              │
    │  用户点击接口节点                                             │
    │←── bus.$emit('open', item) ───────────────────────────────── │
    │←── bus.$emit('status', '查看接口...') ────────────────────── │
    │                                                              │
    │  用户点击分组节点                                             │
    │←── bus.$emit('api-group-selected', item) ─────────────────── │
    │                                                              │
    │  用户右键操作（新建/删除/复制/锁定/导出等）                    │
    │                                                              │── 对应 HTTP 请求
    │←── bus.$emit('status', ...) / bus.$emit('report', ...) ───── │
    │                                                              │
    │  外部触发 bus 事件                                            │
    │── bus.$emit('logout') ─────────────────────────────────────→ │── this.tree = []
    │── bus.$emit('opened', item) ───────────────────────────────→ │── this.currentFileItem = item
    │── bus.$emit('delete-api', item) ───────────────────────────→ │── this.deleteApiInfo(item)
    │── bus.$emit('refresh-resource') ───────────────────────────→ │── this.initData()
    │── bus.$emit('update-group') ───────────────────────────────→ │── this.rebuildTree()
    │── bus.$emit('position-api', id) ───────────────────────────→ │── this.position(id)
```

---

## 7. 实现策略

### 7.1 架构模式

**模式**：自包含树形管理组件（Self-Contained Tree Manager）

- 本组件自行管理完整的树形数据结构（`tree`、`listGroupData`、`listChildrenData`）。
- 通过 EventBus 与外部通信，无 props 依赖（`apis` prop 声明但未使用）。
- 组件内部包含 20 个方法，覆盖树 CRUD、搜索、排序、拖拽、右键菜单、快捷键等全部功能。
- 通过 `$refs` 调用 `MagicGroupChoose` 子组件的方法（`initData()`、`getSelected()`、`unDoSelected()`）。

### 7.2 关键算法

#### 7.2.1 树结构组装（`initTreeData`）

```
1. 构建 groupItem map: { root: [], [groupId]: [], ... }
2. 遍历 listGroupData → 标记 folder=true, opened=true, 缓存 tmpName/tmpPath
3. 遍历 listChildrenData → 按 groupId 放入对应分组, 无分组的放入 root
4. arrayToTree() 递归:
   a. 遍历分组列表, 找到 parentId 匹配的项
   b. 设置 level, tmpName, tmpPath
   c. 递归处理子分组
   d. 将该分组下的接口插入 children
5. this.tree = [...分组树, ...root 级接口]
6. sortTree() 排序
```

**时间复杂度**：O(n²) — `arrayToTree` 中每次遍历整个 `listGroupData` 查找 `parentId` 匹配的项。对于分组数量较少的场景（通常 < 100）可接受。

**源码证据**：`magic-api-list.vue:215-266`

#### 7.2.2 排序算法（`sortTree`）

```
1. 若 treeSort === null，跳过排序
2. sortHandle(arr) 递归:
   a. 分离 folder 节点和 file 节点
   b. 对 folder 的 children 递归排序
   c. folderArr.sort(localeCompare('zh-CN'))
   d. fileArr.sort(localeCompare('zh-CN'))
   e. 若 treeSort === false，reverse 两个数组
   f. 返回 folderArr.concat(fileArr)
3. this.tree = sortHandle(this.tree)
```

**特点**：中文拼音排序（`localeCompare('zh-CN')`），分组始终在前。

**源码证据**：`magic-api-list.vue:299-331`

#### 7.2.3 拖拽循环引用检测（`checkChildrenFolder`）

```
1. 检查 target 是否在 source.children 中（直接子级）
2. 递归检查 source.children 的每个子分组的 children
3. 若找到 → 弹出提示，不执行移动
```

**源码证据**：`magic-api-list.vue:828-841`

#### 7.2.4 树节点增删（`deleteOrAddGroupToTree`）

**双模式**：`flag=true` 为删除，`flag≠true` 为添加。

- **添加分组到根**：若 `parentId` 为空或 `'0'`，直接 `tree.push(item)`。
- **删除**：递归查找 `id` 匹配的节点，`tree.splice(index, 1)`。
- **添加**：递归查找 `parentId`（分组）或 `groupId`（接口）匹配的父节点，`push` 到其 `children`。

**源码证据**：`magic-api-list.vue:743-804`

### 7.3 错误处理

| 错误场景 | 处理方式 | 源码证据 |
|---|---|---|
| HTTP 请求失败（网络/超时） | `request.js` 统一弹框（`modal.magicAlert`） | `request.js:117-127` |
| HTTP 响应 code ≠ 1 | `request.js` 弹框显示异常代码和消息 | `request.js:62-66` |
| HTTP 401 | `request.js` 触发 `bus.$emit('showLogin')` | `request.js:151-153` |
| 分组名称为空 | `$magicAlert({content: '分组名称不能为空'})` | `magic-api-list.vue:624` |
| 复制未保存接口 | `$magicAlert({content: '请先保存在复制！'})` | `magic-api-list.vue:460,480` |
| 锁定/解锁失败 | `$magicAlert({content: '锁定/解锁接口失败'})` | `magic-api-list.vue:516` |
| 删除接口/分组失败 | `$magicAlert({content: '删除失败'})` | `magic-api-list.vue:594,700` |
| 拖拽到子分组 | `$magicAlert({content: '不能移到<name>'})` | `magic-api-list.vue:861` |
| 路径复制失败 | `$magicAlert({title: '复制接口路径失败，请手动复制', content: path})` | `magic-api-list.vue:719` |
| `document.execCommand('copy')` 异常 | `console.error(e)` + `$magicAlert` 兜底 | `magic-api-list.vue:718-721` |

### 7.4 性能考虑

| 关注点 | 现状 | 风险等级 |
|---|---|---|
| 并行加载 | `initData()` 中分组和接口请求为**串行**（嵌套回调），非并行 | 中（spec NFR-003-001 要求并行，但实际为串行） |
| 树组装复杂度 | `arrayToTree` 为 O(n²) | 低（分组数量通常 < 100） |
| 搜索性能 | 全树递归遍历，无索引 | 低（树节点数量通常 < 1000） |
| 强制更新 | `changeForceUpdate()` 翻转布尔值触发全树重渲染 | 低（Vue 虚拟 DOM diff 优化） |
| 深拷贝 | `deepClone()` 用于复制接口，递归拷贝整个接口对象 | 低（单次操作） |
| 锚点滚动 | `goToAnchor()` 使用 `scrollIntoView(true)` | 低 |

### 7.5 与 overall-api.md 对齐

| overall-api.md 约定 | 本模块遵守情况 | 说明 |
|---|---|---|
| HTTP 默认 `application/x-www-form-urlencoded` | ✅ 遵守 | 除 `requestGroup()` 外均使用默认编码 |
| `magic-token` Header 自动注入 | ✅ 遵守 | 通过 `request.js:112` 自动注入 |
| 响应包装 `{code, data, message}` | ✅ 遵守 | 所有 `.success(cb)` 回调接收 `data` 字段 |
| 错误反馈走模态框 | ✅ 遵守 | 所有用户可见错误均通过 `$magicAlert`/`$magicConfirm` |
| 跨组件通信走 bus | ✅ 遵守 | 所有跨组件事件均通过 `bus.$emit`/`bus.$on` |

### 7.6 与 overall-data-model.md 对齐

| overall-data-model.md 约定 | 本模块遵守情况 | 说明 |
|---|---|---|
| `contants.DEFAULT_EXPAND` | ✅ 遵守 | `initTreeData` 中使用 |
| `contants.SERVER_URL` | ✅ 遵守 | `copyPathToClipboard` 中用于绝对路径拼接 |
| `ApiResponse<T>` 包装 | ✅ 遵守 | 所有 HTTP 响应均通过 `.success(data => ...)` 消费 `data` 字段 |
| `StatusLogEntry` | ✅ 遵守 | `bus.$emit('status', content)` 写入 statusLog 数组 |
| localStorage 仅存偏好 | ✅ 遵守 | 本模块无 localStorage 写入 |

---

## 8. 测试考虑

### 8.1 可测试场景

| 场景 | 测试类型 | 验证点 |
|---|---|---|
| `initData()` 加载 | 集成测试 | 分组/接口请求发出、树结构正确组装、loading 状态切换 |
| `doSearch()` 搜索 | 单元测试 | 关键字匹配分组名/接口名/路径、父分组自动可见、大小写不敏感 |
| `sortTree()` 排序 | 单元测试 | 升序/降序/原始三种模式、分组在前接口在后、中文拼音排序 |
| `open()` 打开接口 | 单元测试 | `open` 事件发射、`currentFileItem` 更新 |
| `createGroupAction()` 新建分组 | 集成测试 | 名称校验、HTTP 请求发出、树更新、锚点滚动 |
| `deleteApiInfo()` 删除接口 | 集成测试 | 确认框弹出、HTTP 请求（已保存）/仅树移除（未保存）、编辑器通知 |
| `deleteGroupAction()` 删除分组 | 集成测试 | 递归通知关闭 tab、HTTP 请求、树移除 |
| `draggable()` 拖拽接口 | 集成测试 | 移动成功/循环引用检测/同组不操作 |
| `draggable()` 拖拽分组 | 集成测试 | 循环引用检测、`group/update` 请求、树更新 |
| `copyPathToClipboard()` 路径复制 | 单元测试 | 绝对/相对路径正确生成、剪贴板写入、失败兜底 |
| `openItemById()` 按 ID 打开 | 单元测试 | 数据未加载时缓存、加载后查找并打开 |
| `position()` 定位接口 | 集成测试 | `rebuildTree` + `openItemById` 组合调用 |
| Alt+G 快捷键 | 集成测试 | 按下 Alt+G 打开新建分组弹窗 |

### 8.2 边界情况

| 场景 | 预期行为 | 源码证据 |
|---|---|---|
| 后端返回空分组/接口数组 | 树显示"无数据"（MagicTree 组件提供） | `magic-api-list.vue:201,204`（`data || []`） |
| 接口无 `method` 字段 | `MagicTextIcon` 渲染空图标 | `magic-api-list.vue:66` |
| 接口 `lock` 为非 `'0'`/`'1'` 值 | 不显示锁图标 | `magic-api-list.vue:69`（`v-if="item.lock === '1'"`） |
| 分组 `parentId` 为 `'0'` | 作为根级分组渲染 | `magic-api-list.vue:244`（`== '0'` 宽松匹配） |
| 快速连续调用 `openItemById` | 可能产生竞态（`tmpOpenId` 缓存） | `magic-api-list.vue:927-946` |
| 树中存在 `id` 重复的分组 | `pushFileItemToGroup` 停在第一个匹配项 | `magic-api-list.vue:727-740` |
| `document.execCommand('copy')` 不可用 | 弹出包含路径的提示框 | `magic-api-list.vue:718-721` |

---

## 9. 与 spec.md 的 FR 映射

| spec FR | plan 章节 | 实现状态 |
|---|---|---|
| FR-003-001 ~ 003-006 | §4.1 树结构组装 + §5.1/5.2 数据模型 | ✅ 已实现 |
| FR-003-010 ~ 003-014 | §4.2 搜索算法 | ✅ 已实现 |
| FR-003-020 ~ 003-028 | §6.3 事件协议 + §6.4 交互协议 | ✅ 已实现 |
| FR-003-030 ~ 003-034 | §4.6 临时节点 + §7.3 错误处理 | ✅ 已实现 |
| FR-003-040 ~ 003-046 | §4.1 树结构组装 + §7.2.4 增删算法 | ✅ 已实现 |
| FR-003-050 ~ 003-054 | §4.6 临时节点 + §6.4 HTTP 端点 | ✅ 已实现 |
| FR-003-060 ~ 003-066 | §4.3 拖拽策略 + §7.2.3 循环检测 | ✅ 已实现 |
| FR-003-070 ~ 003-073 | §6.4 HTTP 端点 + §7.3 错误处理 | ✅ 已实现 |
| FR-003-080 ~ 003-084 | §7.3 错误处理 + §5.2 数据模型 | ✅ 已实现 |
| FR-003-090 ~ 003-092 | §6.4 HTTP 端点 + §1.2 utils 依赖 | ✅ 已实现 |
| FR-003-100 ~ 003-104 | §4.1 树结构组装 + §7.2.2 排序算法 | ✅ 已实现 |
| FR-003-110 ~ 003-113 | §4.5 右键菜单 | ✅ 已实现 |
| FR-003-120 | §1.2 hotkey 依赖 + §3.2 mounted | ✅ 已实现 |
| FR-003-130 | §6.3 事件协议（logout 监听） | ✅ 已实现 |
| FR-003-140 ~ 003-141 | §4.8 API 发现器 | ✅ 已实现 |
| NFR-003-001 ~ 003-005 | §7.4 性能 + §7.3 错误处理 | ⚠️ NFR-003-001 要求并行加载，实际为串行（见 §7.4） |

---

## 10. 文件清单

| 文件 | 用途 | 行数 |
|---|---|---|
| `src/components/resources/magic-api-list.vue` | 模块主组件（模板 + 脚本 + 样式引用） | 982 |
| `src/components/resources/magic-resource.css` | 共用样式（树容器、工具栏、节点、拖拽、hover/选中） | 109 |
| `src/api/request.js` | HTTP 请求封装 | 194 |
| `src/scripts/bus.js` | EventBus 实现 | 57 |
| `src/scripts/contants.js` | 全局常量（DEFAULT_EXPAND、SERVER_URL） | 36 |
| `src/scripts/hotkey.js` | 快捷键注册 | 46 |
| `src/scripts/utils.js` | 工具函数（replaceURL/download/requestGroup/deepClone/goToAnchor） | 182 |
| `src/scripts/editor/java-class.js` | JavaClass API 发现器 | — |
| `src/components/common/magic-tree.vue` | 树容器组件（016 模块） | 98 |
| `src/components/common/modal/magic-dialog.vue` | 弹窗容器（016 模块） | — |
| `src/components/common/magic-input.vue` | 输入框（016 模块） | — |
| `src/components/common/magic-text-icon.vue` | HTTP 方法图标（016 模块） | — |
| `src/components/common/magic-contextmenu/` | 右键菜单（016 模块） | — |
| `src/components/resources/magic-group-choose.vue` | 分组选择对话框（006 模块） | 202 |
| `src/components/magic-editor.vue` | 主组件（消费本模块 bus 事件） | 448 |
