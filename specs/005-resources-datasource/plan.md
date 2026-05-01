# 005-resources-datasource 技术计划（As-Built）

> 本文件以"已建成系统"视角记录 005-resources-datasource 模块的实际架构、设计决策与实现策略。
> 模块：005-resources-datasource
> 对应规范：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. 技术上下文

### 1.1 运行环境

| 维度 | 值 |
|---|---|
| 运行时 | 浏览器（现代浏览器，ES Module 支持） |
| 框架 | Vue 3.4（Options API 风格编写本模块） |
| 构建工具 | Vite 5.4.21 |
| 模块系统 | ES Module（`import`/`export`） |
| 部署形态 | 应用模式（`dist-app/`，jar 内嵌）+ 库模式（`dist/`，NPM 包） |
| 父容器 | `<magic-editor>` 侧栏资源面板（`toolbarIndex === 2` 时显示） |

### 1.2 依赖清单

| 依赖 | 版本 | 用途 | 类型 |
|---|---|---|---|
| `vue` | ^3.4.0 | 前端框架 | 直接依赖 |
| `monaco-editor` | ^0.29.1 | "其它配置"字段的 JSON 编辑器 | 直接依赖 |

**间接依赖**（通过 import 链）：

| 依赖 | 来源 | 用途 |
|---|---|---|
| `@/scripts/bus.js` | `magic-datasource-list.vue:84` | EventBus 状态发射/订阅 |
| `@/api/request.js` | `magic-datasource-list.vue:85` | HTTP 请求封装（`request.send().success()` 链式调用） |
| `@/scripts/contants.js` | `magic-datasource-list.vue:86` | 全局常量（JDBC_DRIVERS、DATASOURCE_TYPES、EDITOR_FONT_FAMILY、EDITOR_FONT_SIZE） |
| `@/scripts/utils.js` | `magic-datasource-list.vue:89` | 工具函数（`formatJson`、`isVisible`） |
| `@/scripts/editor/java-class.js` | `magic-datasource-list.vue:90` | JavaClass 单例（注册 SQLModule 扩展属性） |
| `@/scripts/store.js` | `magic-datasource-list.vue:92` | localStorage 封装（读取当前主题 `skin`） |
| `@/components/common/modal/magic-dialog.vue` | `magic-datasource-list.vue:87` | 新建/编辑对话框组件 |
| `@/components/common/magic-input.vue` | `magic-datasource-list.vue:88` | 表单输入组件 |
| `@/components/common/magic-select.vue` | `magic-datasource-list.vue:93` | 可输入下拉选择组件 |
| `@/components/resources/magic-resource.css` | `magic-datasource-list.vue:359` | 资源栏共享样式 |

### 1.3 文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/components/resources/magic-datasource-list.vue` | 419 | 模块完整实现：template（1-81）、script（83-355）、style（358-419） |

---

## 2. Constitution 合规性检查

