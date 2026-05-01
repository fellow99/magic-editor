# Spec 101 — `@fellow99/magic-editor` 适配 magic-api 2.2.2

**状态**：草案
**版本基线**：`@fellow99/magic-editor@3.0.0`（fork 自 magic-editor 1.x）→ 目标对接 `magic-api-spring-boot-starter:2.2.2`
**配套文档**：`api.md`（后端契约事实源）、`plan.md`（HOW）、`tasks.md`（原子任务）
**关联需求**：`016-ruoyi-magic-api-integration`（宿主集成，已落地 T1-T7）

---

## 1. 背景与问题陈述

### 1.1 现状

- RuoYi 宿主已按 spec 016 完成集成：后端引入 `magic-api-spring-boot-starter:2.2.2`、`magic-api.web=/magic/web`、Sa-Token Bearer 注入；前端引入 `@fellow99/magic-editor@3.0.0` 并挂载到 `/tool/magic-api` 路由。
- 启动后浏览器实际请求形如 `/dev-api/magic/web/group/list?type=1`、`/dev-api/magic/web/list`、`/dev-api/magic/web/datasource/list`、`/dev-api/magic/web/function/list`、`/dev-api/magic/web/group/list?type=2` 等 1.x 端点。
- 后端 2.2.2 已不存在上述路径，统一返回 `JsonBean{code:500, msg:"No static resource ...", data:null}`，前端列表全部为空，UI 因依赖列表数据初始化而卡死。
- fork 包 `src/api/request.js` 默认 `Content-Type: application/x-www-form-urlencoded` + `Qs.stringify(arrayFormat:repeat, allowDots:true)`，与 2.2.2 部分端点（`@RequestBody DataSourceInfo`、`text/plain` ROT13 字符串）不兼容。
- fork 包 `src/api/web.js` 当前为空文件；27 处 `request.send()` 调用散落于 `src/components/**`、`src/scripts/utils.js`，URL 与参数均按 1.x 硬编码。

### 1.2 目标

- 在不替换 fork 包整体架构（保留 Vue 组件、monaco 集成、布局结构）的前提下，将其调用层与 magic-api 2.2.2 后端契约对齐。
- 改造完成后：
  - 资源树 / 分组 / 文件 CRUD / 锁定 / 移动 / 备份 / 数据源连通性 / 工作台 / 登录登出 / 搜索 / TODO 等编辑器全部既有功能在 2.2.2 后端上恢复正常。
  - UI 不再因列表 500 错误卡死。
  - fork 包对宿主仍保持「单 npm 依赖 + 一个 Vue 组件」的接入形态。

### 1.3 升级范围与边界

| 维度 | 在范围 | 不在范围 |
|---|---|---|
| 调用层 | `src/api/request.js`、`src/api/web.js`、`src/scripts/utils.js` 内的 HTTP 调用 | 业务用户脚本本身的 `/magic/api/**` 运行时调用 |
| 组件层 | 改动调用点的最小必要片段（参数适配、响应结构适配） | 重写 Vue 组件、调整 UI 视觉、重做状态管理 |
| 通信 | HTTP 端点全量改造（见 §3） | WebSocket（`/magic/console`）协议 — 2.2.2 与 1.x 一致，沿用 014-infra-transport |
| 加密 | 仅 `/resource/file/{folder}/save` 引入 ROT13(Base64) | 其他端点保持明文 |
| 认证 | 沿用宿主在 axios 拦截器中注入的 `Authorization: Bearer <sa-token>`，不改写 fork 包内部头处理 | Sa-Token 自身配置（属于 016） |
| 后端 | 不修改 magic-api 上游源码，不写后端兼容层 | — |

---

## 2. 用户故事与用例

### 2.1 US-101-001 打开 Magic API 编辑器后看到完整资源树

**As** RuoYi 系统管理员
**I want to** 进入 `/tool/magic-api` 后立即看到 API / 函数 / 数据源 / 任务的分组与文件列表
**So that** 我能像 magic-api 官方 2.2.2 控制台一样浏览资源

**验收**：
- 页面初始化只发起一次 `POST /resource`，列表面板按 folder（api/function/datasource/task/component）分别渲染。
- 网络面板不再出现 `group/list`、`list`、`function/list`、`datasource/list`、`group/list?type=2` 等 1.x 路径。
- 控制台无未捕获异常；UI 可交互不卡死。

### 2.2 US-101-002 创建 / 修改 / 删除 / 移动分组

