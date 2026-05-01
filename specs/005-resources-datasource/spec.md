# 数据源管理模块规范（Resources Datasource Specification）

> 模块编号：005-resources-datasource
> 状态：已实现（As-Built）
> 最后更新：2026-05-01
> 源码入口：`src/components/resources/magic-datasource-list.vue`（419 行）

---

## 1. 模块概述

### 1.1 目的

为用户提供 JDBC 数据源的**可视化管理**能力：在编辑器左侧资源栏中展示所有已配置的数据源列表，并支持新建、编辑、测试连接、删除操作。数据源配置完成后，其 `key` 将自动注册为脚本编辑器中 `db.*` 调用的自动补全候选项。

### 1.2 解决的问题

- 用户无法在 IDE 中直接管理后端 JDBC 数据源连接配置
- 缺少连接测试能力，配置错误只能在脚本运行时才发现
- 数据源的 `key` 与脚本编辑器中的 `db.<key>` 调用之间缺少自动关联（补全提示）
- 密码等敏感字段在 UI 中明文展示存在泄露风险

### 1.3 范围

**包含**：
- 数据源列表展示（名称 + key）与关键字搜索过滤
- 新建/编辑数据源（名称、key、JDBC URL、用户名、密码、驱动类、数据源类型、maxRows、扩展 JSON 配置）
- 测试连接（将当前表单配置发送至后端验证连通性）
- 删除数据源（右键菜单触发，需确认）
- 数据源 key 自动注册为脚本编辑器 SQLModule 补全元数据
- 刷新数据源列表
- 主数据源（无 id 项）的只读展示

**不包含**：
- 数据源连接池的实际创建与管理（由后端 magic-api 负责）
- 数据源连接的实际测试执行（由后端负责）
- 数据源加密存储（由后端负责）
- 数据源分组/分类管理
- 数据源导入/导出

---

## 2. 用户故事

| ID | 用户故事 | 源码证据 |
|---|---|---|
| US-001 | 作为脚本开发者，我希望查看所有已配置的数据源列表，以便了解可用的数据库连接 | `magic-datasource-list.vue:19-25` |
| US-002 | 作为脚本开发者，我希望通过关键字搜索数据源，以便在数据源较多时快速定位 | `magic-datasource-list.vue:6-7, 147-153` |
| US-003 | 作为脚本开发者，我希望新建一个 JDBC 数据源并指定 key，以便在脚本中通过 `db.<key>` 调用 | `magic-datasource-list.vue:35-78, 252-276` |
| US-004 | 作为脚本开发者，我希望修改已有数据源的配置，以便调整连接参数 | `magic-datasource-list.vue:190-202, 252-276` |
| US-005 | 作为脚本开发者，我希望在保存前测试数据源连接是否成功，以便避免配置错误 | `magic-datasource-list.vue:76, 229-250` |
| US-006 | 作为脚本开发者，我希望删除不再使用的数据源，以便保持列表整洁 | `magic-datasource-list.vue:154-165, 331-346` |
| US-007 | 作为脚本开发者，我希望数据源的 key 自动出现在脚本编辑器的自动补全中，以便编写 `db.<key>` 时获得提示 | `magic-datasource-list.vue:175-181` |

---

## 3. 功能需求

### 3.1 数据源列表展示

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-005-001 | 系统 MUST 在左侧资源栏中以列表形式展示所有数据源，每项显示名称（无名称时显示"主数据源"）和 key（无 key 时显示"default"） | 功能 | `magic-datasource-list.vue:22-23` |
| FR-005-002 | 系统 MUST 在列表加载期间显示"加载中..."状态，加载完成后隐藏 | 功能 | `magic-datasource-list.vue:27-32` |
| FR-005-003 | 系统 MUST 在数据源列表为空时显示"无数据"提示 | 功能 | `magic-datasource-list.vue:33` |
| FR-005-004 | 系统 MUST 支持通过名称或 key 进行关键字搜索过滤，搜索不区分大小写 | 功能 | `magic-datasource-list.vue:6-7, 147-153` |
| FR-005-005 | 系统 MUST 在用户点击数据源列表项时，尝试加载该数据源详情（无 id 项弹出"该数据源不能被修改"提示） | 功能 | `magic-datasource-list.vue:20, 190-202` |
| FR-005-006 | 系统 MUST 在用户右键点击有 id 的数据源时，弹出包含"删除数据源"选项的上下文菜单 | 功能 | `magic-datasource-list.vue:154-165` |
| FR-005-007 | 系统 MUST 提供刷新按钮，点击后重新从后端拉取数据源列表 | 功能 | `magic-datasource-list.vue:13-15, 168-188` |

