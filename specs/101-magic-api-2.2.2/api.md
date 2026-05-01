# magic-api 2.2.2 后端契约（api.md）

> Module: 101-magic-api-2.2.2
> Status: Reference
> Last Updated: 2026-05-01
> 范围: **仅** magic-editor 前端在运行时需要调用的 HTTP/WebSocket 端点
> 事实源（按权威性排序）：
> 1. magic-api 2.2.2 后端源码 `~/GitHub/fellow99/magic-api/magic-api/src/main/java/org/ssssssss/magicapi/**/*Controller.java`
> 2. magic-api 2.2.2 内置 dist：`~/GitHub/fellow99/magic-api/magic-editor/src/main/resources/magic-editor/assets/app.60f63c60.js`
> 3. magic-api 后端工程 specs：`~/GitHub/fellow99/magic-api/specs/`

---

## 1. 总览

### 1.1 路径前缀

| 前缀 | 来源 | 用途 |
|---|---|---|
| `/magic/web/` | `MagicAPIProperties.web`，部署时由 RuoYi 注入为 `/magic/web` | 编辑器后台 API（资源管理、登录、配置、备份、推送等） |
| `/magic/console/` | `MagicAPIProperties` WebSocket 路径 | 调试/日志 WebSocket（不在本规范变更范围内，沿用） |
| 业务前缀 | `MagicAPIProperties.prefix`，默认 `/magic/api` | 用户编写的 API 自身的运行时路径（非编辑器调用） |

> 编辑器前端的 `BASE_URL` 在 magic-editor 中由宿主注入（`src/scripts/contants.js`），所有相对路径均挂在 `/magic/web/` 下。本文档下文路径均省略 `/magic/web/` 前缀。

### 1.2 鉴权

| 项 | 值 | 说明 |
|---|---|---|
| Header 名 | `magic-token` | `Constants.MAGIC_TOKEN_HEADER`（后端） / `HEADER_MAGIC_TOKEN`（前端） |
| Header 初值 | `unauthorization` | 未登录态默认值 |
| 注入策略 | 由宿主（`magic-editor.vue:beforeMount`）通过 `request.getAxios().interceptors` 注入 | RuoYi 项目内为 `Bearer <sa-token>` |

### 1.3 通用响应壳

后端所有 `@ResponseBody` 接口（除流式下载与 `/classes.txt`、`/config-js`）统一返回 `JsonBean<T>`：

```json
{
  "code": 1,
  "message": "success",
  "data": <T>,
  "timestamp": 1746086400000,
  "executeTime": 12        // 2.2.2 新增字段，编辑器无需消费但需容忍
}
```

| code | 语义 | 处理 |
|---|---|---|
| `1` | 成功 | `successHandle(data.data, response)` |
| `401` | 未登录 | `bus.$emit('showLogin')`，`processResult` 既有逻辑 |
| `0` / 其他 | 业务异常 | `exceptionHandle(code, message, response)` |
| `1000` | 断点命中（调试） | 由消费方在 `successHandle` 内自行判定 |
| `-1000` | 脚本错误 | 走 `exceptionHandle` |
| `-10` | 无权限 | 走 `exceptionHandle` |

### 1.4 与 1.x（@fellow99/magic-editor@3.0.0 当前版本）的总体差异

| 维度 | 1.x（旧） | 2.2.2（新） |
|---|---|---|
| 资源拓扑 | 三类（API/Function/DataSource）独立端点 | 统一资源树（`POST /resource`） |
| 分组模型 | `group/list?type=1\|2`、`group/create`、`group/update`、`group/delete`、`group/copy` | 文件夹模型：`/resource/folder/save`、`/resource/folder/copy` 与文件共用 `/resource/delete`、`/resource/move` |
| 文件保存 | 按类型分散：`/save`、`/function/save`、`datasource/save` | 统一：`POST /resource/file/{folder}/save`，**body 经 ROT13(Base64) 加密** |
| 文件详情 | `get?id=`、`function/get?id=`、`datasource/detail` | 统一：`GET /resource/file/{id}` |
| 删/锁/解锁/移动 | `delete`、`lock`、`unlock`、`api/move`、`function/move` | 统一：`/resource/delete`、`/resource/lock`、`/resource/unlock`、`/resource/move` |
| 备份按 ID | `backups?id=` | `GET /backup/{id}` |
| 备份脚本拉取 | `backup/get` | `GET /backup?timestamp=&id=` |
| TODO 列表 | `POST /todo` | `GET /todo` |
| 数据源连通性 | `datasource/test` | `POST /datasource/jdbc/test`（`@RequestBody DataSourceInfo`） |
| 加密 | 无 | 仅文件保存请求体应用 ROT13(Base64) |

