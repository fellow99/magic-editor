# 006-resources-recent 技术实现计划（As-Built）

> 本文件以"已建成系统"视角记录 006-resources-recent 模块的实际技术实现。
> 模块编号：006-resources-recent
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. Technical Context

### 1.1 Runtime Environment

| 维度 | 值 | 来源 |
|---|---|---|
| 运行环境 | 浏览器（现代浏览器，ES2020+） | [TECH.md](../TECH.md) |
| 前端框架 | Vue 3.4.x（Options API 风格） | `magic-recent-opened.vue:28` |
| 模块系统 | ES Modules（Vite 构建） | [TECH.md](../TECH.md) |
| 语言 | JavaScript（无 TypeScript） | 源码全为 `.js`/`.vue` |

### 1.2 Dependencies

#### 直接依赖（源码 import）

| 依赖 | 版本 | 消费组件 | 用途 |
|---|---|---|---|
| `@/scripts/bus.js` | 内部 | 全部三个组件 | 全局 EventBus |
| `@/scripts/hotkey.js` | 内部 | MagicRecentOpened | 快捷键绑定（Ctrl+E） |
| `@/scripts/store.js` | 内部 | MagicRecentOpened | localStorage 封装 |
| `@/scripts/contants.js` | 内部 | MagicRecentOpened, MagicResourceChoose, MagicGroupChoose | 全局常量（RECENT_OPENED、DEFAULT_EXPAND） |
| `@/api/request.js` | 内部 | MagicResourceChoose, MagicGroupChoose | HTTP 请求封装 |
| `@/components/common/magic-tree.vue` | 内部 | MagicResourceChoose, MagicGroupChoose | 树形渲染容器 |
| `@/components/common/modal/magic-dialog.vue` | 内部 | MagicRecentOpened | 对话框容器 |
| `@/components/common/magic-checkbox.vue` | 内部 | MagicResourceChoose, MagicGroupChoose | 复选框 |
| `@/components/common/magic-text-icon.vue` | 内部 | MagicRecentOpened, MagicResourceChoose | 文本图标（HTTP 方法/函数标识） |

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
| 第一条 | 单一主组件 + 注入式配置 | ✅ Compliant | 本模块三个组件均不声明 props/config 注入后端地址，HTTP 请求通过 `request.js` 使用 `contants.BASE_URL`（`magic-resource-choose.vue:38`），无硬编码后端地址 |
| 第二条 | 前后端契约即真相 | ✅ Compliant | 业务数据（API/Function/Datasource 列表）全部通过 HTTP 从后端加载（`magic-resource-choose.vue:89-140`），localStorage 仅持久化 `recent_opened` 用户偏好（`magic-recent-opened.vue:48`），符合宪法第二条"只允许 localStorage 缓存用户偏好" |
| 第三条 | 通信双通道：HTTP + WebSocket | ✅ Compliant | 本模块仅使用 HTTP 加载资源列表（`GET group/list`、`GET list`、`GET function/list`、`GET datasource/list`），不涉及 WebSocket |
| 第四条 | 事件总线即全局状态 | ✅ Compliant | 跨组件通信统一走 `bus.js`：监听 `close` 事件记录最近打开（`magic-recent-opened.vue:38`），发射 `open` 事件通知打开资源（`magic-recent-opened.vue:87`），无 Vuex/Pinia |
| 第五条 | monaco 一切围绕 magic-script | ✅ Compliant | 本模块不涉及 monaco 编辑器 |
| 第六条 | 类型契约由 Header 表达 | ✅ Compliant | HTTP 请求通过 `request.js` 自动注入 `magic-token` Header（`request.js:111-112`），本模块不直接操作 Header |
| 第七条 | 国际化只信语言包索引化 | ✅ Compliant | 本模块不涉及 monaco i18n |
| 第八条 | 双构建产物共存 | ✅ Compliant | 本模块为纯组件，无构建模式差异代码 |
| 第九条 | 错误反馈走模态框 + Bus | ✅ Compliant | HTTP 请求失败由 `request.js` 统一通过 `modal.magicAlert` 弹框（`request.js:62-66`），本模块不自行处理错误展示 |
| 第十条 | 源代码即文档真相 | ✅ Compliant | 本文档所有论断均附源码行号 |