### 3.2 新建/编辑数据源

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-005-010 | 系统 MUST 提供新建数据源入口（工具栏"+"按钮），点击后弹出创建对话框 | 功能 | `magic-datasource-list.vue:10-12, 35` |
| FR-005-011 | 系统 MUST 在创建/编辑对话框中提供以下字段：名称、Key、URL（JDBC URL）、用户名、密码（password 类型输入）、驱动类（可输入下拉选择）、类型（可输入下拉选择）、maxRows、其它配置（JSON 编辑器） | 功能 | `magic-datasource-list.vue:37-72` |
| FR-005-012 | 系统 MUST 在驱动类下拉中预置常见 JDBC 驱动（MySQL、Oracle、PostgreSQL、SQL Server、DB2 等），并允许用户手动输入 | 功能 | `magic-datasource-list.vue:118-126` |
| FR-005-013 | 系统 MUST 在类型下拉中预置常见数据源类型（HikariCP、Druid、Tomcat JDBC、DBCP2 等），并允许用户手动输入 | 功能 | `magic-datasource-list.vue:127-133` |
| FR-005-014 | 系统 MUST 使用 monaco JSON 编辑器渲染"其它配置"字段，支持语法高亮、代码折叠、自动换行 | 功能 | `magic-datasource-list.vue:71, 307-326` |
| FR-005-015 | 系统 MUST 在保存前校验名称和 key 不为空，为空时弹出相应提示 | 功能 | `magic-datasource-list.vue:253-260` |
| FR-005-016 | 系统 MUST 将"其它配置"中的 JSON 键值合并到数据源对象中（不覆盖已有字段） | 功能 | `magic-datasource-list.vue:204-227` |
| FR-005-017 | 系统 MUST 在保存成功后刷新数据源列表并重置表单 | 功能 | `magic-datasource-list.vue:269-275` |

### 3.3 测试连接

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-005-020 | 系统 MUST 在创建/编辑对话框中提供"测试连接"按钮 | 功能 | `magic-datasource-list.vue:76` |
| FR-005-021 | 系统 MUST 将当前表单配置（含"其它配置"中的合并字段）以 JSON 格式发送至后端进行连接测试 | 功能 | `magic-datasource-list.vue:229-250` |
| FR-005-022 | 系统 MUST 在连接成功时弹出"连接成功"提示 | 功能 | `magic-datasource-list.vue:239-241` |
| FR-005-023 | 系统 MUST 在连接失败时弹出包含后端返回错误信息的提示框 | 功能 | `magic-datasource-list.vue:244-248` |

### 3.4 删除数据源

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-005-030 | 系统 MUST 在用户右键点击数据源时提供"删除数据源"菜单项 | 功能 | `magic-datasource-list.vue:157-159` |
| FR-005-031 | 系统 MUST 在执行删除前弹出确认框，显示数据源名称和 key | 功能 | `magic-datasource-list.vue:333-335` |
| FR-005-032 | 系统 MUST 在删除成功后刷新数据源列表 | 功能 | `magic-datasource-list.vue:337-340` |
| FR-005-033 | 系统 MUST 在删除失败时弹出"删除失败"提示 | 功能 | `magic-datasource-list.vue:342` |

### 3.5 脚本编辑器补全注册

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-005-040 | 系统 MUST 在数据源列表加载完成后，将所有含 key 的数据源注册为 `org.ssssssss.magicapi.modules.SQLModule` 类型的扩展属性 | 功能 | `magic-datasource-list.vue:175-181` |
| FR-005-041 | 系统 MUST 将每个数据源的 key 作为补全项名称、数据源名称作为注释，供脚本编辑器自动补全使用 | 功能 | `magic-datasource-list.vue:176-180` |

