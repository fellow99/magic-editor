# 004-resources-function 技术计划（As-Built）

> 本文件以"已建成系统"视角记录 004-resources-function 模块的实际架构、设计决策与实现策略。
> 模块：004-resources-function
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. 技术上下文

### 1.1 运行环境

| 维度 | 值 |
|---|---|
| 运行时 | 现代浏览器（Chrome/Edge/Firefox/Safari） |
| 框架 | Vue 3.4（Options API 风格，`export default { name, props, components, data, methods, mounted }`） |
| 构建 | Vite 5.4.21，双 mode（app → `dist-app/`，lib → `dist/`） |
| 通信 | axios 0.21（HTTP） |
| 状态 | 自实现 EventBus（`src/scripts/bus.js`），无 Vuex/Pinia |
| 持久化 | 无（本模块不持久化业务数据） |

### 1.2 依赖清单

| 依赖 | 版本/来源 | 用途 | 消费位置 |
|---|---|---|---|
| `vue` | ^3.4.0 | 组件框架 | 全部 |
| `axios` | ^0.21.0 | HTTP 请求（函数/分组 CRUD） | `magic-function-list.vue:103` |
| `@/scripts/bus.js` | 内部 | EventBus 跨组件通信（`open`/`status`/`report`/`logout`/`opened`/`delete-api`/`refresh-resource`/`position-function`） | `magic-function-list.vue:101,183-184,191,195,201,397,407,433,460,506,514,571,599,607,639,864-873` |
| `@/scripts/contants.js` | 内部 | `DEFAULT_EXPAND`（树节点默认展开状态） | `magic-function-list.vue:110,214,672,695` |
| `@/scripts/utils.js` | 内部 | `replaceURL`（路径规范化）、`requestGroup`（分组请求 JSON body）、`goToAnchor`（滚动定位）、`deepClone`（深拷贝） | `magic-function-list.vue:107` |
| `@/scripts/editor/java-class.js` | 内部 | `JavaClass.setupOnlineFunction()` / `JavaClass.setFunctionFinder()`（向编辑器语言服务注册函数列表） | `magic-function-list.vue:108,855-863` |
| `@/scripts/hotkey.js` | 内部 | `Key.bind()` 快捷键绑定（`Alt+G` 新建分组） | `magic-function-list.vue:109,876` |
| `@/api/request.js` | 内部 | HTTP 请求封装（`request.send()`） | `magic-function-list.vue:103,193,196,458,512,604,787` |
| `@/components/common/magic-tree.vue` | 内部 | 通用树组件（渲染分组/函数节点，支持拖拽/搜索/折叠） | `magic-function-list.vue:25` |
| `@/components/common/modal/magic-dialog.vue` | 内部 | 弹窗组件（分组创建/编辑、复制分组目标选择） | `magic-function-list.vue:72-96` |
| `@/components/common/magic-input.vue` | 内部 | 文本输入（分组名称/路径输入框） | `magic-function-list.vue:77,80` |
| `@/components/resources/magic-group-choose.vue` | 内部 | 分组选择器（复制分组时选择目标分组） | `magic-function-list.vue:91` |
| `@/components/common/magic-text-icon.vue` | 内部 | 函数类型图标 | `magic-function-list.vue:65,111` |
| `@/components/common/magic-contextmenu/` | 内部 | `$magicContextmenu` 右键菜单 | `magic-function-list.vue:328,423` |

---

## 2. Constitution 合规性检查

