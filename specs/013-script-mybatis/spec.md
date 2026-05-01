# 013-script-mybatis 模块规范（As-Built）

> 模块编号：013-script-mybatis
> 状态：已实现
> 最后更新：2026-05-01
> 对应源码：`src/scripts/editor/mybatis.js`（1419 行）

---

## 1. 模块概述

### 1.1 目的

本模块为 monaco-editor 注册一门名为 `mybatis` 的自定义语言，提供 **MyBatis 风格 SQL 脚本**的语法高亮能力。其核心职责是：

- 在 magic-script 的三引号字符串（`"""..."""`）内，以 MyBatis XML 标签 + SQL 混合语法的形式进行着色
- 识别 MyBatis 动态 SQL 标签（`<if>`、`<foreach>`、`<where>`、`<set>`、`<trim>`）及其属性
- 提供完整的 SQL 关键字、运算符、内置函数、系统变量、伪列的高亮词表
- 通过 `nextEmbedded` 机制实现 XML 标签体与 SQL 语言之间的**双向切换**

### 1.2 解决的问题

magic-script 语言允许在三引号字符串中内嵌 SQL 脚本（`high-light.js:34`）。当这些 SQL 采用 MyBatis 风格（即包含 `#{}` / `${}` 参数占位符和 `<if>` / `<foreach>` 等动态标签）时，普通的 SQL 高亮无法正确识别 XML 标签结构。本模块通过独立的 `mybatis` 语言定义，使编辑器能够在同一字符串内正确区分：

- SQL 关键字（`SELECT`、`FROM`、`WHERE`…）
- MyBatis XML 标签（`<if test="...">`、`<foreach collection="...">`…）
- SQL 字符串字面量、数字、注释、标识符

### 1.3 范围

**包含**：
- monaco 语言 `mybatis` 的注册（`monaco.languages.register`）
- 语言配置（注释、括号、自动闭合对）
- Monarch 词法提供器（SQL 关键字/运算符/函数/变量词表 + tokenizer 状态机）
- MyBatis XML 标签的识别与 SQL 嵌入切换（`xml` / `xmlEmbedded` 状态）

**不包含**：
- magic-script 语言本身的注册与高亮 → 模块 012-script-language（`high-light.js`）
- magic-script 的自动补全 / 悬停提示 / 签名帮助 → 模块 012-script-language
- MyBatis XML 标签的自动补全或代码片段插入 → [NEEDS CLARIFICATION: 当前仅做高亮，不提供补全]
- 三引号字符串的识别与语言切换 → 模块 012-script-language（`high-light.js:34` 触发 `nextEmbedded: 'mybatis'`）
- SQL 执行、数据源连接 → 模块 005-resources-datasource
- magic-script 自研解析器（lexer/parser/AST）→ 模块 011-script-parser

---

## 2. 用户场景与用例

### US-001：在三引号字符串中编辑 MyBatis 风格 SQL

- **角色**：开发者
- **前置条件**：已在 magic-script 编辑器中输入三引号字符串 `"""`
- **流程**：
  1. 用户输入 `"""` 开启多行字符串
  2. monaco 自动切换到 `mybatis` 语言模式（由 `high-light.js:34` 的 `nextEmbedded: 'mybatis'` 触发）
  3. 用户输入包含 MyBatis 标签的 SQL，如 `<if test="id != null">SELECT * FROM user WHERE id = #{id}</if>`
  4. 编辑器正确高亮：`<if>` 显示为标签、`test` 为属性名、`SELECT`/`FROM`/`WHERE` 为关键字、`#{id}` 为标识符
  5. 用户输入 `"""` 结束多行字符串，monaco 切回 `magicscript` 语言
- **后置条件**：SQL 内容以 MyBatis 风格正确着色

### US-002：编辑含嵌套动态标签的 SQL

- **角色**：开发者
- **前置条件**：已在三引号字符串中
- **流程**：
  1. 用户输入嵌套标签，如 `<where><if test="...">...</if><foreach collection="...">...</foreach></where>`
  2. 编辑器识别所有标签开闭，标签体内容以 SQL 语法着色
  3. 标签属性值（双引号/单引号内）以属性值样式着色