| 条款 | 状态 | 说明 |
|---|---|---|
| **第一条 单一主组件 + 注入式配置** | ✅ 合规 | 本模块为 `<magic-editor>` 的子组件，不暴露独立根组件；JDBC_DRIVERS / DATASOURCE_TYPES 等选项由 `magic-editor.vue:beforeMount` 通过 config 注入到 contants，本模块仅读取 |
| **第二条 前后端契约即真相** | ✅ 合规 | 所有数据源数据通过 `request.send()` 从后端拉取/保存/删除；前端不持久化业务数据，仅持有组件级 `data()` 会话状态 |
| **第三条 通信双通道：HTTP 命令 + WebSocket 事件** | ✅ 合规 | 数据源 CRUD 全部通过 HTTP（`datasource/list|detail|save|test|delete`），未使用 WebSocket |
| **第四条 事件总线即全局状态** | ✅ 合规 | 跨组件通信全部走 `bus.js`：发射 `status` 事件更新状态条（10+ 处）；订阅 `logout` / `refresh-resource` 事件；未引入 Vuex/Pinia/Provide-Inject |
| **第五条 monaco 一切围绕"magic-script"** | ✅ 合规 | 本模块使用 monaco 仅作为 JSON 编辑器（"其它配置"字段），不涉及 magic-script 语言服务；monaco 实例通过 `monaco.editor.create()` 独立创建 |
| **第六条 类型契约由 Header 而非 URL 表达** | ✅ 合规 | `datasource/save` 和 `datasource/test` 通过 `Content-Type: application/json` Header 表达请求体类型（`magic-datasource-list.vue:233-234, 265-266`），URL 仅承载资源标识 |
| **第七条 国际化只信"语言包索引化"机制** | ✅ 合规 | 本模块所有文本为硬编码中文，未调用 monaco 运行时 locale API |
| **第八条 双构建产物共存** | ✅ 合规 | 本模块为 Vue SFC，两种构建模式均正常打包；CSS 通过 `@import './magic-resource.css'` 引用共享样式 |
| **第九条 错误反馈一律走模态框 + Bus** | ✅ 合规 | 所有错误均通过 `$magicAlert` / `$magicConfirm` 弹出（`vue:192, 239, 245, 254, 258, 333, 342`）；状态变更通过 `bus.$emit('status', ...)` 发射 |
| **第十条 源代码即文档真相** | ✅ 合规 | 本文档所有论断均可溯源至 `magic-datasource-list.vue` 具体行号 |

---

## 3. 研究发现

### 3.1 组件架构：单文件 Vue SFC（Options API）

**决策**：整个模块收敛在单一 `.vue` 文件中，采用 Options API 风格（`data()` / `methods` / `mounted()`）。

**实现**（`magic-datasource-list.vue:95-355`）：
```js
export default {
  name: 'MagicDatasourceList',
  components: { MagicSelect, MagicDialog, MagicInput },
  data() { ... },
  methods: { ... },
  mounted() { ... }
}
```

**理由**：
- 与项目中其它资源列表组件（`magic-api-list.vue`、`magic-function-list.vue`）保持一致的编写风格
- 模块功能边界清晰（仅数据源管理），无需拆分为多个子组件
- Options API 在 Vue 3.4 中完全支持，且与主组件 `magic-editor.vue` 风格统一

### 3.2 数据源列表加载与 SQLModule 补全注册联动

**决策**：在 `initData()` 中，拉取数据源列表后**立即**将所有含 key 的数据源注册为 SQLModule 扩展属性。

**实现**（`magic-datasource-list.vue:168-188`）：
```js
initData() {
  // 1. 显示 loading
  this.showLoading = true
  this.datasources = []
  bus.$emit('status', '正在初始化数据源列表')
  
  // 2. 请求列表
  request.send('datasource/list').success(data => {
    this.datasources = data || []
    
    // 3. 注册 SQLModule 补全元数据
    JavaClass.setExtensionAttribute('org.ssssssss.magicapi.modules.SQLModule',
      this.datasources.filter(it => it.key).map(it => ({
        name: it.key,
        type: 'org.ssssssss.magicapi.modules.SQLModule',
        comment: it.name
      }))
    )
    
    // 4. 延迟 500ms 隐藏 loading
    setTimeout(() => { this.showLoading = false }, 500)
    bus.$emit('status', '数据源初始化完毕')
  })
}
```

**设计分析**：
- 列表加载与补全注册在同一回调中完成，保证两者数据一致性
- 过滤 `it.key` 确保仅注册有 key 的数据源（主数据源无 key，不注册）
- 每次 `initData()` 调用都会**覆盖**之前的扩展属性（`JavaClass.setExtensionAttribute` 为赋值语义），因此保存/删除后调用 `initData()` 能自动刷新补全元数据
- 500ms 延迟（`vue:182-184`）防止 loading 闪烁，提升视觉体验

### 3.3 表单数据合并策略（getDataSourceObj）

**决策**：将表单字段与"其它配置"中的 JSON 键值合并，JSON 中的键不覆盖已有表单字段。

