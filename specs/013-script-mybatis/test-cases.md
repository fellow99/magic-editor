# 013-script-mybatis 测试用例

> 模块编号：013-script-mybatis
> 关联规范：[spec.md](./spec.md)
> 对应源码：`src/scripts/editor/mybatis.js`
> 用例编号格式：`TC-013-NNN`

---

## 1. 测试范围

**纳入**：`mybatis` 语言注册、配置、Monarch 高亮（关键字/运算符/函数/系统变量/伪列）、状态机切换（root/xml/xmlEmbedded/strings/numbers/comments/scopes/complexIdentifiers）。

**排除**：magic-script 语言（012）、SQL 执行（005）、AST 解析（011）、补全/悬停/签名/折叠/格式化（FR-091 明确不实现）。

---

## 2. 环境前置

| 项 | 期望 |
|---|---|
| monaco-editor | 0.29.1 已加载 |
| `initMybatis()` | 已调用（由 `initializeMagicScript()` 触发） |
| 测试方式 | 使用 monaco tokenizer API：`monaco.editor.tokenize(text, 'mybatis')` |

---

## 3. 语言注册与配置（FR-001~006）

### TC-013-001 注册 mybatis 语言
- **关联**：FR-001
- **优先级**：P0
- **预期**：`monaco.languages.getLanguages()` 含 `id='mybatis'`

### TC-013-002 语言配置注册
- **关联**：FR-002
- **优先级**：P0
- **预期**：`setLanguageConfiguration('mybatis', ...)` 被调用

### TC-013-003 注释配置
- **关联**：FR-003
- **优先级**：P0
- **预期**：行注释 `--`、块注释 `/* */`

### TC-013-004 括号配置
- **关联**：FR-004
- **优先级**：P0
- **预期**：brackets 包含 `{}`、`[]`、`()` 三组

### TC-013-005 自动闭合 / 环绕对
- **关联**：FR-005、FR-006
- **优先级**：P0
- **预期**：`{}`/`[]`/`()`/`""`/`''` 五组同时配置在 autoClosingPairs 与 surroundingPairs

---

## 4. Monarch 提供器基础（FR-010~012）

### TC-013-010 注册 Monarch 提供器
- **关联**：FR-010
- **优先级**：P0
- **预期**：`setMonarchTokensProvider('mybatis', ...)` 被调用

### TC-013-011 tokenPostfix
- **关联**：FR-011
- **优先级**：P0
- **预期**：tokenPostfix=`.sql`，token type 输出形如 `keyword.sql`

### TC-013-012 ignoreCase
- **关联**：FR-012、NFR-001
- **优先级**：P0
- **输入**：`select`、`SELECT`、`Select`
- **预期**：均命中 keyword token

---

## 5. SQL 词表（FR-020~061）

### TC-013-020 关键字词表完整性
- **关联**：FR-020、FR-021
- **优先级**：P0
- **抽样输入**：`SELECT`、`INSERT`、`CREATE`、`ALTER`、`DROP`、`BEGIN`、`COMMIT`、`ROLLBACK`、`IF`、`WHILE`、`TRY`、`CATCH`
- **预期**：全部命中 keyword

### TC-013-021 数据类型关键字
- **关联**：FR-022
- **优先级**：P0
- **抽样**：`INT`、`VARCHAR`、`DATETIME`、`XML`、`NVARCHAR`、`BIT`
- **预期**：均命中 keyword

### TC-013-022 关键字 token 类型
- **关联**：FR-023
- **优先级**：P0
- **预期**：token type 为 `keyword.sql`

### TC-013-030 运算符词表
- **关联**：FR-030、FR-031
- **优先级**：P0
- **抽样**：`AND`、`OR`、`NOT`、`UNION`、`INTERSECT`、`JOIN`、`LEFT`、`INNER`、`OUTER`、`CROSS`、`APPLY`、`IN`、`LIKE`、`BETWEEN`、`EXISTS`、`PIVOT`、`UNPIVOT`
- **预期**：均命中 operator token

### TC-013-040 内置函数词表
- **关联**：FR-040、FR-041
- **优先级**：P0
- **抽样**：`COUNT`、`MAX`、`SUM`、`AVG`、`CONCAT`、`SUBSTRING`、`GETDATE`、`ROW_NUMBER`、`CAST`、`CONVERT`
- **预期**：均命中 predefined token

### TC-013-050 系统变量
- **关联**：FR-050、FR-051
- **优先级**：P0
- **抽样**：`@@VERSION`、`@@SPID`、`@@ROWCOUNT`、`@@TRANCOUNT`
- **预期**：均命中 predefined token

### TC-013-060 伪列
- **关联**：FR-060、FR-061
- **优先级**：P1
- **输入**：`$ACTION`、`$IDENTITY`、`$ROWGUID`、`$PARTITION`
- **预期**：命中 predefined token（pseudoColumns 状态）

---

## 6. Tokenizer 状态机（FR-070~083）

### TC-013-070 root 注释优先级
- **关联**：FR-070
- **优先级**：P0
- **输入**：`-- 行注释` 与 `/* 块注释 */`
- **预期**：均命中 comment token

### TC-013-071 数字识别
- **关联**：FR-079
- **优先级**：P0
- **输入**：`0xAF`、`$100.50`、`1.5e10`、`42`
- **预期**：均命中 number token

### TC-013-072 字符串与 N''
- **关联**：FR-080、FR-081
- **优先级**：P0
- **输入**：`'abc'`、`N'中文'`、`'it''s'`（含转义）
- **预期**：均命中 string token；`''` 转义不终止字符串