### 例外登记

| ID | 违反条款 | 现状 | 备注 |
|---|---|---|---|
| E-001-C4 | 第四条（衍生约束） | `magic-recent-opened.vue:57-63` 通过 `this.$parent.$refs.apiList.getItemById()` 和 `$parent.$refs.functionList.getItemById()` 直接跨组件引用 003/004 模块的内部方法 | 隐式耦合，已在 spec.md C-006-001 登记 |
| E-002-C4 | 第四条（衍生约束） | `magic-recent-opened.vue:51` 通过 `document.getElementsByClassName('ma-container')[0]` 直接操作 DOM 注册快捷键，而非通过 bus 或组件 props | 依赖 DOM 结构稳定性 |

---

## 3. Project Structure

### 3.1 模块文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/components/resources/magic-recent-opened.vue` | 105 | 最近打开对话框：模板(19行) + 脚本(75行) + 样式(11行) |
| `src/components/resources/magic-resource-choose.vue` | 365 | 跨资源类型选择树：模板(33行) + 脚本(307行) + 样式(25行) |
| `src/components/resources/magic-group-choose.vue` | 202 | 分组单选选择器：模板(18行) + 脚本(157行) + 样式(27行) |
| `src/components/resources/magic-resource.css` | 109 | 共用样式：树容器、工具栏、节点样式（被本模块三个组件共享） |

### 3.2 组件内部结构

#### MagicRecentOpened（105 行）

```
magic-recent-opened.vue
├── <template> (19 行)
│   ├── magic-dialog 容器（340px × 420px）
│   ├── v-for 渲染 fullScripts 列表
│   │   ├── magic-text-icon（api 显示 HTTP 方法，function 显示函数图标）
│   │   └── label 显示"分组名/资源名(分组路径/资源路径)"
│   └── 空状态提示（v-show="fullScripts.length === 0"）
├── <script> (75 行)
│   ├── import 声明 (6 个依赖)
│   ├── data() (2 个响应式字段: visible, scripts)
│   ├── mounted() (14 行)
│   │   ├── bus.$on('close', ...) 监听关闭事件，记录到最近打开列表
│   │   └── Key.bind() 注册 Ctrl+E 快捷键
│   ├── computed
│   │   └── fullScripts — 通过 $parent.$refs 查找资源详情，过滤无效条目
│   └── methods (3 个方法)
│       ├── show() — 从 localStorage 加载数据并打开对话框
│       ├── open(item) — 发射 bus.$emit('open', item) 并关闭对话框
│       └── displayText(str) — 规范化连续斜杠
└── <style scoped> (11 行)
    └── @import magic-resource.css + 空状态/列表项样式
```

#### MagicResourceChoose（365 行）

```
magic-resource-choose.vue
├── <template> (33 行)
│   ├── magic-tree 容器（:data="tree", :loading="showLoading > 0"）
│   ├── #folder 插槽 — 分组节点渲染
│   │   ├── magic-checkbox（v-model="item.selected", :checked-half）
│   │   ├── 展开/折叠箭头
│   │   └── 名称 + 路径
│   └── #file 插槽 — 资源节点渲染
│       ├── magic-checkbox
│       ├── magic-text-icon（api/function）或 datasource 图标
│       └── 名称 + 路径
├── <script> (307 行)
│   ├── import 声明 (6 个依赖)
│   ├── props (3 个: height, maxHeight, refreshData)
│   ├── data() (7 个响应式字段)
│   └── methods (10 个方法)
│       ├── initData() — 并行加载三类资源树
│       ├── initTreeData() — 递归组装 tree 结构（arrayToTree）
│       ├── getSelected() — 递归获取所有选中节点
│       ├── doSelectAll(flag) — 全选/取消全选
│       ├── doSelected(item, selected) — 单选/取消，递归更新子节点+父节点
│       ├── rebuildTree(folding) — 重建树路径/名称
│       ├── treeSortHandle(flag) — 切换排序
│       ├── sortTree() — 递归排序（分组在前，资源在后，localeCompare）
│       ├── pushFileItemToGroup(tree, newItem) — 插入资源节点到对应分组
│       ├── changeForceUpdate() — 强制刷新 tree 组件
│       └── getParents(id) — 向上回溯查找父节点链
├── <style> (25 行) — 全局 checkbox 样式
└── <style scoped> (10 行) — tree 容器高度
```

