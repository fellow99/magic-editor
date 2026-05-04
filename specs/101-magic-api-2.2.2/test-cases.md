# 101-magic-api-2.2.2 测试用例

> 模块编号：101-magic-api-2.2.2
> 关联规范：[spec.md](./spec.md)、[api.md](./api.md)、[plan.md](./plan.md)
> 对应源码：`src/api/request.js`、`src/api/web.js`、`src/scripts/utils.js`、`src/components/**`
> 用例编号格式：`TC-101-NNN`

---

## 1. 测试范围

**纳入**：fork 包对接 magic-api 2.2.2 后端的调用层改造——传输层（axios 旁路 + ROT13 编解码）、资源树合并、文件 CRUD/锁/移动/复制、备份、数据源 JSON 测试、工作台端点、响应壳兼容、27 处调用点回归。

**排除**：宿主集成（spec 016 范畴）、WebSocket 调试帧（→ 014）、用户脚本运行时、monaco 内核、Sa-Token 后端配置。

---

## 2. 环境前置

| 项 | 期望 |
|---|---|
| 后端 | magic-api-spring-boot-starter:2.2.2 + `magic-api.web=/magic/web` |
| 前端 | `@fellow99/magic-editor@3.0.0` 改造版 |
| 鉴权 | 宿主 axios 拦截器注入 `Authorization: Bearer <sa-token>` |
| 工具 | jsdom + axios-mock-adapter / nock；浏览器 E2E（Playwright） |
| 编码 | `TextEncoder`、`btoa`、`atob` 可用 |

---

## 3. 传输层（FR-101-TRX）

### TC-101-001 axios 旁路 text/plain
- **关联**：FR-101-TRX-01
- **优先级**：P0
- **输入**：`request.send(url, 'rotstring', 'POST', { 'Content-Type':'text/plain' })`
- **预期**：请求体为字面量 `'rotstring'`，未被 `Qs.stringify` 包裹

### TC-101-002 form-urlencoded 默认行为不破坏
- **关联**：FR-101-TRX-01
- **优先级**：P0
- **预期**：`POST /resource/delete` form `{id:'X'}` 仍以 `id=X` 序列化

### TC-101-003 FormData 透传
- **关联**：FR-101-TRX-01
- **优先级**：P1
- **预期**：FormData 实例不经 stringify，axios 自动设置 multipart 边界

### TC-101-004 ROT13(Base64) 编码
- **关联**：FR-101-TRX-02、R-101-01
- **优先级**：P0
- **输入**：`{name:'测试', emoji:'🚀'}`
- **预期**：`rot13b64Encode` → `rot13b64Decode` 后等价；后端 `ROT13Utils` 解出同字串

### TC-101-005 ROT13 自反性
- **关联**：FR-101-TRX-02
- **优先级**：P0
- **预期**：对 base64 串两次 ROT13 = 原串

### TC-101-006 多字节字符往返
- **关联**：FR-101-TRX-02、R-101-01
- **优先级**：P0
- **输入**：包含中文、emoji、数学符号的 JSON
- **预期**：utf8 → btoa（latin1 桥接）→ ROT13 全程无损

### TC-101-007 鉴权头透传不冲突
- **关联**：FR-101-TRX-03、R-101-05
- **优先级**：P0
- **预期**：宿主拦截器注入 `Authorization: Bearer ...`；fork 包不覆盖、不删除

### TC-101-008 magic-token 仅登录场景使用
- **关联**：FR-101-TRX-03、A-101-02
- **优先级**：P1
- **预期**：登录响应头中 `magic-token` 被读取并保存；非登录请求不主动注入此头

---

## 4. 资源树合并（FR-101-RES-01）

### TC-101-020 单次 POST /resource
- **关联**：FR-101-RES-01、AC-101-01、US-101-001
- **优先级**：P0
- **预期**：编辑器初始化网络面板仅一次 `POST /resource`，响应 `code=1`

### TC-101-021 1.x 路径不再出现
- **关联**：AC-101-02
- **优先级**：P0
- **预期**：网络面板无 `group/list`、`list`、`function/list`、`datasource/list`、`group/list?type=2`、`POST /todo` 等 1.x 路径

### TC-101-022 树结构按 folder 拆分
- **关联**：FR-101-RES-01
- **优先级**：P0
- **预期**：响应 TreeNode 按 `folder.type∈{api,function,datasource,task,component}` 派发到对应列表组件

### TC-101-023 写后整树刷新
- **关联**：FR-101-RES-01
- **优先级**：P0
- **预期**：保存/删除/移动/复制/重命名后均触发 1 次 `POST /resource`，所有列表组件刷新

