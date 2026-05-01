# 008-layout-request 技术计划（As-Built）

> 本文件以"已建成系统"视角记录 008-layout-request 模块的实际架构、设计决策与实现策略。
> 模块：008-layout-request
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. 技术上下文

### 1.1 运行环境

| 维度 | 值 |
|---|---|
| 运行时 | 现代浏览器（Chrome/Edge/Firefox/Safari） |
| 框架 | Vue 3.4（Options API 风格，全部 9 个子组件均为 `export default { data/mounted/methods }`） |
| 构建 | Vite 5.4.21，双 mode（app → `dist-app/`，lib → `dist/`） |
| 编辑器内核 | monaco-editor 0.29.1（Body JSON 编辑器 + 响应体只读编辑器） |
| 通信 | axios 0.21（HTTP）+ 自研 ReconnectingWebSocket（WS 日志流） |
| 状态 | 自实现 EventBus（`src/scripts/bus.js`），无 Vuex/Pinia |
| 持久化 | localStorage（仅全局参数/全局 Header，通过 `store.js` 封装） |

### 1.2 依赖清单

| 依赖 | 版本 | 用途 | 消费组件 |
|---|---|---|---|
| `vue` | ^3.4.0 | 组件框架 | 全部 |
| `monaco-editor` | ^0.29.1 | JSON 编辑器（请求 Body + 响应 Body） | MagicRequest, MagicRun |
| `axios` | ^0.21.0 | HTTP 请求（`/options`, `group/update`） | MagicGroup, MagicOption |
| `qs` | ^6.9.4 | 请求体序列化（由 `api/request.js` 统一使用） | 间接 |
| `@/scripts/bus.js` | 内部 | EventBus 跨组件通信 | 全部 |
| `@/scripts/contants.js` | 内部 | 全局常量（Header 名/字体/业务码） | MagicRequest, MagicDebug |
| `@/scripts/store.js` | 内部 | localStorage 封装 | MagicRequest（主题）, MagicRun（主题） |
| `@/scripts/utils.js` | 内部 | `formatJson`, `isVisible`, `deepClone`, `requestGroup`, `download` | MagicRequest, MagicRun, MagicGroup |
| `@/scripts/parsing/parser.js` | 内部 | `parseJson()` JSON 解析 + 结构化 | MagicRequest, MagicRun |
| `@/api/request.js` | 内部 | HTTP 请求封装（axios + HttpResponse） | MagicGroup, MagicOption |
| `@/components/common/magic-input.vue` | 内部 | 文本输入 | MagicRequest, MagicFunction, MagicGroup, MagicOption |
| `@/components/common/magic-select.vue` | 内部 | 下拉选择（支持可搜索） | MagicRequest, MagicFunction, MagicGroup, MagicOption |
| `@/components/common/magic-checkbox.vue` | 内部 | 复选框 | MagicRequest |
| `@/components/common/magic-file.vue` | 内部 | 文件选择（支持 multiple） | MagicRequest |
| `@/components/common/magic-textarea.vue` | 内部 | 多行文本 | MagicRequest, MagicFunction |
| `@/components/common/magic-json.vue` | 内部 | JSON 结构化展示 | MagicRequest, MagicRun |
| `@/components/common/magic-bottom-panel.vue` | 内部 | 底部面板容器（标题栏 + 最小化按钮） | MagicOptions |
| `@/components/common/magic-structure.vue` | 内部 | 结构化数据展示 | MagicDebug |
| `@/components/common/modal/` | 内部 | `$magicAlert` 弹框 | MagicRequest, MagicFunction, MagicGroup |
| `@/components/common/magic-contextmenu/` | 内部 | `$magicContextmenu` 右键菜单 | MagicLog |

---

## 2. Constitution 合规性检查

