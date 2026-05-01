# 007-layout-header 模块规范（As-Built）

> 模块编号：007-layout-header
> 状态：已实现
> 最后更新：2026-05-01
> 对应源码：
> - `src/components/layout/magic-header.vue`（379 行）
> - `src/components/layout/magic-status-bar.vue`（111 行）
> - `src/components/layout/magic-login.vue`（68 行）

---

## 1. 模块概述

### 1.1 目的

本模块是 magic-editor 的**布局级 UI 组件集合**，负责：

- **顶部工具栏（magic-header）**：提供应用标识、当前资源路径展示、核心操作按钮（运行/保存/搜索/历史/上传/导出/推送/换肤/刷新）以及皮肤选择器
- **底部状态栏（magic-status-bar）**：展示状态消息、外部链接（Gitee/GitHub/QQ群/文档）、用户登录态与注销
- **登录覆盖层（magic-login）**：提供用户名/密码登录表单，在 401 鉴权失败或用户主动登出时弹出

### 1.2 解决的问题

- 将分散的核心操作（保存、运行、资源导入导出）收敛到顶部工具栏，形成统一的操作入口
- 通过状态栏提供实时操作反馈（如"保存成功"、"推送成功"），替代 console.log 作为用户可见的操作日志
- 通过 401 自动触发登录覆盖层，实现无感知的鉴权恢复流程
- 通过皮肤选择器支持运行时主题切换（含 monaco 编辑器主题联动）

### 1.3 范围

**包含**：
- 顶部工具栏按钮及其弹窗（上传接口、导出接口、远程推送、皮肤选择、全局搜索、历史记录）
- 状态栏消息展示、外部链接图标、用户注销
- 登录弹窗（用户名/密码表单、登录成功后的 token 存储）
- 与 bus 事件系统的交互（emit/on）
- 与 request 模块的 HTTP 调用

**不包含**：
- HTTP 请求底层实现（axios 封装、拦截器、401 拦截）→ 模块 014-infra-transport
- EventBus 实现、store 封装、contants 常量定义 → 模块 015-infra-bus-store
- 底部 Options 区域（请求面板/调试面板/日志面板等）→ 模块 010-layout-options
- 全局搜索组件内部实现 → 本模块仅触发 `search.show()`，组件定义在 `magic-search.vue`
- 资源选择器（magic-resource-choose）内部实现 → 模块 006-resources-recent

---

## 2. 用户场景与用例

### US-007-01：通过顶部工具栏保存脚本

- **角色**：开发者
- **前置条件**：已打开某个接口/函数脚本
- **流程**：
  1. 用户点击顶部保存图标（或按 Ctrl+S）
  2. 系统通过 bus 发出 `doSave` 事件
  3. 编辑器组件监听该事件并执行保存逻辑
- **后置条件**：脚本保存到后端

### US-007-02：通过顶部工具栏测试脚本

- **角色**：开发者
- **前置条件**：已打开一个 API 类型脚本，且当前未处于运行状态
- **流程**：
  1. 用户点击顶部运行图标（或按 Ctrl+Q）
  2. 系统通过 bus 发出 `doTest` 事件
  3. 编辑器组件监听该事件并执行测试逻辑
- **后置条件**：脚本在后端执行，结果展示在底部 Options 区域
- **约束**：当 `info.running === true` 时运行按钮置灰禁用（`magic-header.vue:254-258`）

### US-007-03：上传接口文件

- **角色**：开发者
- **前置条件**：用户已登录
- **流程**：
  1. 用户点击上传图标 → 弹出上传对话框
  2. 用户选择本地 ZIP 文件
  3. 用户选择"增量上传"或"全量上传"
  4. 全量模式需二次确认（警告可能删除其他接口）
  5. 上传成功后刷新资源列表
- **后置条件**：后端接口被更新，资源树刷新

### US-007-04：导出接口

- **角色**：开发者
- **前置条件**：用户已登录
- **流程**：
  1. 用户点击下载图标 → 弹出导出对话框（资源选择器）
  2. 用户勾选要导出的资源
  3. 点击"导出" → 后端返回 ZIP 文件 → 浏览器下载 `magic-api.zip`
- **后置条件**：本地获得包含选中资源的 ZIP 文件

### US-007-05：远程推送接口