### TC-101-024 列表组件不重复请求
- **关联**：FR-101-RES-01、R-101-03
- **优先级**：P0
- **预期**：3 个列表组件初始化只读取共享缓存，不再各自调用 list

### TC-101-025 结构归一化
- **关联**：R-101-03
- **优先级**：P1
- **预期**：调用层将 TreeNode 转换为各组件预期形态，组件内部代码改动最小

### TC-101-026 空响应容错
- **关联**：FR-101-RES-01
- **优先级**：P1
- **预期**：`data=null/{}` 时各列表渲染空树，UI 不卡死

---

## 5. 分组 CRUD（FR-101-RES-02/03/06）

### TC-101-040 新建分组
- **关联**：FR-101-RES-02、US-101-002
- **优先级**：P0
- **预期**：`POST /resource/folder/save`（无 id），body=JSON Group，返回 id 写回

### TC-101-041 重命名分组
- **关联**：FR-101-RES-02、US-101-002
- **优先级**：P0
- **预期**：同一端点带 id；不再调用 `group/update`

### TC-101-042 复制分组
- **关联**：FR-101-RES-03、US-101-002
- **优先级**：P0
- **预期**：`POST /resource/folder/copy` form `src,target`

### TC-101-043 删除分组用 id
- **关联**：FR-101-RES-06、AC-101-04
- **优先级**：P0
- **预期**：`POST /resource/delete` form `id=<分组id>`；不再传 `groupId`

### TC-101-044 分组与文件统一删除端点
- **关联**：FR-101-RES-06
- **优先级**：P0
- **预期**：删除 API/函数/数据源/任务/组件文件均走 `POST /resource/delete` form `id`

---

## 6. 文件保存 ROT13（FR-101-RES-04）

### TC-101-060 API 保存
- **关联**：FR-101-RES-04、US-101-003、AC-101-03
- **优先级**：P0
- **预期**：`POST /resource/file/api/save`、`Content-Type: text/plain`、body=ROT13(Base64(JSON))；HTTP 200；返回 id 写回 entity.id

### TC-101-061 函数保存
- **关联**：FR-101-RES-04
- **优先级**：P0
- **预期**：URL `/resource/file/function/save`；编码协议同上

### TC-101-062 数据源保存
- **关联**：FR-101-RES-04、US-101-003
- **优先级**：P0
- **预期**：URL `/resource/file/datasource/save`；保存后刷新数据源列表

### TC-101-063 任务保存
- **关联**：FR-101-RES-04
- **优先级**：P1
- **预期**：URL `/resource/file/task/save`

### TC-101-064 组件保存
- **关联**：FR-101-RES-04
- **优先级**：P1
- **预期**：URL `/resource/file/component/save`

### TC-101-065 编辑态不丢
- **关联**：US-101-003
- **优先级**：P0
- **预期**：API/函数保存后当前编辑面板脚本内容、参数、headers 不被清空

### TC-101-066 后端解码失败回归
- **关联**：R-101-01、R-101-02
- **优先级**：P0
- **输入**：mock 后端返回 `code=500, msg='ROT13 decode failed'`
- **预期**：UI 弹错，不静默；不污染编辑态

---

## 7. 文件详情（FR-101-RES-05）

### TC-101-080 GET /resource/file/{id}
- **关联**：FR-101-RES-05、US-101-004
- **优先级**：P0
- **预期**：双击文件→`GET /resource/file/<id>`，id 在路径

### TC-101-081 1.x get?id= 不再出现
- **关联**：AC-101-02
- **优先级**：P0
- **预期**：网络面板无 `get?id=`、`function/get?id=`、`datasource/detail`

### TC-101-082 字段映射
- **关联**：FR-101-RES-05、US-101-004
- **优先级**：P0
- **预期**：响应直接映射到 API/Function/DataSource/Task/Component 的实体模型

---

## 8. 锁定与移动（FR-101-RES-07/08/09）

### TC-101-100 锁定文件
- **关联**：FR-101-RES-08、US-101-005
- **优先级**：P0
- **预期**：`POST /resource/lock` form `id`

### TC-101-101 解锁文件
- **关联**：FR-101-RES-09、US-101-005
- **优先级**：P0
- **预期**：`POST /resource/unlock` form `id`

### TC-101-102 移动文件参数 src/groupId
- **关联**：FR-101-RES-07、AC-101-04、R-101-07
- **优先级**：P0
- **预期**：`POST /resource/move` form `src=<文件id>, groupId=<目标分组id>`；不再用 `id`

