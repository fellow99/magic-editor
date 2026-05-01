# Tasks 101 — `@fellow99/magic-editor` 调用层渐进替换

> 配套：`spec.md`（WHAT/WHY）、`plan.md`（HOW）、`api.md`（事实源）。
> 标记说明：`[P]` 表示该任务与同一阶段内其他 `[P]` 任务**互不冲突、可并行**；无标记者必须串行。
> 路径默认相对仓库根 `~/GitHub/fellow99/magic-editor/`。
> 完成口径：每个任务独立可验证（lint/构建/冒烟），并对照 spec.md §4 调用点矩阵或 §5 AC 勾选。

---

## 阶段 0：脚手架

### T001  创建工作分支与目录占位
- 操作：`git checkout -b feat/101-magic-api-2.2.2`；确认 `specs/101-magic-api-2.2.2/{api,spec,plan,tasks}.md` 已就位。
- 验证：`git status` 干净；四个文档 `wc -l` 均 > 0。
- 依赖：无。

### T002  [P] 准备运行时环境快照
- 操作：记录后端 pty `pty_6d0400e1`(:8080)、前端 pty `pty_b824d5c0`(:8000) 当前可用；记录 RuoYi 宿主当前 `package.json` 中 `@fellow99/magic-editor` 版本。
- 验证：`/magic/web` 可访问；宿主版本号已记录在工作笔记。
- 依赖：无。

---

## 阶段 1：传输层（FR-101-TRX）

### T010  新增 `src/api/codec.js`（ROT13(Base64) 工具）
- 操作：按 plan.md §2.1 落地 `rot13b64Encode` / `rot13b64Decode`；使用 `TextEncoder` + `btoa(latin1)` + ROT13；逆向先剥首尾引号。
- 验证：本地 node REPL 或临时单测：
  - `rot13b64Decode(rot13b64Encode("中文+emoji😀"))` === `"中文+emoji😀"`；
  - 与后端 `ROT13Utils` 对一组 fixture（提取自 magic-api 调试日志）字节级一致。
- 依赖：T001。
- 验收映射：FR-101-TRX-02、SMOKE-01。

### T011  修改 `src/api/request.js`：`transformRequest` 旁路 text/plain & application/json
- 操作：按 plan.md §2.2 改写 `transformRequest`；保留 FormData 透传与默认 `Qs.stringify` 路径。
- 验证：
  - 随便挑一个 form 端点（如 `searchScript`）发请求 → 仍以 `application/x-www-form-urlencoded` + `Qs.stringify` 序列化（SMOKE-02）；
  - 临时构造 `request.send(url, "raw-string", { headers: { 'Content-Type':'text/plain' } })` → 网络面板 body 原样为 `"raw-string"`。
- 依赖：T001。
- 验收映射：FR-101-TRX-01、SMOKE-02。

### T012  [P] 校验鉴权头共存
- 操作：在 fork 包内不动 `HEADER_MAGIC_TOKEN` 注入；走宿主 axios 拦截器注入 `Authorization: Bearer ...`；浏览器请求任意端点。
- 验证：网络面板 Request Headers 同时包含 `Authorization: Bearer ...` 与 `magic-token: ...`，HTTP 200。
- 依赖：T011。
- 验收映射：FR-101-TRX-03、SMOKE-10（部分）。

---

## 阶段 2：端点适配层（`src/api/web.js`）

> 阶段约束：所有任务**集中改写同一文件 `src/api/web.js`**，因此本阶段任务串行（不可 `[P]`），但每个任务粒度小、可独立提交。
> 函数签名见 plan.md §3.2；契约见 api.md。

### T020  搭骨架：导入、缓存、`wrapAsHttpResponse` 占位
- 操作：建立模块骨架 — `import request from './request'`、`import { rot13b64Encode } from './codec'`、内部 `_treeCache`、内部辅助 `wrapAsHttpResponse(data)`（最小可运行实现）；预留每个 EP-* 一个空导出。
- 验证：项目可启动，`import * as web from '@/api/web'` 不报错。
- 依赖：T010、T011。