#### MagicGroupChoose（202 行）

```
magic-group-choose.vue
├── <template> (18 行)
│   ├── magic-tree 容器
│   └── #folder 插槽 — 仅分组节点（单选模式）
│       ├── magic-checkbox（:value="item.id === selectedItem"）
│       └── 名称 + 路径
├── <script> (157 行)
│   ├── import 声明 (5 个依赖)
│   ├── props (4 个: height, maxHeight, rootName, type)
│   ├── data() (7 个响应式字段)
│   └── methods (7 个方法)
│       ├── initData() — 加载指定类型分组树
│       ├── initTreeData() — 递归组装 tree 结构
│       ├── getSelected() — 返回 selectedItem
│       ├── doSelected(item) — 设置 selectedItem
│       ├── unDoSelected() — 清除选中
│       ├── sortTree() — 递归排序
│       └── changeForceUpdate() — 强制刷新
├── <style> (14 行) — 全局 checkbox 样式
└── <style scoped> (10 行) — tree 容器高度
```

### 3.3 与相邻模块的物理边界

```
src/components/resources/
├── magic-recent-opened.vue    ← 006-resources-recent（本模块）
├── magic-resource-choose.vue  ← 006-resources-recent（本模块）
├── magic-group-choose.vue     ← 006-resources-recent（本模块）
├── magic-resource.css         ← 006-resources-recent（本模块，共用样式）
├── magic-api-list.vue         ← 003-resources-api（发射 close 事件，消费 MagicGroupChoose）
├── magic-function-list.vue    ← 004-resources-function（发射 close 事件，消费 MagicGroupChoose）
└── magic-datasource-list.vue  ← 005-resources-datasource

src/scripts/
├── bus.js                     ← 015-infra-bus-store（EventBus）
├── contants.js                ← 015-infra-bus-store（RECENT_OPENED / DEFAULT_EXPAND）
├── store.js                   ← 015-infra-bus-store（localStorage 封装）
└── hotkey.js                  ← 015-infra-bus-store（快捷键封装）

src/api/request.js             ← 014-infra-transport（HTTP 请求）
src/components/common/         ← 016-common-ui（MagicTree/MagicDialog/MagicCheckbox/MagicTextIcon）
```

---

## 4. Phase 0 Research

### 4.1 已解决的技术决策

| 决策点 | 选择 | 理由 | 源码证据 |
|---|---|---|---|
| 最近打开存储格式 | `[[_type, id], ...]` 二维数组 | 最小化存储，仅保存类型+ID，详情通过父组件 refs 实时查找 | `magic-recent-opened.vue:44` |
| 最近打开排序策略 | LRU（unshift 到数组头部） | 最近使用的排在最前，符合用户直觉 | `magic-recent-opened.vue:44` |
| 列表容量上限 | 30 条 | 避免 localStorage 数据过大，平衡实用性与存储成本 | `magic-recent-opened.vue:45-47` |
| 无效条目清理时机 | 对话框打开时（fullScripts computed） | 惰性清理，仅在需要展示时检查，避免不必要的性能开销 | `magic-recent-opened.vue:56-72` |
| 资源树加载策略 | 三类资源并行发起（Promise.all 语义） | 三类资源无依赖关系，并行加载减少总等待时间 | `magic-resource-choose.vue:89-140`（三个独立 request.send 链） |
| 树结构组装方式 | 递归 arrayToTree + parentId 映射 | 后端返回扁平列表，前端递归组装为树，parentId='0' 映射到根节点 | `magic-resource-choose.vue:166-190` |
| 多选状态管理 | 节点内联 selected/checkedHalf 属性 | 无需额外状态存储，直接在树节点对象上维护，递归向下+向上回溯 | `magic-resource-choose.vue:217-230` |
| 分组选择模式 | 单选（selectedItem 字符串） | 复制场景只需一个目标分组，无需多选 | `magic-group-choose.vue:131-133` |
| 树排序策略 | 分组在前、资源在后，按名称 localeCompare('zh-CN') | 中文拼音排序，符合中文用户习惯 | `magic-resource-choose.vue:268`、`magic-group-choose.vue:143` |
| 快捷键注册方式 | 直接 DOM 查询 + Key.bind | 简单直接，无需额外事件系统 | `magic-recent-opened.vue:51-53` |
| JSON.parse 容错 | 空 catch 块静默忽略 | 解析失败不影响对话框打开，符合宪法第九条"静默失败须显式注释"的例外（此处为已知行为） | `magic-recent-opened.vue:79-82` |