- **后置条件**：嵌套标签结构正确高亮

### US-003：SQL 关键字自动识别

- **角色**：开发者
- **前置条件**：在 `mybatis` 语言模式下编辑
- **流程**：
  1. 用户输入 SQL 关键字（如 `SELECT`、`JOIN`、`GROUP BY`）
  2. 关键字以 `keyword` token 样式高亮
  3. 内置函数（如 `COUNT`、`MAX`、`CONCAT`）以 `predefined` token 样式高亮
  4. 系统变量（如 `@@VERSION`、`@@SPID`）以 `predefined` token 样式高亮
- **后置条件**：SQL 元素按语义类别正确着色

---

## 3. 功能需求

### 3.1 语言注册

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-001 | 系统 MUST 通过 `monaco.languages.register({ id: 'mybatis' })` 注册名为 `mybatis` 的语言 | `mybatis.js:4` |
| FR-002 | 系统 MUST 通过 `monaco.languages.setLanguageConfiguration` 配置语言选项 | `mybatis.js:5-29` |
| FR-003 | 系统 MUST 设置行注释为 `--`，块注释为 `/* ... */` | `mybatis.js:6-9` |
| FR-004 | 系统 MUST 配置三组括号对：`{}`、`[]`、`()` | `mybatis.js:10-14` |
| FR-005 | 系统 MUST 配置五组自动闭合对：`{}`、`[]`、`()`、`""`、`''` | `mybatis.js:15-21` |
| FR-006 | 系统 MUST 配置五组环绕对（surroundingPairs），与自动闭合对一致 | `mybatis.js:22-28` |

### 3.2 Monarch 词法提供器

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-010 | 系统 MUST 通过 `monaco.languages.setMonarchTokensProvider` 注册词法提供器 | `mybatis.js:31` |
| FR-011 | 词法提供器 MUST 设置 `tokenPostfix: '.sql'`，标识其为 SQL 方言 | `mybatis.js:33` |
| FR-012 | 词法提供器 MUST 设置 `ignoreCase: true`，关键字匹配不区分大小写 | `mybatis.js:34` |

### 3.3 SQL 关键字词表

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-020 | 系统 MUST 提供约 910 个 SQL 关键字（`keywords` 数组），覆盖 T-SQL 全量关键字 | `mybatis.js:39-948` |
| FR-021 | 关键字 MUST 包含 DDL（`CREATE`/`ALTER`/`DROP`）、DML（`SELECT`/`INSERT`/`UPDATE`/`DELETE`）、事务控制（`BEGIN`/`COMMIT`/`ROLLBACK`）、流程控制（`IF`/`WHILE`/`TRY`/`CATCH`）等类别 | `mybatis.js:39-948` |
| FR-022 | 关键字 MUST 包含数据类型（`INT`/`VARCHAR`/`DATETIME`/`XML` 等） | `mybatis.js:114-1223` |
| FR-023 | 关键字匹配后 MUST 标记为 `keyword` token | `mybatis.js:1324-1325` |

### 3.4 SQL 运算符词表

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-030 | 系统 MUST 提供运算符列表（`operators` 数组），包含逻辑运算符（`AND`/`OR`/`NOT`）、集合运算符（`UNION`/`INTERSECT`/`EXCEPT`）、连接运算符（`JOIN`/`LEFT`/`RIGHT`/`INNER`/`OUTER`/`CROSS`/`FULL`/`APPLY`）、谓词（`IN`/`LIKE`/`BETWEEN`/`EXISTS`/`IS NULL`）、透视运算符（`PIVOT`/`UNPIVOT`） | `mybatis.js:950-984` |
| FR-031 | 运算符匹配后 MUST 标记为 `operator` token | `mybatis.js:1326` |

### 3.5 SQL 内置函数词表

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-040 | 系统 MUST 提供内置函数列表（`builtinFunctions` 数组），按类别组织：聚合函数、分析函数、转换函数、日期函数、字符串函数、数学函数、元数据函数、安全函数、系统函数等 | `mybatis.js:986-1264` |
| FR-041 | 内置函数匹配后 MUST 标记为 `predefined` token | `mybatis.js:1328` |

