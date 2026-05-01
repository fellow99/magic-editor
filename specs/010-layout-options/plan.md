# 010-layout-options 技术实施计划（As-Built）

> 本文件以"已建成系统"视角记录 010-layout-options 模块的实际架构、设计决策与实现策略。
> 模块编号：010-layout-options
> 对应规范：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. Technical Context

### 1.1 Runtime Environment

| 维度 | 值 |
|---|---|
| 运行环境 | 浏览器（Chrome / Edge / Firefox 等现代浏览器） |
| 框架 | Vue 3.4（Options API 风格） |
| 构建工具 | Vite 5.4.21 |
| 编辑器内核 | monaco-editor 0.29.1（仅 MagicSearch 使用） |
| 通信方式 | EventBus（`bus.js`）+ HTTP（`request.js`） |
| 持久化 | localStorage（`store.js`） |

### 1.2 Dependencies

#### 直接依赖

| 依赖 | 版本 | 用途 | 消费组件 |
|---|---|---|---|
| `monaco-editor` | 0.29.1 | 搜索预览编辑器（语法高亮 + 只读预览） | `magic-search.vue` |
| `axios` | 0.21.1 | HTTP 请求封装 | `magic-option.vue`、`magic-search.vue`、`magic-todo.vue` |
| `@/scripts/bus.js` | 内部 | 全局事件总线 | 全部 6 个组件 |
| `@/scripts/store.js` | 内部 | localStorage 封装 | `magic-settings.vue`、`magic-search.vue` |
| `@/scripts/contants.js` | 内部 | 全局常量（字体/选项等） | `magic-option.vue`、`magic-search.vue` |
| `@/scripts/utils.js` | 内部 | `replaceKeywords()` 关键词高亮 | `magic-search.vue` |
| `@/api/request.js` | 内部 | HTTP 请求封装（axios 包装） | `magic-option.vue`、`magic-search.vue`、`magic-todo.vue` |
| `@/components/common/magic-input.vue` | 内部 | 输入框组件 | `magic-settings.vue`、`magic-option.vue`、`magic-search.vue` |
| `@/components/common/magic-select.vue` | 内部 | 可搜索下拉选择 | `magic-option.vue` |
| `@/components/common/magic-bottom-panel.vue` | 内部 | 子面板外壳 | `magic-options.vue` |
| `@/components/common/modal/magic-dialog.vue` | 内部 | 模态对话框 | `magic-search.vue` |
| `@/components/common/magic-text-icon.vue` | 内部 | 资源类型图标 | `magic-todo.vue` |

#### 间接依赖（monaco 内部模块）

| 依赖 | 用途 | 消费组件 |
|---|---|---|
| `monaco-editor/esm/vs/editor/common/modes.js` | `TokenizationRegistry`（语法高亮注册表） | `magic-search.vue` |
| `monaco-editor/esm/vs/editor/common/modes/textToHtmlTokenizer.js` | `tokenizeToString`（代码转 HTML 高亮） | `magic-search.vue` |

### 1.3 文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/components/layout/magic-options.vue` | 303 | 底部面板容器：Tab 注册、动态切换、高度拖拽 |
| `src/components/layout/magic-option.vue` | 116 | 接口选项编辑面板 |
| `src/components/layout/magic-search.vue` | 238 | 全局搜索对话框 |
| `src/components/layout/magic-settings.vue` | 147 | 全局参数/Header 编辑面板 |
| `src/components/layout/magic-todo.vue` | 152 | TODO 列表面板 |
| `src/components/common/magic-bottom-panel.vue` | 63 | 子面板外壳组件 |

---

## 2. Constitution Check