| 宪法条款 | 合规状态 | 依据 |
|---|---|---|
| **第一条** 单一主组件 + 注入式配置 | ✅ 合规 | 本组件不声明 `props.config`，不硬编码后端地址；baseURL 通过 `contants.BASE_URL` 由 `request.send()` 内部读取（`api/request.js` 使用 axios 全局实例的 baseURL） |
| **第二条** 前后端契约即真相 | ✅ 合规 | 本模块不持久化业务数据；所有函数/分组数据通过 HTTP 从后端加载，前端仅维护内存中的树结构（`tree`/`listGroupData`/`listChildrenData`）；localStorage 仅用于用户偏好（与本模块无关） |
| **第三条** 通信双通道：HTTP + WebSocket | ✅ 合规 | 本模块所有 CRUD 操作均通过 HTTP（`request.send()` / `requestGroup()`）；不使用 WebSocket；WS 仅由调试模块消费 |
| **第四条** 事件总线即全局状态 | ✅ 合规 | 所有跨组件通信走 `bus.js`（`open`/`status`/`report`/`logout`/`opened`/`delete-api`/`refresh-resource`/`position-function`）；无 Vuex/Pinia/Provide-Inject；组件内部状态使用 Vue 自身 `data()` |
| **第五条** monaco 围绕 magic-script | ✅ 合规 | 本模块不涉及 monaco 编辑器；但通过 `JavaClass.setFunctionFinder()` 向编辑器语言服务提供函数列表，间接支持 magic-script 自动补全 |
| **第六条** 类型契约由 Header 表达 | ✅ 合规 | 本模块分组相关请求通过 `requestGroup()` 使用 `Content-Type: application/json`（`utils.js:56-58`），符合 Header 表达类型原则；函数相关请求使用默认 `application/x-www-form-urlencoded` |
| **第七条** 国际化只信构建期 | ⚠️ 部分 | 本模块 UI 文案全部中文硬编码（搜索框"输入关键字搜索"、按钮"新建分组"/"刷新函数"/"折叠"、右键菜单项等）；不涉及 monaco i18n，构建期插件不影响本模块 |
| **第八条** 双构建产物共存 | ✅ 合规 | 本组件通过 `src/components/resources/` 目录统一打包，应用模式与库模式均包含；CSS 通过 `@import './magic-resource.css'` 引用，无 hash（`vite.config.js:assetFileNames`） |
| **第九条** 错误反馈走模态框 + Bus | ✅ 合规 | 所有错误通过 `$magicAlert` 弹出（`magic-function-list.vue:430,465,520,622,641`）；删除操作通过 `$magicConfirm` 二次确认（`magic-function-list.vue:507-509,600-602`）；无 `console.error` 作为唯一反馈（仅 `copyPathToClipboard` 的 catch 中有 `console.error`，但同时弹出了 `$magicAlert`） |
| **第十条** 源代码即文档真相 | ✅ 合规 | 本文档所有论断均附源码路径/行号；待澄清事项显式标记 |

### 例外登记

本模块无新增例外。

---

## 3. 项目结构

```
src/components/resources/
├── magic-function-list.vue    ← 本模块唯一组件（883 行）
│   ├── template（1-98 行）     工具栏 + 树 + 两个对话框
│   ├── script（100-878 行）    数据定义 + 方法 + 生命周期
│   └── style（881-883 行）     @import './magic-resource.css'
├── magic-resource.css          ← 共享样式（树/工具栏通用）
└── magic-group-choose.vue      ← 分组选择器（006 模块所有，本模块消费）
```

本模块仅包含 **1 个源文件**（`magic-function-list.vue`），所有功能收敛在单一组件内。

---

## 4. 研究发现

### 4.1 单组件全功能模式

**决策**：函数资源管理的所有功能（树展示、搜索、排序、CRUD、拖拽、编辑器联动、快捷键、JavaClass 注册）全部收敛在 `magic-function-list.vue` 一个组件中，未拆分子组件。

**实现**：
- 模板层：工具栏（搜索 + 4 个按钮）+ `magic-tree` + 2 个 `magic-dialog`（分组创建/编辑、复制分组）
- 逻辑层：15 个 data 属性 + 18 个 methods
- 样式层：`@import './magic-resource.css'`（与接口资源/数据源资源共用）

**理由**（推断）：
- 函数资源与接口资源（003-resources-api）结构高度对称，各自独立为单组件便于维护
- 功能边界清晰：树展示 + CRUD + 编辑器联动，无需进一步拆分
- 与 `magic-api-list.vue` / `magic-datasource-list.vue` 保持一致的组件粒度

**后果**：
- 优点：功能内聚，无组件间通信开销
- 缺点：单文件 883 行，阅读/修改成本较高；模板中右键菜单通过 `$magicContextmenu` 动态生成，逻辑与模板分离

### 4.2 串行数据加载策略

