# Plan 101 — `@fellow99/magic-editor` 调用层渐进替换

**目标**：按 spec.md 的 FR-101-* 完成 fork 包改造，对接 magic-api 2.2.2 后端契约。
**基本策略**：保留 Vue 组件 / monaco / 布局；仅在「调用层」做集中改造，组件内仅替换调用入口与必要的响应结构归一化，不重写 UI。
**文档关系**：本文件回答 HOW；端点字段对照见 `api.md`，需求与验收见 `spec.md`，原子任务见 `tasks.md`。

---

## 1. 总体方案

### 1.1 分层重构

```
┌──────────────────────────────────────────────────────┐
│ 组件层 (src/components/**)                            │
│   仅调用 web.js 暴露的命名函数；不再硬编码 URL          │
└──────────────┬───────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────┐
│ 端点适配层 (src/api/web.js)  ← 本次改造主战场           │
│   每个 EP-* 一个命名导出函数；                          │
│   集中处理参数命名映射（id ↔ src 等）、响应结构归一化      │
└──────────────┬───────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────┐
│ 传输层 (src/api/request.js)                          │
│   axios 默认行为不变；                                 │
│   新增 text/plain 旁路；                              │
│   新增 ROT13(Base64) 工具函数（同文件或 src/api/codec.js）│
└──────────────────────────────────────────────────────┘
```

### 1.2 新增/调整文件

| 文件 | 角色 | 动作 |
|---|---|---|
| `src/api/request.js` | 传输层 | 修改：新增 text/plain 旁路；保留默认行为 |
| `src/api/codec.js` | ROT13(Base64) 工具 | 新增（独立文件以便单测） |
| `src/api/web.js` | 端点适配层 | 充实：按 EP-* 编排命名函数 |
| `src/scripts/utils.js` | 资源树聚合 | 修改：`requestGroup` 改为基于缓存的 folder 取出 |
| `src/components/resources/magic-api-list.vue` | 组件层 | 修改：调用点替换、树构造适配 |
| `src/components/resources/magic-function-list.vue` | 组件层 | 修改：同上 |
| `src/components/resources/magic-datasource-list.vue` | 组件层 | 修改：同上 |
| `src/components/editor/magic-script-editor.vue` | 组件层 | 修改：保存/拉取/备份调用点 |
| `src/components/layout/magic-{header,group,login,option,search,status-bar}.vue` | 组件层 | 修改：调用点替换 |

### 1.3 渐进顺序

按依赖反向：传输层 → 端点适配层 → 组件层。每一步都可独立通过「冒烟」验证（详见 §6），降低集成风险。

---

## 2. 传输层（FR-101-TRX）

### 2.1 ROT13(Base64) 工具（FR-101-TRX-02）

新增 `src/api/codec.js`：

```js
// src/api/codec.js
function rot13(str) {
  let out = ''
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c >= 0x41 && c <= 0x5a) {
      out += String.fromCharCode(((c - 0x41 + 13) % 26) + 0x41)
    } else if (c >= 0x61 && c <= 0x7a) {
      out += String.fromCharCode(((c - 0x61 + 13) % 26) + 0x61)
    } else {
      out += String.fromCharCode(c)
    }
  }
  return out
}

function utf8ToLatin1(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

export function rot13b64Encode(jsonString) {
  const bytes = new TextEncoder().encode(jsonString)
  const b64 = btoa(utf8ToLatin1(bytes))
  return rot13(b64)
}

export function rot13b64Decode(input) {
  const trimmed = String(input).replace(/^"|"$/g, '')
  const b64 = rot13(trimmed)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}
```

**约束**：
- 严格匹配后端 `ROT13Utils`：utf8 → base64 → ROT13；逆向先去引号。
- 多字节字符（中文、emoji）必须经 `TextEncoder` 后再 `btoa`，不能直接 `btoa(jsonString)`。
- 仅在 EP-RES-004 调用点使用；不挂全局；不上 axios 拦截器。

### 2.2 axios 旁路 text/plain（FR-101-TRX-01）

修改 `src/api/request.js` 的 `transformRequest`：