**As** 编辑器使用者
**I want to** 通过现有的右键菜单与对话框创建、重命名、删除、复制、移动分组
**So that** 我能维护资源组织结构

**验收**：
- 创建分组调用 `POST /resource/folder/save`（无 `id`），重命名调用同一端点（带 `id`）。
- 复制分组调用 `POST /resource/folder/copy`，参数 `src, target`。
- 删除分组调用 `POST /resource/delete`，参数 `id`（不再使用 `groupId`）。
- 操作完成后资源树自动刷新，无需整页刷新。

### 2.3 US-101-003 编辑并保存 API / 函数 / 数据源 / 任务 / 组件

**As** 接口开发者
**I want to** 在编辑器中编辑脚本并保存
**So that** 后端立刻按新内容运行

**验收**：
- 保存请求统一走 `POST /resource/file/{folder}/save`。
- 请求体为 ROT13(Base64(JSON.stringify(entity))) 字符串，`Content-Type: text/plain`。
- 后端返回的 `data`（实体 ID）能被前端正确写回当前实体的 `id` 字段。
- 数据源保存后刷新数据源列表；API/函数保存后保留当前编辑态不丢失脚本内容。

### 2.4 US-101-004 拉取文件详情进入编辑

**As** 编辑器使用者
**I want to** 双击资源树中的文件进入编辑态
**So that** 我能查看与修改其完整定义（含 script、参数、headers）

**验收**：
- 文件详情请求统一为 `GET /resource/file/{id}`（不再调用 `get?id=`、`function/get?id=`、`datasource/detail`）。
- 响应字段直接映射到当前编辑面板的实体模型（API/Function/DataSource/Task/Component 各自字段集）。

### 2.5 US-101-005 锁 / 解锁 / 移动文件

**As** 编辑器使用者
**I want to** 锁定文件以避免热更新覆盖、按需移动文件到其他分组
**So that** 我能控制运行态与组织结构

**验收**：
- 锁定/解锁调用 `POST /resource/lock` / `POST /resource/unlock`，form 参数 `id`。
- 移动调用 `POST /resource/move`，form 参数 `src`（文件 id）、`groupId`（目标分组 id）；不再使用 `id` 作为参数名。

### 2.6 US-101-006 数据源连通性测试

**As** 编辑器使用者
**I want to** 在数据源对话框点击「测试连接」立即看到结果
**So that** 我能在保存前确认配置正确

**验收**：
- 调用 `POST /datasource/jdbc/test`，**`Content-Type: application/json`**，body 为 `DataSourceInfo` JSON。
- 不再使用 1.x 的 `datasource/test`（form 表单）。

### 2.7 US-101-007 备份与回滚

**As** 编辑器使用者
**I want to** 查看资源历史备份并按需回滚
**So that** 我可以在误操作后恢复

**验收**：
- 列资源备份调用 `GET /backup/{id}`（id 在路径，不再为 query）。
- 取备份脚本调用 `GET /backup?timestamp=&id=`（路径不带 `/get`）。
- 回滚调用 `POST /backup/rollback`，参数 `id, timestamp` 不变。
- 时间维度备份列表 `GET /backups?timestamp=` 沿用。

### 2.8 US-101-008 工作台辅助能力

**As** 编辑器使用者
**I want to** 使用搜索、TODO、登录、当前用户、登出、插件、可选项、重新加载、导入导出、推送等工作台能力
**So that** 我覆盖完整的 magic-api 控制台体验

**验收**：
- TODO 调用 `GET /todo`（方法由 1.x 的 POST 改为 GET）。
- 搜索 `POST /search`、登录 `POST /login`、当前用户 `POST /user`、登出 `POST /logout`、插件 `GET /plugins`、可选项 `* /options`、重载 `GET /reload`、配置 `GET /config.json`、Class 提示文本 `GET /classes.txt`、单 class `POST /class`、全量元数据 `POST /classes`、配置 JS `* /config-js`、导出 `* /download`、导入 `* /upload`、推送 `* /push` 全部按 §3 端点清单对齐。
- 鉴权头由宿主拦截器统一注入 `Authorization: Bearer <sa-token>`，fork 包不再硬编码 `magic-token` 取值逻辑（仅保留请求头透传）。

---

## 3. 功能需求

> 编号约定：`FR-101-AAA[-NN]`。AAA 段对应 api.md 的端点分组（WB/RES/BAK/DS/TRX）。每条 FR 注明：现状、目标、差异、对应 api.md 条目。所有「目标接口」字段以 `api.md` 为事实源。