**决策**：`initData()` 中分组加载与函数加载串行执行（先 `group/list?type=2`，成功后再 `function/list`），而非并行。

**实现**（`magic-function-list.vue:192-205`）：
```
initData()
  → request.send('group/list?type=2')
    → success: listGroupData = data
      → request.send('function/list')
        → success: listChildrenData = data
          → initTreeData()
          → openItemById()
          → showLoading = false
```

**理由**（推断）：
- `initTreeData()` 需要先有分组数据构建 `groupItem` map，再将函数放入对应分组的 children
- 若并行加载，函数数据可能先于分组到达，导致 `groupItem[element.groupId]` 为 undefined
- 串行保证树构建的正确性，牺牲少量加载时间换取逻辑简单

**风险**：
- 分组接口响应慢时，函数数据加载被阻塞
- 无超时设置（`request.js` 默认 `timeout: 0`），极端情况下 loading 永不消失

### 4.3 前端递归构建树算法

**决策**：后端返回扁平的分组列表和函数列表，前端通过 `arrayToTree()` 递归构建层级树。

**实现**（`magic-function-list.vue:232-257`）：
```
1. 创建 groupItem map: { root: [], [groupId]: [], ... }
2. 遍历 listGroupData，为每个分组 id 创建空数组
3. 遍历 listChildrenData，将函数放入对应 groupId 的数组（无 groupId 放入 root）
4. arrayToTree(arr, parentItem, groupName, groupPath, level):
   - 遍历 arr，找到 parentId == parentItem.id 的分组
   - 设置 level、tmpName、tmpPath
   - 递归调用 arrayToTree 构建子分组
   - 将 groupItem[分组id] 中的函数作为 children 追加
5. 最终 tree = [...arrayToTree(listGroupData, {id:0}, '', '', 0), ...groupItem['root']]
```

**关键细节**：
- `parentId == parentItem.id` 使用 `==`（非 `===`），兼容字符串/数字类型
- `tmpName`/`tmpPath` 缓存完整路径，供搜索和显示使用
- 未归属分组的函数出现在根级别（`groupItem['root']`）

### 4.4 搜索过滤的可见性标记模式

**决策**：搜索不删除树节点，而是通过 `_searchShow` 布尔标记控制 `v-if` 显隐。

**实现**（`magic-function-list.vue:165-177`）：
- 递归遍历树，对每个节点计算 `_searchShow`
- 函数节点：匹配名称或路径（经 `replaceURL` 规范化）则可见
- 分组节点：自身名称匹配 **或** 任一子节点可见则可见
- 模板中 `v-if="item._searchShow !== false"` 控制渲染

**理由**（推断）：
- 删除节点会破坏树结构，搜索结束后需要重建
- 标记模式保留完整树结构，清空搜索框即可恢复
- 分组节点"子可见则父可见"的逻辑确保搜索结果上下文完整

### 4.5 拖拽循环嵌套检测

**决策**：拖拽分组时，递归检查目标分组是否为源分组的子级，防止循环嵌套。

**实现**（`magic-function-list.vue:750-763`）：
```
checkChildrenFolder(arr):
  1. 检查 arr 中是否有节点 id 等于目标分组 id
  2. 若有 → 返回 true（是子级，拒绝移动）
  3. 若无 → 递归检查每个节点的 children
  4. 全部检查完 → 返回 false
```

**边界条件**：
- 拖拽到自身：`this.draggableItem.id !== this.draggableTargetItem.id`（`magic-function-list.vue:748`）
- 拖拽到同一父级：`this.draggableItem.parentId !== this.draggableTargetItem.id`（同上）

### 4.6 临时 ID 生成策略

**决策**：未保存的函数使用 `tmp_id = Date.now() + Math.random()*1000` 作为前端唯一标识。

**实现**（`magic-function-list.vue:336,439`）：
- 新建函数：`tmp_id: new Date().getTime() + '' + Math.floor(Math.random() * 1000)`
- 复制函数：同样生成新的 `tmp_id`
- 已保存函数：`tmp_id` 初始等于后端 `id`（`magic-function-list.vue:221`）