```js
transformRequest: [
  function (data, headers) {
    if (data instanceof FormData) return data
    const ct = headers && (headers['Content-Type'] || headers['content-type'])
    if (typeof data === 'string' && (ct === 'text/plain' || ct === 'application/json')) {
      return data
    }
    return Qs.stringify(data, { arrayFormat: 'repeat', allowDots: true })
  }
]
```

**约束**：
- 默认 `application/x-www-form-urlencoded` + `Qs.stringify` 行为保持不变。
- 当上层显式指定 `text/plain` 或 `application/json` 且 `data` 已是字符串时，跳过 stringify。
- 不修改 `paramsSerializer`（GET query 序列化）。

### 2.3 鉴权头（FR-101-TRX-03）

不动 `request.js` 中的 `HEADER_MAGIC_TOKEN` 写入逻辑（登录后续读响应头依赖它）。宿主 axios 拦截器注入的 `Authorization: Bearer` 与 `magic-token` 头共存——后端在 2.2.2 中均能识别，不冲突。

---

## 3. 端点适配层（`src/api/web.js`）

### 3.1 设计

- 每个 EP-* 对应一个命名导出，函数签名贴合调用方语义而非贴合 URL。
- 函数返回 `request.send(...)` 的 `HttpResponse` 链式对象，调用方继续用 `.success(...).exception(...).end(...)`。
- 集中处理：URL、HTTP method、参数名映射、ROT13 编码、`Content-Type` 设置、响应结构归一化。

### 3.2 函数清单

| 导出名 | EP-* | 备注 |
|---|---|---|
| `loadResourceTree()` | EP-RES-001 | 一次性返回 `{api, function, datasource, task, component}`；调用方按 folder 取 |
| `saveFolder(group)` | EP-RES-002 | upsert；body=JSON Group |
| `copyFolder(src, target)` | EP-RES-003 | form |
| `saveFile(folder, entity)` | EP-RES-004 | **此函数封装 ROT13**；`folder ∈ {api, function, datasource, task, component}` |
| `getFile(id)` | EP-RES-005 | path 参数 |
| `deleteResource(id)` | EP-RES-006 | 文件与分组共用；参数名固定 `id` |
| `moveResource(src, groupId)` | EP-RES-007 | 注意参数 `src` 而非 `id` |
| `lockFile(id)` | EP-RES-008 | |
| `unlockFile(id)` | EP-RES-009 | |
| `listBackupsByTime(timestamp)` | EP-BAK-001 | |
| `listBackupsById(id)` | EP-BAK-002 | path 参数 |
| `getBackupContent(timestamp, id)` | EP-BAK-003 | query |
| `rollbackBackup(id, timestamp)` | EP-BAK-004 | form |
| `fullBackup()` | EP-BAK-005 | |
| `testDatasource(dsInfo)` | EP-DS-001 | **JSON body**；显式 `Content-Type: application/json` |
| `getConfig()` | EP-WB-001 | |
| `getClassesText()` | EP-WB-002 | |
| `getClasses()` | EP-WB-003 | |
| `getClass(className)` | EP-WB-004 | |
| `login(username, password)` | EP-WB-005 | |
| `currentUser()` | EP-WB-006 | |
| `logout()` | EP-WB-007 | |
| `listPlugins()` | EP-WB-008 | |
| `listOptions()` | EP-WB-009 | |
| `reload()` | EP-WB-010 | |
| `searchScript(keyword)` | EP-WB-011 | |
| `listTodo()` | EP-WB-012 | **GET**，注意方法切换 |
| `getConfigJs()` | EP-WB-013 | |
| `download(groupId, selected)` | EP-WB-014 | |
| `upload(file, mode)` | EP-WB-015 | multipart |
| `push(headers, selected)` | EP-WB-016 | |

### 3.3 关键实现样例

**EP-RES-004 文件保存（含 ROT13）**：

```js
import request from './request'
import { rot13b64Encode } from './codec'

export function saveFile(folder, entity) {
  const body = rot13b64Encode(JSON.stringify(entity))
  return request.send(`/resource/file/${folder}/save`, body, {
    method: 'post',
    headers: { 'Content-Type': 'text/plain' }
  })
}
```

**EP-DS-001 数据源测试（JSON body）**：