---

## 2. ROT13(Base64) 加密协议（关键）

### 2.1 来源

后端工具类：`org.ssssssss.magicapi.utils.ROT13Utils`
后端调用点：`org.ssssssss.magicapi.core.web.MagicResourceController`，仅作用于 `POST /resource/file/{folder}/save` 的请求体。

### 2.2 算法

```
encrypt(jsonString):
  1. utf8 = UTF-8 编码 jsonString → bytes
  2. b64  = Base64 编码 bytes → ASCII 字符串
  3. rot13 = 对 b64 的每个字符执行 ROT13:
       'A'..'Z' 与 'a'..'z' 旋转 13 位，其他字符（含 '+' '/' '=' 数字）不变
  4. 返回 rot13 字符串

decrypt(input):
  1. 去除首尾的双引号（若存在）
  2. 反向 ROT13（与编码同算法，自反）
  3. Base64 解码 → UTF-8 → JSON 字符串
```

### 2.3 报文形态

| 项 | 值 |
|---|---|
| Method | `POST` |
| URL | `/resource/file/{folder}/save`，`{folder}` ∈ `api` \| `function` \| `datasource` \| `task` \| `component` |
| Content-Type | `text/plain` 或 `application/x-www-form-urlencoded`，**body 是裸字符串而非 form / JSON** |
| Body | ROT13(Base64(JSON.stringify(entity))) 字符串 |
| 响应 | `JsonBean<String>`，`data` 为保存后的实体 ID |

### 2.4 前端实现要点（FR 详见 plan.md）

- 仅在 `/resource/file/*/save` 一种端点上启用，其他端点保持明文
- 加密前的 JSON 即原 entity 对象（保留 `script`、`parameters`、`headers` 等全部字段）
- 与 axios 现有 `transformRequest`（FormData 透传 / Qs.stringify）共存：保存请求需绕开 `transformRequest`，直接走 `data: <rot13String>` + 显式 `Content-Type: text/plain`

---

## 3. 端点清单（编辑器使用范围）

> 表中"源码位置"指向 magic-api 后端 controller。请求/响应字段定义参考后端 `org.ssssssss.magicapi.core.model.*` 与 `org.ssssssss.magicapi.datasource.model.DataSourceInfo`。

### 3.1 工作台 / 鉴权 / 配置（`MagicWorkbenchController`）

| ID | 方法 | 路径 | 用途 | 入参 | 响应 data | 源码位置 |
|---|---|---|---|---|---|---|
| EP-WB-001 | GET | `/config.json` | 编辑器启动配置 | 无 | `{persistenceResponseBody, version, web, prefix, autoImportModuleList, autoImportPackage}` | `MagicWorkbenchController.java:80-92` |
| EP-WB-002 | GET | `/classes.txt` | Class 提示文本（压缩） | 无 | `text/plain` 原始字符串 | `MagicWorkbenchController.java:94-107` |
| EP-WB-003 | POST | `/classes` | 全量 class/extension/function 元数据 | 无 | `{classes, extensions, functions}` | `MagicWorkbenchController.java:112-123` |
| EP-WB-004 | POST | `/class` | 单个 class 详情 | form: `className` | `Set<ScriptClass>` | `MagicWorkbenchController.java:130-137` |
| EP-WB-005 | POST | `/login` | 登录 | form: `username, password` | `Boolean`（成功置 `magic-token` 响应头） | `MagicWorkbenchController.java:142-160` |
| EP-WB-006 | POST | `/user` | 当前用户 | 无（依赖 `magic-token` 头） | `MagicUser` | `MagicWorkbenchController.java:162-173` |
| EP-WB-007 | POST | `/logout` | 登出 | 无 | `Void` | `MagicWorkbenchController.java:175-181` |
| EP-WB-008 | GET | `/plugins` | 已注册插件列表 | 无 | `List<Plugin>` | `MagicWorkbenchController.java:183-188` |
| EP-WB-009 | * | `/options` | 编辑器可选项目枚举 | 无 | `List<List<String>>`，每项 `[value, name, defaultValue]` | `MagicWorkbenchController.java:191-196` |
| EP-WB-010 | GET | `/reload` | 重新加载资源（需 `RELOAD` 权限） | 无 | `Boolean` | `MagicWorkbenchController.java:198-204` |
| EP-WB-011 | POST | `/search` | 全量脚本关键字搜索 | form: `keyword` | `List<{id, text, line}>` | `MagicWorkbenchController.java:206-229` |
| EP-WB-012 | **GET** | `/todo` | TODO/FIXME 注释扫描 | 无 | `List<{id, text, line}>` | `MagicWorkbenchController.java:231-259` |
| EP-WB-013 | * | `/config-js` | 编辑器自定义 JS 配置 | 无 | `application/javascript` 文本 | `MagicWorkbenchController.java:261-286` |
| EP-WB-014 | * | `/download` | 导出 zip | query: `groupId`；body（可选）: `List<SelectedResource>` JSON | `application/octet-stream` | `MagicWorkbenchController.java:288-305` |
| EP-WB-015 | * | `/upload` | 导入 zip | multipart: `file, mode` | `Boolean` | `MagicWorkbenchController.java:307-317` |
| EP-WB-016 | * | `/push` | 推送到目标实例 | headers: `magic-push-target/secret-key/mode`；body: `List<SelectedResource>` JSON | 透传被推送方 `JsonBean` | `MagicWorkbenchController.java:319-327` |