### 3.1 传输层（FR-101-TRX）

#### FR-101-TRX-01 axios 默认配置兼容 ROT13 文件保存

- **现状**（`src/api/request.js`）：`Content-Type` 默认 `application/x-www-form-urlencoded`；`transformRequest` 中除 FormData 外一律 `Qs.stringify`。
- **目标**：保留默认行为；新增对「裸字符串 + `Content-Type: text/plain`」请求的旁路：
  - 当调用方显式传入 `headers['Content-Type'] === 'text/plain'` 且 `data` 已是 string 时，跳过 `Qs.stringify`，直接以原字符串发送。
  - 不影响其他调用点（FormData 透传、form-urlencoded 默认行为不变）。
- **差异**：新增旁路逻辑；原有调用全部不破坏。
- **对应 api.md**：§2、EP-RES-004。

#### FR-101-TRX-02 ROT13(Base64) 编码工具

- **现状**：fork 包内不存在加密工具。
- **目标**：在 `src/api/request.js` 旁新增纯函数 `rot13b64Encode(jsonString)` 与 `rot13b64Decode(input)`：
  - 算法严格匹配后端 `ROT13Utils`（utf8 → base64 → ROT13；逆向去引号、ROT13 自反、base64 解、utf8 解）。
  - 仅在 EP-RES-004 调用点使用；不挂载到全局；不强制其他端点使用。
- **差异**：新增；不影响现有逻辑。
- **对应 api.md**：§2.2、§2.3。

#### FR-101-TRX-03 鉴权头透传不变

- **现状**：宿主 `magic-editor.vue:beforeMount` 通过 `request.getAxios().interceptors.request.use` 注入 `Authorization: Bearer <sa-token>`；fork 包内未硬编码鉴权字符串。
- **目标**：保持 `request.js` 不主动设置 `Authorization`；保留对 `magic-token` 头的现有读写（用于登录端点设置/读取，参考 EP-WB-005）；不与宿主拦截器冲突。
- **差异**：仅做回归保证。
- **对应 api.md**：§1.2。

### 3.2 资源树（FR-101-RES）

> 替代 1.x 的 5 次 list 请求与若干 CRUD 端点。详细端点定义见 api.md §3.2。

| FR | 现状（1.x 调用） | 目标（2.2.2 端点） | 差异 |
|---|---|---|---|
| FR-101-RES-01 | `GET group/list?type=1` + `GET list` + `GET function/list` + `GET datasource/list` + `GET group/list?type=2`（5 次） | EP-RES-001 `POST /resource`（1 次） | 5 → 1；前端按 folder key 拆分到 api/function/datasource/task/component |
| FR-101-RES-02 | `POST group/create` / `POST group/update` | EP-RES-002 `POST /resource/folder/save` | 合并为 upsert；body=JSON Group |
| FR-101-RES-03 | `POST group/copy`（form `src, target`） | EP-RES-003 `POST /resource/folder/copy` | URL 变更；参数不变 |
| FR-101-RES-04 | `POST save` / `POST function/save` / `POST datasource/save`（form 表单） | EP-RES-004 `POST /resource/file/{folder}/save` | URL 合并；body 改为 ROT13(Base64(JSON))；`Content-Type: text/plain` |
| FR-101-RES-05 | `GET get?id=` / `GET function/get?id=` / `GET datasource/detail?id=` | EP-RES-005 `GET /resource/file/{id}` | 合并；id 移入路径 |
| FR-101-RES-06 | `POST delete`（form `id`）/ `POST group/delete`（form `groupId`） | EP-RES-006 `POST /resource/delete`（form `id`） | URL 变更；分组与文件统一参数名 `id` |
| FR-101-RES-07 | `POST api/move` / `POST function/move`（form `id, groupId`） | EP-RES-007 `POST /resource/move`（form `src, groupId`） | URL 合并；参数 `id` → `src` |
| FR-101-RES-08 | `POST lock`（form `id`） | EP-RES-008 `POST /resource/lock` | 仅 URL 变更 |
| FR-101-RES-09 | `POST unlock`（form `id`） | EP-RES-009 `POST /resource/unlock` | 仅 URL 变更 |

**FR-101-RES-01 增补约束**：
- 树构造逻辑：1.x 中各列表组件（`magic-api-list.vue` / `magic-function-list.vue` / `magic-datasource-list.vue`）独立请求各自分组与文件并组装树；2.2.2 改为统一缓存 `POST /resource` 响应，由各列表组件按 folder key 取出对应子树渲染。
- 缓存与刷新：编辑器初始化、保存/删除/移动/复制/重命名等任意写操作完成后均触发一次 `POST /resource` 重新加载，刷新所有列表组件（保持 1.x 既有的「写后整树刷新」语义）。