### TC-101-103 api/move、function/move 端点废止
- **关联**：AC-101-02
- **优先级**：P0
- **预期**：网络面板不再出现这两个 1.x 路径

---

## 9. 备份（FR-101-BAK）

### TC-101-120 时间维度列表
- **关联**：FR-101-BAK-01、US-101-007
- **优先级**：P1
- **预期**：`GET /backups?timestamp=` 调用成功

### TC-101-121 资源维度备份列表
- **关联**：FR-101-BAK-02、US-101-007
- **优先级**：P0
- **预期**：`GET /backup/{id}`，id 在路径，**不在 query**

### TC-101-122 备份脚本内容
- **关联**：FR-101-BAK-03、US-101-007
- **优先级**：P0
- **预期**：`GET /backup?timestamp=&id=`；路径无 `/get`

### TC-101-123 回滚
- **关联**：FR-101-BAK-04、US-101-007、AC-101-06
- **优先级**：P0
- **预期**：`POST /backup/rollback` form `id, timestamp`

### TC-101-124 全量备份
- **关联**：FR-101-BAK-05
- **优先级**：P2
- **预期**：`POST /backup/full` 调用成功

---

## 10. 数据源测试（FR-101-DS-01）

### TC-101-140 JSON Content-Type
- **关联**：FR-101-DS-01、US-101-006、AC-101-05
- **优先级**：P0
- **预期**：`POST /datasource/jdbc/test`，`Content-Type: application/json`，body 为 `DataSourceInfo` JSON

### TC-101-141 不被 Qs.stringify 损坏
- **关联**：FR-101-DS-01、R-101-02
- **优先级**：P0
- **预期**：调用层显式传 JSON 字符串，绕开 axios 默认 transformRequest

### TC-101-142 成功返回 ok
- **关联**：AC-101-05
- **优先级**：P0
- **预期**：后端 `data='ok'` → UI 成功提示

### TC-101-143 失败返回异常
- **关联**：AC-101-05
- **优先级**：P0
- **预期**：后端 `data` 为异常 message → UI 失败提示

### TC-101-144 1.x datasource/test 废止
- **关联**：AC-101-02
- **优先级**：P0
- **预期**：网络面板不再出现 `datasource/test`（form 表单）

---

## 11. 工作台（FR-101-WB）

### TC-101-160 TODO GET
- **关联**：FR-101-WB-01、US-101-008
- **优先级**：P0
- **预期**：`GET /todo`；1.x 的 `POST /todo` 不再出现

### TC-101-161 config.json 容忍 executeTime
- **关联**：FR-101-WB-02、FR-101-WB-11、R-101-04
- **优先级**：P0
- **预期**：响应壳含 `executeTime` 不抛错、不 warning

### TC-101-162 classes.txt
- **关联**：FR-101-WB-03
- **优先级**：P1
- **预期**：`GET /classes.txt` 文本响应解析正常

### TC-101-163 单 class 详情
- **关联**：FR-101-WB-03
- **优先级**：P1
- **预期**：`POST /class` 返回单类元数据

### TC-101-164 全量 classes
- **关联**：FR-101-WB-03
- **优先级**：P1
- **预期**：`POST /classes` 返回元数据集

### TC-101-165 登录链路
- **关联**：FR-101-WB-04、AC-101-07
- **优先级**：P0
- **预期**：`POST /login` 成功→响应头 `magic-token` 写入；后续 `POST /user`、`POST /logout` 链路畅通

### TC-101-166 双鉴权头共存
- **关联**：AC-101-07、R-101-05
- **优先级**：P0
- **预期**：宿主 `Authorization: Bearer` + fork 包 `magic-token` 并存不冲突

### TC-101-167 plugins
- **关联**：FR-101-WB-05
- **优先级**：P1
- **预期**：`GET /plugins` 返回插件列表

### TC-101-168 options
- **关联**：FR-101-WB-06
- **优先级**：P1
- **预期**：`* /options` 调用成功

### TC-101-169 reload
- **关联**：FR-101-WB-07
- **优先级**：P1
- **预期**：`GET /reload` 调用成功

### TC-101-170 search
- **关联**：FR-101-WB-08、US-101-008
- **优先级**：P0
- **预期**：`POST /search` 返回结果

### TC-101-171 config-js
- **关联**：FR-101-WB-09
- **优先级**：P2
- **预期**：`* /config-js` 调用成功

### TC-101-172 download
- **关联**：FR-101-WB-10
- **优先级**：P1
- **预期**：`* /download` 触发下载

### TC-101-173 upload
- **关联**：FR-101-WB-10
- **优先级**：P1
- **预期**：`* /upload` 上传 zip 成功