**实现**（`magic-datasource-list.vue:204-227`）：
```js
getDataSourceObj() {
  // 1. 构建基础对象（8 个表单字段）
  let temp = { id, name, key, maxRows, type, driverClassName, username, password, url }
  
  // 2. 解析 monaco 编辑器中的 JSON
  let json = {}
  try { json = JSON.parse(this.editor.getValue()) } catch(e) {}
  
  // 3. 合并：仅当 temp 中不存在该 key 时才赋值
  for (let key in json) {
    if (!temp[key]) {
      temp[key] = json[key]
    }
  }
  return temp
}
```

**设计分析**：
- `try/catch` 静默吞掉 JSON 解析错误，无效 JSON 不影响保存/测试
- 合并策略为"表单字段优先"：如果 JSON 中包含 `name`、`key` 等已知字段，不会覆盖表单中的值
- 这意味着用户可以在"其它配置"中任意添加连接池参数（如 HikariCP 的 `maximumPoolSize`、`connectionTimeout` 等），后端按需消费

### 3.4 monaco JSON 编辑器生命周期管理

**决策**：monaco 编辑器实例在首次打开对话框时创建，后续复用；对话框关闭时不销毁。

**实现**（`magic-datasource-list.vue:290-328`）：
```js
toogleDialog(show, clear) {
  this.showDialog = show
  if (show) {
    // 初始化表单数据
    if (clear) this.initDataSourceObj()
    
    // 构建"其它配置"的初始值（排除已知字段后的剩余对象）
    let temp = { ...this.datasourceObj }
    delete temp.id; delete temp.name; ... // 删除 9 个已知字段
    
    if (!this.editor) {
      // 首次创建
      this.editor = monaco.editor.create(this.$refs.editor, {
        minimap: { enabled: false },
        language: 'json',
        fixedOverflowWidgets: true,
        folding: true,
        wordWrap: 'on',
        fontFamily: contants.EDITOR_FONT_FAMILY,
        fontSize: contants.EDITOR_FONT_SIZE,
        fontLigatures: true,
        renderWhitespace: 'none',
        theme: store.get('skin') || 'default',
        value: formatJson(temp) || '{\r\n\t\r\n}'
      })
    } else {
      // 复用：更新内容
      this.editor.setValue(formatJson(temp))
    }
    this.layout()
  }
}
```

**设计分析**：
- 编辑器实例生命周期与组件实例绑定（`this.editor`），非对话框生命周期
- 首次创建时配置了完整的 monaco 选项（字体、主题、代码折叠、自动换行等）
- 主题从 `store.get('skin')` 读取，支持默认/暗色主题切换
- `formatJson()` 来自 `utils.js`，用于格式化 JSON 输出
- 初始值为排除已知字段后的剩余对象，确保"其它配置"仅展示扩展参数
- **内存泄漏风险**：组件销毁时未调用 `this.editor.dispose()`，monaco 实例可能残留

### 3.5 搜索过滤实现（doSearch）

**决策**：在数据源列表项上添加 `_searchShow` 标记，通过 `v-if` 控制显示/隐藏。

**实现**（`magic-datasource-list.vue:147-153`）：
```js
doSearch(keyword) {
  keyword = keyword.toLowerCase()
  this.datasources.forEach(it => {
    it._searchShow = keyword
      ? (it.name && it.name.toLowerCase().indexOf(keyword) > -1)
        || (it.key && it.key.toLowerCase().indexOf(keyword) > -1)
      : true
  })
  this.$forceUpdate()
}
```

**模板侧**（`magic-datasource-list.vue:20`）：
```html
<li v-if="item._searchShow === true || item._searchShow === undefined">
```

**设计分析**：
- 不区分大小写搜索（keyword 和值均转小写后比较）
- 同时匹配 `name` 和 `key` 两个字段
- 使用 `$forceUpdate()` 强制重新渲染（因为 `_searchShow` 是动态添加到对象上的属性，Vue 3 的响应式系统可能无法自动追踪）
- `v-if` 条件包含 `_searchShow === undefined` 兼容初始状态（未搜索时所有项显示）