### 3.6 事件总线集成

| ID | 需求 | 类型 | 源码证据 |
|---|---|---|---|
| FR-005-050 | 系统 MUST 在数据源加载的各个阶段（初始化中、详情加载中、测试连接中、保存中、删除中）通过 bus 发射 `status` 事件以更新状态条 | 功能 | `magic-datasource-list.vue:171, 185, 196, 200, 230, 242, 244, 262, 270, 332, 339` |
| FR-005-051 | 系统 MUST 在收到 `logout` 事件时清空数据源列表 | 功能 | `magic-datasource-list.vue:350` |
| FR-005-052 | 系统 MUST 在收到 `refresh-resource` 事件时重新加载数据源列表 | 功能 | `magic-datasource-list.vue:351-353` |

---

## 4. 关键实体

| 实体 | 描述 | 关键属性 | 源码证据 |
|---|---|---|---|
| `datasourceObj` | 数据源表单对象（新建/编辑时使用） | `id`, `name`, `key`, `url`, `username`, `password`, `driverClassName`, `maxRows`, `type` | `magic-datasource-list.vue:107-117` |
| `datasource` | 数据源列表项 | `id`, `name`, `key`, `_searchShow`（搜索过滤标记） | `magic-datasource-list.vue:19-24, 150` |
| `drivers` | JDBC 驱动类选项列表 | 预置 6 种驱动 + `contants.JDBC_DRIVERS` 扩展 | `magic-datasource-list.vue:118-126` |
| `datasourceTypes` | 数据源类型选项列表 | 预置 4 种类型 + `contants.DATASOURCE_TYPES` 扩展 | `magic-datasource-list.vue:127-133` |

---

## 5. 接口契约

### 5.1 HTTP 端点

| 方法 | 路径 | 参数 | 响应 | 用途 | 源码证据 |
|---|---|---|---|---|---|
| POST | `datasource/list` | 无 | `Array<datasource>` | 获取数据源列表 | `magic-datasource-list.vue:173` |
| POST | `datasource/detail` | `{ id }` | `datasourceObj` | 获取数据源详情（用于编辑） | `magic-datasource-list.vue:197` |
| POST | `datasource/save` | JSON 字符串（`datasourceObj` + 扩展配置） | `dsId`（新/修改后的数据源 ID） | 保存数据源（新建或更新） | `magic-datasource-list.vue:263` |
| POST | `datasource/test` | JSON 字符串（同 save） | 成功时为空/`null`，失败时为错误信息字符串 | 测试数据源连接 | `magic-datasource-list.vue:231` |
| POST | `datasource/delete` | `{ id }` | `boolean`（是否删除成功） | 删除数据源 | `magic-datasource-list.vue:337` |

> 注：所有请求均通过 `src/api/request.js` 的 `send()` 方法发起，遵循 form-urlencoded 编码 + `magic-token` Header 约定（参见 `overall-api.md §2`）。`datasource/save` 和 `datasource/test` 使用 `Content-Type: application/json` 并设置 `transformRequest: []` 跳过默认序列化。

### 5.2 组件方法（被父组件调用）

| 方法 | 签名 | 用途 | 调用方 | 源码证据 |
|---|---|---|---|---|
| `initData` | `() => Promise<void>` | 从后端拉取数据源列表并注册 SQLModule 补全 | `magic-editor.vue:98` | `magic-datasource-list.vue:168-188` |

### 5.3 事件总线订阅

| 事件 | 用途 | 源码证据 |
|---|---|---|
| `logout` | 登出时清空数据源列表 | `magic-datasource-list.vue:350` |
| `refresh-resource` | 刷新数据源列表 | `magic-datasource-list.vue:351-353` |

### 5.4 事件总线发射

| 事件 | 载荷 | 时机 | 源码证据 |
|---|---|---|---|
| `status` | 状态文本字符串 | 数据源加载/保存/测试/删除各阶段 | 多处（见 FR-005-050） |

---