### 3.3 备份（FR-101-BAK）

| FR | 现状 | 目标 | 差异 |
|---|---|---|---|
| FR-101-BAK-01 | `GET backups?timestamp=` | EP-BAK-001 `GET /backups` | 不变 |
| FR-101-BAK-02 | `GET backups?id=<id>` | EP-BAK-002 `GET /backup/{id}` | id 进路径 |
| FR-101-BAK-03 | `GET backup/get?timestamp=&id=` | EP-BAK-003 `GET /backup?timestamp=&id=` | 路径去 `/get` |
| FR-101-BAK-04 | `POST backup/rollback`（form `id, timestamp`） | EP-BAK-004 `POST /backup/rollback` | 不变 |
| FR-101-BAK-05 | `POST backup/full` | EP-BAK-005 `POST /backup/full` | 不变 |

### 3.4 数据源连通性（FR-101-DS）

#### FR-101-DS-01 测试连通性改 JSON

- **现状**：`POST datasource/test`，form-urlencoded（与其它表单端点一致）。
- **目标**：`POST /datasource/jdbc/test`，`Content-Type: application/json`，body 为 `DataSourceInfo` 完整对象（参考 api.md §3.4）。
- **差异**：URL + 序列化方式；前端调用点需绕开 axios 默认 `Qs.stringify`，显式传 JSON 字符串与 `Content-Type: application/json`。

### 3.5 工作台 / 鉴权 / 配置（FR-101-WB）

| FR | 现状 | 目标 | 差异 |
|---|---|---|---|
| FR-101-WB-01 | `POST /todo` | EP-WB-012 `GET /todo` | 方法 POST → GET |
| FR-101-WB-02 | `GET /config.json` | EP-WB-001 `GET /config.json` | 不变；前端需容忍响应壳新增字段 `executeTime` |
| FR-101-WB-03 | `GET /classes.txt`、`POST /classes`、`POST /class` | EP-WB-002 / 003 / 004 | 不变 |
| FR-101-WB-04 | `POST /login` / `POST /logout` / `POST /user` | EP-WB-005 / 007 / 006 | 不变；登录响应 `magic-token` 头读取沿用 |
| FR-101-WB-05 | `GET /plugins` | EP-WB-008 | 不变 |
| FR-101-WB-06 | `* /options` | EP-WB-009 | 不变 |
| FR-101-WB-07 | `GET /reload` | EP-WB-010 | 不变 |
| FR-101-WB-08 | `POST /search` | EP-WB-011 | 不变 |
| FR-101-WB-09 | `* /config-js` | EP-WB-013 | 不变 |
| FR-101-WB-10 | `* /download`、`* /upload`、`* /push` | EP-WB-014 / 015 / 016 | 不变 |

### 3.6 响应壳兼容（FR-101-WB-11）

- **现状**：`processResult` 处理 `JsonBean<T>` 的 `code/message/data`；对未知顶层字段有宽容性但未明确测试。
- **目标**：明确容忍 `JsonBean.executeTime`（2.2.2 新增），不参与判断、不抛错、不打 warning。
- **差异**：仅对响应解析逻辑做回归保证。
- **对应 api.md**：§1.3。

---

## 4. 现状调用点矩阵（27 处）

> 用于 plan.md / tasks.md 直接消费。每行 = fork 包内一处 `request.send` 调用，列出需要替换的目标端点编号。