### 3.6 右键菜单与主数据源保护

**决策**：仅对有 `id` 的数据源显示右键删除菜单；点击无 `id` 项弹出不可修改提示。

**实现**：
- 右键菜单（`magic-datasource-list.vue:154-165`）：`if(item.id)` 才调用 `$magicContextmenu`
- 点击详情（`magic-datasource-list.vue:190-202`）：`if(!item.id)` 弹出 `$magicAlert`

**设计分析**：
- 主数据源（无 `id`）由后端配置文件管理，前端不允许修改
- 两处保护逻辑独立：点击保护 + 右键菜单保护，形成双重防护

### 3.7 请求编码差异

**决策**：不同端点使用不同的请求体编码方式。

| 端点 | 编码方式 | 原因 |
|---|---|---|
| `datasource/list` | 默认（无 body） | 仅拉取列表，无参数 |
| `datasource/detail` | 默认 form-urlencoded | 简单参数 `{id}` |
| `datasource/delete` | 默认 form-urlencoded | 简单参数 `{id}` |
| `datasource/save` | JSON（`Content-Type: application/json` + `transformRequest: []`） | 复杂对象，含动态扩展字段 |
| `datasource/test` | JSON（同上） | 与 save 相同的对象结构 |

**实现**（`magic-datasource-list.vue:231-236, 263-268`）：
```js
request.send('datasource/save', JSON.stringify(this.getDataSourceObj()), {
  method: 'post',
  headers: { 'Content-Type': 'application/json' },
  transformRequest: []  // 跳过默认的 Qs.stringify
})
```

**设计分析**：
- `transformRequest: []` 覆盖 axios 实例默认的 `transformRequest`（`request.js:26-37` 中的 `Qs.stringify`），确保 JSON 字符串原样发送
- 手动 `JSON.stringify` 而非让 axios 自动序列化，确保控制序列化格式

---

## 4. 数据模型

### 4.1 数据源列表项（datasource）

```js
{
  id: string | undefined,    // 有 id = 可修改；无 id = 主数据源
  name: string | undefined,  // 展示名称；无名称时显示"主数据源"
  key: string | undefined,   // 脚本中 db.<key> 的 key；无 key 时显示"default"
  _searchShow: boolean       // 搜索过滤标记（运行时动态添加）
}
```

### 4.2 数据源表单对象（datasourceObj）

```js
{
  id: string,              // 空字符串 = 新建；非空 = 编辑
  name: string,            // 数据源名称
  key: string,             // 数据源 key（脚本中 db.<key>）
  url: string,             // JDBC URL
  username: string,        // 数据库用户名
  password: string,        // 数据库密码（password 类型输入框）
  driverClassName: string, // JDBC 驱动类（可空，内部自动识别）
  maxRows: string,         // 最大返回行数，默认 "-1"
  type: string             // 数据源类型（连接池实现）
}
```

### 4.3 驱动类选项（drivers）

```js
// 预置 6 种 + contants.JDBC_DRIVERS 扩展
[
  'com.mysql.jdbc.Driver',
  'com.mysql.cj.jdbc.Driver',
  'oracle.jdbc.driver.OracleDriver',
  'org.postgresql.Driver',
  'com.microsoft.sqlserver.jdbc.SQLServerDriver',
  'com.ibm.db2.jcc.DB2Driver',
  ...contants.JDBC_DRIVERS   // 由后端 /config.json 注入
].map(it => ({ text: it, value: it }))
```

### 4.4 数据源类型选项（datasourceTypes）

```js
// 预置 4 种 + contants.DATASOURCE_TYPES 扩展
[
  'com.zaxxer.hikari.HikariDataSource',
  'com.alibaba.druid.pool.DruidDataSource',
  'org.apache.tomcat.jdbc.pool.DataSource',
  'org.apache.commons.dbcp2.BasicDataSource',
  ...contants.DATASOURCE_TYPES  // 由后端 /config.json 注入
].map(it => ({ text: it, value: it }))
```

### 4.5 组件 data 状态