| 宪法条款 | 合规状态 |  justification |
|---|---|---|
| **第一条** 单一主组件 + 注入式配置 | ✅ 合规 | 本模块所有组件不声明 `props.config`，不硬编码后端地址；baseURL 通过 `contants.BASE_URL` / `contants.SERVER_URL` 读取（`magic-group.vue:131` 的 `request.send('/options')` 使用全局 baseURL） |
| **第二条** 前后端契约即真相 | ✅ 合规 | 本模块不持久化业务数据；`info` 对象由 001-editor-core 注入，面板仅编辑内存状态；分组保存通过 `POST group/update` 写回后端（`magic-group.vue:167`） |
| **第三条** 通信双通道：HTTP + WebSocket | ✅ 合规 | HTTP 用于 CRUD（`/options` GET、`group/update` POST）；WebSocket 仅用于日志流（`ws_log` 事件，`magic-log.vue:28`）；不通过 WS 发起 CRUD，不通过 HTTP 长轮询 |
| **第四条** 事件总线即全局状态 | ✅ 合规 | 所有跨组件通信走 `bus.js`（`opened`/`switch-tab`/`api-group-selected`/`update-response-body` 等）；无 Vuex/Pinia/Provide-Inject |
| **第五条** monaco 围绕 magic-script | ✅ 合规 | 本模块中 monaco 仅用于 JSON 编辑（请求 Body / 响应 Body），语言为 `json`，不涉及 magic-script 语言服务 |
| **第六条** 类型契约由 Header 表达 | ✅ 合规 | 本模块不直接设置调试 Header；但 `MagicGroup` 的 `requestGroup()` 使用 `Content-Type: application/json`（`utils.js:56-58`），符合 Header 表达类型原则 |
| **第七条** 国际化只信构建期 | ⚠️ 部分 | 本模块 UI 文案全部中文硬编码（符合 overall-spec FR-081）；monaco JSON 编辑器的 i18n 由构建期插件处理（`vite.config.js:monacoEditorLocalesPlugin`），本模块不干预 |
| **第八条** 双构建产物共存 | ✅ 合规 | 本模块组件通过 `src/components/layout/` 目录统一打包，应用模式与库模式均包含；CSS 无 hash（`vite.config.js:assetFileNames`） |
| **第九条** 错误反馈走模态框 + Bus | ✅ 合规 | 所有错误通过 `$magicAlert` 弹出（`magic-request.vue:291-294,310-313`、`magic-function.vue:85-88,100-103`、`magic-group.vue:158-161,175-178`）；无 `console.error` 作为唯一反馈 |
| **第十条** 源代码即文档真相 | ✅ 合规 | 本文档所有论断均附源码路径/行号；待澄清事项显式标记 |

### 例外登记

本模块无新增例外。

---

## 3. 研究发现

### 3.1 容器-子组件架构模式

**决策**：MagicOptions 作为底部面板的容器组件，通过动态 `tabs` 数组管理子面板的注册与切换。

**实现**：
- `tabs` 数组由 `apiTabs` / `functionTabs` / `apiGroupTabs` / `commonTabs` 四组拼接而成（`magic-options.vue:41-58`）
- 通过 `<component v-bind:is="item.component" v-model:info="info"/>` 动态渲染（`magic-options.vue:8`）
- 所有子组件共享同一 `info` 对象引用（通过 `v-model:info` 双向绑定），无数据拷贝

**理由**（推断）：
- 避免 prop drilling：MagicOptions 作为中间层，将 `info` 统一传递给所有子组件
- 动态 Tab 切换：根据资源类型（API / Function / Group）切换不同的 Tab 集合
- 共享状态：子组件对 `info` 的修改直接反映到父组件，001-editor-core 读取时无需同步

**后果**：
- 优点：状态共享简单，子组件直接修改 `info` 即可
- 缺点：`info` 对象结构隐式约定（无 TypeScript 接口），子组件依赖 `info` 的特定属性存在

### 3.2 Monaco 编辑器懒加载策略

**决策**：MagicRequest 的 Body 编辑器在首次切换到"请求 Body"页签时才创建实例，而非组件挂载时立即创建。

**实现**：
- `initRequestBodyDom()` 检查 `this.bodyEditor == null && this.showIndex === 3`（`magic-request.vue:343`）
- 创建后通过 `bus.$on('update-window-size', ...)` 监听布局变化（`magic-request.vue:371`）
- 组件销毁时调用 `this.bodyEditor.dispose()`（`magic-request.vue:416-418`）