**理由**（推断）：
- 后端 `id` 在保存前不存在，需要前端唯一标识用于树节点定位
- 时间戳+随机数在单用户场景下足够唯一
- `tmp_id` 始终存在，`id` 仅在保存后才有值

### 4.7 JavaClass 函数注册机制

**决策**：组件 `mounted` 时向 `JavaClass` 模块注册两个回调：
1. `setupOnlineFunction(doFindFunction)` — 按路径查找函数（供编辑器中"跳转到定义"使用）
2. `setFunctionFinder(() => [...])` — 返回所有函数列表（供自动补全使用）

**实现**（`magic-function-list.vue:855-863`）：
- `doFindFunction(path)`：遍历 `listChildrenData`，匹配 `groupPath + '/' + path`
- `setFunctionFinder`：返回所有非分组节点的 `{path, name}` 数组，路径经 `replaceURL` 规范化

**理由**（推断）：
- 编辑器中编写 magic-script 时，需要知道可用的函数列表进行自动补全
- `doFindFunction` 支持从代码中的函数调用路径反向定位到资源树节点

---

## 5. 数据模型

### 5.1 组件 data 状态

```
MagicFunctionList.data: {
  bus: bus,                          // EventBus 引用
  listGroupData: [],                 // 后端返回的分组列表（扁平）
  listChildrenData: [],              // 后端返回的函数列表（扁平）
  tree: [],                          // 前端构建的树结构（嵌套）
  treeSort: true,                    // 排序方式：true=升序, false=降序, null=不排序
  groupChooseVisible: false,         // 复制分组对话框可见性
  srcId: '',                         // 复制分组的源 ID
  createGroupObj: {                  // 分组创建/编辑表单
    visible: false,
    id: '', name: '', path: '', parentId: '', type: '2', children: []
  },
  tempGroupObj: {},                  // 编辑时指向原分组对象的引用
  currentFileItem: {},               // 当前打开的文件项
  forceUpdate: true,                 // 强制触发 magic-tree 重新渲染
  draggableItem: {},                 // 拖拽源节点
  draggableTargetItem: {},           // 拖拽目标节点
  showLoading: true,                 // 树加载 loading 状态
  dragging: false,                   // 是否正在拖拽
  tmpOpenId: []                      // 缓存待打开的函数 ID（数据未加载完成时）
}
```

### 5.2 TreeNode 统一抽象

分组和函数节点在前端树中共享以下属性：

```
TreeNode: {
  // 共有属性
  id: string,                        // 后端 ID（分组）或函数 ID
  name: string,                      // 显示名称
  path: string,                      // 路径
  level: number,                     // 树层级（0=根）
  _searchShow: boolean,              // 搜索可见性标记
  selectRightItem: boolean,          // 右键选中高亮
  tmp_id: string,                    // 前端唯一标识（函数节点）

  // 分组特有
  folder: true,                      // 节点类型标识
  parentId: string,                  // 父分组 ID（'0'=根）
  type: '2',                         // 资源类型（函数分组固定为 '2'）
  opened: boolean,                   // 展开/折叠状态
  tmpName: string,                   // 缓存完整名称路径
  tmpPath: string,                   // 缓存完整路径
  children: TreeNode[],              // 子节点（分组+函数）

  // 函数特有
  folder: false,
  _type: 'function',
  groupId: string,                   // 所属分组 ID
  groupName: string,                 // 所属分组名称
  groupPath: string,                 // 所属分组路径
  script: string|null,               // 函数脚本内容
  parameters: array|null,            // 函数参数
  description: string|null,          // 函数描述
  lock: '0'|'1',                    // 锁定状态
  delete: boolean                    // 删除标记（通知编辑器关闭标签）
}
```

### 5.3 状态流转

