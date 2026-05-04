# 009-layout-debug 测试用例

> 模块编号：009-layout-debug
> 关联规范：[spec.md](./spec.md)
> 对应源码：`src/components/layout/{magic-debug,magic-log}.vue`
> 用例编号格式：`TC-009-NNN`

---

## 1. 测试范围

**纳入**：调试面板（继续/单步/变量表）、日志面板（流式渲染/转义/高亮/折叠/清空）、断点协议 Header、断点响应码、ws_breakpoint/ws_log/ws_exception 消费、resume_breakpoint 上行消息。

**排除**：断点装饰渲染（→001）、HTTP 调用发起（→001）、WebSocket 连接管理与帧解析（→014）、底部容器 Tab 切换（→008）、MagicStructure 内部实现（→016）。

---

## 2. 环境前置

| 项 | 期望 |
|---|---|
| `info.ext.debuging` | 由 001 维护 |
| `info.ext.variables` | 数组，每项 {name,value,type} |
| bus | `doContinue`/`doStepInto`/`ws_log`/`ws_breakpoint`/`ws_exception`/`switch-tab`/`message` 通畅 |
| WebSocket | 由 014 提供，已连接 |
| MagicStructure | 已注册 |
| `$magicContextmenu` | 全局指令已挂载 |

---

## 3. 功能用例

### US-001 / US-002 调试面板基础

#### TC-009-001 继续/单步按钮存在
- **关联**：FR-001
- **优先级**：P0
- **预期**：左侧工具条含两按钮（F8/F6 标识）

#### TC-009-002 非调试态按钮禁用
- **关联**：FR-002、NFR-004
- **优先级**：P0
- **前置**：`info.ext.debuging=false`
- **预期**：按钮含 `disabled` 类，点击无事件

#### TC-009-003 调试态按钮启用
- **关联**：FR-002
- **优先级**：P0
- **前置**：`info.ext.debuging=true`
- **预期**：按钮可点击

#### TC-009-004 点击继续 emit doContinue
- **关联**：FR-003、FR-070、FR-080
- **优先级**：P0
- **预期**：bus emit `doContinue`，无参数

#### TC-009-005 点击单步 emit doStepInto
- **关联**：FR-004、FR-071、FR-081
- **优先级**：P0
- **预期**：bus emit `doStepInto`，无参数

#### TC-009-006 info=null 时按钮禁用
- **关联**：C-005
- **优先级**：P1
- **预期**：禁用

---

### US-001 变量表

#### TC-009-010 变量表三列
- **关联**：FR-005
- **优先级**：P0
- **预期**：变量名 / 变量值 / 变量类型

#### TC-009-011 变量值用 MagicStructure
- **关联**：FR-006
- **优先级**：P0
- **预期**：传入 value/type，渲染结构化树

#### TC-009-012 无变量占位
- **关联**：FR-007
- **优先级**：P1
- **前置**：`info.ext.variables=[]`
- **预期**：显示 "no message." 居中

#### TC-009-013 variables 计算属性
- **关联**：FR-009
- **优先级**：P0
- **预期**：mutate `info.ext.variables` → 表格刷新

#### TC-009-014 偶数行斑马纹
- **关联**：FR-010
- **优先级**：P2
- **预期**：偶数行背景色不同

#### TC-009-015 列垂直分隔线
- **关联**：FR-011
- **优先级**：P2
- **预期**：列间 border 可见

---

### US-003 ~ US-005 日志面板

#### TC-009-020 ws_log 追加
- **关联**：FR-020、FR-074
- **优先级**：P0
- **预期**：bus emit `ws_log` payload → logs 数组追加

#### TC-009-021 HTML 转义
- **关联**：FR-021、NFR-001
- **优先级**：P0
- **前置**：log = `<img onerror=alert(1)>`
- **预期**：渲染为 `&lt;img...&gt;`，不执行脚本

#### TC-009-022 时间戳 + 级别高亮
- **关联**：FR-022
- **优先级**：P2
- **前置**：log 含 `2024-01-01 12:00:00.000 INFO`
- **预期**：日期段+级别段加 span 着色

#### TC-009-023 URL 转链接
- **关联**：FR-023、NFR-005
- **优先级**：P2
- **前置**：log 含 `https://example.com/x`
- **预期**：渲染 `<a target="blank">`

#### TC-009-024 Java 堆栈下划线
- **关联**：FR-024、NFR-005
- **优先级**：P2
- **前置**：log 含 `\tat com.x.Y.z(Y.java:42)`
- **预期**：文件位置加灰色下划线

#### TC-009-025 超 3 行折叠
- **关联**：FR-025、NFR-002
- **优先级**：P0
- **前置**：log 共 10 行
- **预期**：max-height:60px + "有 N 行隐藏 点击显示"

#### TC-009-026 折叠记录元数据
- **关联**：FR-028
- **优先级**：P1
- **预期**：日志条目含 multiple/lines/showMore

#### TC-009-027 点击展开
- **关联**：FR-025
- **优先级**：P1
- **预期**：max-height:none，链接变"点击隐藏"

#### TC-009-028 自动滚动到底部
- **关联**：FR-026、NFR-003
- **优先级**：P0
- **预期**：scrollTop=scrollHeight

#### TC-009-029 行高 20px
- **关联**：FR-029
- **优先级**：P2
- **预期**：line-height:20px

#### TC-009-030 背景色变量
- **关联**：FR-030
- **优先级**：P2
- **预期**：`--run-log-background`

---

### US-006 右键清空