### TC-101-174 push
- **关联**：FR-101-WB-10
- **优先级**：P2
- **预期**：`* /push` 调用成功

---

## 12. 响应壳兼容（FR-101-WB-11）

### TC-101-190 processResult 容忍未知字段
- **关联**：FR-101-WB-11、R-101-04
- **优先级**：P0
- **预期**：响应顶层多出 `executeTime`、`requestId` 等字段不影响 code/message/data 解析

### TC-101-191 code 非 1 走错误路径
- **关联**：FR-101-WB-11
- **优先级**：P0
- **预期**：`code=500, msg='No static resource ...'` 时进入错误处理，不被静默吞掉

### TC-101-192 data=null 容错
- **关联**：FR-101-WB-11
- **优先级**：P0
- **预期**：成功响应 `data=null` 时调用方按 `null` 正常分支处理

---

## 13. 27 处调用点矩阵回归（§4）

> 与 spec §4 矩阵一一对应，确保无遗漏。

### TC-101-210 utils.requestGroup
- **关联**：调用点 #1、FR-101-RES-01
- **优先级**：P0
- **预期**：不再调用 `group/list?type=N`，统一走 `POST /resource`

### TC-101-211 magic-api-list 列表
- **关联**：#2、FR-101-RES-01
- **优先级**：P0
- **预期**：不再 `GET list`

### TC-101-212 magic-api-list 删除文件
- **关联**：#3、FR-101-RES-06
- **优先级**：P0

### TC-101-213 magic-api-list 删除分组
- **关联**：#4、FR-101-RES-06
- **优先级**：P0
- **预期**：参数名 `id`

### TC-101-214 magic-api-list 锁
- **关联**：#5、FR-101-RES-08
- **优先级**：P0

### TC-101-215 magic-api-list 解锁
- **关联**：#6、FR-101-RES-09
- **优先级**：P0

### TC-101-216 magic-api-list 移动
- **关联**：#7、FR-101-RES-07
- **优先级**：P0
- **预期**：`src/groupId` 参数

### TC-101-217 magic-api-list 复制分组
- **关联**：#8、FR-101-RES-03
- **优先级**：P0

### TC-101-218 magic-api-list 导出
- **关联**：#9、FR-101-WB-10
- **优先级**：P1

### TC-101-219 magic-function-list 列表
- **关联**：#10、FR-101-RES-01
- **优先级**：P0

### TC-101-220 magic-datasource-list 列表
- **关联**：#11、FR-101-RES-01
- **优先级**：P0

### TC-101-221 magic-datasource-list 详情
- **关联**：#12、FR-101-RES-05
- **优先级**：P0

### TC-101-222 magic-datasource-list 测试
- **关联**：#13、FR-101-DS-01
- **优先级**：P0

### TC-101-223 magic-datasource-list 保存
- **关联**：#14、FR-101-RES-04
- **优先级**：P0

### TC-101-224 magic-datasource-list 删除
- **关联**：#15、FR-101-RES-06
- **优先级**：P0

### TC-101-225 magic-script-editor 拉取
- **关联**：#16、FR-101-RES-05
- **优先级**：P0

### TC-101-226 magic-script-editor 保存 API
- **关联**：#17、FR-101-RES-04
- **优先级**：P0

### TC-101-227 magic-script-editor 保存函数
- **关联**：#18、FR-101-RES-04
- **优先级**：P0

### TC-101-228 magic-script-editor 备份列表
- **关联**：#19、FR-101-BAK-02
- **优先级**：P0

### TC-101-229 magic-header 重载
- **关联**：#20、FR-101-WB-07
- **优先级**：P1

### TC-101-230 magic-search 搜索
- **关联**：#21、FR-101-WB-08
- **优先级**：P0

### TC-101-231 magic-login 登录
- **关联**：#22、FR-101-WB-04
- **优先级**：P0

### TC-101-232 magic-login 当前用户
- **关联**：#23、FR-101-WB-04
- **优先级**：P0

### TC-101-233 magic-login 登出
- **关联**：#24、FR-101-WB-04
- **优先级**：P0

### TC-101-234 magic-option 可选项
- **关联**：#25、FR-101-WB-06
- **优先级**：P1

### TC-101-235 magic-status-bar TODO
- **关联**：#26、FR-101-WB-01
- **优先级**：P0

### TC-101-236 magic-group 分组操作
- **关联**：#27、FR-101-RES-02/03
- **优先级**：P0
- **预期**：upsert 走 `/resource/folder/save`；复制走 `/resource/folder/copy`

---

## 14. 系统级验收（AC-101-01~10）

