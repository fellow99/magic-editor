# 013-script-mybatis 技术实现计划（As-Built）

> 本文件以"已建成系统"视角记录 013-script-mybatis 模块的实际技术实现。
> 模块编号：013-script-mybatis
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. Technical Context

### 1.1 Runtime Environment

| 维度 | 值 | 来源 |
|---|---|---|
| 运行环境 | 浏览器（现代浏览器，ES2020+） | [TECH.md §7](../TECH.md#7-浏览器目标) |
| 前端框架 | Vue 3.4.x（本模块不直接 import Vue） | `mybatis.js` 全文无 Vue 引用 |
| 编辑器内核 | monaco-editor 0.29.1 | [TECH.md §1](../TECH.md#1-核心框架) |
| 模块系统 | ES Modules（Vite 构建） | [TECH.md §2](../TECH.md#2-构建工具链) |
| 语言 | JavaScript（无 TypeScript） | 源码全为 `.js` |
| 激活方式 | 仅在 magic-script 三引号字符串内被 `nextEmbedded: 'mybatis'` 激活 | `high-light.js:34` |

### 1.2 Dependencies

#### 直接依赖（源码 import）

| 依赖 | 版本 | 路径 | 用途 |
|---|---|---|---|
| `monaco-editor` | ^0.29.1 | `mybatis.js:1` | 语言注册 API（`register`/`setLanguageConfiguration`/`setMonarchTokensProvider`） |

#### 间接依赖（调用方）

| 依赖 | 类型 | 路径 | 用途 |
|---|---|---|---|
| `@/scripts/editor/magic-script.js` | 内部模块（调用方） | `magic-script.js:7,11` | import `initMybatis` 并在 `initializeMagicScript()` 中调用 |
| `@/scripts/editor/high-light.js` | 内部模块（触发方） | `high-light.js:34` | 通过 `nextEmbedded: 'mybatis'` 在 magicscript tokenizer 中切换到本语言 |

#### 间接依赖（工程级）

| 依赖 | 版本 | 用途 |
|---|---|---|
| `vue` | ^3.4.0 | 前端框架（库模式下 external） |
| `monaco-editor` | ^0.29.1 | 编辑器内核（Monarch tokenizer 运行时） |

---

## 2. Constitution Check

| 原则编号 | 原则名称 | 合规状态 | 依据 |
|---|---|---|---|
| 第一条 | 单一主组件 + 注入式配置 | ✅ Compliant | 本模块为纯 monaco 语言定义，不涉及组件/props/config 注入 |
| 第二条 | 前后端契约即真相 | ✅ Compliant | 本模块不持有/持久化任何业务数据，无 localStorage/HTTP 操作 |
| 第三条 | 通信双通道：HTTP + WebSocket | ✅ Compliant | 本模块不涉及任何网络通信 |
| 第四条 | 事件总线即全局状态 | ✅ Compliant | 本模块不使用 bus.js，无跨组件通信 |
| 第五条 | monaco 一切围绕 magic-script | ✅ Compliant | 本模块专为 magic-script 的 MyBatis 风格 SQL 高亮而设，语言 ID 固定为 `mybatis`，由 `magic-script.js:11` 在初始化时注册 |
| 第六条 | 类型契约由 Header 表达 | ✅ Compliant | 本模块不涉及 HTTP 请求 |
| 第七条 | 国际化只信语言包索引化 | ✅ Compliant | 本模块不涉及 i18n，无 monaco nls 调用 |
| 第八条 | 双构建产物共存 | ✅ Compliant | 本模块为纯 JS 模块，两种构建模式均正常打包 |
| 第九条 | 错误反馈走模态框 + Bus | ✅ Compliant | 本模块为纯高亮定义，无运行时错误路径 |
| 第十条 | 源代码即文档真相 | ✅ Compliant | 本文档所有论断均附源码行号 |

### 例外登记

无。

---

## 3. Project Structure

### 3.1 模块文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/scripts/editor/mybatis.js` | 1419 | 唯一文件：`initMybatis()` 导出函数，包含语言注册、语言配置、Monarch token provider（词表 + tokenizer 状态机） |

### 3.2 文件内部结构

```
mybatis.js (1419 行)
├── import * as monaco (行 1)
├── export const initMybatis = () => { (行 2)
│   ├── monaco.languages.register({ id: 'mybatis' }) (行 4)
│   ├── monaco.languages.setLanguageConfiguration (行 5-29)
│   │   ├── comments: lineComment='--', blockComment=['/*','*/'] (行 6-9)
│   │   ├── brackets: {} [] () (行 10-14)
│   │   ├── autoClosingPairs: {} [] () "" '' (行 15-21)
│   │   └── surroundingPairs: {} [] () "" '' (行 22-28)
│   └── monaco.languages.setMonarchTokensProvider (行 31-1419)
│       ├── defaultToken: '' (行 32)
│       ├── tokenPostfix: '.sql' (行 33)
│       ├── ignoreCase: true (行 34)
│       ├── brackets 定义 (行 35-38)
│       ├── keywords[] 词表 (行 39-948) — 约 910 个 T-SQL 关键字
│       ├── operators[] 词表 (行 950-984) — 逻辑/集合/连接/谓词/透视/合并
│       ├── builtinFunctions[] 词表 (行 986-1264) — 20+ 类别
│       ├── builtinVariables[] 词表 (行 1266-1306) — @@ 前缀全局变量
│       ├── pseudoColumns[] (行 1308) — $ACTION/$IDENTITY/$ROWGUID/$PARTITION
│       └── tokenizer 状态机 (行 1309-1417)
│           ├── root (行 1310-1333) — 入口状态，13 条规则
│           ├── whitespace (行 1335) — 空白匹配
│           ├── comments (行 1336-1339) — 行注释 + 块注释入口
│           ├── comment (行 1340-1347) — 块注释内容（不支持嵌套）
│           ├── pseudoColumns (行 1348-1357) — $ 前缀伪列
│           ├── numbers (行 1359-1362) — 十六进制/货币/浮点
│           ├── strings (行 1364-1366) — N'...' 和 '...' 入口
│           ├── string (行 1368-1371) — 字符串内容，支持 '' 转义
│           ├── complexIdentifiers (行 1373-1375) — [...] 和 "..." 入口
│           ├── bracketedIdentifier (行 1377-1381) — 方括号标识符内容
│           ├── quotedIdentifier (行 1382-1386) — 双引号标识符内容
│           ├── scopes (行 1387-1396) — BEGIN TRAN/TRY/CATCH/CASE/WHEN/THEN
│           ├── xml (行 1398-1412) — MyBatis 标签属性解析 + SQL 嵌入切换
│           └── xmlEmbedded (行 1414-1417) — 标签体内 SQL 高亮 + 闭合标签弹出
└── } (行 1420)
```

### 3.3 与相邻模块的物理边界

```
src/scripts/editor/
├── magic-script.js        ← 012-script-language（调用 initMybatis）
├── high-light.js          ← 012-script-language（nextEmbedded: 'mybatis' 触发切换）
├── mybatis.js             ← 013-script-mybatis（本模块）
├── completion.js          ← 012-script-language（补全，不涉及 mybatis）
├── hover.js               ← 012-script-language（悬停，不涉及 mybatis）
├── signature.js           ← 012-script-language（签名帮助，不涉及 mybatis）
├── folding.js             ← 012-script-language（折叠，不涉及 mybatis）
└── theme.js               ← 012-script-language（主题，不涉及 mybatis）

src/scripts/parsing/       ← 011-script-parser（本模块无任何交互）
```

---

## 4. Phase 0 Research

### 4.1 已解决的技术决策

| 决策点 | 选择 | 理由 | 源码证据 |
|---|---|---|---|
| 词法分析引擎 | Monarch（monaco 内置） | monaco 0.29.x 原生支持，无需额外依赖，与 magicscript 高亮（`high-light.js`）使用同一引擎 | `mybatis.js:31` |
| 关键字词表规模 | 约 910 个 T-SQL 关键字全量内联 | 覆盖 SQL Server 全量关键字，避免遗漏导致高亮缺失 | `mybatis.js:39-948` |
| 大小写匹配 | `ignoreCase: true` | SQL 关键字不区分大小写，避免 `SELECT`/`select`/`Select` 重复定义 | `mybatis.js:34` |
| MyBatis 标签范围 | 仅支持 5 种：`<if>`/`<foreach>`/`<where>`/`<set>`/`<trim>` | 覆盖最常用的动态 SQL 标签，`<choose>`/`<when>`/`<otherwise>` 未纳入 | `mybatis.js:1318` |
| 标签体 SQL 嵌入 | `nextEmbedded: 'mybatis'`（自嵌入） | 标签体内恢复 SQL 高亮，指向自身语言 ID 形成递归嵌入 | `mybatis.js:1408` |
| 参数占位符处理 | 不做特殊处理，作为普通标识符匹配 | `#{}`/`${}` 被 `[\w@#$]+` 正则覆盖，`#` 和 `$` 在字符类中 | `mybatis.js:1322` |
| 块注释嵌套 | 不支持 | 注释中明确说明 `nested comments seem to not be standard`，嵌套规则被注释掉 | `mybatis.js:1342-1344` |
| 词表组织方式 | 扁平数组字面量 | 简单直接，Monarch 的 `@keywords` 语法直接引用数组 | `mybatis.js:39-1306` |
| 运算符与关键字分离 | 独立 `operators` 数组 | 逻辑/集合/连接/谓词/透视运算符单独归类，token 标记为 `operator` 而非 `keyword` | `mybatis.js:950-984, 1326` |
| 作用域关键字正则匹配 | `scopes` 状态使用正则而非词表 | `BEGIN TRAN`/`BEGIN TRY` 等多词结构需正则匹配，无法用单字词表覆盖 | `mybatis.js:1387-1396` |

### 4.2 已识别的技术债

| 问题 | 风险等级 | 说明 |
|---|---|---|
| `xmlEmbedded` 中 `[^<]+` 误判 `<` 运算符 | 中 | `xmlEmbedded` 状态使用 `[/[^<]+/, '']` 匹配非 `<` 字符，若 SQL 中出现 `WHERE a < b`，`<` 会被 `root` 状态的标识符规则重新匹配，但 `< b` 可能被误判为标签开头（spec.md C-004 / NC-001） |
| 词表为静态数组，不支持运行时扩展 | 低 | 用户自定义 SQL 函数无法加入高亮词表，需修改源码（spec.md C-002） |
| MyBatis 标签仅支持 5 种 | 低 | `<choose>`/`<when>`/`<otherwise>`/`<bind>` 等标签不被识别，将作为普通标识符着色（spec.md A-003） |
| `#{}`/`${}` 参数占位符无特殊高亮 | 低 | 与普通标识符使用相同 token，无法在视觉上区分 MyBatis 参数引用和普通列名（spec.md A-004） |

---

## 5. Phase 1 Design Outputs

### 5.1 Data Model（引用）

本模块不涉及业务数据模型。词表数据结构已在以下文档中定义：

- **SQL 关键字表**：[spec.md §4 关键实体](./spec.md#4-关键实体) — `keywords[]`（约 910 个 T-SQL 关键字）
- **SQL 运算符表**：[spec.md §4](./spec.md#4-关键实体) — `operators[]`（逻辑/集合/连接/谓词/透视/合并）
- **SQL 内置函数表**：[spec.md §4](./spec.md#4-关键实体) — `builtinFunctions[]`（20+ 类别）
- **SQL 系统变量表**：[spec.md §4](./spec.md#4-关键实体) — `builtinVariables[]`（`@@` 前缀全局变量）
- **SQL 伪列表**：[spec.md §4](./spec.md#4-关键实体) — `pseudoColumns[]`（`$` 前缀伪列）
- **Tokenizer 状态机**：[spec.md §3.8](./spec.md#38-tokenizer-状态机) — 14 个状态定义

### 5.2 Contracts（引用）

本模块的接口契约已在以下文档中定义：

- **语言注册契约**：[spec.md §3.1](./spec.md#31-语言注册) — FR-001 ~ FR-006
- **Monarch Provider 契约**：[spec.md §3.2](./spec.md#32-monarch-词法提供器) — FR-010 ~ FR-012
- **模块间边界**：[spec.md §8](./spec.md#8-与其他模块的边界) — 与 012/011/005/001 的边界

### 5.3 Quickstart

本模块为纯 monaco 语言定义模块，无独立运行方式。使用方式：

1. 确保 `monaco-editor` 已安装并可用
2. 确保 `initializeMagicScript()` 已调用（`magic-script.js:11`），内部第 1 行即调用 `initMybatis()`
3. 在 magic-script 编辑器中输入三引号字符串 `"""`，`high-light.js:34` 的 `nextEmbedded: 'mybatis'` 自动激活本语言
4. 输入包含 MyBatis 标签的 SQL 即可看到高亮效果

开发调试：
```bash
npm run serve        # 启动 dev server
# 访问 http://localhost:5173（需后端 magic-api 运行在 :9999）
# 在编辑器中输入 API 脚本，使用三引号字符串编写 MyBatis SQL
```

---

## 6. FR 实现策略映射

本节将 spec.md 中定义的每个 FR 映射到具体实现策略。

### 6.1 语言注册（FR-001 ~ FR-006）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-001 | `monaco.languages.register({ id: 'mybatis' })` 注册语言 | `mybatis.js:4` |
| FR-002 | `monaco.languages.setLanguageConfiguration(language, config)` 配置语言选项 | `mybatis.js:5` |
| FR-003 | `comments: { lineComment: '--', blockComment: ['/*', '*/'] }` | `mybatis.js:6-9` |
| FR-004 | `brackets: [['{','}'], ['[',']'], ['(',')']]` | `mybatis.js:10-14` |
| FR-005 | `autoClosingPairs` 五组：`{}` `[]` `()` `""` `''` | `mybatis.js:15-21` |
| FR-006 | `surroundingPairs` 与 autoClosingPairs 完全一致 | `mybatis.js:22-28` |

### 6.2 Monarch 词法提供器（FR-010 ~ FR-012）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-010 | `monaco.languages.setMonarchTokensProvider(language, {...})` 注册 | `mybatis.js:31` |
| FR-011 | `tokenPostfix: '.sql'` 标识 SQL 方言 | `mybatis.js:33` |
| FR-012 | `ignoreCase: true` 关键字不区分大小写 | `mybatis.js:34` |

### 6.3 SQL 关键字词表（FR-020 ~ FR-023）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-020 | `keywords` 数组包含约 910 个 T-SQL 关键字，从 `ABORT_AFTER_WAIT` 到 `YMIN` | `mybatis.js:39-948` |
| FR-021 | 词表覆盖 DDL（`CREATE`/`ALTER`/`DROP`）、DML（`SELECT`/`INSERT`/`UPDATE`/`DELETE`）、事务（`BEGIN`/`COMMIT`/`ROLLBACK`）、流程控制（`IF`/`WHILE`/`TRY`/`CATCH`）等 | `mybatis.js:39-948` |
| FR-022 | 数据类型关键字包含在内：`BIGINT`/`BINARY`/`BIT`/`CHAR`/`DATETIME`/`XML`/`NVARCHAR` 等 | `mybatis.js:114-1223` |
| FR-023 | tokenizer `root` 状态中 `cases: { '@keywords': 'keyword' }` 标记为 `keyword` token | `mybatis.js:1324-1325` |

### 6.4 SQL 运算符词表（FR-030 ~ FR-031）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-030 | `operators` 数组按注释分组：Logical（`ALL`/`AND`/`BETWEEN`/`EXISTS`/`IN`/`LIKE`/`NOT`/`OR`/`SOME`）、Set（`EXCEPT`/`INTERSECT`/`UNION`）、Join（`APPLY`/`CROSS`/`FULL`/`INNER`/`JOIN`/`LEFT`/`OUTER`/`RIGHT`）、Predicates（`CONTAINS`/`FREETEXT`/`IS`/`NULL`）、Pivoting（`PIVOT`/`UNPIVOT`）、Merging（`MATCHED`） | `mybatis.js:950-984` |
| FR-031 | tokenizer `root` 状态中 `cases: { '@operators': 'operator' }` 标记为 `operator` token | `mybatis.js:1326` |

### 6.5 SQL 内置函数词表（FR-040 ~ FR-041）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-040 | `builtinFunctions` 数组按注释分为 20+ 类别：Aggregate（`AVG`/`COUNT`/`MAX`/`MIN`/`SUM` 等 12 个）、Analytic（`CUME_DIST`/`LAG`/`LEAD`/`ROW_NUMBER` 等 8 个）、Collation（3 个）、Azure（1 个）、Conversion（`CAST`/`CONVERT`/`PARSE` 等 6 个）、Cryptographic（24 个）、Cursor（1 个）、Datatype（6 个）、Datetime（17 个）、Logical（`CHOOSE`/`COALESCE`/`IIF`/`NULLIF`）、Mathematical（20 个）、Metadata（30 个）、Ranking（4 个）、Replication（1 个）、Rowset（4 个）、Security（22 个）、String（23 个）、System（18 个）、TextImage（2 个）、Trigger（4 个）、ChangeTracking（5 个）、FullTextSearch（2 个）、SemanticTextSearch（3 个）、FileStream（4 个）、ServiceBroker（1 个） | `mybatis.js:986-1264` |
| FR-041 | tokenizer `root` 状态中 `cases: { '@builtinFunctions': 'predefined' }` 标记为 `predefined` token | `mybatis.js:1328` |

### 6.6 SQL 系统变量词表（FR-050 ~ FR-051）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-050 | `builtinVariables` 数组按注释分组：Configuration（`@@DATEFIRST`/`@@VERSION`/`@@SPID` 等 14 个）、Cursor（`@@CURSOR_ROWS`/`@@FETCH_STATUS`）、Datetime（`@@DATEFIRST` 重复）、Metadata（`@@PROCID`）、System（`@@ERROR`/`@@IDENTITY`/`@@ROWCOUNT`/`@@TRANCOUNT`）、Stats（`@@CONNECTIONS`/`@@CPU_BUSY`/`@@IO_BUSY` 等 10 个） | `mybatis.js:1266-1306` |
| FR-051 | tokenizer `root` 状态中 `cases: { '@builtinVariables': 'predefined' }` 标记为 `predefined` token | `mybatis.js:1327` |

### 6.7 SQL 伪列词表（FR-060 ~ FR-061）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-060 | `pseudoColumns: ['$ACTION', '$IDENTITY', '$ROWGUID', '$PARTITION']` | `mybatis.js:1308` |
| FR-061 | `pseudoColumns` 状态中 `/[$][A-Za-z_][\w@#$]*/` 匹配 `$` 开头标识符，`cases: { '@pseudoColumns': 'predefined' }` 标记为 `predefined` | `mybatis.js:1348-1357` |

### 6.8 Tokenizer 状态机（FR-070 ~ FR-083）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-070 | `root` 状态包含 13 条规则：`@comments`/`@whitespace`/`@pseudoColumns`/`@numbers`/`@strings`/`@complexIdentifiers`/`@scopes` 共 7 个 include，MyBatis 标签匹配、分隔符、括号、标识符/关键字匹配、运算符匹配共 6 条内联规则 | `mybatis.js:1310-1333` |
| FR-071 | `[(<)(where\|set\|foreach\|if\|trim)/, ['delimiter', { token: 'tag', next: '@xml' }]]` 匹配 `<where`/`<set`/`<foreach`/`<if`/`<trim`，切换到 `xml` 状态 | `mybatis.js:1318` |
| FR-072 | `xml` 状态处理：`"([^"]*)"` → `attribute.value`、`'([^']*)'` → `attribute.value`、`[\w\-]+` → `attribute.name`、`=` → `delimiter` | `mybatis.js:1399-1402` |
| FR-073 | `xml` 状态中 `>` 匹配 → `{ token: 'delimiter', next: '@xmlEmbedded', nextEmbedded: 'mybatis' }`，切换到 `xmlEmbedded` 并嵌入 `mybatis` 语言恢复 SQL 高亮 | `mybatis.js:1403-1409` |
| FR-074 | `xmlEmbedded` 状态中 `</(where\|if\|set\|foreach\|trim)` 匹配 → `{ token: 'tag', next: '@pop', nextEmbedded: '@pop' }`，弹出嵌入语言并返回 `xml` 状态 | `mybatis.js:1415` |
| FR-075 | `xml` 状态中 `(<\/)(where\|if\|set\|foreach\|trim)(>)` 匹配自闭合/结束标签 → `['delimiter', 'tag', { token: 'delimiter', next: '@pop' }]` | `mybatis.js:1412` |
| FR-076 | `whitespace` 状态：`/\s+/` → `white` | `mybatis.js:1335` |
| FR-077 | `comments` 状态：`/--+.*/` → `comment`（行注释），`/\/\*/` → `{ token: 'comment.quote', next: '@comment' }`（块注释入口） | `mybatis.js:1336-1338` |
| FR-078 | `comment` 状态：`/[^*/]+/` → `comment`，`/\*\//` → `{ token: 'comment.quote', next: '@pop' }`，`/./` → `comment` | `mybatis.js:1340-1346` |
| FR-079 | `numbers` 状态：`/0[xX][0-9a-fA-F]*/` → `number`（十六进制），`/[$][+-]*\d*(\.\d*)?/` → `number`（货币），`/((\d+(\.\d*)?)\|(\.\d+))([eE][\-+]?\d+)?/` → `number`（浮点/科学计数法） | `mybatis.js:1359-1362` |
| FR-080 | `strings` 状态：`/N'/` → `{ token: 'string', next: '@string' }`（Unicode 字符串），`/'/` → `{ token: 'string', next: '@string' }`（普通字符串） | `mybatis.js:1364-1366` |
| FR-081 | `string` 状态：`/[^']+/` → `string`，`/''/` → `string`（转义），`/'/` → `{ token: 'string', next: '@pop' }` | `mybatis.js:1368-1371` |
| FR-082 | `complexIdentifiers` 状态：`/\[/` → `{ token: 'identifier.quote', next: '@bracketedIdentifier' }`，`/"/` → `{ token: 'identifier.quote', next: '@quotedIdentifier' }` | `mybatis.js:1373-1375` |
| FR-083 | `scopes` 状态：8 条正则分别匹配 `BEGIN TRAN`/`BEGIN TRY`/`END TRY`/`BEGIN CATCH`/`END CATCH`/`BEGIN|CASE`/`END`/`WHEN`/`THEN`，token 分别为 `keyword`/`keyword.try`/`keyword.catch`/`keyword.block`/`keyword.choice` | `mybatis.js:1387-1396` |

### 6.9 对外注册的 Monaco Provider（FR-090 ~ FR-092）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-090 | 仅调用 `monaco.languages.register` 和 `monaco.languages.setMonarchTokensProvider`，无其它注册 | `mybatis.js:4, 31` |
| FR-091 | 全文未见 `registerCompletionProvider`/`registerHoverProvider`/`registerSignatureHelpProvider`/`registerFoldingRangeProvider`/`registerDocumentFormattingEditProvider` 调用 | `mybatis.js` 全文 |
| FR-092 | 全文未见 `monaco.editor.defineTheme` 调用 | `mybatis.js` 全文 |

---

## 7. Complexity Tracking

### 7.1 复杂度热点

| 区域 | 复杂度来源 | 行数 | 说明 |
|---|---|---|---|
| `keywords` 词表 | 约 910 个关键字的维护 | 910 行（行 39-948） | 纯数据，无逻辑复杂度，但维护成本高（新增/删除需手动编辑） |
| `builtinFunctions` 词表 | 20+ 类别、约 280 个函数 | 279 行（行 986-1264） | 按类别注释分组，结构清晰 |
| `root` 状态 | 13 条规则的优先级顺序 | 24 行（行 1310-1333） | 规则顺序决定匹配优先级：注释→空白→伪列→数字→字符串→复杂标识符→作用域→MyBatis 标签→分隔符→括号→标识符→运算符 |
| `xml` / `xmlEmbedded` 状态 | 双向嵌入/弹出逻辑 | 15 行（行 1398-1417） | `nextEmbedded: 'mybatis'` 自嵌入 + `nextEmbedded: '@pop'` 弹出，形成嵌套状态机 |
| `scopes` 状态 | 多词正则匹配 | 10 行（行 1387-1396） | `BEGIN\s+(DISTRIBUTED\s+)?TRAN(SACTION)?\b/i` 等复杂正则 |

### 7.2 Tokenizer 状态转换图

```
root ──(注释/空白/数字/字符串/标识符/运算符)──→ root（自循环）
  │
  ├─ <where|set|foreach|if|trim ──→ xml
  │
xml ──(属性名/属性值/等号/空白)──→ xml（自循环）
  │
  ├─ > ──→ xmlEmbedded（nextEmbedded: 'mybatis'，恢复 SQL 高亮）
  │
  └─ </where|if|set|foreach|trim> ──→ @pop（返回 root）
       │
xmlEmbedded ──([^<]+)──→ xmlEmbedded（自循环，SQL 内容）
       │
       └─ </where|if|set|foreach|trim ──→ @pop + nextEmbedded: @pop（弹出 SQL 嵌入，返回 xml）
```

### 7.3 规则优先级分析

`root` 状态的规则按**从上到下**顺序匹配，Monarch 采用"第一条匹配即停止"策略：

1. `@comments` — 优先匹配 `--` 和 `/*`，避免注释内容被后续规则误判
2. `@whitespace` — 跳过空白
3. `@pseudoColumns` — `$ACTION` 等伪列优先于普通标识符
4. `@numbers` — 数字优先于标识符（避免 `123` 被当作标识符）
5. `@strings` — 字符串优先于标识符
6. `@complexIdentifiers` — `[...]` 和 `"..."` 优先于普通标识符
7. `@scopes` — `BEGIN TRAN` 等多词结构优先于单字 `BEGIN`
8. MyBatis 标签 — `<if` 等优先于 `<` 运算符
9. 分隔符/括号 — 单字符匹配
10. 标识符/关键字 — `[\w@#$]+` 宽泛匹配，通过 `cases` 分发到 keyword/operator/predefined/identifier
11. 运算符 — `[<>=!%&+\-*/|~^]` 单字符运算符兜底

**关键优先级依赖**：MyBatis 标签规则（行 1318）必须在标识符规则（行 1322）之前，否则 `<if` 会被拆分为 `<`（运算符）+ `if`（关键字）。

---

## 8. Progress Tracking

### 8.1 文档完成状态

| 章节 | 状态 | 备注 |
|---|---|---|
| 1. Technical Context | ✅ 完成 | 运行环境 + 依赖清单完整，附源码行号 |
| 2. Constitution Check | ✅ 完成 | 10 条原则逐一检查，无例外 |
| 3. Project Structure | ✅ 完成 | 单文件清单 + 内部结构树 + 物理边界 |
| 4. Phase 0 Research | ✅ 完成 | 10 项技术决策 + 4 项技术债 |
| 5. Phase 1 Design Outputs | ✅ 完成 | data-model/contracts/quickstart 引用对齐 |
| 6. FR 实现策略映射 | ✅ 完成 | 全部 28 个 FR（FR-001~FR-092）一一映射到实现策略 |
| 7. Complexity Tracking | ✅ 完成 | 5 个复杂度热点 + 状态转换图 + 规则优先级分析 |
| 8. Progress Tracking | ✅ 完成 | 本章节 |

### 8.2 与总体文档对齐检查

| 对齐项 | 状态 | 说明 |
|---|---|---|
| spec.md FR 编号 | ✅ 对齐 | FR-001~FR-092 共 28 个需求全部映射 |
| spec.md NC 待澄清 | ✅ 对齐 | NC-001（`<` 运算符误判）已在 §4.2 技术债中登记 |
| constitution.md 原则 | ✅ 对齐 | 10 条原则全部检查，无违反 |
| overall-data-model.md | ✅ 对齐 | 本模块不涉及业务数据模型，仅词表数据结构 |
| overall-api.md | ✅ 对齐 | 本模块不暴露任何 HTTP/WS 接口 |
| overall-plan.md 构建顺序 | ✅ 对齐 | 本模块为纯语言定义，无构建依赖，在 `initializeMagicScript()` 中最早初始化 |