## 6. 非功能需求

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-005-001 | 安全性 | 系统 MUST 使用 `type="password"` 输入框渲染密码字段，避免明文展示 | `magic-datasource-list.vue:55` |
| NFR-005-002 | 安全性 | 系统 MUST 将密码字段通过 HTTP 发送至后端，由后端负责加密存储；前端不执行加密 | `magic-datasource-list.vue:213`（密码明文传输） |
| NFR-005-003 | 可用性 | 系统 MUST 在数据源列表加载期间显示 loading 状态，避免用户误操作 | `magic-datasource-list.vue:27-32` |
| NFR-005-004 | 可用性 | 系统 MUST 在删除操作前弹出确认框，防止误删 | `magic-datasource-list.vue:333-335` |
| NFR-005-005 | 性能 | 系统 MUST 在数据源列表加载完成后延迟 500ms 再隐藏 loading，避免闪烁 | `magic-datasource-list.vue:182-184` |
| NFR-005-006 | 可访问性 | 系统 MUST 为工具栏按钮提供 `title` 属性以展示 tooltip | `magic-datasource-list.vue:10, 13` |

---

## 7. 假设与约束

| ID | 描述 | 依据 |
|---|---|---|
| AS-001 | 后端 `datasource/list` 返回的列表中，无 `id` 的项表示"主数据源"（不可修改） | `magic-datasource-list.vue:191-194` |
| AS-002 | 后端 `datasource/test` 在连接成功时返回空值/`null`，失败时返回错误信息字符串 | `magic-datasource-list.vue:238-248` |
| AS-003 | 后端 `datasource/save` 返回新/修改后的数据源 ID | `magic-datasource-list.vue:269` |
| AS-004 | `contants.JDBC_DRIVERS` 和 `contants.DATASOURCE_TYPES` 由后端通过 `/config.json` 注入，前端初始化为空数组 | `contants.js:28-29`、`magic-editor.vue:121-122` |
| AS-005 | 数据源的 `key` 在脚本编辑器中对应 `db.<key>` 的调用方式，由后端 magic-api 的 SQLModule 实现 | `magic-datasource-list.vue:175-181` |
| AS-006 | "其它配置"中的 JSON 字段用于传递数据源类型的额外连接池参数（如 HikariCP 的 `maximumPoolSize` 等） | `magic-datasource-list.vue:204-227` |

---

## 8. 依赖与边界

### 8.1 上游依赖

| 模块 | 依赖内容 | 边界说明 |
|---|---|---|
| **003-resources-api**（`magic-api-list.vue`） | 同属资源栏组件，共享 `magic-resource.css` 样式；无直接数据依赖 | 两者为兄弟组件，通过 `magic-editor.vue` 的 `toolbarIndex` 切换显示，互不通信 |
| **014-infra-transport**（`api/request.js`） | 通过 `request.send()` 发起所有 HTTP 请求 | 本模块不直接操作 axios，仅使用 `request.send().success()` 链式调用 |
| **015-infra-bus-store**（`bus.js` / `contants.js`） | 通过 bus 发射/订阅状态事件；从 contants 读取 `JDBC_DRIVERS`、`DATASOURCE_TYPES`、`EDITOR_FONT_FAMILY`、`EDITOR_FONT_SIZE` | 本模块不修改 contants 常量，仅读取 |

### 8.2 下游依赖

| 模块 | 被依赖内容 | 边界说明 |
|---|---|---|
| **001-editor-core**（`magic-script-editor.vue`） | 本模块通过 `JavaClass.setExtensionAttribute()` 将数据源 key 注册为 SQLModule 补全元数据，供脚本编辑器自动补全使用 | 本模块**不直接调用**编辑器组件，仅通过 `JavaClass` 模块单例间接注入元数据；编辑器侧如何消费这些元数据由 012-script-language 模块负责 |
| **012-script-language**（`scripts/editor/completion.js`） | 消费 `JavaClass` 中注册的 SQLModule 扩展属性，在自动补全中展示 `db.<key>` 候选项 | 本模块不感知补全的具体渲染逻辑 |

### 8.3 与 013-script-mybatis 的边界