```js
{
  bus: bus,                    // EventBus 引用
  datasources: [],             // 数据源列表
  showDialog: false,           // 对话框显隐
  datasourceObj: { ... },      // 表单对象（见 §4.2）
  drivers: [ ... ],            // 驱动类选项（见 §4.3）
  datasourceTypes: [ ... ],    // 数据源类型选项（见 §4.4）
  editor: null,                // monaco 编辑器实例引用
  showLoading: true            // loading 状态
}
```

### 4.6 状态流转

```
组件挂载
  ↓
mounted() → 订阅 logout / refresh-resource 事件
  ↓
外部调用 initData()（由 magic-editor.vue:98 触发）
  ↓
  ├─ showLoading = true
  ├─ POST datasource/list
  ├─ datasources = data || []
  ├─ JavaClass.setExtensionAttribute(...)  ← 注册补全元数据
  ├─ setTimeout(500ms) → showLoading = false
  └─ bus.$emit('status', '数据源初始化完毕')

用户操作分支：
  ├─ 搜索 → doSearch(keyword) → 标记 _searchShow → $forceUpdate()
  ├─ 新建 → toogleDialog(true, true) → initDataSourceObj() → 创建/复用 monaco
  ├─ 编辑 → showDetail(item) → POST datasource/detail → toogleDialog(true)
  ├─ 测试 → doTest() → POST datasource/test(JSON) → 弹框反馈
  ├─ 保存 → doSave() → 校验 → POST datasource/save(JSON) → initData() 刷新
  ├─ 删除 → deleteDataSource(item) → $magicConfirm → POST datasource/delete → initData()
  ├─ 刷新 → initData()
  ├─ logout 事件 → datasources = []
  └─ refresh-resource 事件 → initData()
```

---

## 5. 接口契约

### 5.1 导出接口

| 导出 | 类型 | 说明 |
|---|---|---|
| `export default { name: 'MagicDatasourceList', ... }` | Vue 组件定义 | 供 `magic-editor.vue` 导入注册 |

### 5.2 组件方法（被父组件调用）

| 方法 | 签名 | 返回值 | 说明 |
|---|---|---|---|
| `initData` | `() => Promise<void>` | Promise | 拉取数据源列表并注册 SQLModule 补全元数据 |
| `layout` | `() => void` | void | 触发 monaco 编辑器重新布局（父组件在窗口 resize 时调用） |

### 5.3 消费的 HTTP 端点

| 方法 | 路径 | 编码 | 请求体 | 响应 | 源码 |
|---|---|---|---|---|---|
| POST | `datasource/list` | 默认（无 body） | 无 | `Array<datasource>` | `vue:173` |
| POST | `datasource/detail` | form-urlencoded | `{ id }` | `datasourceObj` | `vue:197` |
| POST | `datasource/save` | JSON | `JSON.stringify(datasourceObj + 扩展)` | `dsId`（string） | `vue:263` |
| POST | `datasource/test` | JSON | 同 save | 成功为空/`null`，失败为错误信息字符串 | `vue:231` |
| POST | `datasource/delete` | form-urlencoded | `{ id }` | `boolean` | `vue:337` |

### 5.4 消费的 EventBus 事件

| 事件 | 方向 | 载荷 | 说明 |
|---|---|---|---|
| `logout` | 消费 | 无 | 登出时清空数据源列表（`vue:350`） |
| `refresh-resource` | 消费 | 无 | 刷新数据源列表（`vue:351-353`） |
| `status` | 生产 | `string`（状态文本） | 数据源加载/保存/测试/删除各阶段发射（10+ 处） |

### 5.5 消费的 JavaClass 接口

| 方法 | 签名 | 说明 |
|---|---|---|
| `setExtensionAttribute` | `(className: string, attributes: Array<{name, type, comment}>) => void` | 将数据源 key 注册为 SQLModule 扩展属性（`vue:175-181`） |

### 5.6 消费的 contants 常量