```js
export function testDatasource(dsInfo) {
  return request.send('/datasource/jdbc/test', JSON.stringify(dsInfo), {
    method: 'post',
    headers: { 'Content-Type': 'application/json' }
  })
}
```

**EP-RES-007 移动资源（参数名映射）**：

```js
export function moveResource(srcId, groupId) {
  // 调用方仍传熟悉的语义；此处映射到后端要求的 src
  return request.send('/resource/move', { src: srcId, groupId }, { method: 'post' })
}
```

**EP-WB-012 TODO（GET）**：

```js
export function listTodo() {
  return request.send('/todo', null, { method: 'get' })
}
```

### 3.4 响应结构归一化

`loadResourceTree()` 内部缓存最近一次响应；同时暴露：

```js
let _treeCache = null
export function loadResourceTree(force = false) {
  if (!force && _treeCache) {
    // 立即把缓存交还给调用方（仍走 HttpResponse 接口，便于组件统一处理）
    return wrapAsHttpResponse(_treeCache)
  }
  return request.send('/resource', null, { method: 'post' })
    .success(data => { _treeCache = data })
}

export function getFolderTree(folder) {
  // folder ∈ 'api' | 'function' | 'datasource' | 'task' | 'component'
  return _treeCache && _treeCache[folder]
}

export function invalidateResourceTree() { _treeCache = null }
```

> `wrapAsHttpResponse` 仅作为内部辅助：保持组件层调用风格统一（不必区分缓存命中与未命中）。具体实现允许在 tasks.md 中替换为更直接的 `Promise.resolve` + 适配，只要组件层签名不破。

---

## 4. 组件层改造

### 4.1 资源列表三件套

- `magic-api-list.vue` / `magic-function-list.vue` / `magic-datasource-list.vue`：
  - 移除自身的 list 请求，改为在挂载/写后回调中调用 `loadResourceTree()`，并通过 `getFolderTree('api' | 'function' | 'datasource')` 取出本组件需要的子树。
  - 树构造逻辑：1.x 中前端组装树的代码改为「读取后端 TreeNode 结构 → 适配为组件原 props」。仅做字段映射；不引入新组件。
  - 删除/锁/解锁/移动/复制 → 改调 `web.js` 对应函数；写后调用 `loadResourceTree(true)` 强刷。

### 4.2 编辑器

- `magic-script-editor.vue`：
  - 拉取详情：调用 `getFile(id)`，根据当前编辑实体类型把响应字段映射到本地 model。
  - 保存：根据当前编辑器类型选择 `folder`，调 `saveFile(folder, entity)`；保存成功后用响应 `data` 写回 `entity.id`，并刷新资源树。
  - 备份页签：列表用 `listBackupsById(id)`、内容用 `getBackupContent(timestamp, id)`、回滚用 `rollbackBackup(id, timestamp)`。

### 4.3 布局/工作台

- `magic-header.vue`：重载 → `reload()`；导入导出推送 → `download/upload/push`。
- `magic-search.vue`：搜索 → `searchScript(keyword)`。
- `magic-login.vue`：登录、当前用户、登出 → `login/currentUser/logout`。
- `magic-option.vue`：→ `listOptions()`。
- `magic-status-bar.vue`：TODO → `listTodo()`（注意：方法 GET，UI 行为不变）。
- `magic-group.vue`：分组创建/重命名/复制 → `saveFolder()` / `copyFolder()`。

### 4.4 `src/scripts/utils.js`

- `requestGroup(type)` 不再发请求；改为 `getFolderTree(typeToFolder(type))` 同步返回缓存数据。
- 调用方若期望异步，封装一层 `await loadResourceTree()` 后再返回 folder 子树。

---

## 5. `processResult` 与响应壳

- 新增字段 `executeTime` 不需要消费；现有 `processResult` 仅看 `code/data/message`，理论无须改动。
- 仍要在回归用例中显式覆盖（见 §6 SMOKE-04）。

---

## 6. 冒烟与回归

### 6.1 冒烟矩阵（按层）