| 条款 | 状态 | 说明 |
|---|---|---|
| 第一条 单一主组件 + 注入式配置 | ✅ Compliant | 本模块不暴露根组件，所有组件均为 MagicEditor 的子组件；配置通过 `contants` 模块单例读取（`EDITOR_FONT_FAMILY`、`EDITOR_FONT_SIZE`、`OPTIONS`） |
| 第二条 前后端契约即真相 | ✅ Compliant | 本模块仅持久化用户偏好（`global-parameters`、`global-headers`），不持久化业务数据；业务数据（脚本/TODO/搜索结果）全部通过 HTTP 从后端获取 |
| 第三条 通信双通道 | ✅ Compliant | 本模块仅使用 HTTP（`POST search`、`GET todo`、`GET /options`），不涉及 WebSocket |
| 第四条 事件总线即全局状态 | ✅ Compliant | 跨组件通信全部通过 `bus.js`（`search-open`、`update-window-size`、`opened`、`api-group-selected`、`switch-tab`、`login`）；无 Vuex/Pinia/Provide-Inject |
| 第五条 monaco 围绕 magic-script | ✅ Compliant | MagicSearch 的预览编辑器使用 `language: 'magicscript'`，通过 `TokenizationRegistry.getPromise('magicscript')` 获取语法高亮支持 |
| 第六条 类型契约由 Header 表达 | ✅ Compliant | 本模块不直接操作 HTTP Header，通过 `request.js` 统一注入 |
| 第七条 国际化只信语言包索引化 | ✅ N/A | 本模块不涉及 monaco 国际化配置 |
| 第八条 双构建产物 | ✅ Compliant | 本模块组件通过 `import` 被主组件引用，两种构建模式均包含 |
| 第九条 错误反馈走模态框 + Bus | ✅ Compliant | `magic-option.vue:84-89` 使用 `$magicAlert` 提示"请先添加或选择接口" |
| 第十条 源代码即文档真相 | ✅ Compliant | 本文档所有论断均可在源码中找到证据 |

### 例外登记

| ID | 违反条款 | 现状 | 备注 |
|---|---|---|---|
| E-010-001 | 第四条衍生 | `magic-search.vue:133` 通过 `$parent.$parent.$refs` 跨两级父组件直接引用资源列表；`magic-todo.vue:60` 跨三级父组件引用 | 已在 spec.md NC-001/NC-002 登记待澄清 |

---

## 3. Project Structure

### 3.1 组件层级关系

```
MagicEditor (magic-editor.vue)
└── MagicLayout (magic-layout.vue)
    ├── MagicHeader (magic-header.vue)
    │   └── MagicSearch (magic-search.vue)          ← 通过 $refs.search.show() 打开
    └── MagicOptions (magic-options.vue)            ← 底部面板容器
        ├── MagicBottomPanel × N                     ← 子面板外壳
        │   ├── MagicRequest (008 模块)
        │   ├── MagicOption                          ← 接口选项
        │   ├── MagicRun (008 模块)
        │   ├── MagicDebug (008 模块)
        │   ├── MagicFunction (008 模块)
        │   ├── MagicGroup (008 模块)
        │   ├── MagicLog (008 模块)
        │   ├── MagicSettings                        ← 全局设置
        │   ├── MagicTodo                            ← TODO 列表
        │   └── MagicEvent (008 模块)
        └── (resizer)                                ← 高度拖拽分隔条
```

### 3.2 数据流

```
用户操作 → 组件内部 data 变更
                ↓
        deep watch / 方法调用
                ↓
        ┌───────┼───────────────┐
        ↓       ↓               ↓
   store.set  bus.$emit     request.send
   (localStorage) (事件通知)  (HTTP 请求)
        ↓       ↓               ↓
   持久化    主组件/其他组件   后端响应
   用户偏好   响应式更新       数据展示
```

### 3.3 Bus 事件完整映射

#### 发射（emit）

| 事件 | 发射组件 | 触发时机 | 参数 | 消费者 |
|---|---|---|---|---|
| `search-open` | `magic-search.vue:167` | 双击搜索结果项 | `{ type: 1\|2, id, cache, ... }` | `magic-editor.vue:212-218`（切换工具栏索引） |
| `update-window-size` | `magic-options.vue:105,119,127,132` | Tab 切换 / 面板高度变化 | 无 | 各编辑器/列表组件（重排 Monaco） |

#### 监听（on）

| 事件 | 监听组件 | 处理逻辑 | 源码行 |
|---|---|---|---|
| `opened` | `magic-options.vue` | 更新 `info` 数据，切换 Tab 集合，广播 body/response 事件 | `vue:68-92` |
| `api-group-selected` | `magic-options.vue` | 切换到分组 Tab 集合 | `vue:62-67` |
| `switch-tab` | `magic-options.vue` | 切换到指定子页签 | `vue:93-106` |
| `login` | `magic-todo.vue` | 刷新 TODO 列表 | `vue:53` |

#### 广播（由 magic-options.vue 在 `opened` 事件中发射）

| 事件 | 触发时机 | 参数 | 消费者 |
|---|---|---|---|
| `update-request-body-definition` | API 资源打开时 | `info.requestBodyDefinition` | 008 模块（MagicRequest） |
| `update-request-body` | API 资源打开时 | `info.requestBody` | 008 模块 |
| `update-response-body-definition` | API 资源打开时 | `info.responseBodyDefinition` | 008 模块 |
| `update-response-body` | API 资源打开时 | `info.responseBody` | 008 模块 |

---

## 4. Phase 0 Research — 已解决的技术决策

### 4.1 底部面板 Tab 动态切换策略