**理由**：
- 性能优化：用户可能永远不会切换到 Body 页签，避免不必要的 monaco 实例创建
- monaco 实例较重（~2MB JS），懒加载减少首屏加载时间

### 3.3 valueCopy 元数据保留算法

**决策**：当 Body JSON 结构变化时，通过递归 `valueCopy()` 保留同名字段的验证规则、默认值、描述等元数据。

**实现**（`magic-request.vue:385-413`）：
```
新 Body 结构 → 遍历每个字段 → 在旧 Body 中查找同名同层级字段 →
  若找到：
    Object/Array 类型 → 递归处理 children
    其他类型 → 复制 validateType/expression/error/defaultValue
    始终复制 name/description/selected/required
  若未找到 → 使用新字段的默认值
```

**理由**（推断）：
- 用户先通过 UI 定义了字段的验证规则和描述，然后修改 JSON 结构
- 直接替换会丢失所有元数据，`valueCopy()` 提供"智能合并"体验

**风险**：
- 字段重命名会导致元数据丢失（按 `name` 精确匹配）
- 数组元素的匹配依赖 `arrayFlag`，嵌套数组的元数据保留可能不准确

### 3.4 分组保存的 HTTP 请求方式

**决策**：分组保存使用 `requestGroup()` 工具函数，而非标准的 `request.send()`。

**实现**（`utils.js:45-61`）：
- 请求体为 `JSON.stringify({...})`，非 `Qs.stringify`
- `Content-Type: application/json`，非默认的 `application/x-www-form-urlencoded`
- `transformRequest: []`，跳过 axios 的默认请求体转换

**理由**（推断）：
- 后端 `group/update` 接口期望 JSON 格式的请求体
- 与接口/函数的保存方式（`POST /save`，JSON 格式）保持一致

### 3.5 响应二进制处理的两种路径

**决策**：MagicRun 根据响应类型选择不同的展示方式。

**实现**：
- 路径 1（JSON 响应）：`update-response-body` 事件 → Monaco 只读编辑器展示文本（`magic-run.vue:70-79`）
- 路径 2（二进制响应）：`update-response-blob` 事件 → 检查 `content-disposition` → 有则下载，无则 iframe 展示（`magic-run.vue:83-99`）

**理由**：
- 后端通过 `ma-content-type` Header 告知响应类型
- 001-editor-core 的 `sendTestRequest()` 设置 `responseType: 'blob'`，统一以 Blob 接收
- Blob 需要特殊处理：JSON 类型需读为文本，二进制类型需展示或下载

---

## 4. 数据模型

### 4.1 共享 info 对象结构

所有子组件通过 `v-model:info` 共享同一对象引用。该对象由 001-editor-core 注入，结构如下：

**API 类型**：
```
info: {
  _type: 'api',
  id: string,              // 空字符串表示新增
  tmp_id: string,          // 前端生成的临时唯一标识
  name: string,            // 接口名称
  path: string,            // 接口路径
  method: 'GET'|'POST'|'PUT'|'DELETE'|'HEAD'|'PATCH',
  groupPath: string,       // 分组路径前缀
  groupId: string,         // 分组 ID
  groupName: string,       // 分组名称
  lock: '0'|'1',          // 锁定状态
  running: boolean,        // 是否正在执行测试
  // —— 请求参数（由 MagicRequest 编辑）——
  parameters: [{           // 查询/表单参数
    name, value, dataType, defaultValue, validateType, expression, error, description, required
  }],
  headers: [{              // 请求 Header
    name, value, dataType, defaultValue, validateType, expression, error, description, required
  }],
  paths: [{                // 路径变量
    name, value, dataType, validateType, expression, error, description
  }],
  requestBody: string,     // JSON 字符串
  requestBodyDefinition: object,  // 结构化定义（由 parseJson 产出）
  responseBody: string,    // 响应体 JSON 字符串
  responseBodyDefinition: object, // 响应体结构化定义
  responseHeader: object,  // 响应头
  option: [{               // 接口选项（由 MagicOption 编辑）
    name, value, description
  }],
  description: string,     // 接口描述
  // —— 扩展属性（由 001-editor-core 注入）——
  ext: {
    debuging: boolean,     // 是否处于调试态
    sessionId: string,     // 当前调试会话 ID
    variables: [{name, value, type}],  // 调试变量
    decorations: array,    // 断点装饰列表
    debugDecorations: array,
    debugDecoration: object,
    save: boolean,
    loading: boolean,
    scrollTop: number,
    tmpScript: string|null,
    tabDraggable: boolean,
    requestConfig: object  // 最后一次测试的请求配置
  }
}
```