| 关注点 | 本模块职责 | 013-script-mybatis 职责 |
|---|---|---|
| 数据源配置 | 管理 JDBC 连接参数（URL、用户名、密码、驱动等） | 不涉及数据源配置 |
| 脚本编辑支持 | 仅提供数据源 key 的自动补全注册 | 提供 MyBatis 风格标签（`<select>`, `<if>`, `<foreach>` 等）的语法高亮与语言服务 |
| 运行时行为 | 不参与脚本执行 | 在编辑器中解析/高亮 MyBatis 标签 |

> 两者无直接依赖关系。数据源配置是**运行时基础设施**，MyBatis 支持是**编辑器语言服务**，分别属于不同的关注面。

### 8.4 全局依赖

| 模块 | 用途 | 源码证据 |
|---|---|---|
| `JavaClass`（`scripts/editor/java-class.js`） | 注册 SQLModule 扩展属性（数据源 key → 补全元数据） | `magic-datasource-list.vue:90, 175-181` |
| `monaco-editor` | 为"其它配置"字段提供 JSON 编辑器 | `magic-datasource-list.vue:91, 307-326` |
| `store.js` | 读取当前主题（`store.get('skin')`）以设置 monaco 编辑器主题 | `magic-datasource-list.vue:92, 320` |
| `utils.js` | 使用 `formatJson()` 格式化 JSON、`isVisible()` 判断 DOM 可见性 | `magic-datasource-list.vue:89, 142, 321` |

---

## 9. 待澄清事项

| ID | 问题 | 影响范围 |
|---|---|---|
| NC-001 | 密码字段在前端以明文传输至后端（`magic-datasource-list.vue:213`），是否应由前端进行加密（如 RSA/AES）后再传输？当前依赖后端 HTTPS 保障传输安全，但在非 HTTPS 环境下存在泄露风险 | 安全性 |
| NC-002 | `datasourceObj` 中的 `password` 字段在编辑模式下是否从后端返回？如果后端不返回密码，编辑时密码字段为空，用户是否需要重新输入？当前代码未做特殊处理 | 用户体验 / 安全性 |
| NC-003 | 主数据源（无 `id` 项）不可修改的设计意图是什么？是否意味着主数据源由后端配置文件（如 `application.yml`）管理，不允许通过 UI 修改？ | 架构理解 |

---

## 10. 接受场景

### 场景 1：查看数据源列表

- **Given** 用户已登录且后端存在至少一个数据源配置
- **When** 用户点击左侧资源栏的"数据源"标签
- **Then** 系统显示数据源列表，每项展示名称和 key；无数据时显示"无数据"

### 场景 2：新建数据源并测试连接

- **Given** 用户在数据源列表页面
- **When** 用户点击"新建数据源"按钮，填写名称、key、JDBC URL、用户名、密码，然后点击"测试连接"
- **Then** 系统将配置发送至后端，连接成功时弹出"连接成功"提示，失败时弹出错误信息

### 场景 3：保存数据源后自动注册补全

- **Given** 用户已填写完整的数据源配置（含有效的 key）
- **When** 用户点击"创建"按钮保存成功
- **Then** 系统刷新数据源列表，并将该 key 注册为脚本编辑器中 `db.<key>` 的自动补全候选项

### 场景 4：搜索数据源

- **Given** 数据源列表中存在多个数据源
- **When** 用户在搜索框中输入关键字
- **Then** 系统仅显示名称或 key 包含该关键字的数据源（不区分大小写）

### 场景 5：删除数据源

- **Given** 用户在数据源列表页面且存在至少一个可删除的数据源（有 id）
- **When** 用户右键点击该数据源并选择"删除数据源"，在确认框中确认
- **Then** 系统向后端发送删除请求，成功后刷新列表

### 场景 6：主数据源不可修改

- **Given** 数据源列表中存在主数据源（无 id 项）
- **When** 用户点击该数据源
- **Then** 系统弹出"该数据源不能被修改"提示，不打开编辑对话框

---

## 附录 A：源码引用清单