#### TC-009-040 右键弹菜单
- **关联**：FR-027
- **优先级**：P2
- **预期**：contextmenu 触发 `$magicContextmenu`，含"清空日志"

#### TC-009-041 点击清空 logs.splice(0)
- **关联**：FR-027、场景 5
- **优先级**：P1
- **预期**：日志列表清空

---

### 调试控制流（与 001 协作）

#### TC-009-050 ws_breakpoint 设置 debuging=true
- **关联**：FR-052
- **优先级**：P0
- **前置**：bus emit `ws_breakpoint` payload
- **预期**：001 设置 `info.ext.debuging=true`，本面板按钮启用

#### TC-009-051 ws_breakpoint 写入 variables
- **关联**：FR-053、FR-065
- **优先级**：P0
- **预期**：`info.ext.variables=[{name,value,type}, ...]`

#### TC-009-052 ws_breakpoint 切换到 Debug Tab
- **关联**：FR-055、FR-075
- **优先级**：P0
- **预期**：bus emit `switch-tab','debug'`

#### TC-009-053 状态条"进入断点"
- **关联**：FR-056
- **优先级**：P2
- **预期**：bus emit `status` 含"进入断点"

#### TC-009-054 doContinue 发送 resume_breakpoint,0
- **关联**：FR-082、FR-090、FR-091
- **优先级**：P0
- **预期**：bus emit `message','resume_breakpoint','0|0|<bps>'` 或拼接为字符串

#### TC-009-055 doStepInto 发送 resume_breakpoint,1
- **关联**：FR-082、FR-091
- **优先级**：P0
- **预期**：step 段为 '1'

#### TC-009-056 断点列表 `|` 分隔
- **关联**：FR-092
- **优先级**：P1
- **前置**：断点行 [10,25,42]
- **预期**：消息含 `10|25|42`

#### TC-009-057 恢复执行清装饰
- **关联**：FR-093
- **优先级**：P0
- **预期**：deltaDecorations 清空，debuging=false

#### TC-009-058 恢复执行清变量
- **关联**：FR-094
- **优先级**：P0
- **预期**：variables=[]

---

### 断点协议 Header

#### TC-009-070 Magic-Request-Session Header 注入
- **关联**：FR-040、FR-041
- **优先级**：P0
- **预期**：HTTP 测试请求含 Header，值=`<ts><rand4>`

#### TC-009-071 Magic-Request-Breakpoints Header 注入
- **关联**：FR-042、FR-043
- **优先级**：P0
- **预期**：值=`"10,25,42"`（逗号分隔）

#### TC-009-072 断点行号来自 decoration
- **关联**：FR-044
- **优先级**：P1
- **预期**：filter `linesDecorationsClassName==='breakpoints'`

#### TC-009-073 set_session_id 通知 WS
- **关联**：FR-045
- **优先级**：P0
- **预期**：bus emit `message','set_session_id', sessionId`

#### TC-009-074 RESPONSE_CODE_DEBUG=1000
- **关联**：FR-050
- **优先级**：P0
- **预期**：响应 code=1000 → 走断点流程

---

### ws_exception 处理

#### TC-009-080 ws_exception 触发 onException
- **关联**：FR-061、FR-066
- **优先级**：P0
- **前置**：bus emit `ws_exception` `[sessionId, msg, [sl,el,sc,ec]]`
- **预期**：001 渲染异常波浪线

---

## 4. 边界与异常

| 编号 | 场景 | 预期 |
|---|---|---|
| TC-009-200 | LOG_MAX_ROWS=Infinity 持续推送 1 万条 | 不截断、滚动正常（但内存增长，NC-002） |
| TC-009-201 | MagicLog 卸载后 ws_log 仍触发 | 回调仍存在 → 内存泄漏（NC-001 已记录） |
| TC-009-202 | ws_log payload 为空字符串 | 追加空行，不抛错 |
| TC-009-203 | ws_log 含极长单行（10K 字符） | 渲染不卡，水平不超出 |
| TC-009-204 | 调试中 info 切换到另一资源 | variables 重置为新资源数据 |
| TC-009-205 | 多次连续断点（未先 continue） | variables/decoration 以最新一次为准 |
| TC-009-206 | resume_breakpoint 时无断点 | breakpoints 段为空字符串 |
| TC-009-207 | 变量 type=java.util.List value=JSON 数组 | MagicStructure 渲染为可展开数组 |
| TC-009-208 | 变量 value 非合法 JSON | MagicStructure 直显字符串 |
| TC-009-209 | ws_exception location 为空 | 仅显示 status 异常文案，不装饰 |
| TC-009-210 | 多行日志全部为空行 | lines 计数正确，不报错 |
| TC-009-211 | 高频 ws_log（每 1ms 一条） | 滚动不卡，logs 数组保持顺序 |
| TC-009-212 | 不同 sessionId 并发响应 | 当前实现以最新会话覆盖（C-005） |

---

## 5. 索引摘要

| 用户故事 | 用例区间 | 数量 |
|---|---|---|
| US-001/002 调试面板基础 | TC-009-001~006 | 6 |
| US-001 变量表 | TC-009-010~015 | 6 |
| US-003~005 日志渲染 | TC-009-020~030 | 11 |
| US-006 右键清空 | TC-009-040~041 | 2 |
| 调试控制流 | TC-009-050~058 | 9 |
| 断点协议 Header | TC-009-070~074 | 5 |
| 异常事件 | TC-009-080 | 1 |
| 边界异常 | TC-009-200~212 | 13 |
| **合计** | | **53** |

> P0 ≈ 25，P1 ≈ 13，P2 ≈ 15