### 3.6 SQL 系统变量词表

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-050 | 系统 MUST 提供系统变量列表（`builtinVariables` 数组），包含 `@@` 前缀的全局变量（如 `@@VERSION`、`@@SPID`、`@@ROWCOUNT`、`@@TRANCOUNT`） | `mybatis.js:1266-1306` |
| FR-051 | 系统变量匹配后 MUST 标记为 `predefined` token | `mybatis.js:1327` |

### 3.7 SQL 伪列词表

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-060 | 系统 MUST 提供伪列列表（`pseudoColumns` 数组）：`$ACTION`、`$IDENTITY`、`$ROWGUID`、`$PARTITION` | `mybatis.js:1308` |
| FR-061 | 伪列以 `$` 开头，匹配后 MUST 标记为 `predefined` token | `mybatis.js:1348-1357` |

### 3.8 Tokenizer 状态机

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-070 | 系统 MUST 定义 `root` 状态，包含：注释、空白、伪列、数字、字符串、复杂标识符、作用域关键字、MyBatis XML 标签、分隔符、括号、标识符/关键字匹配、运算符 | `mybatis.js:1309-1333` |
| FR-071 | 系统 MUST 在 `root` 状态中识别 MyBatis 标签开头：`<where`、`<set`、`<foreach`、`<if`、`<trim`，并切换到 `xml` 状态 | `mybatis.js:1318` |
| FR-072 | 系统 MUST 定义 `xml` 状态，处理标签属性名、属性值（双引号/单引号）、等号分隔符 | `mybatis.js:1398-1412` |
| FR-073 | 系统 MUST 在 `xml` 状态中遇到 `>` 时，切换到 `xmlEmbedded` 状态并嵌入 `mybatis` 语言（`nextEmbedded: 'mybatis'`），即标签体内恢复 SQL 高亮 | `mybatis.js:1403-1409` |
| FR-074 | 系统 MUST 在 `xmlEmbedded` 状态中识别闭合标签 `</where`、`</if`、`</set`、`</foreach`、`</trim`，并弹出 `mybatis` 嵌入、返回 `xml` 状态 | `mybatis.js:1414-1415` |
| FR-075 | 系统 MUST 在 `xml` 状态中识别自闭合/结束标签序列 `</where>`、`</if>`、`</set>`、`</foreach>`、`</trim>`，并弹出状态 | `mybatis.js:1412` |
| FR-076 | 系统 MUST 定义 `whitespace` 状态，匹配空白字符 | `mybatis.js:1335` |
| FR-077 | 系统 MUST 定义 `comments` 状态，支持 `--` 行注释和 `/* ... */` 块注释 | `mybatis.js:1336-1339` |
| FR-078 | 系统 MUST 定义 `comment` 状态，处理块注释内容（不支持嵌套） | `mybatis.js:1340-1347` |
| FR-079 | 系统 MUST 定义 `numbers` 状态，支持十六进制（`0x...`）、货币（`$...`）、浮点数/科学计数法 | `mybatis.js:1359-1362` |
| FR-080 | 系统 MUST 定义 `strings` 状态，支持 `N'...'`（Unicode 字符串）和普通 `'...'` 字符串 | `mybatis.js:1364-1366` |
| FR-081 | 系统 MUST 定义 `string` 状态，处理字符串内容，支持 `''` 转义 | `mybatis.js:1368-1371` |
| FR-082 | 系统 MUST 定义 `complexIdentifiers` 状态，支持 `[...]`（方括号标识符）和 `"..."`（双引号标识符） | `mybatis.js:1373-1375` |
| FR-083 | 系统 MUST 定义 `scopes` 状态，识别 `BEGIN TRAN`、`BEGIN TRY`、`END TRY`、`BEGIN CATCH`、`END CATCH`、`BEGIN`/`CASE`/`END`、`WHEN`/`THEN` 等结构化关键字 | `mybatis.js:1387-1396` |