### T021  实现资源接口：`loadResourceTree` / `getFolderTree` / `invalidateResourceTree`
- 操作：按 plan.md §3.4 实现；缓存命中走 `wrapAsHttpResponse`，未命中走 `POST /resource`。
- 验证：浏览器 console 调用 `loadResourceTree().success(d => ...).end(...)`，network 仅一次 `POST /resource`，`getFolderTree('api')` 返回非空。
- 依赖：T020。
- 验收映射：EP-RES-001、AC-101-04。

### T022  实现 `saveFolder` / `copyFolder` / `deleteResource` / `moveResource` / `lockFile` / `unlockFile`
- 操作：按 EP-RES-002/003/006/007/008/009 落函数；`moveResource(srcId, groupId)` 内部映射到后端字段 `src`。
- 验证：在浏览器 console 逐个触发；HTTP 200；删除/移动后再 `loadResourceTree(true)` 反映变更。
- 依赖：T021。
- 验收映射：FR-101-RES-02/03/06/07/08/09。

### T023  实现 `saveFile` / `getFile`（含 ROT13 调用）
- 操作：按 plan.md §3.3 实现；`saveFile` 编码后 body 走 `text/plain`；`getFile(id)` 走 path 参数。
- 验证：
  - `saveFile('api', sampleEntity)` → request body 为 ROT13 字符串、`Content-Type: text/plain`、响应 `data` 为字符串 ID；
  - `getFile(returnedId)` 拿回原实体，关键字段（path/method/script）一致。
- 依赖：T010、T020。
- 验收映射：EP-RES-004/005、FR-101-RES-04/05、SMOKE-05、AC-101-05。

### T024  实现备份接口：`listBackupsByTime` / `listBackupsById` / `getBackupContent` / `rollbackBackup` / `fullBackup`
- 操作：按 EP-BAK-001~005 落函数；`listBackupsById` 注意 path 参数，`rollbackBackup` form。
- 验证：触发现有备份页签场景；HTTP 200；UI 回显与 1.x 一致。
- 依赖：T020。
- 验收映射：FR-101-BAK-01~05、SMOKE-09。

### T025  实现数据源测试：`testDatasource`（JSON body）
- 操作：按 EP-DS-001 落函数；显式 `Content-Type: application/json` + `JSON.stringify(dsInfo)`。
- 验证：网络面板 Request Headers `Content-Type: application/json`；body 为 JSON 文本；后端返回 `"ok"` 或异常 message（SMOKE-06）。
- 依赖：T011、T020。
- 验收映射：FR-101-DS-01、AC-101-06。

### T026  实现工作台接口（WB 全量 13 个）
- 操作：按 EP-WB-001~015 落函数；`listTodo` 切 GET；`upload` multipart；`download/push` 维持现行 form/JSON 形态（按 api.md）。
- 验证：逐个端点在 console 试调，HTTP 200；`listTodo` 网络面板方法栏显示 `GET`。
- 依赖：T011、T020。
- 验收映射：FR-101-WB-01~15。

### T027  [P] `web.js` 单文件 lint / 构建快检
- 操作：`pnpm -C ~/GitHub/fellow99/magic-editor build`（或当前 dev 流水线等价命令）确认仅 `web.js` 改动不破坏构建。
- 验证：构建成功，无新增 ts/eslint 报错。
- 依赖：T020~T026。

---

## 阶段 3：组件层切换

> 阶段约束：组件文件之间相互独立，标 `[P]` 的任务可并行；同文件内多调用点必须在同一任务里一次性切换以避免双源调用。
> 每个任务在切换完成后**必须**调用 `loadResourceTree(true)` 路径或对应刷新逻辑，并在 PR 描述中勾选 spec.md §4 的对应行。

### T030  [P] 改造 `src/scripts/utils.js:requestGroup`
- 操作：移除 `request.send('/group/list', { type })`；改为 `loadResourceTree()` + `getFolderTree(typeToFolder(type))`；保留同步签名（必要时改 async）。
- 验证：所有调用 `requestGroup` 的页面（资源选择、最近打开、组选择）在初始化时不再发 `/group/list`，仅命中一次 `/resource`。
- 依赖：T021。
- 验收映射：spec.md §4 「`utils.js:46`」行；AC-101-04。