**Function 类型**：
```
info: {
  _type: 'function',
  name: string,
  path: string,
  returnType: 'java.lang.Number'|'java.lang.String'|'java.util.Collection'|'java.util.Map'|'java.lang.Object',
  parameters: [{name, type, description}],
  description: string
}
```

**Group 类型**：
```
info: {
  id: string,
  name: string,
  path: string,
  type: number,
  parentId: string,
  paths: [{name, value, dataType, validateType, expression, error, description}],
  options: [{name, value, description}]
}
```

### 4.2 Tab 配置对象

```
tab: {
  id: string,          // 'request' | 'options' | 'result' | 'debug' | 'function' | 'group' | 'log' | 'setting' | 'todo' | 'event'
  name: string,        // 显示名称
  icon: string,        // 图标类名后缀（如 'parameter' → 'ma-icon-parameter'）
  component: VueComponent,  // 动态渲染的组件
  right?: boolean      // 是否右对齐（仅 event）
}
```

### 4.3 状态流转

```
[资源未选中]
    │
    ├─ 点击 API 节点 → opened(info) → apiTabs + commonTabs → 默认选中 'request'
    │
    ├─ 点击 Function 节点 → opened(info) → functionTabs + commonTabs → 默认选中 'function'
    │
    ├─ 点击分组节点 → api-group-selected(group) → apiGroupTabs + commonTabs → 默认选中 'group'
    │
    └─ 登出 → logout → 清空 info
```

---

## 5. 接口契约

### 5.1 提供的接口

本模块不对外导出 API。所有能力通过 bus 事件和 `v-model:info` 暴露。

### 5.2 消费的接口

| 来源 | 接口 | 消费方式 |
|---|---|---|
| 001-editor-core | `info` 对象 | `v-model:info` 双向绑定 |
| 001-editor-core | `bus.$emit('opened', info)` | 监听 → 切换 Tab 集合 |
| 001-editor-core | `bus.$emit('switch-tab', target)` | 监听 → 切换到指定页签 |
| 001-editor-core | `bus.$emit('update-response-body', body, headers)` | 监听 → 更新响应展示 |
| 001-editor-core | `bus.$emit('update-response-blob', contentType, blob, headers)` | 监听 → 处理二进制响应 |
| 001-editor-core | `bus.$emit('update-response-body-definition', def)` | 监听 → 更新响应结构 |
| 001-editor-core | `bus.$emit('update-request-body', body)` | 监听 → 更新 Body 编辑器 |
| 001-editor-core | `bus.$emit('update-request-body-definition', def)` | 监听 → 更新 Body 结构化定义 |
| 003-resources-api | `bus.$emit('api-group-selected', group)` | 监听 → 切换到分组 Tab |
| 003-resources-api | `bus.$emit('update-group')` | 监听 → 刷新分组树（MagicGroup 保存后发射） |
| 014-infra-transport | `request.send('/options')` | 加载可选项列表 |
| 014-infra-transport | `requestGroup('group/update', saveObj)` | 保存分组 |
| WebSocket | `ws_log` 事件 | 追加运行日志 |

### 5.3 发射的事件

| 事件 | 参数 | 触发组件 | 消费者 |
|---|---|---|---|
| `update-window-size` | — | MagicOptions | 所有编辑器/列表组件 |
| `status` | 状态文案 | MagicGroup | 状态条 |
| `update-group` | — | MagicGroup | 003-resources-api |
| `report` | `'group_update'` | MagicGroup | cnzz 埋点 |
| `doContinue` | — | MagicDebug | 001-editor-core |
| `doStepInto` | — | MagicDebug | 001-editor-core |

---