> EP-WB-009 / EP-WB-013 / EP-WB-014 / EP-WB-015 / EP-WB-016 使用 `@RequestMapping`（不限方法），编辑器前端均按 1.x 既有方式发起。

### 3.2 资源树（`MagicResourceController`，路径前缀 `/resource`）

| ID | 方法 | 路径 | 用途 | 入参 | 响应 data |
|---|---|---|---|---|---|
| EP-RES-001 | POST | `/resource` | **统一资源树**（替代 1.x 五个 list 端点） | 无 | `{api: TreeNode<Group>, function: TreeNode<Group>, datasource: List<Datasource>}`（最外层 key 为各 `MagicResourceStorage.folder()`） |
| EP-RES-002 | POST | `/resource/folder/save` | 保存（新建/修改）分组 | JSON: `Group{id?, name, path, parentId, type, properties, paths, options}` | 分组 `id` |
| EP-RES-003 | POST | `/resource/folder/copy` | 复制分组到目标 | form: `src, target` | 新分组 `id` |
| EP-RES-004 | POST | `/resource/file/{folder}/save` | **保存文件（API/Function/DataSource/Task/Component）** | body: **ROT13(Base64(entity JSON))**；`{folder}` 取值见 §2.3 | 文件 `id` |
| EP-RES-005 | GET | `/resource/file/{id}` | 文件详情（替代 1.x `get?id=`、`function/get?id=`、`datasource/detail`） | path: `id` | `MagicEntity` 子类（`ApiInfo` / `FunctionInfo` / `DataSourceInfo` / `TaskInfo` / `ComponentInfo`） |
| EP-RES-006 | POST | `/resource/delete` | 删除文件或分组 | form: `id` | `Boolean` |
| EP-RES-007 | POST | `/resource/move` | 移动文件到分组 | form: `src`（文件 id）, `groupId`（目标分组 id） | `Boolean` |
| EP-RES-008 | POST | `/resource/lock` | 锁定文件 | form: `id` | `Boolean` |
| EP-RES-009 | POST | `/resource/unlock` | 解锁文件 | form: `id` | `Boolean` |

> **关键变更**
> - 1.x 的 `group/list?type=1`、`list`、`group/list?type=2`、`function/list`、`datasource/list` 五次请求合并为 EP-RES-001 一次。
> - 1.x 的 `group/copy` 携带的 `{src, target}` 直接复用到 EP-RES-003。
> - 1.x 的 `api/move`、`function/move` 合并到 EP-RES-007，参数名由 `id, groupId` 改为 `src, groupId`。
> - 删除接口由 1.x 的 `POST delete`（form: `id`）保留语义，URL 改为 `/resource/delete`。
> - 锁/解锁同上。

### 3.3 备份（`MagicBackupController`）