```
[组件挂载]
    │
    ├─ mounted()
    │   ├─ JavaClass.setupOnlineFunction(doFindFunction)
    │   ├─ JavaClass.setFunctionFinder(...)
    │   ├─ bus.$on('logout') → tree = []
    │   ├─ bus.$on('opened') → currentFileItem = item
    │   ├─ bus.$on('delete-api') → deleteApiInfo(item)
    │   ├─ bus.$on('refresh-resource') → initData()
    │   └─ Key.bind(Alt+G) → openCreateGroupModal()
    │
    └─ initData()（首次加载）
        ├─ GET group/list?type=2 → listGroupData
        ├─ GET function/list → listChildrenData
        ├─ initTreeData() → 构建树
        └─ openItemById() → 打开缓存的函数

[用户操作]
    │
    ├─ 点击函数节点 → open(item) → bus.$emit('open', item)
    │
    ├─ 右键分组 → folderRightClickHandle → 新建/修改/复制/删除/移动
    │
    ├─ 右键函数 → fileRightClickHandle → 复制/删除/锁定/解锁
    │
    ├─ 拖拽分组/函数 → draggable → 后端更新 → 重建前端树
    │
    ├─ 搜索 → doSearch(keyword) → 标记 _searchShow
    │
    ├─ 排序 → treeSortHandle() → sortTree()
    │
    └─ 收到 position-function → position(id) → rebuildTree + openItemById
```

---

## 6. 接口契约

### 6.1 提供的接口

本模块不对外导出 API。所有能力通过 bus 事件和 `JavaClass` 注册暴露：

| 接口 | 类型 | 消费者 |
|---|---|---|
| `bus.$emit('open', item)` | 事件 | 001-editor-core（打开函数脚本） |
| `bus.$emit('status', content)` | 事件 | bus.js（状态日志） |
| `bus.$emit('report', eventId)` | 事件 | bus.js（cnzz 埋点） |
| `JavaClass.setupOnlineFunction(doFindFunction)` | 回调注册 | 012-script-language（编辑器"跳转到定义"） |
| `JavaClass.setFunctionFinder(fn)` | 回调注册 | 012-script-language（自动补全函数列表） |
| `doFindFunction(path)` | 方法 | JavaClass 内部调用 |

### 6.2 消费的接口

| 来源 | 接口 | 消费方式 |
|---|---|---|
| 014-infra-transport | `request.send('group/list?type=2')` | 加载分组列表 |
| 014-infra-transport | `request.send('function/list')` | 加载函数列表 |
| 014-infra-transport | `request.send('group/create', obj)` | 创建分组 |
| 014-infra-transport | `request.send('group/update', obj)` | 修改/移动分组 |
| 014-infra-transport | `request.send('group/delete', {groupId})` | 删除分组 |
| 014-infra-transport | `request.send('group/copy', {src, target})` | 复制分组 |
| 014-infra-transport | `request.send('function/delete', {id})` | 删除函数 |
| 014-infra-transport | `request.send('function/lock', {id})` | 锁定函数 |
| 014-infra-transport | `request.send('function/unlock', {id})` | 解锁函数 |
| 014-infra-transport | `request.send('function/move', {id, groupId})` | 移动函数 |
| 014-infra-transport | `requestGroup('group/update', params)` | 分组更新（JSON body） |
| 014-infra-transport | `requestGroup('group/create', params)` | 分组创建（JSON body） |
| 006-resources-recent | `magic-group-choose` 组件 | 复制分组目标选择 |
| 001-editor-core | `bus.$emit('logout')` | 清空树 |
| 001-editor-core | `bus.$emit('opened', item)` | 同步当前文件 |
| 001-editor-core | `bus.$emit('delete-api', item)` | 触发删除 |
| 001-editor-core | `bus.$emit('refresh-resource')` | 全量刷新 |
| 008-layout-request | `bus.$emit('position-function', id)` | 定位函数（经 `magic-editor.vue` 转发） |

### 6.3 HTTP 端点契约