## 6. 实现策略

### 6.1 架构模式

**容器-动态组件模式**：

```
MagicOptions（容器）
├── tabs[]（动态 Tab 配置数组）
├── info（共享数据对象，v-model 传递给子组件）
└── <component :is="item.component" v-model:info="info"/>（动态渲染）
    ├── MagicRequest（请求参数面板）
    ├── MagicOption（接口选项面板）
    ├── MagicRun（运行结果面板）
    ├── MagicDebug（调试信息面板）
    ├── MagicFunction（函数参数面板）
    ├── MagicGroup（分组属性面板）
    ├── MagicLog（运行日志面板）
    ├── MagicEvent（事件面板）
    ├── MagicSettings（全局参数面板）→ 010 模块
    └── MagicTodo（待办事项面板）→ 010 模块
```

### 6.2 关键算法

#### 6.2.1 Tab 切换逻辑

```
收到 opened(info) 事件:
  1. 判断 info._type
  2. _type === 'api' → tabs = apiTabs
  3. _type === 'function' → tabs = functionTabs
  4. 拼接 commonTabs
  5. 默认选中 tabs[0].id
  6. $nextTick → 广播 update-request-body / update-response-body 等事件

收到 api-group-selected(group) 事件:
  1. info = group
  2. tabs = apiGroupTabs + commonTabs
  3. 默认选中 tabs[0].id

收到 switch-tab(target) 事件:
  1. 检查 target 是否在当前 tabs 中
  2. 不在 → 尝试从 apiTabs/functionTabs/apiGroupTabs 中找到并替换 tabs
  3. 拼接 commonTabs
  4. selectedTab = target
  5. 发射 update-window-size
```

#### 6.2.2 Body 编辑器初始化

```
切换到 Body 页签 (showIndex === 3):
  1. 检查 bodyEditor 是否为 null
  2. 为 null → monaco.editor.create($refs.bodyEditor, config)
  3. 配置: language='json', minimap=false, folding=true, wordWrap='on'
  4. 主题: store.get('skin') || 'default'
  5. 字体: contants.EDITOR_FONT_FAMILY / EDITOR_FONT_SIZE
  6. 注册 onDidChangeModelContent → 同步 info.requestBody + 触发 updateRequestBody
  7. 注册 onDidPaste → 尝试 JSON 格式化
  8. 注册 bus.$on('update-window-size') → layout()
```

#### 6.2.3 分组保存流程

```
点击保存按钮:
  1. 检查 info.paths 是否存在
  2. 构造 saveObj = {...info}
  3. 过滤: saveObj.paths = paths.filter(it => it.name)
  4. 过滤: saveObj.options = options.filter(it => it.name)
  5. 发射 status: "准备保存分组「{name}」"
  6. requestGroup('group/update', saveObj)
  7. 成功 → 发射 update-group / report('group_update') / status("保存成功")
```

### 6.3 错误处理

| 场景 | 处理方式 | 源码位置 |
|---|---|---|
| 未添加接口就增删参数行 | `$magicAlert('请先添加或选择接口')` | `magic-request.vue:291-294,310-313` |
| 未添加函数就增删参数行 | `$magicAlert('请先添加或选择函数')` | `magic-function.vue:85-88,100-103` |
| 未添加分组就增删行 | `$magicAlert('请先添加或选择分组')` | `magic-group.vue:175-178,191-194` |
| 未添加分组就保存 | `$magicAlert('请先添加或选择分组')` | `magic-group.vue:158-161` |
| Body JSON 解析失败 | 静默忽略（`catch (ignored) {}`） | `magic-request.vue:368` |
| HTTP 请求失败 | `HttpResponse.exceptionHandle` → `$magicAlert` | `request.js:62-66` |
| 401 未授权 | `bus.$emit('showLogin')` → 弹出登录覆盖层 | `request.js:151-153` |

### 6.4 性能优化