- **角色**：开发者
- **前置条件**：用户已登录，已知目标远程地址和秘钥
- **流程**：
  1. 用户点击推送图标 → 弹出推送对话框
  2. 用户勾选资源、输入远程地址和秘钥
  3. 选择"增量推送"或"全量推送"（全量需二次确认）
  4. 推送成功后关闭对话框
- **后置条件**：目标远程服务器的接口被更新

### US-007-06：切换皮肤（主题）

- **角色**：开发者
- **前置条件**：`config.header.skin !== false`
- **流程**：
  1. 用户点击换肤图标 → 弹出皮肤选择下拉列表
  2. 用户点击某个主题名称
  3. 系统切换 CSS 变量 + monaco 编辑器主题 + 持久化到 localStorage
- **后置条件**：UI 和编辑器主题立即生效，下次打开自动恢复

### US-007-07：刷新资源

- **角色**：开发者
- **前置条件**：用户已登录
- **流程**：
  1. 用户点击刷新图标
  2. 系统调用后端刷新接口 → 成功后发出 `refresh-resource` 事件
- **后置条件**：资源树重新加载

### US-007-08：状态栏查看操作日志

- **角色**：开发者
- **流程**：
  1. 用户执行任意操作（保存、推送、上传等）
  2. 状态栏实时显示当前操作状态文案（如"准备保存"、"保存成功"）
- **后置条件**：状态消息保留在状态栏，同时追加到内存状态日志数组

### US-007-09：登录/注销

- **角色**：开发者
- **流程（登录）**：
  1. 401 响应或用户主动登出 → 登录覆盖层弹出
  2. 用户输入用户名和密码 → 点击登录
  3. 登录成功 → token 存入 localStorage → 关闭登录层 → 触发资源加载
- **流程（注销）**：
  1. 用户点击状态栏用户名图标
  2. 二次确认 → 调用 `/logout` → 清除 token → 弹出登录层

### US-007-10：通过状态栏访问外部链接

- **角色**：开发者
- **流程**：用户点击 Gitee/GitHub/QQ群/文档图标 → 新窗口打开对应 URL
- **约束**：各链接可通过 `config.header.repo` / `config.header.qqGroup` / `config.header.document` 配置隐藏

---

## 3. 功能需求（FR）

### 3.1 顶部工具栏

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-007-001 | 顶部工具栏 MUST 显示应用标题（`config.title`）和版本号（`config.version`） | `magic-header.vue:3-5` |
| FR-007-002 | 顶部工具栏 MUST 显示当前打开资源的完整路径（`groupName/name(groupPath/path)`） | `magic-header.vue:7, 260-265` |
| FR-007-003 | 运行按钮 MUST 在 API 类型脚本处于运行中时置灰禁用 | `magic-header.vue:8, 254-258` |
| FR-007-004 | 运行按钮快捷键提示 MUST 显示"Ctrl+Q" | `magic-header.vue:8` |
| FR-007-005 | 保存按钮快捷键提示 MUST 显示"Ctrl+S" | `magic-header.vue:11` |
| FR-007-006 | 工具栏 MUST 提供以下操作按钮：运行、保存、全局搜索、历史记录、上传接口、导出接口、远程推送、换肤、刷新 | `magic-header.vue:8-34` |
| FR-007-007 | 换肤按钮 MUST 在 `config.header.skin === false` 时隐藏 | `magic-header.vue:29` |
| FR-007-008 | 皮肤选择器 MUST 列出所有已注册主题（`Themes` 对象的键） | `magic-header.vue:37` |
| FR-007-009 | 切换皮肤 MUST 同时更新 CSS 变量、monaco 编辑器主题、localStorage 持久化 | `magic-header.vue:234-243` |
| FR-007-010 | 点击页面任意位置 MUST 关闭皮肤选择器下拉列表 | `magic-header.vue:125` |
| FR-007-011 | 上传接口 MUST 支持增量和全量两种模式，全量模式需二次确认 | `magic-header.vue:197-232` |
| FR-007-012 | 导出接口 MUST 允许用户选择资源子集，导出为 `magic-api.zip` | `magic-header.vue:142-157` |
| FR-007-013 | 远程推送 MUST 携带目标地址、秘钥、推送模式（increment/full）作为 Header | `magic-header.vue:162-195` |
| FR-007-014 | 全量推送 MUST 二次确认，警告"以本地数据为准全量覆盖更新" | `magic-header.vue:183-192` |
| FR-007-015 | 刷新资源 MUST 调用后端刷新接口并在成功后触发 `refresh-resource` 事件 | `magic-header.vue:245-251` |