### TC-101-260 AC-101-01 初始化只一次 POST /resource
- **优先级**：P0

### TC-101-261 AC-101-02 1.x 路径白名单
- **优先级**：P0
- **预期**：网络抓包断言所有 1.x 路径绝迹

### TC-101-262 AC-101-03 五类资源完整链路
- **优先级**：P0
- **预期**：API/函数/数据源/任务/组件均完成 新建→编辑→保存→详情→删除 全链路；保存协议 ROT13+text/plain

### TC-101-263 AC-101-04 分组完整链路
- **优先级**：P0
- **预期**：新建→重命名→复制→删除→移动文件入分组；参数名一致

### TC-101-264 AC-101-05 数据源测试
- **优先级**：P0

### TC-101-265 AC-101-06 备份链路
- **优先级**：P0

### TC-101-266 AC-101-07 鉴权双头
- **优先级**：P0

### TC-101-267 AC-101-08 工作台覆盖
- **优先级**：P0

### TC-101-268 AC-101-09 控制台无错
- **优先级**：P0
- **预期**：浏览器 DevTools 全程无未捕获异常；UI 可交互

### TC-101-269 AC-101-10 WebSocket 不回归
- **关联**：014-infra-transport
- **优先级**：P0
- **预期**：`/magic/console` 帧协议在 2.2.2 后端正常建立与传输；调试运行链路不破坏

---

## 15. 边界与待澄清

| 编号 | 场景 | 关联 | 预期 |
|---|---|---|---|
| TC-101-300 | ROT13 输入空字符串 | FR-101-TRX-02 | 编码=空；解码=空 |
| TC-101-301 | btoa latin1 桥接非 ASCII | A-101-05、R-101-01 | 必须先 utf8 → latin1 字节序，否则 `btoa` 抛 `InvalidCharacterError` |
| TC-101-302 | 后端响应缺 code 字段 | FR-101-WB-11 | 走错误分支并提示，不静默 |
| TC-101-303 | `POST /resource` 部分 folder 缺失 | FR-101-RES-01 | 缺失 folder 列表为空，不报错 |
| TC-101-304 | 大型 TreeNode（>5000 节点） | NFR | 性能基线观察，必要时延迟渲染 |
| TC-101-305 | 移动文件到同一分组 | FR-101-RES-07 | 后端语义未约束，前端不应主动拦截 |
| TC-101-306 | 删除分组下仍有文件 | FR-101-RES-06 | 由后端校验返回错误，前端 UI 透传 |
| TC-101-307 | 数据源测试超时 | FR-101-DS-01 | 显示超时提示，不影响其他请求 |
| TC-101-308 | 同时多次保存（双击保存按钮） | FR-101-RES-04 | 调用方需做去抖（已知约束，登记） |
| TC-101-309 | magic-token 与 Bearer 后端只接其一 | R-101-05、AC-101-07 | 由后端实际行为决定；记录为环境差异 |
| TC-101-310 | `executeTime` 为非法类型 | FR-101-WB-11 | 仍不参与判断，data 解析正常 |
| TC-101-311 | 27 处调用点之外发现遗漏 | R-101-06 | 网络面板白盒检查 → 补登记到矩阵 |
| TC-101-312 | request.send 调用方未通过适配函数 | R-101-07 | tasks.md 强制 lint 检查（约束记录） |
| TC-101-313 | 业务脚本运行时 `/magic/api/**` | §8 不在范围 | 不在本测试范围内 |

---

## 16. 索引摘要

| 章节 | 用例区间 | 数量 |
|---|---|---|
| 传输层 | TC-101-001~008 | 8 |
| 资源树合并 | TC-101-020~026 | 7 |
| 分组 CRUD | TC-101-040~044 | 5 |
| 文件保存 ROT13 | TC-101-060~066 | 7 |
| 文件详情 | TC-101-080~082 | 3 |
| 锁/移动 | TC-101-100~103 | 4 |
| 备份 | TC-101-120~124 | 5 |
| 数据源测试 | TC-101-140~144 | 5 |
| 工作台 | TC-101-160~174 | 15 |
| 响应壳 | TC-101-190~192 | 3 |
| 27 处矩阵 | TC-101-210~236 | 27 |
| 系统级 AC | TC-101-260~269 | 10 |
| 边界/待澄清 | TC-101-300~313 | 14 |
| **合计** | | **113** |

> P0 ≈ 84、P1 ≈ 14、P2 ≈ 4、边界 14。覆盖 8 个 US、所有 FR-TRX/RES/BAK/DS/WB、10 条 AC、7 条风险、5 条假设。