### 3.9 对外注册的 Monaco Provider

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-090 | 系统 MUST 仅注册一个 monaco 语言（`mybatis`）及其 Monarch token provider | `mybatis.js:4, 31` |
| FR-091 | 系统 MUST **不**注册 completion provider、hover provider、signature provider、folding provider、formatting provider | `mybatis.js` 全文未见相关注册 |
| FR-092 | 系统 MUST **不**注册自定义主题 | `mybatis.js` 全文未见主题注册 |

---

## 4. 关键实体

| 实体 | 描述 | 关键属性 |
|---|---|---|
| `mybatis` 语言 | monaco 注册的自定义语言 ID | `id: 'mybatis'` |
| SQL 关键字表 | 约 910 个 T-SQL 关键字数组 | `keywords[]`（`mybatis.js:39-948`） |
| SQL 运算符表 | 逻辑/集合/连接/谓词/透视运算符 | `operators[]`（`mybatis.js:950-984`） |
| SQL 内置函数表 | 按类别分组的内置函数 | `builtinFunctions[]`（`mybatis.js:986-1264`） |
| SQL 系统变量表 | `@@` 前缀全局变量 | `builtinVariables[]`（`mybatis.js:1266-1306`） |
| SQL 伪列表 | `$` 前缀伪列 | `pseudoColumns[]`（`mybatis.js:1308`） |
| Tokenizer 状态机 | Monarch 词法分析状态定义 | `tokenizer` 对象（`mybatis.js:1309-1417`） |

---

## 5. 接受场景

### 场景 1：三引号字符串内 MyBatis SQL 高亮

- **Given** 用户在 magic-script 编辑器中输入了 `"""` 开启多行字符串
- **When** 用户输入 `SELECT * FROM user WHERE id = #{id}`
- **Then** `SELECT`、`FROM`、`WHERE` 显示为关键字样式，`user`、`id` 显示为标识符样式，`#{id}` 显示为标识符样式

### 场景 2：MyBatis `<if>` 标签高亮

- **Given** 用户在多行字符串中
- **When** 用户输入 `<if test="status != null"> AND status = #{status} </if>`
- **Then** `<if` 和 `</if>` 显示为 `tag` 样式，`test` 显示为 `attribute.name` 样式，`"status != null"` 显示为 `attribute.value` 样式，标签体内的 `AND`、`status` 显示为 SQL 样式

### 场景 3：MyBatis `<foreach>` 标签高亮

- **Given** 用户在多行字符串中
- **When** 用户输入 `<foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>`
- **Then** 标签名显示为 `tag`，各属性名显示为 `attribute.name`，属性值显示为 `attribute.value`，标签体内 `#{id}` 显示为 SQL 标识符

### 场景 4：嵌套标签高亮

- **Given** 用户在多行字符串中
- **When** 用户输入 `<where><if test="name != null"> AND name LIKE #{name} </if></where>`
- **Then** 外层 `<where>` 和内层 `<if>` 均正确识别为标签，嵌套关系正确，标签体内 SQL 正确高亮

### 场景 5：SQL 注释与字符串

- **Given** 用户在 `mybatis` 语言模式下
- **When** 用户输入 `-- 这是一行注释` 或 `/* 块注释 */` 或 `N'中文'`
- **Then** 行注释显示为 `comment` 样式，块注释显示为 `comment` 样式，Unicode 字符串显示为 `string` 样式

---

## 6. 非功能需求

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-001 | 性能 | 词法提供器 MUST 使用 `ignoreCase: true`，避免大小写变体导致重复匹配 | `mybatis.js:34` |
| NFR-002 | 可维护性 | 关键字/函数/变量词表 MUST 以数组字面量形式内联定义，不依赖外部数据源 | `mybatis.js:39-1306` |
| NFR-003 | 兼容性 | 模块 MUST 不依赖 magic-script 解析器，可独立运行于任何 monaco 实例 | `mybatis.js` 全文无 `parsing/` 导入 |
| NFR-004 | 可扩展性 | 新增 SQL 关键字只需在 `keywords` 数组中追加，无需修改 tokenizer 逻辑 | `mybatis.js:39-948` |

---

## 7. 假设与约束

### 7.1 假设