### T031  [P] 改造 `src/components/resources/magic-api-list.vue`（8 调用点）
- 操作：按 spec.md §4 矩阵列出的 8 处调用点逐一切换到 `web.js`；树构造逻辑改为读 `getFolderTree('api')`；删除/锁/解锁/移动/复制走 EP-RES-006~009 + EP-RES-007；保存触发 `loadResourceTree(true)`。
- 验证：网络面板不再出现 `/api/list`、`/group/*`、`/api/move|delete|lock|unlock`；UI 行为不变；新建/重命名/删除回归通过。
- 依赖：T021、T022、T023。
- 验收映射：spec.md §4 「`magic-api-list.vue` ×8」；AC-101-04/05/07。

### T032  [P] 改造 `src/components/resources/magic-function-list.vue`
- 操作：同上策略，folder 取 `'function'`；保存走 `saveFile('function', entity)`。
- 验证：网络面板无 `/function/*` 旧路径；列表/CRUD 正常。
- 依赖：T021、T022、T023。
- 验收映射：spec.md §4 「`magic-function-list.vue`」。

### T033  [P] 改造 `src/components/resources/magic-datasource-list.vue`（5 调用点）
- 操作：列表走 `getFolderTree('datasource')`；测试连接走 `testDatasource(dsInfo)`；保存走 `saveFile('datasource', entity)`。
- 验证：测试连接请求 `Content-Type: application/json`；列表/保存/删除均无 1.x 旧路径。
- 依赖：T021、T022、T023、T025。
- 验收映射：spec.md §4 「`magic-datasource-list.vue` ×5」；AC-101-06。

### T034  改造 `src/components/editor/magic-script-editor.vue`（4 调用点）
- 操作：拉取详情 → `getFile(id)`；保存 → `saveFile(folder, entity)`（folder 由编辑器当前类型派生）；备份页签 → EP-BAK-002/003/004。
- 验证：保存后 `entity.id` 写回成功；备份列表/内容/回滚链路 200；编辑器无控制台报错。
- 依赖：T023、T024。
- 验收映射：spec.md §4 「`magic-script-editor.vue` ×4」；AC-101-05/08。

### T035  [P] 改造 `src/components/layout/magic-header.vue`
- 操作：reload/download/upload/push 切到 `web.js`。
- 验证：菜单项操作链路 200；导入导出文件名/内容正常。
- 依赖：T026。
- 验收映射：spec.md §4 「`magic-header.vue`」。

### T036  [P] 改造 `src/components/layout/magic-group.vue`
- 操作：分组保存/复制 → `saveFolder` / `copyFolder`；分组删除 → `deleteResource`。
- 验证：分组三件套 UI 行为不变；操作后树自动刷新。
- 依赖：T021、T022。
- 验收映射：spec.md §4 「`magic-group.vue`」；AC-101-04。

### T037  [P] 改造 `src/components/layout/magic-login.vue`
- 操作：登录/当前用户/登出 → `login` / `currentUser` / `logout`。
- 验证：登录链路 200；响应头 `magic-token` 正常读取；登出后状态清理。
- 依赖：T026。
- 验收映射：spec.md §4 「`magic-login.vue`」；AC-101-09、SMOKE-10。

### T038  [P] 改造 `src/components/layout/magic-option.vue`
- 操作：`listOptions()` 替换。
- 验证：选项面板加载正常。
- 依赖：T026。
- 验收映射：spec.md §4 「`magic-option.vue`」。

### T039  [P] 改造 `src/components/layout/magic-search.vue`
- 操作：`searchScript(keyword)` 替换。
- 验证：搜索结果数量与 1.x 行为对齐。
- 依赖：T026。
- 验收映射：spec.md §4 「`magic-search.vue`」。

### T040  [P] 改造 `src/components/layout/magic-status-bar.vue`
- 操作：TODO 列表 → `listTodo()`（GET）。
- 验证：网络面板方法为 GET；UI 与 1.x 一致。
- 依赖：T026。
- 验收映射：spec.md §4 「`magic-status-bar.vue`」；AC-101-08。