### 3.2 状态栏

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-007-020 | 状态栏 MUST 显示最新的 bus `status` 事件消息 | `magic-status-bar.vue:46` |
| FR-007-021 | 状态栏 MUST 在 `config.header.repo !== false` 时显示 Gitee 和 GitHub 图标 | `magic-status-bar.vue:5-12` |
| FR-007-022 | 状态栏 MUST 在 `config.header.qqGroup !== false` 时显示 QQ 群图标 | `magic-status-bar.vue:13-16` |
| FR-007-023 | 状态栏 MUST 在 `config.header.document !== false` 时显示帮助文档图标 | `magic-status-bar.vue:17-20` |
| FR-007-024 | 状态栏 MUST 在用户已登录（`user.id && user.username` 存在）时显示用户名，点击可注销 | `magic-status-bar.vue:21` |
| FR-007-025 | 注销 MUST 二次确认，调用 `/logout` 后清除 token 并触发 `logout` 事件 | `magic-status-bar.vue:56-71` |
| FR-007-026 | 登录成功后 MUST 自动获取当前用户信息（`GET /user`）并展示在状态栏 | `magic-status-bar.vue:47-50` |

### 3.3 登录覆盖层

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-007-030 | 登录弹窗 MUST 包含用户名和密码输入框 | `magic-login.vue:4-8` |
| FR-007-031 | 登录弹窗 MUST 不支持关闭（无关闭按钮、无遮罩关闭） | `magic-login.vue:2`（`:showClose="false" :shade="true"`） |
| FR-007-032 | 登录 MUST 调用 `POST /login` 携带用户名和密码 | `magic-login.vue:41-43` |
| FR-007-033 | 登录成功 MUST 从响应 Header 中读取 `magic-token` 并存入 localStorage | `magic-login.vue:47-48` |
| FR-007-034 | 登录成功 MUST 调用 `onLogin` 回调关闭弹窗并触发后续资源加载 | `magic-login.vue:49` |
| FR-007-035 | 登录失败 MUST 弹出错误提示"登录失败,用户名或密码不正确" | `magic-login.vue:51-55` |
| FR-007-036 | 登录弹窗 MUST 在 401 响应时由 `request.js` 通过 `bus.$emit('showLogin')` 触发显示 | `request.js:151-153` |
| FR-007-037 | 登录弹窗 MUST 在用户主动登出（`bus.$emit('logout')`）时显示 | `magic-editor.vue:219-222` |

### 3.4 Bus 事件契约

| ID | 事件名 | 方向 | 触发方 | 消费方 | 载荷 | 源码证据 |
|---|---|---|---|---|---|---|
| FR-007-040 | `doSave` | emit | 顶部工具栏（点击/快捷键） | 编辑器组件 | 无 | `magic-header.vue:11` |
| FR-007-041 | `doTest` | emit | 顶部工具栏（点击/快捷键） | 编辑器组件 | 无 | `magic-header.vue:8` |
| FR-007-042 | `status` | emit | 本模块各操作 | bus（持久化到 statusLog） | `message: string` | `magic-header.vue:145,155,165,179,205,215,246,249`；`magic-status-bar.vue:48,57,67` |
| FR-007-043 | `status` | on | bus | 状态栏 | `message: string` | `magic-status-bar.vue:46` |
| FR-007-044 | `showLogin` | emit | `request.js`（401 拦截） | 根组件（设置 `showLogin=true`） | 无 | `request.js:152`、`magic-editor.vue:223` |
| FR-007-045 | `login` | emit | 状态栏（登录成功后获取用户信息前） | 状态栏（获取 `/user`） | 无 | `magic-status-bar.vue:47-49` |
| FR-007-046 | `logout` | emit | 状态栏（注销成功后） | 根组件（关闭 WS、弹登录层） | 无 | `magic-status-bar.vue:66`、`magic-editor.vue:219-222` |
| FR-007-047 | `refresh-resource` | emit | 顶部工具栏（上传/刷新成功后） | 资源列表组件 | 无 | `magic-header.vue:216,248` |
| FR-007-048 | `opened` | on | 编辑器组件 | 顶部工具栏 | `info: {groupName, name, groupPath, path, _type, running, empty}` | `magic-header.vue:126-130` |
| FR-007-049 | `viewHistory` | emit | 顶部工具栏（历史记录按钮） | [NEEDS CLARIFICATION: 消费方未在已读源码中明确定位] | 无 | `magic-header.vue:17` |