- A-001：`mybatis` 语言**仅**在 magic-script 的三引号字符串内被激活（由 `high-light.js:34` 的 `nextEmbedded: 'mybatis'` 触发），不作为独立编辑语言使用
- A-002：词表基于 T-SQL（SQL Server）方言，而非 MySQL/PostgreSQL 方言（从关键字如 `TOP`、`IDENTITY`、`NVARCHAR`、`@@SPID` 可推断）
- A-003：MyBatis 标签仅支持 `<if>`、`<foreach>`、`<where>`、`<set>`、`<trim>` 五种，不支持 `<choose>`/`<when>`/`<otherwise>` 等其它动态标签
- A-004：`#{}` 和 `${}` 参数占位符在 tokenizer 中**未**被特殊处理，仅作为普通标识符着色（`mybatis.js:1322` 的 `[\w@#$]+` 正则匹配）

### 7.2 约束

- C-001：本模块为纯 monaco 语言定义，**不**包含任何 Vue 组件、bus 事件、HTTP 请求
- C-002：词表为静态数组，不支持运行时扩展（如用户自定义 SQL 函数）
- C-003：块注释不支持嵌套（`mybatis.js:1343-1344` 已注释说明）
- C-004：`xmlEmbedded` 状态中的 SQL 内容匹配使用 `[^<]+`（非 `<` 字符），这意味着 SQL 中若出现 `<` 运算符（如 `WHERE a < b`）可能被误判为标签开头 [NEEDS CLARIFICATION: 实际测试中是否会导致 `<` 运算符高亮异常？]

---

## 8. 与其他模块的边界

### 8.1 与 012-script-language 的边界

- **012-script-language 负责**：注册 `magicscript` 语言、其 Monarch 高亮（`high-light.js`）、自动补全（`completion.js`）、悬停提示（`hover.js`）、签名帮助（`signature.js`）、代码折叠（`folding.js`）、主题（`theme.js`）
- **本模块负责**：注册 `mybatis` 语言及其 Monarch 高亮
- **交互方式**：
  - `magic-script.js:7` import `initMybatis`，在 `initializeMagicScript()` 中第 1 行调用（`magic-script.js:11`）
  - `high-light.js:34` 在 `magicscript` 的 tokenizer 中，遇到 `"""` 时通过 `nextEmbedded: 'mybatis'` 切换到本模块的语言模式
  - 本模块的 `xml` 状态中，遇到 `>` 时通过 `nextEmbedded: 'mybatis'`（`mybatis.js:1408`）在标签体内恢复 SQL 高亮——此处 `nextEmbedded: 'mybatis'` 实际指向自身，形成自嵌入
- **边界清晰点**：本模块不注册 `magicscript` 的任何服务；012 模块不定义 `mybatis` 的词法规则

### 8.2 与 011-script-parser 的边界

- **011-script-parser 负责**：magic-script 的词法分析（`tokenizer.js`）、语法分析（`parser.js`）、AST 节点（`ast.js`）
- **本模块与 011 无任何交互**：
  - 不 import `parsing/` 下的任何文件
  - 不使用 Parser 进行语法校验
  - 不消费 AST 节点
- **边界清晰点**：本模块是纯 monaco 层面的高亮定义，与 magic-script 解析器完全解耦

### 8.3 与 005-resources-datasource 的边界

- **005-resources-datasource 负责**：数据源的 CRUD UI、数据源列表展示、驱动配置、连接测试
- **本模块与 005 无任何直接交互**：
  - 不读取数据源列表
  - 不引用 `db.*` 或 `dataSource` 变量
  - 不参与 SQL 执行
- **间接关联**：用户在数据源管理界面配置的 `key`（如 `db.user` 中的 `user`）对应 magic-script 中 `db.xxx` 调用时使用的数据源标识。本模块的 SQL 高亮不感知这些数据源名称，仅做通用 SQL 着色
- **边界清晰点**：数据源的元数据（key/name/url/driver）由 005 模块管理并通过 `JavaClass.setExtensionAttribute` 注入补全系统（`magic-datasource-list.vue:175`），本模块不参与此流程