详见 [spec.md §9 HTTP 端点清单](./spec.md#9-http-端点清单)。补充说明：

| 端点 | 请求体格式 | 响应格式 |
|---|---|---|
| `GET group/list?type=2` | 无 | `ApiResponse<FunctionGroup[]>` |
| `GET function/list` | 无 | `ApiResponse<Function[]>` |
| `POST group/create` | JSON: `{name, path, type:'2', parentId}` | `ApiResponse<string>`（返回新分组 ID） |
| `POST group/update` | JSON: `{id, name, path, parentId, type:'2'}` | `ApiResponse<boolean>` |
| `POST group/delete` | `{groupId: string}` | `ApiResponse<boolean>` |
| `POST group/copy` | `{src: string, target: string}` | `ApiResponse<void>` |
| `POST function/delete` | `{id: string}` | `ApiResponse<boolean>` |
| `POST function/lock` | `{id: string}` | `ApiResponse<boolean>` |
| `POST function/unlock` | `{id: string}` | `ApiResponse<boolean>` |
| `POST function/move` | `{id: string, groupId: string}` | `ApiResponse<boolean>` |

### 6.4 Bus 事件契约

详见 [spec.md §10 Bus 事件清单](./spec.md#10-bus-事件清单)。补充说明：

- `open` 事件的 `item` 参数为完整函数节点对象（含 `id`/`tmp_id`/`name`/`path`/`script`/`groupId` 等）
- `position-function` 事件的 `id` 参数为函数 ID（后端 ID 或 `tmp_id`）
- `delete-api` 事件的 `item` 参数为函数节点对象，触发与右键删除相同的流程

---

## 7. 实现策略

### 7.1 架构模式

**单组件 + 动态右键菜单模式**：

```
MagicFunctionList（单一组件）
├── 工具栏（搜索 + 按钮）
├── magic-tree（通用树组件）
│   ├── #folder 插槽 → 分组节点渲染
│   └── #file 插槽 → 函数节点渲染
├── magic-dialog（分组创建/编辑）
└── magic-dialog（复制分组目标选择）
    └── magic-group-choose（分组选择器）

右键菜单（动态生成）:
├── 分组右键: 新建函数 / 刷新 / 新建分组 / 修改 / 复制 / 删除 / 移动到根节点
└── 函数右键: 复制函数 / 复制路径 / 锁定/解锁 / 刷新 / 删除
```

### 7.2 关键算法

#### 7.2.1 树构建算法（`initTreeData`）

```
输入: listGroupData（扁平分组列表）, listChildrenData（扁平函数列表）
输出: tree（嵌套树结构）

步骤:
1. 构建 groupItem map:
   groupItem = { root: [] }
   遍历 listGroupData:
     groupItem[element.id] = []
     element.folder = true
     element.opened = contants.DEFAULT_EXPAND
     element.tmpName = 规范化名称（前补 /）
     element.tmpPath = 规范化路径（前补 /）

2. 将函数放入对应分组:
   遍历 listChildrenData:
     element.tmp_id = element.id
     element._type = 'function'
     若 groupItem[element.groupId] 存在 → 推入
     否则 → element.groupName='', element.groupPath='', 推入 root

3. 递归构建分组树:
   arrayToTree(arr, parentItem, groupName, groupPath, level):
     遍历 arr 中每个 item:
       若 item.parentId == parentItem.id:
         item.level = level
         item.tmpName = groupName + item.tmpName
         item.tmpPath = groupPath + item.tmpPath
         item.children = arrayToTree(arr, item, item.tmpName, item.tmpPath, level+1)
         将 groupItem[item.id] 中的函数追加到 item.children
         推入结果数组
     返回结果数组

4. 合并: tree = [...arrayToTree(listGroupData, {id:0}, '', '', 0), ...groupItem['root']]
5. 排序: sortTree()
```

#### 7.2.2 排序算法（`sortTree`）

```
输入: tree（嵌套树）
输出: 排序后的 tree

规则:
- treeSort === null → 不排序，直接返回
- treeSort === true → 升序（localeCompare 'zh-CN'）
- treeSort === false → 降序（升序后 reverse）
- 分组始终在函数之前

步骤:
1. 递归遍历每个层级:
   分离 folderArr 和 fileArr
   对 folderArr 的 children 递归排序
   folderArr.sort(localeCompare)
   fileArr.sort(localeCompare)
   若降序 → folderArr.reverse(), fileArr.reverse()
   返回 folderArr.concat(fileArr)
2. 触发 changeForceUpdate() 刷新树组件
```

#### 7.2.3 搜索算法（`doSearch`）

```
输入: keyword（搜索关键字）
处理:
1. keyword 转小写
2. 递归遍历树（loopSearch）:
   分组节点:
     先递归处理所有子节点
     _searchShow = 自身名称匹配 || 任一子节点._searchShow
   函数节点:
     _searchShow = 名称或路径（经 replaceURL 规范化）包含 keyword
3. 触发 changeForceUpdate() 刷新树组件
```

#### 7.2.4 拖拽算法（`draggable`）

```
dragstart:
  draggableItem = item

dragenter:
  draggableTargetItem = item
  dragging = true

dragend:
  dragging = false
  若目标不是分组 → 结束

  若拖拽的是分组:
    条件检查:
      - 目标不是自身
      - 目标不是当前父级
      - checkChildrenFolder(源分组的 children) 不包含目标
    若通过:
      params = JSON.parse(JSON.stringify(draggableItem))
      params.parentId = 目标 id
      requestGroup('group/update', params)
        → 成功: 从原位置删除 → 插入新位置 → rebuildTree → goToAnchor
    否则:
      $magicAlert('不能移到{目标名称}')

  若拖拽的是函数:
    条件检查:
      - 目标不是当前父级
      - 目标分组的 children 不包含该函数
    若通过:
      request.send('function/move', {id, groupId: 目标 id})
        → 成功: 从原位置删除 → 更新 groupId → 插入新位置 → rebuildTree → goToAnchor
```

#### 7.2.5 定位算法（`position` + `openItemById`）

```
position(id):
  $nextTick → rebuildTree(false) → openItemById(id)

openItemById(openId):
  若 listChildrenData.length === 0（数据未加载完）:
    tmpOpenId.push(openId)  // 缓存
  否则:
    tmpOpenId.push(openId)（若不重复）
    遍历 tmpOpenId:
      cache = getItemById(id)
      若找到:
        $nextTick → open(cache) → $nextTick → goToAnchor('.ma-tree-select')
    tmpOpenId = []  // 清空缓存
```

### 7.3 错误处理

| 场景 | 处理方式 | 源码位置 |
|---|---|---|
| 分组名称为空 | `$magicAlert('分组名称不能为空')` | `magic-function-list.vue:549-552` |
| 复制未保存的函数 | `$magicAlert('请先保存在复制！')` | `magic-function-list.vue:429-431` |
| 删除分组/函数 | `$magicConfirm` 二次确认 | `magic-function-list.vue:507-509,600-602` |
| 删除分组/函数失败 | `$magicAlert('删除失败')` | `magic-function-list.vue:520,622` |
| 锁定/解锁失败 | `$magicAlert('锁定/解锁函数失败')` | `magic-function-list.vue:465` |
| 拖拽到子级（循环嵌套） | `$magicAlert('不能移到{名称}')` | `magic-function-list.vue:781` |
| 复制路径失败 | `$magicAlert('复制函数路径失败，请手动复制')` + `console.error` | `magic-function-list.vue:640-642` |
| HTTP 请求失败 | `HttpResponse.exceptionHandle` → `$magicAlert` | `request.js:62-66` |
| 401 未授权 | `bus.$emit('showLogin')` → 弹出登录覆盖层 | `request.js:151-153` |

### 7.4 性能优化

| 优化点 | 策略 | 源码位置 |
|---|---|---|
| 树组件强制更新 | 通过 `forceUpdate` 布尔值翻转触发 `magic-tree` 重新渲染，而非全量重建 | `magic-function-list.vue:728-730` |
| 搜索过滤 | 前端完成，不发起后端请求；通过 `_searchShow` 标记而非删除节点 | `magic-function-list.vue:165-177` |
| 路径规范化 | `replaceURL` 统一处理连续斜杠，避免重复计算 | `magic-function-list.vue:107,172,179,630` |
| 滚动定位 | `$nextTick` 延迟 + `goToAnchor` 确保 DOM 更新后滚动 | `magic-function-list.vue:561,576,777,800,846` |
| 深拷贝 | `deepClone` 用于复制函数时避免引用污染 | `magic-function-list.vue:107,435` |

---

## 8. 测试考虑

### 8.1 可测试性分析

当前工程无测试目录，以下列出建议的测试类别：

| 类别 | 测试场景 | 优先级 |
|---|---|---|
| 单元 | `initTreeData` 树构建算法（含无分组函数、多层嵌套分组） | 高 |
| 单元 | `sortTree` 排序算法（升序/降序/不排序，分组在前函数在后） | 高 |
| 单元 | `doSearch` 搜索算法（匹配函数/匹配分组/子匹配父可见/大小写忽略） | 高 |
| 单元 | `checkChildrenFolder` 循环嵌套检测（直接子级/深层子级/非子级） | 高 |
| 单元 | `deleteOrAddGroupToTree` 树的增删操作（根级/嵌套级/函数） | 高 |
| 单元 | `openItemById` 定位算法（数据已加载/数据未加载缓存） | 中 |
| 集成 | 新建函数 → 树中出现临时节点 → 发出 `open` 事件 | 高 |
| 集成 | 拖拽分组到子级 → 拒绝并提示 → 树结构不变 | 高 |
| 集成 | 删除分组 → 确认 → 后端删除成功 → 树中移除 + 通知编辑器关闭 | 中 |
| 集成 | `position-function` 事件 → 树展开并高亮目标函数 | 中 |
| E2E | 搜索 → 点击函数 → 编辑器打开脚本的完整流程 | 中 |

### 8.2 边界条件

| 场景 | 预期行为 | 源码位置 |
|---|---|---|
| 函数无所属分组 | 出现在树的根级别（`groupItem['root']`） | `magic-function-list.vue:226-229` |
| 分组 `parentId` 为 `'0'` | 视为根级分组 | `magic-function-list.vue:237,396` |
| 搜索关键字为空 | 所有节点 `_searchShow` 为 `true`（空字符串 indexOf 始终 > -1） | `magic-function-list.vue:166,170,172` |
| 拖拽函数到非分组节点 | 不执行任何操作（`dragend` 中检查 `draggableTargetItem.folder === true`） | `magic-function-list.vue:746` |
| 拖拽分组到自身 | 不执行任何操作（`id !== draggableTargetItem.id` 检查） | `magic-function-list.vue:748` |
| 复制未保存函数 | 弹出提示"请先保存在复制！"，不执行复制 | `magic-function-list.vue:429-431` |
| `position-function` 在数据加载前触发 | 缓存 ID 到 `tmpOpenId`，数据加载后自动打开 | `magic-function-list.vue:835-851` |
| 树为空时搜索 | `this.tree.forEach` 不执行，无报错 | `magic-function-list.vue:175` |

---

## 9. 文件清单

| 文件 | 目的 | 行数 |
|---|---|---|
| `src/components/resources/magic-function-list.vue` | 函数资源管理组件（树展示/搜索/排序/CRUD/拖拽/编辑器联动/快捷键/JavaClass 注册） | 883 |
| `src/components/resources/magic-resource.css` | 共享样式（树节点/工具栏/右键菜单高亮等） | ~200 |
| `src/scripts/bus.js` | EventBus + statusLog + cnzz 统计 | 57 |
| `src/scripts/contants.js` | 全局常量（`DEFAULT_EXPAND` 等） | 36 |
| `src/scripts/utils.js` | 工具函数（`replaceURL`, `requestGroup`, `goToAnchor`, `deepClone`） | 182 |
| `src/scripts/editor/java-class.js` | JavaClass 模块（`setupOnlineFunction`, `setFunctionFinder`） | ~1400 |
| `src/scripts/hotkey.js` | 快捷键绑定（`Key.bind`） | ~50 |
| `src/api/request.js` | HTTP 请求封装（axios + HttpResponse） | 194 |
| `src/components/common/magic-tree.vue` | 通用树组件 | ~300 |
| `src/components/common/modal/magic-dialog.vue` | 弹窗组件 | ~100 |
| `src/components/common/magic-input.vue` | 文本输入组件 | ~50 |
| `src/components/resources/magic-group-choose.vue` | 分组选择器组件 | 202 |
| `src/components/common/magic-text-icon.vue` | 类型图标组件 | ~30 |
| `src/components/common/magic-contextmenu/` | 右键菜单组件 | ~100 |

**本模块核心文件**：1 个（`magic-function-list.vue`，883 行）。
**依赖文件总计**：约 2,800 行。