**决策**：使用数组拼接 + 条件替换策略，而非动态组件注册。

**实现**：
- 预定义四组 Tab 数组：`apiTabs`、`functionTabs`、`apiGroupTabs`、`commonTabs`
- 根据 `info._type` 选择主 Tab 组，再 `.concat(commonTabs)` 拼接公共 Tab
- `switch-tab` 事件中若目标 Tab 不在当前集合，自动切换到对应 Tab 组

**理由**：
- 简单直观，无需动态 import
- Tab 配置集中管理，便于维护
- 避免了 Vue 动态组件的注册/注销开销

**替代方案**：
- 动态 import + 异步组件注册（增加复杂度，无收益）
- 全部 Tab 始终渲染 + CSS 隐藏（性能差，DOM 节点多）

### 4.2 全局参数/Header 自动持久化

**决策**：使用 Vue deep watch 自动触发 `store.set()`，无手动保存按钮。

**实现**：
```js
watch: {
  headers: { deep: true, handler() { this.save() } },
  parameters: { deep: true, handler() { this.save() } }
}
```

**理由**：
- 用户体验好，修改即保存
- 避免遗忘保存导致数据丢失
- 实现简单，无需额外的"保存"状态管理

**风险**：
- 每次深变更都触发 `JSON.stringify` + `localStorage.setItem`，高频编辑时可能产生多余写入
- `save()` 方法（`vue:83-86`）从未被显式调用，作为兜底能力存在但未使用

### 4.3 搜索预览编辑器实现

**决策**：使用 monaco-editor 直接创建实例（`monaco.editor.create`），非 Vue 组件封装。

**实现**：
- 在 `initEditor()` 中通过 `document.getElementById('searchEditor')` 获取 DOM 节点
- 配置 `language: 'magicscript'`、`readOnly: true`、`wordWrap: 'on'`
- 通过 `TokenizationRegistry.getPromise('magicscript')` 获取语法高亮支持
- 在 `destroyed()` 钩子中调用 `searchEditor.dispose()` 清理

**理由**：
- 搜索预览是只读场景，无需完整编辑器功能
- 直接创建实例比 Vue 封装更轻量
- 避免引入额外的 monaco Vue 组件依赖

### 4.4 搜索结果语法高亮方案

**决策**：双层高亮 — monaco tokenize + 自定义关键词替换。

**实现**：
1. 第一层：`tokenizeToString()` 将代码转为带 monaco 语法高亮 class 的 HTML
2. 第二层：`replaceKeywords()` 在 HTML 中替换关键词为 `<span class="keyword">` 黄色高亮

**理由**：
- monaco tokenize 提供语言级语法高亮
- `replaceKeywords()` 提供搜索关键词的额外视觉标记
- 两层叠加确保搜索结果既有语法语义又有搜索焦点

### 4.5 面板高度拖拽实现

**决策**：原生 DOM 事件（`document.onmousemove` / `document.onmouseup`）实现拖拽。

**实现**：
- `mousedown` 时绑定 `document.onmousemove` 和 `document.onmouseup`
- 拖拽过程中实时更新 `contentHeight` 并触发 `update-window-size`
- 最小高度限制 150px（`e.clientY > 150`）
- `mouseup` 时清理事件绑定

**理由**：
- 无需引入第三方拖拽库
- 实现简单直接
- 默认高度 300px（`contentHeight: '300px'`）

### 4.6 跨组件引用策略

**决策**：通过 `$parent.$parent.$refs` 链式访问资源列表（搜索/TODO 组件）。

**实现**：
- `magic-search.vue:133`：`this.$parent.$parent.$refs.apiList` / `functionList`
- `magic-todo.vue:60`：`this.$parent.$parent.$parent.$refs.apiList` / `functionList`

**理由**（推断）：
- 避免引入额外的全局状态管理
- 组件层级固定，引用路径可预期

**风险**：
- 耦合度高，组件层级变化将导致引用断裂
- 已在 spec.md NC-001/NC-002 登记待澄清

---

## 5. Phase 1 Design Outputs

### 5.1 FR 映射表

| Spec FR | 实现文件 | 实现方式 | 状态 |
|---|---|---|---|
| FR-001 ~ FR-010 | `magic-settings.vue` | 双 Tab 导航 + 表格编辑 + deep watch 自动保存 | ✅ Implemented |
| FR-020 ~ FR-036 | `magic-search.vue` | MagicDialog + monaco 编辑器 + 防抖搜索 + 双层高亮 | ✅ Implemented |
| FR-040 ~ FR-050 | `magic-todo.vue` | GET todo + 表格展示 + login 事件刷新 + 点击跳转 | ✅ Implemented |
| FR-060 ~ FR-072 | `magic-options.vue` | Tab 数组拼接 + bus 事件订阅 + 原生拖拽 | ✅ Implemented |
| FR-080 ~ FR-086 | `magic-option.vue` | 表格 + MagicSelect + GET /options + 自动填充 | ✅ Implemented |
| FR-090 ~ FR-093 | `magic-bottom-panel.vue` | 标题栏 + buttons prop + slot + 最小化按钮 | ✅ Implemented |