| # | 文件 | 行（约） | 1.x URL / 方法 | 目标 FR | 目标端点 |
|---|---|---|---|---|---|
| 1 | `src/scripts/utils.js` | 45-50 | `requestGroup(type)` → `group/list?type=N` | FR-101-RES-01 | EP-RES-001 |
| 2 | `src/components/resources/magic-api-list.vue` | 列表加载 | `GET list` | FR-101-RES-01 | EP-RES-001 |
| 3 | 同上 | 删除文件 | `POST delete` | FR-101-RES-06 | EP-RES-006 |
| 4 | 同上 | 删除分组 | `POST group/delete` | FR-101-RES-06 | EP-RES-006 |
| 5 | 同上 | 锁 | `POST lock` | FR-101-RES-08 | EP-RES-008 |
| 6 | 同上 | 解锁 | `POST unlock` | FR-101-RES-09 | EP-RES-009 |
| 7 | 同上 | 移动 | `POST api/move` | FR-101-RES-07 | EP-RES-007 |
| 8 | 同上 | 复制分组 | `POST group/copy` | FR-101-RES-03 | EP-RES-003 |
| 9 | 同上 | 导出 | `* /download` | FR-101-WB-10 | EP-WB-014 |
| 10 | `src/components/resources/magic-function-list.vue` | 列表加载 | `GET function/list` | FR-101-RES-01 | EP-RES-001 |
| 11 | `src/components/resources/magic-datasource-list.vue` | 列表加载 | `GET datasource/list` | FR-101-RES-01 | EP-RES-001 |
| 12 | 同上 | 详情 | `GET datasource/detail` | FR-101-RES-05 | EP-RES-005 |
| 13 | 同上 | 测试连接 | `POST datasource/test` | FR-101-DS-01 | EP-DS-001 |
| 14 | 同上 | 保存 | `POST datasource/save` | FR-101-RES-04 | EP-RES-004 |
| 15 | 同上 | 删除 | `POST delete` | FR-101-RES-06 | EP-RES-006 |
| 16 | `src/components/editor/magic-script-editor.vue` | 拉取 | `GET get?id=` / `GET function/get?id=` | FR-101-RES-05 | EP-RES-005 |
| 17 | 同上 | 保存 API | `POST save` | FR-101-RES-04 | EP-RES-004 |
| 18 | 同上 | 保存函数 | `POST function/save` | FR-101-RES-04 | EP-RES-004 |
| 19 | 同上 | 备份列表 | `GET backups?id=` | FR-101-BAK-02 | EP-BAK-002 |
| 20 | `src/components/layout/magic-header.vue` | 重载 | `GET /reload` | FR-101-WB-07 | EP-WB-010 |
| 21 | `src/components/layout/magic-search.vue` | 搜索 | `POST /search` | FR-101-WB-08 | EP-WB-011 |
| 22 | `src/components/layout/magic-login.vue` | 登录 | `POST /login` | FR-101-WB-04 | EP-WB-005 |
| 23 | 同上 | 当前用户 | `POST /user` | FR-101-WB-04 | EP-WB-006 |
| 24 | 同上 | 登出 | `POST /logout` | FR-101-WB-04 | EP-WB-007 |
| 25 | `src/components/layout/magic-option.vue` | 可选项 | `* /options` | FR-101-WB-06 | EP-WB-009 |
| 26 | `src/components/layout/magic-status-bar.vue` | TODO | `POST /todo` | FR-101-WB-01 | EP-WB-012 |
| 27 | `src/components/layout/magic-group.vue` | 分组保存/复制 | `POST group/create`、`POST group/update`、`POST group/copy` | FR-101-RES-02 / 03 | EP-RES-002 / 003 |

> 行号留空处由 plan.md / tasks.md 在分解时补全；本表的责任边界是「每个调用点都至少对应一个 FR」。

---

## 5. 验收标准（系统级）

> 所有 US 与 FR 的并集；plan.md 的回归用例必须覆盖。

- **AC-101-01**：编辑器初始化网络面板仅出现一次 `POST /resource`，且响应 `code=1`。
- **AC-101-02**：网络面板不再出现以下 1.x 路径：`group/list`、`list`、`function/list`、`datasource/list`、`group/create`、`group/update`、`group/delete`、`save`、`function/save`、`datasource/save`、`get?id=`、`function/get?id=`、`datasource/detail`、`datasource/test`、`api/move`、`function/move`、`backups?id=`、`backup/get`、`POST /todo`。
- **AC-101-03**：API/函数/数据源/任务/组件均能完成「新建 → 编辑 → 保存 → 重新拉取详情 → 删除」全链路；保存请求 body 为 ROT13 字符串，`Content-Type: text/plain`，HTTP 200。
- **AC-101-04**：分组的「新建 → 重命名 → 复制 → 删除 → 移动文件到目标分组」全部成功；删除分组使用 `id` 而非 `groupId`；移动文件参数为 `src, groupId`。
- **AC-101-05**：数据源「测试连接」请求 `Content-Type: application/json`，body 为 `DataSourceInfo` JSON；后端返回 `"ok"` 时前端显示成功提示；返回异常 message 时显示失败提示。
- **AC-101-06**：备份页签：`GET /backups`（时间维度）、`GET /backup/{id}`（资源维度）、`GET /backup?timestamp=&id=`（脚本内容）、`POST /backup/rollback` 全部成功；UI 流程不变。
- **AC-101-07**：登录页：`POST /login` 成功后 fork 包从响应头读取 `magic-token`，后续 `POST /user`、`POST /logout` 链路畅通；不影响宿主注入的 `Authorization: Bearer <sa-token>`（两套头共存）。
- **AC-101-08**：工作台 TODO、搜索、可选项、配置 JS、Class 提示、插件、重载、导入导出、推送全部恢复。
- **AC-101-09**：浏览器控制台无未捕获异常；UI 全程可交互不卡死。
- **AC-101-10**：`/magic/console` WebSocket 帧协议在 2.2.2 后端上仍可建立并传输；调试运行链路不回归。