| 常量 | 值来源 | 用途 |
|---|---|---|
| `JDBC_DRIVERS` | `/config.json` → `config.jdbcDrivers` | 驱动类下拉选项扩展 |
| `DATASOURCE_TYPES` | `/config.json` → `config.datasourceTypes` | 数据源类型下拉选项扩展 |
| `EDITOR_FONT_FAMILY` | `magic-editor.vue:124-126` | monaco JSON 编辑器字体 |
| `EDITOR_FONT_SIZE` | `magic-editor.vue:127-129` | monaco JSON 编辑器字号 |

---

## 6. 实现策略

### 6.1 架构模式

本模块采用**单一职责组件模式**：

- 一个 `.vue` 文件包含完整的 UI 展示、表单编辑、HTTP 通信、事件总线集成
- 通过 `JavaClass` 单例间接向脚本编辑器注入补全元数据（非直接调用编辑器组件）
- 通过 `bus.js` 与全局状态条通信，实现操作反馈的解耦

### 6.2 关键算法

#### 6.2.1 表单字段与 JSON 扩展配置合并

见 §3.3 getDataSourceObj 实现。

#### 6.2.2 搜索过滤

见 §3.5 doSearch 实现。

#### 6.2.3 补全元数据注册

```
datasource/list 响应
  ↓
filter(it => it.key)          // 过滤无 key 的项（主数据源）
  ↓
map(it => ({                  // 转换为扩展属性格式
  name: it.key,               // 补全项名称 = db.<key> 中的 key
  type: 'org.ssssssss.magicapi.modules.SQLModule',
  comment: it.name            // 补全注释 = 数据源名称
}))
  ↓
JavaClass.setExtensionAttribute('org.ssssssss.magicapi.modules.SQLModule', attributes)
```

### 6.3 错误处理

| 场景 | 处理方式 | 代码位置 |
|---|---|---|
| 数据源名称为空 | `$magicAlert('数据源名称不能为空')` | `vue:254-256` |
| 数据源 key 为空 | `$magicAlert('数据源key不能为空')` | `vue:257-260` |
| 主数据源点击编辑 | `$magicAlert('该数据源不能被修改')` | `vue:192-194` |
| 测试连接失败 | `$magicAlert({ title: '测试连接失败', content: msg })` | `vue:245-248` |
| 删除失败 | `$magicAlert({ content: '删除失败' })` | `vue:342` |
| JSON 解析失败（其它配置） | 静默忽略，使用空对象 `{}` | `vue:218-221` |

**状态条反馈**：每个操作阶段均通过 `bus.$emit('status', ...)` 发射状态文本，供底部状态栏展示。

### 6.4 性能考量

- **列表渲染**：使用 `v-for` + `v-if` 组合，搜索过滤时通过 `$forceUpdate()` 强制重新渲染；数据源数量通常较少（< 50），性能影响可忽略
- **monaco 编辑器**：仅在对话框打开时创建/复用，`minimap: { enabled: false }` 减少内存占用
- **loading 延迟**：500ms 延迟隐藏 loading，避免快速加载时的视觉闪烁
- **$forceUpdate 使用**：因 `_searchShow` 是动态添加的属性，Vue 3 响应式系统无法自动追踪，必须使用 `$forceUpdate()`；若数据源列表较大（> 100），每次搜索会触发全量重新渲染

---

## 7. 测试考虑

### 7.1 可测试性分析

**当前状态**：项目无测试目录，无测试框架配置。

**可测试单元**：

| 单元 | 测试类型 | 测试要点 |
|---|---|---|
| `doSearch()` | 单元测试 | 空关键字显示全部、匹配 name、匹配 key、不区分大小写 |
| `getDataSourceObj()` | 单元测试 | 表单字段正确提取、JSON 扩展字段合并、JSON 解析失败时静默忽略、JSON 中已知字段不覆盖表单值 |
| `initDataSourceObj()` | 单元测试 | 表单重置为默认值（id/name/key 为空字符串，maxRows 为 "-1"） |
| `initData()` | 集成测试 | HTTP 请求发出、列表数据赋值、JavaClass.setExtensionAttribute 调用、loading 延迟隐藏 |
| `doSave()` | 集成测试 | 名称为空拦截、key 为空拦截、正常保存流程、保存后刷新列表 |
| `doTest()` | 集成测试 | 连接成功弹框、连接失败弹框含错误信息 |
| `deleteDataSource()` | 集成测试 | 确认框弹出、删除成功刷新、删除失败弹框 |