| ID | 方法 | 路径 | 用途 | 入参 | 响应 data | 源码位置 |
|---|---|---|---|---|---|---|
| EP-BAK-001 | GET | `/backups` | 时间维度备份列表 | query: `timestamp?`（默认当前时间） | `List<Backup>` | `MagicBackupController.java:33-40` |
| EP-BAK-002 | GET | `/backup/{id}` | 按资源 ID 列出其备份历史 | path: `id` | `List<Backup>` | `MagicBackupController.java:42-49` |
| EP-BAK-003 | GET | `/backup` | 单个备份点的脚本内容 | query: `timestamp, id` | `String`（脚本内容） | `MagicBackupController.java:77-86` |
| EP-BAK-004 | POST | `/backup/rollback` | 回滚到指定备份点 | form: `id, timestamp` | `Boolean` | `MagicBackupController.java:51-75` |
| EP-BAK-005 | POST | `/backup/full` | 主动全量备份 | 无 | `Boolean` | `MagicBackupController.java:88-94` |

> **关键变更**
> - 1.x `backups?id=<id>` → EP-BAK-002 `GET /backup/{id}`（id 移到 PathVariable）。
> - 1.x `backup/get?timestamp=&id=` → EP-BAK-003 `GET /backup?timestamp=&id=`（路径去掉 `/get`）。

### 3.4 数据源连通性（`MagicDataSourceController`）

| ID | 方法 | 路径 | 用途 | 入参 | 响应 data | 源码位置 |
|---|---|---|---|---|---|---|
| EP-DS-001 | * | `/datasource/jdbc/test` | JDBC 连通性测试 | **JSON body**: `DataSourceInfo{driverClassName, url, username, password, ...}` | `String`（`"ok"` 或异常 message） | `MagicDataSourceController.java:21-31` |

> **关键变更**：1.x 的 `datasource/test`（form 表单）→ EP-DS-001 `/datasource/jdbc/test`，且后端使用 `@RequestBody`，**前端必须以 JSON 形式提交**，而非 form-urlencoded。

### 3.5 不在本规范变更范围（沿用 1.x 现状）

- 调试/日志 WebSocket（`/magic/console`）— magic-api 2.2.2 协议未变
- 业务 API 调用（`/magic/api/**`）— 用户脚本运行时端点，编辑器仅作 URL 拼接

---

## 4. 关键数据模型（消费方需识别）

### 4.1 资源树节点（EP-RES-001 响应）

```jsonc
{
  "api": {
    "node": { /* 根分组，通常为虚拟根 */ },
    "children": [
      {
        "node": { "id": "...", "name": "...", "path": "...", "parentId": "0", "type": "1", ... },
        "children": [ /* 子分组 */ ]
      }
    ],
    "files": [
      // 该分组下的文件元信息（仅元数据，不含 script）
      { "id": "...", "name": "...", "path": "...", "method": "GET", "lock": "0", "groupId": "...", ... }
    ]
  },
  "function": { /* 同结构 */ },
  "datasource": { /* 同结构，files 即 DataSourceInfo 元信息列表 */ }
}
```

> 实际字段以 `org.ssssssss.magicapi.core.model.TreeNode` + `Group` + 各 `MagicEntity` 子类为准。前端只需保证「分组在前，文件在后」的渲染契约不变。

### 4.2 文件实体（EP-RES-004 入参 / EP-RES-005 响应）

| 折叠键 `{folder}` | 实体类 | 关键字段 |
|---|---|---|
| `api` | `ApiInfo` | `id, name, groupId, method, path, script, parameters, headers, paths, requestBody, requestBodyDefinition, responseBody, responseBodyDefinition, options, description, ...` |
| `function` | `FunctionInfo` | `id, name, groupId, path, script, parameters, returnType, ...` |
| `datasource` | `DataSourceInfo` | `id, name, key, type, driverClassName, url, username, password, properties, ...` |
| `task` | `TaskInfo` | `id, name, groupId, cron, script, ...` |
| `component` | `ComponentInfo` | `id, name, groupId, script, ...` |

### 4.3 备份 `Backup`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 资源 ID（或 `"full"` 表示全量备份） |
| `name` | string | 备份名称（含描述） |
| `tag` | string | 操作描述（如 "保存前自动备份"） |
| `type` | string | `api` / `function` / `datasource` / `task` / `component` / `*-group` / `full` |
| `createDate` | long | 时间戳 |
| `createBy` | string | 操作人 |
| `content` | byte[] | 备份内容字节（EP-BAK-004 内部使用，列表接口通常不返回） |

---

## 5. 端点映射对照表（1.x → 2.2.2）

> 供 plan.md / tasks.md 直接消费。"前端调用源"列示意 magic-editor 1.x 中发起调用的位置类型。