### 8.4 与 001-editor-core 的边界

- **001-editor-core 负责**：编辑器组件生命周期、Tab 管理、保存/测试/调试
- **本模块与 001 无直接交互**：编辑器组件通过 `initializeMagicScript()` 间接初始化本模块，不直接调用 `initMybatis()`
- **边界清晰点**：编辑器不感知 `mybatis` 语言的存在，仅通过 `magicscript` 语言的 `nextEmbedded` 机制间接激活

---

## 9. 依赖清单

| 依赖 | 类型 | 用途 | 源码行 |
|---|---|---|---|
| `monaco-editor` | 外部库 | monaco 语言注册 API | `mybatis.js:1` |
| `@/scripts/editor/magic-script.js` | 内部模块（被调用方） | 调用 `initMybatis()` 初始化 | `magic-script.js:7,11` |
| `@/scripts/editor/high-light.js` | 内部模块（调用方） | 通过 `nextEmbedded: 'mybatis'` 激活本语言 | `high-light.js:34` |

---

## 附录：源码引用清单

| 文件 | 行号范围 | 引用说明 |
|---|---|---|
| `src/scripts/editor/mybatis.js` | 1-4 | import monaco、导出 `initMybatis`、注册语言 |
| `src/scripts/editor/mybatis.js` | 5-29 | 语言配置：注释、括号、自动闭合对、环绕对 |
| `src/scripts/editor/mybatis.js` | 31-38 | Monarch token provider 注册、基础配置（tokenPostfix、ignoreCase、brackets） |
| `src/scripts/editor/mybatis.js` | 39-948 | SQL 关键字词表（约 910 个 T-SQL 关键字） |
| `src/scripts/editor/mybatis.js` | 950-984 | SQL 运算符词表（逻辑/集合/连接/谓词/透视） |
| `src/scripts/editor/mybatis.js` | 986-1264 | SQL 内置函数词表（聚合/分析/转换/日期/字符串/数学/元数据/安全/系统等 20+ 类别） |
| `src/scripts/editor/mybatis.js` | 1266-1306 | SQL 系统变量词表（`@@` 前缀全局变量） |
| `src/scripts/editor/mybatis.js` | 1308 | SQL 伪列表（`$ACTION`/`$IDENTITY`/`$ROWGUID`/`$PARTITION`） |
| `src/scripts/editor/mybatis.js` | 1309-1333 | `root` 状态：注释/空白/伪列/数字/字符串/复杂标识符/作用域/MyBatis 标签/分隔符/标识符匹配/运算符 |
| `src/scripts/editor/mybatis.js` | 1335 | `whitespace` 状态 |
| `src/scripts/editor/mybatis.js` | 1336-1347 | `comments` / `comment` 状态（行注释 + 块注释） |
| `src/scripts/editor/mybatis.js` | 1348-1357 | `pseudoColumns` 状态 |
| `src/scripts/editor/mybatis.js` | 1359-1362 | `numbers` 状态（十六进制/货币/浮点） |
| `src/scripts/editor/mybatis.js` | 1364-1371 | `strings` / `string` 状态（含 N'...' Unicode 字符串） |
| `src/scripts/editor/mybatis.js` | 1373-1386 | `complexIdentifiers` / `bracketedIdentifier` / `quotedIdentifier` 状态 |
| `src/scripts/editor/mybatis.js` | 1387-1396 | `scopes` 状态（BEGIN TRAN/TRY/CATCH/CASE/WHEN/THEN） |
| `src/scripts/editor/mybatis.js` | 1398-1412 | `xml` 状态：MyBatis 标签属性解析 + 标签体 SQL 嵌入切换 |
| `src/scripts/editor/mybatis.js` | 1414-1417 | `xmlEmbedded` 状态：标签体内 SQL 高亮 + 闭合标签识别弹出 |
| `src/scripts/editor/magic-script.js` | 7 | import `initMybatis` |
| `src/scripts/editor/magic-script.js` | 11 | 调用 `initMybatis()` |
| `src/scripts/editor/high-light.js` | 34 | `nextEmbedded: 'mybatis'` 触发语言切换 |