| ID | 范围 | 用例 | 通过条件 |
|---|---|---|---|
| SMOKE-01 | 传输层 | `rot13b64Encode("中文+emoji😀")` 后再 `rot13b64Decode(...)` 应等于原串 | 字节级一致 |
| SMOKE-02 | 传输层 | 任意 form 端点（如 `searchScript`）请求 | 仍以 `application/x-www-form-urlencoded` 发送，参数完整 |
| SMOKE-03 | 端点层 | `loadResourceTree()` | 网络面板仅一次 `POST /resource`，响应 `code=1` |
| SMOKE-04 | 响应壳 | 任意一个返回 `executeTime` 字段的请求 | `processResult` 不告警、不抛错 |
| SMOKE-05 | 端点层 | `saveFile('api', {...})` | 请求体为 ROT13 字符串、`Content-Type: text/plain`、HTTP 200、响应 `data` 为字符串 ID |
| SMOKE-06 | 端点层 | `testDatasource({...})` | `Content-Type: application/json`、body 为 JSON、响应 `"ok"` 或异常 message |
| SMOKE-07 | 组件层 | 资源面板初始渲染 | API/Function/DataSource/Task 列表均有数据；UI 可交互 |
| SMOKE-08 | 组件层 | 新建分组 → 重命名 → 复制 → 删除 → 移动文件 | 全链路 200；操作后树自动刷新 |
| SMOKE-09 | 组件层 | 备份列表/内容/回滚 | 全链路 200；UI 行为不变 |
| SMOKE-10 | 组件层 | 登录/当前用户/登出 | 链路畅通；`Authorization` 与 `magic-token` 头共存 |
| SMOKE-11 | 网络面板 | 全程白盒检查 | 不再出现 spec.md AC-101-02 列表中的任何 1.x 路径 |

### 6.2 工具

- 浏览器侧：`/dev-api/magic/web/**` 网络面板筛选；`window.fetch`/axios 已经统一走 axios 实例。
- 后端侧：保持 pty `pty_6d0400e1`(:8080) 启动；前端 pty `pty_b824d5c0`(:8000)。
- 自动化：playwright 复用 016 阶段的脚本，新增 SMOKE-07 ~ 11 用例。

---

## 7. 回滚策略

- 每个层级独立提交（传输层 → 端点适配层 → 组件层），保证可二分回滚。
- 端点适配层一次性补齐到全量函数，但组件层按文件分批切换；切换中产生的临时双调用（旧路径 + 新路径）允许在单文件提交内并存，由 git history 保证可逐文件回滚。
- fork 包发版以最末次「全部组件切换完成 + 全量冒烟通过」为唯一发版点；中途不发布。

---

## 8. 与 016 / 014 的边界

- 016（RuoYi 集成）：宿主侧 `BASE_URL`、Sa-Token Bearer、SQL menu、路由、Vite proxy。**不在本 plan**。
- 014（infra-transport）：WebSocket 帧协议、调试运行链路。**不在本 plan**，仅做不回归保证。
- Monaco worker 告警：属于 016 残留，不纳入本 plan 修复范围（spec.md §8 已声明）。

---

## 9. 风险与对应

| 风险（spec §6） | plan 对应措施 |
|---|---|
| R-101-01 ROT13 多字节字符 | §2.1 `TextEncoder` + latin1 中转；SMOKE-01 |
| R-101-02 axios `transformRequest` 冲突 | §2.2 显式旁路；调用方统一经 `web.js` 封装 |
| R-101-03 TreeNode 结构差异 | §3.4 在端点适配层归一化；组件改动控制在字段映射 |
| R-101-04 `executeTime` 新字段 | SMOKE-04 显式回归 |
| R-101-05 鉴权头双写 | §2.3 不接管 `Authorization`；只保留登录响应头读取 |
| R-101-06 27 处遗漏 | §4 + tasks.md 强制对照 spec.md §4 矩阵逐项 checklist |
| R-101-07 参数命名错配 | §3.2 函数签名贴语义、内部映射；禁止组件直传 |

---

## 10. 完成定义

- 新增 `src/api/codec.js`、充实 `src/api/web.js`、修改 `src/api/request.js`。
- 27 处调用点全部切到 `web.js` 命名函数；spec.md §4 矩阵全部勾选。
- SMOKE-01 ~ 11 全部通过。
- AC-101-01 ~ 10 全部通过。
- fork 包发版（版本号 + CHANGELOG）；宿主 `package.json` 更新；CRLF 行尾约束按宿主仓库现行约定提交。