### TC-013-073 复杂标识符
- **关联**：FR-082
- **优先级**：P1
- **输入**：`[user table]`、`"col name"`
- **预期**：括号/引号包裹内容作为 identifier token

### TC-013-074 scopes 多词关键字
- **关联**：FR-083
- **优先级**：P1
- **输入**：`BEGIN TRY ... END TRY`、`BEGIN CATCH ... END CATCH`、`BEGIN TRAN`、`CASE WHEN x THEN 1 END`
- **预期**：完整短语命中 scope/keyword

### TC-013-075 块注释非嵌套
- **关联**：FR-078、C-003
- **优先级**：P1
- **输入**：`/* outer /* inner */ tail */`
- **预期**：第一个 `*/` 即结束块注释；`tail */` 落入 root

### TC-013-076 root 标识符匹配
- **关联**：FR-070
- **优先级**：P0
- **输入**：`#{userId}`、`${param}`
- **预期**：A-004 — 不特殊处理，作为普通 identifier token 着色

---

## 7. MyBatis XML 标签嵌入（FR-071~075）

### TC-013-080 五种标签触发 xml 状态
- **关联**：FR-071
- **优先级**：P0
- **输入**：分别 `<where>`、`<set>`、`<foreach>`、`<if>`、`<trim>`
- **预期**：tag 名命中 tag token，状态切换至 xml

### TC-013-081 属性名 / 属性值
- **关联**：FR-072
- **优先级**：P0
- **输入**：`<if test="status != null">`
- **预期**：`test` → attribute.name；`"status != null"` → attribute.value（双引号或单引号均可）

### TC-013-082 标签体内 SQL 嵌入
- **关联**：FR-073
- **优先级**：P0
- **输入**：`<if test="a">SELECT * FROM t</if>`
- **预期**：`>` 之后通过 `nextEmbedded='mybatis'` 重新进入 SQL 高亮，`SELECT`、`FROM` 命中 keyword

### TC-013-083 闭合标签弹出嵌入
- **关联**：FR-074、FR-075
- **优先级**：P0
- **输入**：`</where>`、`</if>`、`</set>`、`</foreach>`、`</trim>`
- **预期**：识别后弹出 mybatis 嵌入并退出 xml 状态返回 root

### TC-013-084 嵌套标签结构
- **关联**：US-002、接受场景 4
- **优先级**：P0
- **输入**：`<where><if test="x">AND a=#{a}</if><foreach collection="ids" item="i" open="(" separator="," close=")">#{i}</foreach></where>`
- **预期**：所有 5 个标签均正确开闭，内层 SQL 命中 keyword/identifier

### TC-013-085 foreach 多属性
- **关联**：FR-072、接受场景 3
- **优先级**：P0
- **输入**：`<foreach collection="ids" item="id" open="(" separator="," close=")">`
- **预期**：5 个属性名命中 attribute.name；5 个属性值命中 attribute.value

---

## 8. 边界与异常

| 编号 | 场景 | 关联 | 预期 |
|---|---|---|---|
| TC-013-200 | SQL 中 `<` 比较运算符 | C-004 | **风险记录**：`WHERE a < b` 中 `<` 可能触发 xml 误判（仅在标签匹配关键字 where/set/foreach/if/trim 时），其它场景 `<` 仍为 operator |
| TC-013-201 | 不支持的 MyBatis 标签 `<choose>`、`<when>`、`<otherwise>` | A-003 | 不进入 xml 状态，按普通 SQL 字符处理 |
| TC-013-202 | 三引号未闭合至文件末 | — | xmlEmbedded/xml 状态保留至 EOF，不抛错 |
| TC-013-203 | 标签未闭合 `<if test="x">SELECT 1` | — | 状态停留在 xmlEmbedded，不抛错；后续 `</if>` 出现时正常弹出 |
| TC-013-204 | 属性值包含转义引号 `<if test="a=\"b\"">` | — | 风险记录：当前 tokenizer 仅识别非引号字符 |
| TC-013-205 | 单行注释直至行尾 `-- comment\n` | FR-077 | 注释仅延伸到换行 |
| TC-013-206 | 标签名大小写 `<IF>`、`<If>` | — | 识别行为遵循 ignoreCase=true，应均触发 xml |
| TC-013-207 | 极大 keywords 词表性能 | NFR-001、NFR-002 | 1000 行 SQL 高亮无明显卡顿（性能记录） |
| TC-013-208 | 重复调用 initMybatis | — | monaco 自身去重或幂等覆盖 |
| TC-013-209 | mybatis 单独使用（脱离三引号） | A-001 | 可独立工作（NFR-003），高亮规则不变 |
| TC-013-210 | 用户自定义 SQL 函数 | C-002 | 不支持运行时扩展，按 identifier 着色 |
| TC-013-211 | 货币数字 `$100.5` 与伪列 `$ACTION` 区分 | FR-079、FR-060 | 数字优先匹配；`$ACTION` 命中 pseudoColumns（顺序由 root 状态决定） |
| TC-013-212 | 反引号标识符 \`col\` | — | 当前不在 complexIdentifiers 中处理，按普通 token 切割（风险记录） |

---

## 9. 索引摘要

| 章节 | 用例区间 | 数量 |
|---|---|---|
| 注册与配置 | TC-013-001~005 | 5 |
| Monarch 基础 | TC-013-010~012 | 3 |
| SQL 词表 | TC-013-020~060 | 7 |
| 状态机 | TC-013-070~076 | 7 |
| MyBatis 嵌入 | TC-013-080~085 | 6 |
| 边界异常 | TC-013-200~212 | 13 |
| **合计** | | **41** |

> P0 ≈ 27，P1 ≈ 7，边界 13（多为风险记录）