| 1.x 端点 | 1.x 入参 | 2.2.2 端点 | 2.2.2 入参 | 备注 |
|---|---|---|---|---|
| `GET group/list?type=1` | - | `POST /resource` | - | 5 个 list 合并为 1 |
| `GET list` | - | `POST /resource` | - | 同上 |
| `GET function/list` | - | `POST /resource` | - | 同上 |
| `GET datasource/list` | - | `POST /resource` | - | 同上 |
| `GET group/list?type=2` | - | `POST /resource` | - | 同上 |
| `POST group/create` | JSON Group | `POST /resource/folder/save` | JSON Group（无 id） | 合并 create/update |
| `POST group/update` | JSON Group | `POST /resource/folder/save` | JSON Group（含 id） | 同上 |
| `POST group/delete` | form: `groupId` | `POST /resource/delete` | form: `id` | 参数名 `groupId` → `id` |
| `POST group/copy` | form: `src, target` | `POST /resource/folder/copy` | form: `src, target` | URL 变更 |
| `POST save` | form: entity 字段 | `POST /resource/file/api/save` | **ROT13(Base64(entity JSON))** | 加密 |
| `POST function/save` | form | `POST /resource/file/function/save` | ROT13(Base64) | 加密 |
| `POST datasource/save` | form | `POST /resource/file/datasource/save` | ROT13(Base64) | 加密 |
| `GET get?id=` | query: `id` | `GET /resource/file/{id}` | path: `id` | id 移入路径 |
| `GET function/get?id=` | query: `id` | `GET /resource/file/{id}` | path: `id` | 合并 |
| `GET datasource/detail?id=` | query: `id` | `GET /resource/file/{id}` | path: `id` | 合并 |
| `POST delete` | form: `id` | `POST /resource/delete` | form: `id` | URL 变更 |
| `POST lock` | form: `id` | `POST /resource/lock` | form: `id` | URL 变更 |
| `POST unlock` | form: `id` | `POST /resource/unlock` | form: `id` | URL 变更 |
| `POST api/move` | form: `id, groupId` | `POST /resource/move` | form: `src, groupId` | URL & 参数名变更 |
| `POST function/move` | form: `id, groupId` | `POST /resource/move` | form: `src, groupId` | 合并 |
| `GET backups?id=<id>` | query: `id` | `GET /backup/{id}` | path: `id` | id 移入路径 |
| `GET backup/get?timestamp=&id=` | query | `GET /backup?timestamp=&id=` | query | 路径去 `/get` |
| `POST backup/rollback` | form | `POST /backup/rollback` | form | 不变 |
| `POST datasource/test` | form | `POST /datasource/jdbc/test` | **JSON body** `DataSourceInfo` | URL & 序列化方式变更 |
| `POST /todo` | - | `GET /todo` | - | 方法变更 |

---

## 6. 假设与风险

- **假设 A1**：`magic-api.web` 在部署侧固定为 `/magic/web`，前端 `BASE_URL` 由宿主注入；本规范不试图在 fork 包内硬编码该值。
- **假设 A2**：`POST /resource` 一次返回 api/function/datasource/task/component 全部资源；编辑器 1.x 中的"按 type 分别加载"在 2.2.2 中改由前端按 folder key 拆分。
- **假设 A3**：ROT13 加密**仅**作用于 `/resource/file/*/save`；其他端点（含 `/resource/folder/save`）使用明文 JSON 或 form 表单。已对照后端 `MagicResourceController` 全量方法核验。
- **风险 R1**：后端 `JsonBean.executeTime` 字段在 1.x 中不存在；前端 1.x 的 `processResult` 对未知顶层字段宽容，理论上不阻塞，但需要在改造后回归确认。
- **风险 R2**：`POST /resource` 响应的 `TreeNode` 结构与 1.x 的"扁平 list + 前端组装树"语义不同；现有 `magic-api-list.vue` / `magic-function-list.vue` / `magic-datasource-list.vue` 的树构造逻辑需要适配（plan.md 中处理）。
- **风险 R3**：`Content-Type: text/plain` 与现有 axios 默认 `application/x-www-form-urlencoded` 配置冲突；`transformRequest` 必须放行 ROT13 字符串而非 `Qs.stringify`。

---

## 7. 不在本文档范围

- 调试/运行 WebSocket 帧协议（沿用 014-infra-transport spec）
- monaco/编辑器内核行为
- 业务用户编写的 API 自身的请求/响应（属于 `/magic/api/**`，与编辑器无关）
- magic-api 后端配置（`application.yml`）—— 见上游 `~/GitHub/fellow99/magic-api/specs/`