---

## 6. 风险与缓解

| ID | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R-101-01 | ROT13 算法实现不一致（utf8 编码遗漏多字节字符） | 后端解码失败保存出错 | 严格按 `ROT13Utils` 实现：`new TextEncoder().encode` → `btoa`（先转 latin1）→ ROT13；plan.md 中以中文/emoji 用例回归 |
| R-101-02 | axios 默认 `transformRequest` 与 ROT13 字符串冲突 | 保存请求被 `Qs.stringify` 损坏 | FR-101-TRX-01 显式旁路；调用点统一通过封装函数发起 |
| R-101-03 | `POST /resource` 响应 TreeNode 结构与 1.x 列表组件期望的扁平结构不符 | 三个列表组件渲染异常 | FR-101-RES-01 在调用层做一次结构归一化（folder → 该组件预期形态），组件内部尽量不改 |
| R-101-04 | `executeTime` 等响应壳新字段导致 `processResult` 误判 | 业务弹错 | FR-101-WB-11 增加冒烟回归用例 |
| R-101-05 | 鉴权头双写（宿主 `Authorization: Bearer` + fork 包 `magic-token`）后端不接受 | 接口 401 | 仅在登录端点的响应头读取场景使用 `magic-token`，其它请求不主动添加；保持宿主 Bearer 是主鉴权 |
| R-101-06 | 27 处调用点存在遗漏 | 改造完成后仍有 1.x 路径出现 | tasks.md 强制对照 §4 矩阵逐项 checklist；网络面板回归白盒检查 |
| R-101-07 | 命名重命名（`id` → `src`、`groupId` → `id`）造成参数错配 | 操作语义错乱（删错对象） | plan.md 中给出**端点适配函数**集中处理；禁止在组件内裸传参数 |

---

## 7. 假设

- **A-101-01**：宿主部署侧固定 `magic-api.web=/magic/web`；前端 `BASE_URL` 由宿主在 `magic-editor.vue` 注入；fork 包自身不硬编码该值。
- **A-101-02**：宿主 axios 拦截器持续注入 `Authorization: Bearer <sa-token>`；fork 包不接管该职责。
- **A-101-03**：`POST /resource` 一次性返回 api/function/datasource/task/component 全量；前端不再按 type 分多次拉取。
- **A-101-04**：`/resource/file/{folder}/save` 的 ROT13 加密**仅**作用于此一个端点；其他端点（含 `/resource/folder/save`）使用明文 JSON 或 form 表单。
- **A-101-05**：浏览器内 `btoa`/`atob` 与 `TextEncoder` 可用（现代浏览器与 Vite 5 构建产物均支持）。

---

## 8. 不在范围

- 调试/运行 WebSocket 帧协议（沿用 014-infra-transport）。
- monaco / 编辑器内核行为、UI 视觉、状态管理重构。
- 业务用户脚本运行时（`/magic/api/**`）。
- magic-api 后端配置变更（`application.yml`、Sa-Token 策略 — 属于 016）。
- Monaco web worker 加载告警（`Could not create web worker(s)`）— 属于 016 残留任务，不通过本 spec 修复。

---

## 9. 完成定义（DoD）

1. `plan.md` / `tasks.md` 落盘，章节与本 spec FR/AC 编号一一对应。
2. fork 包按 tasks.md 改造完成；`src/api/web.js` 充实为「按端点分组的适配函数集合」；27 处调用点全部切到适配函数。
3. RuoYi 宿主在 `/tool/magic-api` 路由下完整跑通 AC-101-01 ~ AC-101-10。
4. fork 包发版（版本号 + CHANGELOG），宿主 `package.json` 更新至新版。
5. git commit（CRLF 行尾约束，按宿主仓库现有约定）。