| 文件 | 行号 | 引用内容 |
|---|---|---|
| `src/components/resources/magic-datasource-list.vue` | 1-419 | 模块完整源码（template + script + style） |
| `src/components/resources/magic-datasource-list.vue` | 1-34 | 模板：列表展示、搜索、工具栏、loading/空状态 |
| `src/components/resources/magic-datasource-list.vue` | 35-79 | 模板：新建/编辑对话框（含 8 个表单字段 + monaco JSON 编辑器） |
| `src/components/resources/magic-datasource-list.vue` | 84-93 | 导入：bus、request、contants、组件、工具函数、JavaClass、monaco、store |
| `src/components/resources/magic-datasource-list.vue` | 102-137 | data：datasources 列表、datasourceObj 表单、drivers/datasourceTypes 选项、editor 引用、showLoading |
| `src/components/resources/magic-datasource-list.vue` | 147-153 | `doSearch()`：关键字搜索过滤 |
| `src/components/resources/magic-datasource-list.vue` | 154-165 | `datasourceContextMenu()`：右键菜单（仅对有 id 项显示删除） |
| `src/components/resources/magic-datasource-list.vue` | 168-188 | `initData()`：拉取列表 + 注册 SQLModule 补全 + loading 延迟 |
| `src/components/resources/magic-datasource-list.vue` | 173 | HTTP `datasource/list` 调用点 |
| `src/components/resources/magic-datasource-list.vue` | 175-181 | `JavaClass.setExtensionAttribute()` 注册 SQLModule 扩展属性 |
| `src/components/resources/magic-datasource-list.vue` | 190-202 | `showDetail()`：加载数据源详情并打开编辑对话框 |
| `src/components/resources/magic-datasource-list.vue` | 197 | HTTP `datasource/detail` 调用点 |
| `src/components/resources/magic-datasource-list.vue` | 204-227 | `getDataSourceObj()`：合并表单字段与 JSON 扩展配置 |
| `src/components/resources/magic-datasource-list.vue` | 229-250 | `doTest()`：测试连接（JSON POST） |
| `src/components/resources/magic-datasource-list.vue` | 231 | HTTP `datasource/test` 调用点 |
| `src/components/resources/magic-datasource-list.vue` | 252-276 | `doSave()`：校验 + 保存数据源（JSON POST） |
| `src/components/resources/magic-datasource-list.vue` | 263 | HTTP `datasource/save` 调用点 |
| `src/components/resources/magic-datasource-list.vue` | 278-289 | `initDataSourceObj()`：重置表单 |
| `src/components/resources/magic-datasource-list.vue` | 290-328 | `toogleDialog()`：打开/关闭对话框 + 初始化 monaco JSON 编辑器 |
| `src/components/resources/magic-datasource-list.vue` | 331-346 | `deleteDataSource()`：确认 + 删除 + 刷新 |
| `src/components/resources/magic-datasource-list.vue` | 337 | HTTP `datasource/delete` 调用点 |
| `src/components/resources/magic-datasource-list.vue` | 349-354 | `mounted()`：订阅 `logout` / `refresh-resource` 事件 |
| `src/components/resources/magic-datasource-list.vue` | 358-419 | CSS 样式（列表 hover、表单布局、loading 动画、空状态） |
| `src/components/magic-editor.vue` | 15 | `<magic-datasource-list>` 组件引用（`toolbarIndex === 2` 时显示） |
| `src/components/magic-editor.vue` | 40 | `MagicDatasourceList` 组件导入 |
| `src/components/magic-editor.vue` | 98 | 登录后并行调用 `datasourceList.initData()` |
| `src/components/magic-editor.vue` | 122 | `contants.DATASOURCE_TYPES` 从 config 注入 |
| `src/components/magic-editor.vue` | 288 | 拖拽分隔容器引用（`datasourceList`） |
| `src/scripts/contants.js` | 28-29 | `JDBC_DRIVERS` / `DATASOURCE_TYPES` 初始为空数组 |
| `src/scripts/editor/java-class.js` | 136-139 | `setExtensionAttribute()` 方法实现 |
| `src/scripts/editor/java-class.js` | 152-154 | `findAttributes()` 中合并扩展属性 |
| `src/api/request.js` | 132-191 | `request.send()` 方法实现 |
| `src/api/request.js` | 26-37 | `transformRequest` 默认 form-urlencoded 序列化 |
| `src/components/resources/magic-resource.css` | 全文 | 资源栏共享样式 |