### 5.2 数据模型

#### 5.2.1 全局参数/Header 行

```js
{
  name: string,        // 键
  value: string,       // 值
  description: string  // 描述
}
```

持久化：`store.set('global-parameters', parameters)` / `store.set('global-headers', headers)`

#### 5.2.2 搜索结果项

```js
{
  id: number,          // 资源 ID
  type: number,        // 1=接口, 2=函数
  text: string,        // 高亮后的代码片段 HTML
  line: number,        // 行号
  cache: object        // 缓存的资源对象（通过 apiList/functionList.getItemById 获取）
}
```

#### 5.2.3 TODO 条目

```js
{
  id: number,          // 资源 ID
  type: number,        // 1=接口, 2=函数
  text: string,        // TODO/FIXME 注释内容
  line: number,        // 行号
  cache: object,       // 缓存的资源对象
  method: string       // HTTP 方法（仅接口类型）
}
```

#### 5.2.4 Tab 配置对象

```js
{
  id: string,          // Tab 唯一标识
  name: string,        // 显示名称
  icon: string,        // 图标类名（不含前缀 'ma-icon-'）
  component: VueComponent,  // 组件引用
  right?: boolean,     // 是否右对齐
  buttons?: Array      // 标题栏操作按钮（可选）
}
```

#### 5.2.5 可选项元数据

```js
{
  text: string,        // 选项名（显示文本）
  value: string,       // 选项值
  description: string, // 描述
  defaultValue: string // 默认值
}
```

来源：后端 `GET /options` 返回 `[[name, description, defaultValue], ...]` 与 `contants.OPTIONS` 合并。

### 5.3 接口契约

#### 5.3.1 本模块消费的 HTTP 端点

| 方法 | 路径 | 请求体 | 响应 | 消费组件 |
|---|---|---|---|---|
| POST | `search` | `{ keyword: string }` | `[{ id, type, text, line }, ...]` | `magic-search.vue` |
| GET | `todo` | 无 | `[{ id, type, text, line, method? }, ...]` | `magic-todo.vue` |
| GET | `options` | 无 | `[[name, description, defaultValue], ...]` | `magic-option.vue` |
| GET | `get?id=<id>` | 无 | `{ script: string, ... }` | `magic-search.vue`（预览用） |
| GET | `function/get?id=<id>` | 无 | `{ script: string, ... }` | `magic-search.vue`（预览用） |

#### 5.3.2 本模块提供的 Bus 事件

| 事件 | 载荷 | 语义 |
|---|---|---|
| `search-open` | `{ type: 1\|2, id, cache, ... }` | 用户双击搜索结果，请求打开对应资源 |
| `update-window-size` | 无 | 底部面板布局变化，通知编辑器重排 |

#### 5.3.3 本模块广播的 Bus 事件（由 `opened` 事件触发）

| 事件 | 载荷 | 语义 |
|---|---|---|
| `update-request-body-definition` | `info.requestBodyDefinition` | API 资源打开时广播请求体定义 |
| `update-request-body` | `info.requestBody` | API 资源打开时广播请求体数据 |
| `update-response-body-definition` | `info.responseBodyDefinition` | API 资源打开时广播响应体定义 |
| `update-response-body` | `info.responseBody` | API 资源打开时广播响应体数据 |

### 5.4 状态机

#### 5.4.1 MagicSearch 对话框状态

```
[关闭] ──show()──→ [打开, 空列表]
                      │
                      ├─ inputText 变更 → [防抖 600ms] → POST search → [有结果]
                      │                      │
                      │                      └─ 无结果 → [无结果占位]
                      │
                      ├─ 单击结果项 → [选中, 预览代码]
                      │
                      ├─ 双击结果项 → search-open → [关闭]
                      │
                      └─ onClose → dispose editor → [关闭]
```

#### 5.4.2 MagicOptions Tab 切换状态