---

## 4. HTTP 端点（本模块消费）

| 方法 | 路径 | 触发场景 | 请求体 | 响应 | 源码证据 |
|---|---|---|---|---|---|
| POST | `/login` | 登录表单提交 | `{username, password}` | `data: boolean`；成功时 Header 含 `magic-token` | `magic-login.vue:41-48` |
| GET | `/user` | 登录成功后获取当前用户 | 无 | `data: {id, username}` | `magic-status-bar.vue:49` |
| POST | `/logout` | 用户注销 | 无 | 无业务数据 | `magic-status-bar.vue:62` |
| GET | `/config.json` | 启动时拉取配置（含 `config.header` 字段） | 无 | `data: {version, web, prefix, ...}` | `magic-editor.vue:259-260` |
| POST | `/download` | 导出接口 | 选中资源 ID 数组（JSON） | Blob（ZIP 文件） | `magic-header.vue:146-156` |
| POST | `/upload` | 上传接口 | `FormData{file, mode}` | 无业务数据 | `magic-header.vue:206-217` |
| POST | `/push` | 远程推送 | 选中资源 ID 数组（JSON） | 无业务数据 | `magic-header.vue:166-181` |
| POST | `refresh` | 刷新资源 | 无 | 无业务数据 | `magic-header.vue:247-250` |

### 4.1 远程推送专用 Header

| Header | 值 | 证据 |
|---|---|---|
| `magic-push-target` | 目标远程地址 | `magic-header.vue:169` |
| `magic-push-secret-key` | 秘钥 | `magic-header.vue:170` |
| `magic-push-mode` | `increment` 或 `full` | `magic-header.vue:171` |

---

## 5. 关键实体

| 实体 | 描述 | 关键属性 | 源码证据 |
|---|---|---|---|
| `config` | 应用配置对象 | `title`, `version`, `header.{skin,repo,qqGroup,document}`, `defaultTheme`, `themes` | `magic-header.vue:107`、`magic-editor.vue:137-142` |
| `info` | 当前打开的资源信息 | `groupName`, `name`, `groupPath`, `path`, `_type`, `running`, `empty` | `magic-header.vue:112, 253-265` |
| `Themes` | 已注册主题映射 | `{[themeName]: {[cssVarName]: value}}` | `magic-header.vue:86, 114` |
| `user` | 当前登录用户 | `id`, `username` | `magic-status-bar.vue:41, 49` |
| `statusLog` | 状态消息历史数组 | `[{timestamp, content}]` | `bus.js:4, 49-54` |

---

## 6. 非功能需求（NFR）

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-007-001 | 可用性 | 登录弹窗 MUST 不可通过点击遮罩或关闭按钮退出，强制用户输入凭据或刷新页面 | `magic-login.vue:2` |
| NFR-007-002 | 安全性 | 密码输入框 MUST 使用 `type="password"` | `magic-login.vue:8` |
| NFR-007-003 | 安全性 | Token MUST 存储在 localStorage 而非 cookie/sessionStorage | `magic-login.vue:48`、`magic-status-bar.vue:65` |
| NFR-007-004 | 安全性 | 注销后 token 值 MUST 重置为 `unauthorization` | `magic-status-bar.vue:64-65` |
| NFR-007-005 | 可配置性 | 顶部工具栏的换肤、状态栏的外部链接 MUST 支持通过 `config.header` 配置显隐 | `magic-header.vue:29`、`magic-status-bar.vue:5-20` |
| NFR-007-006 | 响应性 | 皮肤切换 MUST 即时生效（CSS 变量 + monaco 主题同步更新） | `magic-header.vue:234-243` |
| NFR-007-007 | 可观测性 | 所有关键操作 MUST 通过 `status` 事件向状态栏输出进度文案 | 多处 `bus.$emit('status', ...)` |

---

## 7. 假设与约束

- **假设 A-001**：后端 `/login`（POST）在登录成功时通过响应 Header 返回 `magic-token`，失败时返回 `code !== 1` 的 JSON。
- **假设 A-002**：后端 `/push` 端点接受自定义 Header 传递目标地址和秘钥，而非请求体。
- **约束 C-001**：登录弹窗为强制模态，用户无法绕过。
- **约束 C-002**：皮肤选择器点击页面任意位置即关闭，无延迟动画。
- **约束 C-003**：远程推送的默认目标地址硬编码为 `http://host:port/_magic-api-sync`，默认秘钥为 `123456789`（`magic-header.vue:119-120`）。

