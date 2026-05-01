# 007-layout-header 技术实现计划（As-Built）

> 本文件以"已建成系统"视角记录 007-layout-header 模块的实际技术实现。
> 模块编号：007-layout-header
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. Technical Context

### 1.1 Runtime Environment

| 维度 | 值 | 来源 |
|---|---|---|
| 运行环境 | 浏览器（现代浏览器，ES2020+） | [TECH.md §7](../TECH.md#7-浏览器目标) |
| 前端框架 | Vue 3.4.x（Options API 风格） | `magic-header.vue:97` |
| 编辑器内核 | monaco-editor 0.29.1（皮肤切换时调用） | `magic-header.vue:88,242` |
| 模块系统 | ES Modules（Vite 构建） | [TECH.md §2](../TECH.md#2-构建工具链) |
| 语言 | JavaScript（无 TypeScript） | 源码全为 `.vue` |

### 1.2 Dependencies

#### 直接依赖（源码 import）

| 依赖 | 版本 | 消费文件 | 用途 |
|---|---|---|---|
| `monaco-editor` | ^0.29.1 | `magic-header.vue:88` | `monaco.editor.setTheme()` 切换编辑器主题 |
| `@/scripts/bus.js` | 内部 | `magic-header.vue:85`、`magic-status-bar.vue:27`、`magic-login.vue:22` | 全局 EventBus |
| `@/scripts/editor/theme.js` | 内部 | `magic-header.vue:86` | `Themes` 主题注册表 |
| `@/scripts/utils.js` | 内部 | `magic-header.vue:87` | `downloadFile()` 导出 ZIP 下载 |
| `@/scripts/store.js` | 内部 | `magic-header.vue:89`、`magic-status-bar.vue:30`、`magic-login.vue:21` | localStorage 封装（skin/token 持久化） |
| `@/scripts/contants.js` | 内部 | `magic-status-bar.vue:29`、`magic-login.vue:20` | 常量（`HEADER_MAGIC_TOKEN`/`HEADER_MAGIC_TOKEN_VALUE`） |
| `@/api/request.js` | 内部 | `magic-header.vue:90`、`magic-status-bar.vue:28`、`magic-login.vue:19` | HTTP 请求封装 |
| `@/components/common/modal/magic-dialog.vue` | 内部 | `magic-header.vue:91`、`magic-login.vue:18` | 对话框容器 |
| `@/components/common/magic-input.vue` | 内部 | `magic-header.vue:92`、`magic-login.vue:17` | 输入框组件 |
| `@/components/common/magic-file.vue` | 内部 | `magic-header.vue:93` | 文件选择组件 |
| `@/components/resources/magic-resource-choose.vue` | 内部 | `magic-header.vue:94` | 资源选择器（导出/推送） |
| `./magic-search.vue` | 内部 | `magic-header.vue:95` | 全局搜索组件 |

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
| 第一条 | 单一主组件 + 注入式配置 | ✅ Compliant | 本模块通过 props 接收 `config`（`magic-header.vue:107`、`magic-status-bar.vue:34-37`），无硬编码后端地址 |
| 第二条 | 前后端契约即真相 | ✅ Compliant | 业务数据（上传/导出/推送）全部通过 HTTP 与后端交互，localStorage 仅持久化 `skin` 和 `magic-token` 用户偏好 |
| 第三条 | 通信双通道：HTTP + WebSocket | ✅ Compliant | 本模块所有操作走 HTTP（`request.send`），不直接使用 WS；WS 由根组件在 `login` 事件后创建 |
| 第四条 | 事件总线即全局状态 | ✅ Compliant | 所有跨组件通信走 `bus.js`：发出 `doSave`/`doTest`/`status`/`logout`/`refresh-resource`，订阅 `status`/`login`/`opened`，无 Vuex/Pinia |
| 第五条 | monaco 一切围绕 magic-script | ✅ Compliant | `monaco.editor.setTheme()` 仅用于切换编辑器皮肤，不涉及语言服务（`magic-header.vue:242`） |
| 第六条 | 类型契约由 Header 表达 | ✅ Compliant | 推送操作使用 `magic-push-target`/`magic-push-secret-key`/`magic-push-mode` 自定义 Header（`magic-header.vue:169-171`）；登录 token 通过 `magic-token` Header 传递（`magic-login.vue:47-48`） |
| 第七条 | 国际化只信语言包索引化 | ✅ Compliant | 本模块不涉及 monaco i18n 切换 |
| 第八条 | 双构建产物共存 | ✅ Compliant | 本模块为纯组件，无构建模式差异代码 |
| 第九条 | 错误反馈走模态框 + Bus | ✅ Compliant | 上传/推送/注销均通过 `$magicConfirm` 二次确认（`magic-header.vue:220,184`、`magic-status-bar.vue:58`）；登录失败通过 `$magicAlert` 弹框（`magic-login.vue:52-55`）；操作进度通过 `bus.$emit('status', ...)` 反馈 |
| 第十条 | 源代码即文档真相 | ✅ Compliant | 本文档所有论断均附源码行号 |

### 例外登记

| ID | 违反条款 | 现状 | 备注 |
|---|---|---|---|
| E-001-C6 | 第六条（衍生约束） | `magic-header.vue:119-120` 硬编码推送默认地址 `http://host:port/_magic-api-sync` 和秘钥 `123456789` | 已在 spec.md Q-002 登记，应通过 `config` 注入或留空 |
| E-002-C2 | 第二条（衍生约束） | `magic-header.vue:241` 通过 `store.set('skin', ...)` 持久化皮肤偏好，属宪法允许的"用户偏好"范围 | 合规，仅记录 |

---

## 3. Project Structure

### 3.1 模块文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/components/layout/magic-header.vue` | 379 | 顶部工具栏：操作按钮、皮肤选择、上传/导出/推送对话框、刷新 |
| `src/components/layout/magic-status-bar.vue` | 111 | 底部状态栏：状态消息、外部链接、用户注销 |
| `src/components/layout/magic-login.vue` | 68 | 登录覆盖层：用户名/密码表单、登录提交 |

### 3.2 组件内部结构

```
magic-header.vue (379 行)
├── <template> (82 行)
│   ├── Logo + 版本号（ma-logo）
│   ├── 当前资源路径展示（displayText）
│   ├── 9 个操作按钮（运行/保存/搜索/历史/上传/导出/推送/换肤/刷新）
│   ├── 皮肤选择器下拉列表（v-show="skinVisible"）
│   ├── 上传接口对话框（magic-dialog + magic-file）
│   ├── 导出接口对话框（magic-dialog + magic-resource-choose）
│   ├── 远程推送对话框（magic-dialog + magic-resource-choose + magic-input×2）
│   └── 全局搜索组件（magic-search ref）
├── <script> (207 行)
│   ├── import 声明 (12 个依赖)
│   ├── props: config, themeStyle
│   ├── data() (9 个响应式字段)
│   ├── mounted() (3 项初始化)
│   │   ├── 点击根元素关闭皮肤选择器
│   │   ├── 订阅 opened 事件更新当前资源信息
│   │   └── 初始化皮肤（从 store 或 defaultTheme）
│   └── methods (8 个方法)
│       ├── download / remotePush / upload    — 打开对话框
│       ├── doExport                          — 导出 ZIP
│       ├── doPush                            — 远程推送（增量/全量）
│       ├── doUpload                          — 上传 ZIP（增量/全量）
│       ├── switchTheme                       — 皮肤切换
│       └── refresh                           — 刷新资源
├── computed (2 个)
│   ├── isDisableTest                         — 运行按钮禁用逻辑
│   └── displayText                           — 资源路径格式化
└── <style scoped> (90 行)
    └── 工具栏布局 + 皮肤选择器 + 推送表单样式

magic-status-bar.vue (111 行)
├── <template> (24 行)
│   ├── 状态消息展示（v-html="message"）
│   ├── 外部链接图标（Gitee/GitHub/QQ群/文档）
│   └── 用户注销图标（v-if="user && user.id && user.username"）
├── <script> (48 行)
│   ├── import 声明 (4 个依赖)
│   ├── props: config
│   ├── data() (2 个响应式字段: user, message)
│   ├── mounted() (2 个 bus 订阅)
│   │   ├── status → 更新消息
│   │   └── login → 获取用户信息
│   └── methods (2 个方法)
│       ├── open(url)                         — 新窗口打开链接
│       └── logout()                          — 注销登录（二次确认）
└── <style scoped> (35 行)
    └── 状态栏布局 + 图标样式

magic-login.vue (68 行)
├── <template> (14 行)
│   ├── 强制模态对话框（:showClose="false" :shade="true"）
│   ├── 用户名输入框 + 密码输入框
│   └── 登录按钮
├── <script> (24 行)
│   ├── import 声明 (5 个依赖)
│   ├── props: onLogin（回调函数）
│   ├── data() (2 个响应式字段: username, password)
│   └── methods (1 个方法)
│       └── doLogin()                         — 提交登录请求
└── <style scoped> (6 行)
    └── 表单 label 对齐
```

### 3.3 与相邻模块的物理边界

```
src/components/layout/
├── magic-header.vue         ← 007-layout-header（本模块）
├── magic-status-bar.vue     ← 007-layout-header（本模块）
├── magic-login.vue          ← 007-layout-header（本模块）
├── magic-search.vue         ← 007-layout-header（本模块，被 header 引用）
├── magic-options.vue        ← 010-layout-options（相邻模块）
└── magic-editor-*.vue       ← 008/009（相邻模块）

src/components/resources/magic-resource-choose.vue  ← 006-resources-recent（被 header 引用）
src/scripts/bus.js           ← 015-infra-bus-store（import 调用）
src/scripts/store.js         ← 015-infra-bus-store（import 调用）
src/scripts/contants.js      ← 015-infra-bus-store（import 调用）
src/api/request.js           ← 014-infra-transport（import 调用）
src/scripts/editor/theme.js  ← 012-script-language（Themes 注册表）
```

---

## 4. Phase 0 Research

### 4.1 已解决的技术决策

| 决策点 | 选择 | 理由 | 源码证据 |
|---|---|---|---|
| 组件通信方式 | EventBus（bus.js） | 宪法第四条强制要求，避免 props 透传链 | `magic-header.vue:8,11,145` 等多处 `bus.$emit` |
| 皮肤持久化 | localStorage `skin` 键 | 宪法第二条允许"用户偏好"持久化 | `magic-header.vue:241`、`magic-header.vue:131` |
| Token 持久化 | localStorage `magic-token` 键 | 宪法第二条允许"用户偏好"持久化 | `magic-login.vue:48`、`magic-status-bar.vue:65` |
| 上传/推送模式 | 增量 vs 全量两种模式，全量需二次确认 | 防止误操作导致数据丢失 | `magic-header.vue:183-192,219-228` |
| 登录弹窗可见性控制 | 由根组件 `showLogin` 状态控制（`v-if`），非组件自身管理 | 登录弹窗生命周期由根组件编排（WS 创建/关闭） | `magic-editor.vue:91,223` + `magic-login.vue:2`（`v-show="true"` 始终渲染） |
| 皮肤选择器关闭方式 | 监听 `$root.$el` 点击事件 | 简单直接，无需额外状态管理 | `magic-header.vue:125` |
| 导出文件名 | 硬编码 `magic-api.zip` | 后端不返回文件名，前端固定命名 | `magic-header.vue:154` |
| 运行按钮禁用逻辑 | computed `isDisableTest`：非 API 类型或 running=true 时禁用 | 防止重复执行 | `magic-header.vue:254-258` |

### 4.2 登录/会话流程对齐

本模块的登录流程与 `magic-token` / `Magic-Request-Session` / `showLogin` 事件的对齐关系：

```
┌──────────────────────────────────────────────────────────────┐
│                     登录/会话完整流程                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  401 触发路径：                                               │
│    request.js:151-152  → bus.$emit('showLogin')              │
│    magic-editor.vue:223 → this.showLogin = true              │
│    → <magic-login> 组件渲染（v-if="showLogin"）               │
│                                                              │
│  主动登出路径：                                                │
│    magic-status-bar.vue:56-71 → $magicConfirm → /logout      │
│    → contants.HEADER_MAGIC_TOKEN_VALUE = 'unauthorization'   │
│    → store.remove(contants.HEADER_MAGIC_TOKEN)               │
│    → bus.$emit('logout')                                     │
│    magic-editor.vue:219-222 → this.showLogin = true          │
│                        → this.websocket.close()              │
│                                                              │
│  登录成功路径：                                                │
│    magic-login.vue:41-48 → POST /login                       │
│    → response.headers['magic-token'] → HEADER_MAGIC_TOKEN_VALUE│
│    → store.set(contants.HEADER_MAGIC_TOKEN, tokenValue)      │
│    → this.onLogin()（根组件回调）                             │
│    magic-editor.vue:93-102 → showLogin=false                 │
│                        → Promise.all([资源列表初始化])         │
│                        → bus.$emit('login')                  │
│    magic-editor.vue:116-118 → 创建 MagicWebSocket            │
│    magic-status-bar.vue:47-50 → GET /user → 展示用户名        │
│                                                              │
│  Token 注入路径：                                              │
│    request.js:111-112 → 每个请求自动注入 magic-token Header   │
│    → 值为 contants.HEADER_MAGIC_TOKEN_VALUE                   │
│    → 默认 'unauthorization'，登录后替换为真实 token            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 已识别的技术债

| NC 编号 | 问题 | 风险等级 | 缓解建议 |
|---|---|---|---|
| NC-001 | `magic-header.vue:119-120` 硬编码推送默认地址和秘钥 | 中 | 应通过 `config.header.pushTarget` / `config.header.pushSecretKey` 注入 |
| NC-002 | `magic-header.vue:125` 直接监听 `$root.$el` 点击关闭皮肤选择器 | 低 | 可能与宿主环境的点击事件冲突，建议改为 `document.addEventListener` 并在 `beforeUnmount` 清理 |
| NC-003 | `magic-login.vue:2` 使用 `v-show="true"` 始终渲染，可见性由父组件 `v-if` 控制 | 低 | 语义不清晰，建议改为由组件自身响应 `showLogin` prop |
| NC-004 | `magic-header.vue:127-129` 通过 `this.info = null; this.info = info` 强制触发 Vue 响应式更新 | 低 | Vue 3 中可直接赋值，此写法为 Vue 2 遗留习惯 |

---

## 5. Phase 1 Design Outputs

### 5.1 Data Model（引用）

本模块涉及的数据模型已在以下文档中定义：

- **config 配置对象**：[overall-data-model.md §2 配置常量模型](../overall-data-model.md#2-配置常量模型contants) + [overall-plan.md §5 配置项实施清单](../overall-plan.md#5-配置项实施清单)
- **info 资源信息**：[spec.md §5 关键实体](./spec.md#5-关键实体)
- **Themes 主题映射**：[spec.md §5 关键实体](./spec.md#5-关键实体)
- **user 用户对象**：[spec.md §5 关键实体](./spec.md#5-关键实体)
- **statusLog 状态日志**：[overall-data-model.md §6.6 状态日志数组](../overall-data-model.md#66-状态日志数组)
- **localStorage 持久化**：[overall-data-model.md §3 localStorage 持久化条目](../overall-data-model.md#3-localstorage-持久化条目)

### 5.2 Contracts（引用）

本模块消费/生产的接口契约已在以下文档中定义：

- **HTTP 通用约定**：[overall-api.md §2 HTTP 通用约定](../overall-api.md#2-http-通用约定)
- **HTTP 自定义 Header（推送）**：[spec.md §4.1 远程推送专用 Header](./spec.md#41-远程推送专用-header)
- **HTTP 端点（本模块消费）**：[spec.md §4 HTTP 端点](./spec.md#4-http-端点本模块消费)
- **Bus 事件契约**：[spec.md §3.4 Bus 事件契约](./spec.md#34-bus-事件契约)
- **模块间边界**：[spec.md §8 依赖关系](./spec.md#8-依赖关系)

### 5.3 Quickstart

本模块为布局级组件，无独立运行方式。使用方式：

1. 确保 `magic-editor.vue` 主组件已挂载
2. 确保 `bus.js`、`contants.js`、`store.js`、`request.js` 等基础设施已初始化
3. 确保 `Themes` 主题注册表已加载（`theme.js` 已 import）
4. 在 `magic-editor.vue` 模板中引用：
   ```vue
   <magic-header :config="config" :theme-style.sync="themeStyle" />
   <magic-status-bar :config="config" />
   <magic-login v-if="showLogin" :on-login="onLogin" />
   ```

开发调试：
```bash
npm run dev          # 启动 dev server
# 访问 http://localhost:5173（需后端 magic-api 运行在 :9999）
```

---

## 6. FR 实现策略映射

本节将 spec.md 中定义的每个 FR 映射到具体实现策略。

### 6.1 顶部工具栏（FR-007-001 ~ FR-007-015）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-007-001 | 模板中 `:title="config.title"` + `{{ config.title }}` 和 `{{ config.version }}` | `magic-header.vue:3-5` |
| FR-007-002 | computed `displayText` 拼接 `groupName/name(groupPath/path)`，正则替换多余 `/` | `magic-header.vue:7,260-265` |
| FR-007-003 | computed `isDisableTest`：`info._type === 'api' && info.running === true` 时返回 true | `magic-header.vue:254-258` |
| FR-007-004 | 模板中 `title="运行（Ctrl+Q）"` 硬编码 | `magic-header.vue:8` |
| FR-007-005 | 模板中 `title="保存（Ctrl+S）"` 硬编码 | `magic-header.vue:11` |
| FR-007-006 | 模板中 9 个 `<span>` 按钮依次排列，各自绑定 click 事件 | `magic-header.vue:8-34` |
| FR-007-007 | `v-if="config.header.skin !== false"` 条件渲染 | `magic-header.vue:29` |
| FR-007-008 | `v-for="theme in Object.keys(Themes)"` 遍历主题注册表 | `magic-header.vue:37` |
| FR-007-009 | `switchTheme()` 三步：`$delete` 清除旧 CSS 变量 → `$set` 写入新变量 → `monaco.editor.setTheme()` → `store.set('skin')` → `$emit('update:themeStyle')` | `magic-header.vue:234-243` |
| FR-007-010 | `mounted()` 中 `this.$root.$el.addEventListener('click', ...)` 关闭皮肤选择器 | `magic-header.vue:125` |
| FR-007-011 | `doUpload(mode)` 中全量模式走 `$magicConfirm` 二次确认，增量模式直接上传 | `magic-header.vue:197-232` |
| FR-007-012 | `doExport()` 中 `resourceExport.getSelected()` 获取选中资源，`POST /download` 返回 Blob 后 `downloadFile(blob, 'magic-api.zip')` | `magic-header.vue:142-157` |
| FR-007-013 | `doPush()` 中 `request.send('/push', ...)` 携带 `magic-push-target`/`magic-push-secret-key`/`magic-push-mode` Header | `magic-header.vue:162-181` |
| FR-007-014 | 全量推送前 `$magicConfirm` 提示"以本地数据为准全量覆盖更新" | `magic-header.vue:183-192` |
| FR-007-015 | `refresh()` 中 `request.send('refresh')` 成功后 `bus.$emit('refresh-resource')` + `bus.$emit('status', ...)` | `magic-header.vue:245-251` |

### 6.2 状态栏（FR-007-020 ~ FR-007-026）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-007-020 | `mounted()` 中 `bus.$on('status', (message) => this.message = message)` | `magic-status-bar.vue:46` |
| FR-007-021 | `v-if="config.header.repo !== false"` 条件渲染 Gitee + GitHub 图标 | `magic-status-bar.vue:5-12` |
| FR-007-022 | `v-if="config.header.qqGroup !== false"` 条件渲染 QQ 群图标 | `magic-status-bar.vue:13-16` |
| FR-007-023 | `v-if="config.header.document !== false"` 条件渲染帮助文档图标 | `magic-status-bar.vue:17-20` |
| FR-007-024 | `v-if="user && user.id && user.username"` 条件渲染用户名，`@click="logout"` | `magic-status-bar.vue:21` |
| FR-007-025 | `logout()` 中 `$magicConfirm` 二次确认 → `POST /logout` → 重置 token → `bus.$emit('logout')` | `magic-status-bar.vue:56-71` |
| FR-007-026 | `mounted()` 中 `bus.$on('login', ...)` → `bus.$emit('status', ...)` → `GET /user` → `this.user = user` | `magic-status-bar.vue:47-50` |

### 6.3 登录覆盖层（FR-007-030 ~ FR-007-037）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-007-030 | 模板中两个 `magic-input`，分别绑定 `username` 和 `password` | `magic-login.vue:4-8` |
| FR-007-031 | `:showClose="false" :shade="true"` 禁止关闭 | `magic-login.vue:2` |
| FR-007-032 | `doLogin()` 中 `request.send('/login', {username, password})` | `magic-login.vue:41-43` |
| FR-007-033 | 成功回调中 `response.headers[contants.HEADER_MAGIC_TOKEN]` 读取 token | `magic-login.vue:47-48` |
| FR-007-034 | 成功回调中 `this.onLogin()` 调用根组件传入的回调 | `magic-login.vue:49` |
| FR-007-035 | 失败分支 `$magicAlert({content: '登录失败,用户名或密码不正确'})` | `magic-login.vue:51-55` |
| FR-007-036 | `request.js:151-152` 中 `data.code === 401` 时 `bus.$emit('showLogin')` | `request.js:151-152` |
| FR-007-037 | `magic-editor.vue:219-222` 中 `bus.$on('logout', ...)` 设置 `showLogin = true` | `magic-editor.vue:219-222` |

### 6.4 Bus 事件契约（FR-007-040 ~ FR-007-049）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-007-040 | `@click="bus.$emit('doSave')"` 直接 emit | `magic-header.vue:11` |
| FR-007-041 | `@click="bus.$emit('doTest')"` 直接 emit | `magic-header.vue:8` |
| FR-007-042 | 各操作前后 `bus.$emit('status', '...')` 输出进度文案 | `magic-header.vue:145,155,165,179,205,215,246,249`；`magic-status-bar.vue:57,67` |
| FR-007-043 | `bus.$on('status', ...)` 订阅并更新 `message` | `magic-status-bar.vue:46` |
| FR-007-044 | `request.js:152` emit → `magic-editor.vue:223` 消费 | `request.js:152`、`magic-editor.vue:223` |
| FR-007-045 | `magic-status-bar.vue:48` emit → 同组件 `bus.$on('login', ...)` 消费 | `magic-status-bar.vue:47-49` |
| FR-007-046 | `magic-status-bar.vue:66` emit → `magic-editor.vue:219-222` 消费 | `magic-status-bar.vue:66`、`magic-editor.vue:219-222` |
| FR-007-047 | 上传/刷新成功后 `bus.$emit('refresh-resource')` | `magic-header.vue:216,248` |
| FR-007-048 | `bus.$on('opened', ...)` 订阅并更新 `info` | `magic-header.vue:126-130` |
| FR-007-049 | `@click="bus.$emit('viewHistory')"` emit，消费方未在已读源码中定位 | `magic-header.vue:17` |

---

## 7. Complexity Tracking

### 7.1 复杂度热点

| 区域 | 复杂度来源 | 行数 | 说明 |
|---|---|---|---|
| `doPush()` | 推送逻辑分支（增量/全量、二次确认、Header 注入） | 34 行（`magic-header.vue:162-195`） | 包含模式判断、确认弹窗、HTTP 请求、成功回调 |
| `doUpload()` | 上传逻辑分支（增量/全量、FormData 构建、二次确认） | 36 行（`magic-header.vue:197-232`） | 包含文件校验、模式判断、确认弹窗、HTTP 请求、成功回调 |
| `switchTheme()` | 皮肤切换三步操作（CSS 变量 + monaco 主题 + 持久化） | 10 行（`magic-header.vue:234-243`） | 涉及 Vue 响应式 API（`$delete`/`$set`）和 monaco API |
| `doLogin()` | 登录提交 + token 处理 + 回调调用 | 18 行（`magic-login.vue:40-58`） | 包含成功/失败分支、Header 读取、store 写入 |
| `logout()` | 注销确认 + token 清除 + 事件触发 | 16 行（`magic-status-bar.vue:56-71`） | 包含确认弹窗、HTTP 请求、状态重置、事件广播 |

### 7.2 圈复杂度评估

| 方法 | 分支数 | 评估 |
|---|---|---|
| `doPush()` | 4+ | 中 — 模式判断 + 确认弹窗 + 成功回调 |
| `doUpload()` | 4+ | 中 — 文件校验 + 模式判断 + 确认弹窗 + 成功回调 |
| `doExport()` | 2 | 低 — 选中校验 + 成功回调 |
| `switchTheme()` | 1 | 低 — 线性流程 |
| `isDisableTest` | 3 | 低 — 三条件判断 |
| `displayText` | 2 | 低 — 空/非空分支 |
| `doLogin()` | 2 | 低 — 成功/失败分支 |
| `logout()` | 2 | 低 — 确认/取消分支 |

---

## 8. Progress Tracking

### 8.1 文档完成状态

| 章节 | 状态 | 备注 |
|---|---|---|
| 1. Technical Context | ✅ 完成 | 依赖清单完整，附源码行号 |
| 2. Constitution Check | ✅ 完成 | 10 条原则逐一检查，2 条例外登记 |
| 3. Project Structure | ✅ 完成 | 3 个文件清单 + 内部结构 + 物理边界 |
| 4. Phase 0 Research | ✅ 完成 | 8 项技术决策 + 登录流程对齐图 + 4 项技术债 |
| 5. Phase 1 Design Outputs | ✅ 完成 | data-model/contracts/quickstart 引用对齐 |
| 6. FR 实现策略映射 | ✅ 完成 | 全部 31 个 FR（FR-007-001 ~ FR-007-049）一一映射 |
| 7. Complexity Tracking | ✅ 完成 | 5 个复杂度热点 + 圈复杂度评估 |
| 8. Progress Tracking | ✅ 完成 | 本章节 |

### 8.2 与总体文档对齐检查

| 对齐项 | 状态 | 说明 |
|---|---|---|
| overall-data-model.md 配置常量 | ✅ 对齐 | `config.header` 字段与 overall-plan §5 一致 |
| overall-data-model.md localStorage | ✅ 对齐 | `magic-token`/`skin` 持久化与 overall-data-model §3 一致 |
| overall-api.md HTTP Header | ✅ 对齐 | `magic-push-*` Header 与 overall-api §2.3 风格一致 |
| overall-api.md 错误传播 | ✅ 对齐 | 401 → `showLogin` 与 overall-api §8 一致 |
| overall-plan.md 构建顺序 | ✅ 对齐 | 本模块依赖基础设施层（contants/bus/store/request），构建顺序正确 |
| constitution.md 原则 | ✅ 对齐 | 10 条原则全部检查，2 条例外已登记 |
| spec.md FR 编号 | ✅ 对齐 | FR-007-001 ~ FR-007-049 共 31 个需求全部映射 |