### 7.2 边界情况

| 场景 | 预期行为 | 风险 |
|---|---|---|
| 后端返回空列表 | 显示"无数据"提示 | 低 |
| 后端返回 null 而非空数组 | `data || []` 兜底为空数组 | 低 |
| "其它配置"中输入非法 JSON | 保存/测试时静默忽略，不影响已知字段 | 中（用户可能不知道扩展配置未生效） |
| monaco 编辑器在对话框未渲染时调用 layout | `isVisible(this.$refs.editor)` 检查保护 | 低 |
| 组件销毁时 monaco 实例未 dispose | 内存泄漏（编辑器实例残留） | 中（组件频繁切换时累积） |
| 数据源 key 包含特殊字符 | 补全元数据中 name 为原始 key，monaco 补全可能异常 | 低（key 通常为合法标识符） |
| 快速连续点击保存 | 可能发出多次 save 请求（无防抖/节流） | 中 |

---

## 8. 文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/components/resources/magic-datasource-list.vue` | 419 | 模块完整实现 |
| ↳ template（1-81） | 81 | 列表展示、搜索框、工具栏、loading/空状态、新建/编辑对话框（8 个表单字段 + monaco JSON 编辑器） |
| ↳ script（83-355） | 273 | 导入声明、组件注册、data 定义、9 个方法（layout/doSearch/datasourceContextMenu/initData/showDetail/getDataSourceObj/doTest/doSave/initDataSourceObj/toogleDialog/deleteDataSource）、mounted 生命周期 |
| ↳ style（358-419） | 62 | 列表 hover 效果、表单布局（flex）、loading 动画（旋转 icon）、空状态定位 |

---

## 9. 与 spec.md 功能需求映射

| spec.md FR ID | plan.md 章节 | 实现位置 |
|---|---|---|
| FR-005-001 | §4.1, §3.1 | `vue:22-23` |
| FR-005-002 | §3.2 | `vue:27-32, 169-184` |
| FR-005-003 | §3.1 | `vue:33` |
| FR-005-004 | §3.5 | `vue:6-7, 147-153` |
| FR-005-005 | §3.6 | `vue:190-202` |
| FR-005-006 | §3.6 | `vue:154-165` |
| FR-005-007 | §3.2 | `vue:13-15, 168-188` |
| FR-005-010 | §3.1 | `vue:10-12, 35` |
| FR-005-011 | §4.2, §3.1 | `vue:37-72` |
| FR-005-012 | §4.3 | `vue:118-126` |
| FR-005-013 | §4.4 | `vue:127-133` |
| FR-005-014 | §3.4 | `vue:71, 307-326` |
| FR-005-015 | §6.3 | `vue:253-260` |
| FR-005-016 | §3.3 | `vue:204-227` |
| FR-005-017 | §3.2 | `vue:269-275` |
| FR-005-020 | §3.1 | `vue:76` |
| FR-005-021 | §3.3 | `vue:229-250` |
| FR-005-022 | §6.3 | `vue:239-241` |
| FR-005-023 | §6.3 | `vue:244-248` |
| FR-005-030 | §3.6 | `vue:157-159` |
| FR-005-031 | §6.3 | `vue:333-335` |
| FR-005-032 | §3.2 | `vue:337-340` |
| FR-005-033 | §6.3 | `vue:342` |
| FR-005-040 | §3.2, §6.2.3 | `vue:175-181` |
| FR-005-041 | §6.2.3 | `vue:176-180` |
| FR-005-050 | §3.2, §6.3 | 多处 `bus.$emit('status', ...)` |
| FR-005-051 | §3.1 | `vue:350` |
| FR-005-052 | §3.1 | `vue:351-353` |