---

## 8. 依赖关系

### 8.1 上游依赖（本模块消费）

| 模块 | 依赖内容 | 证据 |
|---|---|---|
| **014-infra-transport** | `request.send()` HTTP 封装、401 自动拦截触发 `showLogin` | `magic-header.vue:90`、`magic-login.vue:19`、`request.js:151-153` |
| **015-infra-bus-store** | `bus` EventBus、`store` localStorage 封装、`contants` 常量（`HEADER_MAGIC_TOKEN`） | `magic-header.vue:85,89`、`magic-status-bar.vue:27-30`、`magic-login.vue:21-22` |
| **010-layout-options** | 无直接依赖；但 `doSave`/`doTest` 事件的最终消费方在编辑器/Options 区域 | `magic-header.vue:8,11` |
| **016-common-ui** | `MagicDialog`、`MagicInput`、`MagicFile`、`MagicResourceChoose` 等通用组件 | `magic-header.vue:91-95`、`magic-login.vue:17-18` |

### 8.2 下游依赖（消费本模块）

| 模块 | 依赖内容 | 证据 |
|---|---|---|
| **001-editor-core** | 消费 `doSave`/`doTest` 事件；通过 `opened` 事件向本模块推送当前资源信息 | `magic-header.vue:126-130` |
| **014-infra-transport** | `request.js` 401 拦截触发 `showLogin` 事件，本模块的登录弹窗响应 | `request.js:151-153` |
| **006-resources-recent** | 消费 `refresh-resource` 事件刷新资源列表 | `magic-header.vue:216,248` |

### 8.3 模块边界说明

| 边界 | 说明 |
|---|---|
| **与 014-infra-transport** | 401 拦截逻辑在 `request.js` 中实现（emit `showLogin`），本模块仅负责**响应**该事件并显示登录弹窗。本模块不处理 HTTP 重试、token 自动刷新等传输层逻辑。 |
| **与 015-infra-bus-store** | 本模块是 bus 事件的**主要生产者**（`doSave`/`doTest`/`status`/`logout`/`refresh-resource`）和消费者（`status`/`login`/`opened`）。store 仅用于 token 和 skin 的持久化，不涉及业务数据。 |
| **与 010-layout-options** | 本模块的 `doSave`/`doTest` 按钮仅负责**触发事件**，实际的保存/测试逻辑由编辑器组件和 Options 区域执行。本模块不感知保存结果或测试响应。 |

---

## 9. 待澄清

| ID | 问题 | 影响范围 |
|---|---|---|
| Q-001 | `viewHistory` 事件的消费方未在已读源码中明确定位（`magic-header.vue:17` emit，但未见对应 `$on` 监听器）。该事件是否由编辑器历史组件消费？还是已废弃？ | 功能完整性 |
| Q-002 | 远程推送的默认秘钥硬编码为 `123456789`（`magic-header.vue:120`），是否存在安全风险？是否应通过 `config` 注入或留空？ | 安全性 |
| Q-003 | 登录弹窗的 `onLogin` 回调由根组件 `magic-editor.vue:93-102` 传入，但登录组件本身不直接调用 `bus.$emit('login')`。登录成功后的 WS 创建流程是否完全由根组件编排？ | 架构理解 |

---

## 10. 源码引用清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/components/layout/magic-header.vue` | 379 | 顶部工具栏：操作按钮、皮肤选择、上传/导出/推送对话框、刷新 |
| `src/components/layout/magic-status-bar.vue` | 111 | 底部状态栏：状态消息、外部链接、用户注销 |
| `src/components/layout/magic-login.vue` | 68 | 登录覆盖层：用户名/密码表单、登录提交 |
| `src/scripts/bus.js` | 57 | EventBus 实现、status 日志持久化、cnzz 统计注入 |
| `src/api/request.js` | 194 | HTTP 请求封装、401 拦截（`bus.$emit('showLogin')`） |
| `src/scripts/contants.js` | 36 | 全局常量（`HEADER_MAGIC_TOKEN` 等） |
| `src/components/magic-editor.vue` | 448 | 根组件：组装 header/login/status-bar、监听 bus 事件、WS 生命周期 |
| `src/scripts/store.js` | — | localStorage 封装（token/skin 持久化） |
| `src/scripts/editor/theme.js` | — | `Themes` 导出、`defineTheme()` 注册 |