```
[初始化: apiTabs + commonTabs]
         │
         ├─ opened(api) → [apiTabs + commonTabs, selectedTab = 'request']
         │
         ├─ opened(function) → [functionTabs + commonTabs, selectedTab = 'function']
         │
         ├─ api-group-selected → [apiGroupTabs + commonTabs, selectedTab = 'group']
         │
         ├─ switch-tab(target) → [切换对应 Tab 组 + commonTabs, selectedTab = target]
         │
         └─ 点击已选中 Tab → [selectedTab = null]（收起面板）
```

### 5.5 错误处理

| 场景 | 处理方式 | 源码位置 |
|---|---|---|
| 搜索请求失败 | 由 `request.js` 拦截器统一处理（`modal.magicAlert`） | `request.js:62-66` |
| TODO 列表加载失败 | 同上 | `request.js:62-66` |
| 选项列表加载失败 | 静默处理（`data = data || []`），降级为空数组 | `magic-option.vue:59` |
| 接口选项添加时 info.option 不存在 | `$magicAlert` 提示"请先添加或选择接口" | `magic-option.vue:84-89` |
| monaco 编辑器销毁 | `destroyed()` 钩子调用 `searchEditor.dispose()` | `magic-search.vue:184-187` |

### 5.6 性能考量

| 关注点 | 实现策略 | 源码位置 |
|---|---|---|
| 搜索防抖 | 600ms `setTimeout` + `clearTimeout` | `magic-search.vue:114-116` |
| 语法高亮异步 | `async getHighlight()` 不阻塞 UI | `magic-search.vue:106-112` |
| 单击/双击区分 | 300ms `setTimeout` 延迟单击执行 | `magic-search.vue:150-156` |
| 面板高度拖拽 | 原生 DOM 事件，无框架开销 | `magic-options.vue:112-128` |
| deep watch 持久化 | 每次深变更触发 `JSON.stringify` + `localStorage.setItem` | `magic-settings.vue:118-131` |
| 搜索结果列表高度限制 | CSS `height: 200px; overflow: auto` | `magic-search.vue:197-198` |
| TODO 列表 loading 延迟 | `setTimeout(500ms)` 避免闪烁 | `magic-todo.vue:70-72` |

---

## 6. Complexity Tracking

| 复杂度来源 | 级别 | 说明 |
|---|---|---|
| Tab 动态切换逻辑 | 中 | 四组 Tab 数组的拼接/替换/回退逻辑，需保证 `commonTabs` 始终存在 |
| 搜索双层高亮 | 中 | monaco tokenize + `replaceKeywords()` 两层 HTML 处理，需确保 HTML 结构不被破坏 |
| 跨组件引用链 | 高 | `$parent.$parent.$refs` / `$parent.$parent.$parent.$refs` 耦合度高，组件层级变化将断裂 |
| 面板拖拽 | 低 | 原生 DOM 事件实现，逻辑简单 |
| deep watch 持久化 | 低 | Vue 内置能力，配置即用 |
| monaco 编辑器生命周期 | 中 | 延迟初始化（`$nextTick`）+ 手动销毁（`destroyed`），需确保不泄漏 |

---

## 7. Progress Tracking

| 阶段 | 状态 | 说明 |
|---|---|---|
| spec.md 生成 | ✅ Done | 功能需求、用户故事、实体、场景、边界、事件清单完整 |
| plan.md 生成 | ✅ Done | 技术上下文、宪法检查、数据模型、接口契约、状态机、错误处理、性能考量完整 |
| FR 映射验证 | ✅ Done | 全部 FR（FR-001~FR-093）均已映射到源码实现 |
| Constitution Check | ✅ Done | 十条宪法条款逐一检查，1 条例外已登记 |
| Bus 事件对齐 | ✅ Done | 发射/监听/广播事件与 `overall-api.md`、`overall-data-model.md` 一致 |
| 待澄清事项 | 4 项 | NC-001~NC-004 登记于 spec.md §13 |

---

## 附录：与 overall-api.md 的对齐验证

| overall-api.md 条目 | 本模块对应 | 对齐状态 |
|---|---|---|
| §2.2 默认请求设置（POST / form-urlencoded） | `magic-search.vue:117` POST search、`magic-option.vue:58` GET options、`magic-todo.vue:58` GET todo | ✅ 一致 |
| §2.3 通用请求 Header（magic-token） | 通过 `request.js` 统一注入，本模块不直接操作 | ✅ 一致 |
| §6.4 EventBus 事件 `search-open` | `magic-search.vue:167` 发射，`magic-editor.vue:212-218` 消费 | ✅ 一致 |
| §6.4 EventBus 事件 `update-window-size` | `magic-options.vue:105,119,127,132` 发射 | ✅ 一致 |
| §6.4 EventBus 事件 `login` | `magic-todo.vue:53` 订阅 | ✅ 一致 |