### T041  [P] 改造 `src/components/resources/magic-{group-choose,recent-opened,resource-choose}.vue`
- 操作：原通过 `requestGroup` 间接拿到列表的逻辑，确认在 T030 之后无残留旧调用；如有直接 `request.send` 调用一并切到 `web.js`。
- 验证：三个组件初始化与交互不再触发 `/group/list` 等旧路径。
- 依赖：T030、T021。
- 验收映射：spec.md §4 对应行；AC-101-04。

---

## 阶段 4：回归与验收

### T050  执行 SMOKE-01 ~ SMOKE-11（plan.md §6）
- 操作：依次跑通 11 项冒烟；失败者打回阶段 1~3 对应任务。
- 验证：每项均给出网络面板截图或日志摘录归档到 PR description。
- 依赖：T010~T041。
- 验收映射：plan.md §6 全表。

### T051  对照 spec.md §5 勾选 AC-101-01 ~ AC-101-10
- 操作：逐条核对：路径治理、单次 `/resource`、ROT13、JSON DS、GET TODO、备份、登录、UI 不卡死等。
- 验证：勾选完整；任何未通过项回阶段 3 修复。
- 依赖：T050。
- 验收映射：spec.md §5 全部 AC。

### T052  [P] playwright 复跑 016 用例 + 新 SMOKE-07~11
- 操作：在宿主中运行已有 016 playwright 脚本；新增 SMOKE-07~11 对应用例。
- 验证：全绿；无 console error（Monaco worker 告警按 spec.md §8 豁免）。
- 依赖：T050。
- 验收映射：AC-101-10、SMOKE-07~11。

### T053  对照 spec.md §4 全量 27 调用点 checklist
- 操作：在 PR 描述中以表格形式逐行勾选「旧 URL → 新函数」；任何未勾选项立即处理。
- 验证：表格 27/27 通过。
- 依赖：T030~T041。
- 验收映射：spec.md §4 矩阵；R-101-06 风险关闭。

---

## 阶段 5：发版与宿主联动

### T060  fork 包发版
- 操作：`@fellow99/magic-editor` 版本号递增（建议 `3.0.0` → `3.1.0`，含 BREAKING CHANGE 时按语义递增）；更新 `CHANGELOG.md`：列出 27 调用点切换、ROT13、`/resource` 单次、备份/数据源/TODO 变更。
- 验证：`pnpm publish --access public` 或对应私有源命令成功；npm 视图可见新版本。
- 依赖：T050、T051、T052、T053。

### T061  宿主仓库联动
- 操作：在 RuoYi 宿主 `package.json` 升级 fork 包版本；`pnpm install`；提交 lockfile。
- 验证：宿主启动后访问 `/magic/web/`，资源面板加载、保存脚本、登录/登出全链路通过。
- 依赖：T060。

### T062  Git 提交（CRLF 行尾约束）
- 操作：在 magic-editor 仓库与宿主仓库分别 commit；遵循现行 CRLF 设置；commit message 引用 spec/plan/tasks 章节。
- 验证：`git diff --check` 无行尾告警；CI 通过。
- 依赖：T061。

---

## 并行执行建议

阶段 3 中可一次性并行启动的任务集合（互相之间无文件冲突）：

```
[P 集合 A] T030 / T035 / T036 / T037 / T038 / T039 / T040
[P 集合 B] T031 / T032 / T033（资源三件套独立文件）
T034（编辑器，单文件，独占）
T041（依赖 T030 完成后再起）
```

阶段 2 内部为单文件改造，**不并行**；阶段 1 中 T010 与 T011 文件不同可并行（已分别在 `codec.js` / `request.js`），可标 `[P]`，但都阻塞 T020。

---

## 失败回滚指引

- 任意阶段冒烟失败：立即在该任务的 commit 上 `git revert`；端点适配层与组件层独立提交保证可二分。
- 阶段 5 发版后宿主出现回归：宿主侧 `package.json` 回退至上一个 fork 版本；fork 仓库 `npm deprecate` 当前版本并修复后重发。
- ROT13 或 JSON-body 端点出错：优先怀疑 `transformRequest` 改动；用 SMOKE-02 / SMOKE-05 / SMOKE-06 三件套定位层级。