### 4.2 已识别的技术债（与 spec.md C 对齐）

| C 编号 | 问题 | 风险等级 | 缓解建议 |
|---|---|---|---|
| C-006-001 | `close` bus 事件的确切发射方未在三个源文件中出现 | 低 | 推测由 003/004 模块的资源列表组件在关闭 tab 时发射，功能正常 |
| C-006-002 | 最近打开列表未在登出时清空 | 低 | 登出后 localStorage 数据仍保留，下次登录可能显示旧数据；建议在 `logout` bus 事件中清理 |
| C-006-003 | `MagicResourceChoose` 无对外 `$emit` 事件，消费者通过 `$refs` 调用方法 | 低 | 与项目整体 Options API + refs 调用风格一致，但不够 Vue 3 惯用 |

---

## 5. Phase 1 Design Outputs

### 5.1 Data Model（引用）

本模块涉及的数据模型已在以下文档中定义：

- **最近打开条目**：[overall-data-model.md §3 localStorage 持久化条目](../overall-data-model.md#3-localstorage-持久化条目) — `recent_opened` 键，值为 `[[_type, id], ...]` 的 JSON 字符串
- **最近打开完整条目**：[spec.md §4 关键实体](./spec.md#4-关键实体) — 通过 ID 查找后的完整资源对象（`_type`, `id`, `name`, `path`, `method`, `groupName`, `groupPath`）
- **资源树节点**：[spec.md §4 关键实体](./spec.md#4-关键实体) — 树节点对象（`id`, `name`, `path`, `parentId`, `_type`, `folder`, `selected`, `checkedHalf`, `level`, `children[]`, `tmpName`, `tmpPath`）
- **配置常量模型**：[overall-data-model.md §2 配置常量模型](../overall-data-model.md#2-配置常量模型contants) — `RECENT_OPENED` / `RECENT_OPENED_TAB` / `DEFAULT_EXPAND`
- **Bus 事件载荷**：[overall-data-model.md §6 EventBus 事件载荷](../overall-data-model.md#6-eventbus-事件载荷) — `close` / `open` 事件

### 5.2 Contracts（引用）

本模块消费/生产的接口契约已在以下文档中定义：

- **HTTP 通用约定**：[overall-api.md §2 HTTP 通用约定](../overall-api.md#2-http-通用约定)
- **模块级 HTTP 端点**：[spec.md §9 HTTP 端点清单](./spec.md#9-http-端点清单)
- **模块级 Bus 事件**：[spec.md §8.3 总线事件清单](./spec.md#83-总线事件清单)
- **Props / Methods 接口**：[spec.md §8.4 Props / Emit 接口](./spec.md#84-props--emit-接口)
- **模块间边界**：[spec.md §10 模块边界](./spec.md#10-模块边界)

### 5.3 Quickstart

本模块为组件级模块，无独立运行方式。使用方式：

1. 确保 `magic-editor.vue` 主组件已挂载
2. 确保 `bus.js`、`contants.js`、`store.js`、`hotkey.js` 等基础设施已初始化
3. **最近打开对话框**：通过 `$refs.recentOpened.show()` 打开，或按 Ctrl+E 快捷键
4. **资源选择树**：通过 `<magic-resource-choose>` 嵌入，调用 `$refs.resourceChoose.initData()` 加载数据，`$refs.resourceChoose.getSelected()` 获取选中结果
5. **分组选择器**：通过 `<magic-group-choose>` 嵌入，调用 `$refs.groupChoose.initData()` 加载数据，`$refs.groupChoose.getSelected()` 获取选中分组 ID

开发调试：
```bash
npm run serve        # 启动 dev server
# 访问 http://localhost:5173（需后端 magic-api 运行在 :9999）
```

---

## 6. FR 实现策略映射

本节将 spec.md 中定义的每个 FR 映射到具体实现策略。

### 6.1 最近打开列表持久化（FR-006-001 ~ FR-006-007）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-006-001 | `bus.$on('close', item => { if (item.id) { ... } })` 监听关闭事件 | `magic-recent-opened.vue:38-50` |
| FR-006-002 | 存储格式 `[item._type, item.id]` 二维数组 | `magic-recent-opened.vue:44` |
| FR-006-003 | `this.scripts.unshift([item._type, item.id])` 移到最前 | `magic-recent-opened.vue:44` |
| FR-006-004 | `if (this.scripts.length > 30) { this.scripts.splice(30, this.scripts.length) }` 截断 | `magic-recent-opened.vue:45-47` |
| FR-006-005 | `store.set(contants.RECENT_OPENED, this.scripts)` 持久化 | `magic-recent-opened.vue:48` |
| FR-006-006 | `try { this.scripts = JSON.parse(str) } catch (e) {}` 静默容错 | `magic-recent-opened.vue:79-82` |
| FR-006-007 | `show()` 方法中 `store.get(contants.RECENT_OPENED)` 加载到 `scripts` 数组 | `magic-recent-opened.vue:76-84` |

### 6.2 最近打开对话框展示（FR-006-010 ~ FR-006-016）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-006-010 | 模板 `v-for="(it, i) in fullScripts"` 渲染，label 显示 `displayText(it.groupName + '/' + it.name)` | `magic-recent-opened.vue:6,10` |
| FR-006-011 | `magic-text-icon v-if="it._type === 'api'" v-model="it.method"` | `magic-recent-opened.vue:8` |
| FR-006-012 | `magic-text-icon v-if="it._type === 'function'" value="function"` | `magic-recent-opened.vue:9` |
| FR-006-013 | `v-show="fullScripts.length === 0"` 显示空状态提示 | `magic-recent-opened.vue:13-15` |
| FR-006-014 | `magic-dialog width="340px" height="420px"`，内容区 `height: 380px; overflow: auto` | `magic-recent-opened.vue:2,5` |
| FR-006-015 | `@click="open(it)"` → `bus.$emit('open', item); this.visible = false` | `magic-recent-opened.vue:6,86-89` |
| FR-006-016 | `displayText(str)` 方法 `str.replace(/\/+/g, '/')` 规范化连续斜杠 | `magic-recent-opened.vue:91` |

### 6.3 无效条目自动清理（FR-006-020 ~ FR-006-022）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-006-020 | `fullScripts` computed 中 `$parent.$refs.apiList.getItemById(item[1])` 和 `$parent.$refs.functionList.getItemById(item[1])` 查找 | `magic-recent-opened.vue:57-63` |
| FR-006-021 | `list.filter(it => it)` 过滤 undefined 条目 | `magic-recent-opened.vue:65,72` |
| FR-006-022 | `if (filtered.length !== this.scripts.length)` 时 `$nextTick` 中同步清理 localStorage | `magic-recent-opened.vue:66-71` |

### 6.4 快捷键（FR-006-060）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-006-060 | `Key.bind(document.getElementsByClassName('ma-container')[0], Key.Ctrl \| Key.E, () => this.show())` | `magic-recent-opened.vue:51-53` |

### 6.5 资源选择树（FR-006-030 ~ FR-006-038）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-006-030 | `initData()` 中三个独立 `request.send()` 链并行发起（API 分组+接口、Function 分组+函数、Datasource） | `magic-resource-choose.vue:80-140` |
| FR-006-031 | 根节点 `listGroupData` 初始化：`'1.接口列表'`、`'2.函数列表'`、`'3.数据源'` | `magic-resource-choose.vue:85-87` |
| FR-006-032 | `request.send('group/list?type=1')` 和 `request.send('group/list?type=2')` | `magic-resource-choose.vue:89,109` |
| FR-006-033 | `request.send('list')`、`request.send('function/list')`、`request.send('datasource/list')` | `magic-resource-choose.vue:98,118,129` |
| FR-006-034 | 数据源节点映射：`it._type = 'datasource'; it.path = it.key; it.groupId = 'datasource'` | `magic-resource-choose.vue:131-136` |
| FR-006-035 | `it.parentId = it.parentId == '0' ? 'api' : it.parentId`（API）和 `'function'`（函数） | `magic-resource-choose.vue:92,112` |
| FR-006-036 | `arrayToTree()` 递归组装，`this.tree = [...arrayToTree(...), ...groupItem['root']]` 分组在前资源在后 | `magic-resource-choose.vue:166-191` |
| FR-006-037 | `sortTree()` 中 `folderArr.sort(sortItem)` + `fileArr.sort(sortItem)`，`localeCompare('zh-CN')` | `magic-resource-choose.vue:263-294` |
| FR-006-038 | 数据源无分组层级，直接 `filter(it => it.id)` 后挂在 `datasource` 根节点下 | `magic-resource-choose.vue:129-140` |

### 6.6 多选/全选状态管理（FR-006-040 ~ FR-006-046）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-006-040 | 节点初始化时设置 `selected: false; checkedHalf: false` | `magic-resource-choose.vue:93-95,102-103,113-114,121-122,132-133` |
| FR-006-041 | `doSelected()` 中 `process()` 递归设置子节点 `selected` | `magic-resource-choose.vue:217-223` |
| FR-006-042 | `getParents()` 向上回溯更新父节点状态 | `magic-resource-choose.vue:227-230` |
| FR-006-043 | `node.selected = node.children.some(it => it.selected)` | `magic-resource-choose.vue:228` |
| FR-006-044 | `node.checkedHalf = node.children.some(it => !it.selected \|\| it.checkedHalf)` | `magic-resource-choose.vue:229` |
| FR-006-045 | `doSelectAll(flag)` 递归设置所有节点 `selected = flag`，分组节点 `checkedHalf = false` | `magic-resource-choose.vue:206-215` |
| FR-006-046 | `getSelected()` 递归遍历 `this.tree.filter(it => it.selected)` 返回 `{type, id}[]` | `magic-resource-choose.vue:194-205` |

### 6.7 分组选择对话框（FR-006-050 ~ FR-006-055）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-006-050 | `initData()` 中 `request.send('group/list?type=${this.type}')` 按 prop 加载 | `magic-group-choose.vue:69-85` |
| FR-006-051 | 根节点 `name: this.rootName` | `magic-group-choose.vue:73` |
| FR-006-052 | `doSelected(item)` 设置 `this.selectedItem = item.id`，checkbox `:value="item.id === selectedItem"` | `magic-group-choose.vue:131-133,10` |
| FR-006-053 | `getSelected()` 返回 `this.selectedItem` | `magic-group-choose.vue:128-130` |
| FR-006-054 | `unDoSelected()` 设置 `this.selectedItem = ''` | `magic-group-choose.vue:134-136` |
| FR-006-055 | `sortTree()` 与 MagicResourceChoose 相同的排序逻辑 | `magic-group-choose.vue:138-169` |

---

## 7. Complexity Tracking

### 7.1 复杂度热点

| 区域 | 组件 | 复杂度来源 | 行数 | 说明 |
|---|---|---|---|---|
| `initTreeData()` + `arrayToTree()` | MagicResourceChoose | 递归树组装 + 分组/资源合并逻辑 | 49 行（vue:143-191） | 嵌套递归：外层遍历分组，内层递归组装子分组并插入对应资源列表 |
| `doSelected()` | MagicResourceChoose | 向下递归子节点 + 向上回溯父节点的双向状态传播 | 15 行（vue:216-231） | 包含 `process()` 内部递归函数 + `getParents()` 调用 |
| `sortTree()` + `sortHandle()` | MagicResourceChoose / MagicGroupChoose | 递归排序（分组/资源分离 + 子树递归 + 升/降序切换） | 32 行（vue:263-294） | 两个组件各自实现相同逻辑，存在代码重复 |
| `fullScripts` computed | MagicRecentOpened | 通过 `$parent.$refs` 跨组件查找 + 惰性清理 | 17 行（vue:56-73） | 隐式依赖父组件的 refs 结构 |
| `getParents()` | MagicResourceChoose | 递归查找父节点链，通过重新遍历整棵树实现 | 16 行（vue:319-337） | 每次调用都从根节点重新遍历，O(n) 复杂度 |
| `initData()` | MagicResourceChoose | 三个并行请求链 + 嵌套回调 | 61 行（vue:80-140） | API 分组→接口为嵌套回调，Function 同理，Datasource 独立 |

### 7.2 圈复杂度评估

| 方法 | 分支数 | 评估 |
|---|---|---|
| `initData()` (MagicResourceChoose) | 6+ | 高 — 三个并行请求链，每个链有 success 回调 + 数据映射 |
| `initTreeData()` (MagicResourceChoose) | 4+ | 中 — arrayToTree 递归 + groupId 映射 + root 兜底 |
| `doSelected()` (MagicResourceChoose) | 3+ | 中 — 向下递归 + 向上回溯 + folder 特殊处理 |
| `sortHandle()` (MagicResourceChoose/GroupChoose) | 3+ | 中 — folder/file 分离 + 递归子树 + 升/降序 |
| `fullScripts` (MagicRecentOpened) | 3+ | 中 — api/function 类型分支 + 过滤 + 清理判断 |
| `getParents()` (MagicResourceChoose) | 3+ | 中 — 递归遍历 + 匹配 + 子树遍历 |
| `pushFileItemToGroup()` (MagicResourceChoose) | 3+ | 低 — 递归查找 + 匹配 + 插入 |

### 7.3 代码重复

| 重复区域 | 涉及组件 | 重复内容 | 建议 |
|---|---|---|---|
| `sortTree()` + `sortHandle()` + `sortItem()` | MagicResourceChoose, MagicGroupChoose | 完全相同的排序逻辑（分组在前、localeCompare、升/降序） | 可提取为共用 mixin 或 utils 函数 |
| `initTreeData()` + `arrayToTree()` | MagicResourceChoose, MagicGroupChoose | 树组装逻辑高度相似，区别仅在于 MagicResourceChoose 处理三类资源 | 可提取为通用 tree builder，传入资源类型配置 |
| checkbox 全局样式 | MagicResourceChoose, MagicGroupChoose | 完全相同的 `<style>` 块（12px checkbox） | 已部分共用 `magic-resource.css`，但 checkbox 样式未纳入 |

---

## 8. Progress Tracking

### 8.1 文档完成状态

| 章节 | 状态 | 备注 |
|---|---|---|
| 1. Technical Context | ✅ 完成 | 依赖清单完整，附源码行号 |
| 2. Constitution Check | ✅ 完成 | 10 条原则逐一检查，2 条例外登记 |
| 3. Project Structure | ✅ 完成 | 4 个文件清单 + 3 个组件内部结构 + 物理边界 |
| 4. Phase 0 Research | ✅ 完成 | 11 项技术决策 + 3 项技术债 |
| 5. Phase 1 Design Outputs | ✅ 完成 | data-model/contracts/quickstart 引用对齐 |
| 6. FR 实现策略映射 | ✅ 完成 | spec.md 全部 30 个 FR（FR-006-001~070）一一映射 |
| 7. Complexity Tracking | ✅ 完成 | 6 个复杂度热点 + 圈复杂度评估 + 代码重复分析 |
| 8. Progress Tracking | ✅ 完成 | 本章节 |

### 8.2 与总体文档对齐检查

| 对齐项 | 状态 | 说明 |
|---|---|---|
| overall-data-model.md localStorage 键 | ✅ 对齐 | `recent_opened` 键与 overall-data-model §3 一致，值为 `[[_type, id], ...]` JSON 字符串 |
| overall-data-model.md 配置常量 | ✅ 对齐 | `RECENT_OPENED` / `RECENT_OPENED_TAB` 与 overall-data-model §2 一致 |
| overall-api.md HTTP 约定 | ✅ 对齐 | 所有 HTTP 请求通过 `request.js` 发起，遵循 POST 默认 + form-urlencoded 约定 |
| overall-api.md 模块级端点 | ✅ 对齐 | spec.md §9 的 6 个端点均在源码中找到对应 `request.send()` 调用 |
| constitution.md 原则 | ✅ 对齐 | 10 条原则全部检查，2 条例外已登记（E-001-C4 / E-002-C4） |
| spec.md FR 编号 | ✅ 对齐 | FR-006-001~FR-006-070 共 30 个需求全部映射到实现策略 |
| spec.md localStorage 键 | ✅ 对齐 | `contants.RECENT_OPENED` = `'recent_opened'`，与 overall-data-model §3 和 spec.md §8.5 一致 |