| 优化点 | 策略 | 源码位置 |
|---|---|---|
| Monaco 实例创建 | 懒加载（首次切换到 Body 页签时创建） | `magic-request.vue:342-343` |
| Monaco 小地图 | 禁用（`minimap.enabled: false`） | `magic-request.vue:346-348` |
| Body 解析 | `parseJson()` 增量解析，非全量重绘 | `magic-request.vue:379-383` |
| 事件面板刷新 | `$nextTick` 延迟更新，避免频繁 DOM 操作 | `magic-event.vue:39-41` |
| 日志面板滚动 | `$nextTick` 后设置 `scrollTop` | `magic-log.vue:53` |
| 面板高度拖拽 | 仅在 `clientY > 150` 时更新，避免过小高度 | `magic-options.vue:115` |

---

## 7. 测试考虑

### 7.1 可测试性分析

当前工程无测试目录，以下列出建议的测试类别：

| 类别 | 测试场景 | 优先级 |
|---|---|---|
| 单元 | MagicOptions 的 Tab 切换逻辑（API/Function/Group 三种类型） | 高 |
| 单元 | MagicRequest 的 addRow/removeRow 边界条件 | 高 |
| 单元 | MagicRequest 的 valueCopy 元数据保留算法 | 高 |
| 单元 | MagicRun 的 content-disposition 解析与下载触发 | 中 |
| 单元 | MagicLog 的日志 HTML 转义（XSS 防护） | 高 |
| 集成 | opened 事件 → Tab 切换 → 子组件渲染的完整流程 | 高 |
| 集成 | MagicGroup 保存 → update-group 事件 → 资源树刷新 | 中 |
| E2E | Ctrl+Q 测试 → 日志展示 → 结果展示的完整流程 | 中 |

### 7.2 边界条件

| 场景 | 预期行为 | 源码位置 |
|---|---|---|
| 删除最后一行参数 | 自动添加一行空行 | `magic-request.vue:317-319` |
| Body 编辑器粘贴非法 JSON | 静默忽略，不崩溃 | `magic-request.vue:365-369` |
| 响应为 `{}` 或 `[]` | responseBody 设为空数组 | `magic-run.vue:139-141` |
| 无调试变量时 | 显示 "no message." | `magic-debug.vue:19-21` |
| 日志超过 3 行 | 默认折叠，提供展开切换 | `magic-log.vue:46-51` |
| 面板高度拖拽到 < 150px | 停止更新高度 | `magic-options.vue:115` |

---

## 8. 文件清单

| 文件 | 目的 | 行数 |
|---|---|---|
| `src/components/layout/magic-options.vue` | 底部面板容器 + Tab 路由 + 分隔条拖拽 | 303 |
| `src/components/layout/magic-request.vue` | 请求参数面板（5 类子页签 + Monaco Body 编辑器） | 429 |
| `src/components/layout/magic-run.vue` | 运行结果面板（Body/响应Header/响应结构） | 223 |
| `src/components/layout/magic-function.vue` | 函数参数面板（参数名/类型/描述） | 172 |
| `src/components/layout/magic-event.vue` | 事件日志面板（状态日志时间线） | 89 |
| `src/components/layout/magic-group.vue` | 分组属性面板（路径变量 + 分组选项 + 保存） | 217 |
| `src/components/layout/magic-option.vue` | 接口选项面板（选项表格） | 116 |
| `src/components/layout/magic-log.vue` | 运行日志面板（日志流渲染 + 语法高亮） | 99 |
| `src/components/layout/magic-debug.vue` | 调试信息面板（变量表格 + 继续/单步按钮） | 134 |
| `src/components/common/magic-bottom-panel.vue` | 底部面板通用容器（标题栏 + 最小化） | 63 |
| `src/scripts/bus.js` | EventBus + statusLog + cnzz 统计 | 57 |
| `src/scripts/contants.js` | 全局常量（Header 名/业务码/字体等） | 36 |
| `src/scripts/utils.js` | 工具函数（`requestGroup`, `formatJson`, `deepClone`, `download`, `isVisible`） | 182 |
| `src/scripts/parsing/parser.js` | `parseJson()` JSON 解析 + 结构化定义 | 954 |
| `src/api/request.js` | HTTP 请求封装（axios + HttpResponse） | 194 |
| `src/scripts/store.js` | localStorage 封装 | 21 |

**总计**：15 个文件，约 3,090 行。
