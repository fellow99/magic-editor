# magic-script 脚本解析器规范

> 模块: 011-script-parser
> 状态: 已实现
> 最后更新: 2026-05-01

## 1. 模块概述

### 1.1 目的

本模块为 **magic-script** 脚本语言提供前端词法分析（Tokenizer）、语法分析（Parser）和抽象语法树（AST）构建能力。其核心目标是为 monaco 编辑器的语言服务（自动补全、悬停提示、参数提示、代码折叠）提供结构化语义信息，而非替代后端 magic-api 的实际脚本执行。

### 1.2 解决的问题

- **编辑器智能感知**：没有解析器，编辑器只能做基于正则的静态高亮，无法理解变量类型、方法签名、成员属性等语义信息。
- **上下文感知补全**：通过 AST 最佳匹配（`parseBest`），在光标位置推断当前表达式类型，从而提供精准的补全候选。
- **悬停类型提示**：通过 AST 节点的 Java 类型推导（`getJavaType`），在鼠标悬停时显示变量/方法/属性的类型信息。
- **参数签名帮助**：通过识别方法调用节点，展示方法参数列表和文档。
- **请求体结构解析**：通过 `parseJson` 将 JSON 风格的 Map/List 字面量解析为参数结构树，用于请求面板的参数定义。

### 1.3 范围

**包含**：
- magic-script 词法分析（Token 化）
- magic-script 语法分析（递归下降 Parser）
- AST 节点定义与 Java 类型推导
- 对外暴露的解析 API（`tokenize`、`parse`、`parseBest`、`parseJson`）
- 错误定位（ParseException + Span 行号/列号）
- 节点类型枚举（TokenType 全集）

**不包含**：
- 脚本实际执行（由后端 magic-api 负责）
- monaco 高亮规则（由 `high-light.js` 的 Monarch 规则独立处理，仅与 Token 类型间接对齐）
- 代码格式化（由 `beautifier/` 独立处理）
- MyBatis 标签解析（由 013-script-mybatis 模块处理）
- Java 类元数据加载（由 `java-class.js` 负责，本模块仅消费其接口）

## 2. 用户场景

### UC-1：用户在编辑器中输入 `user.` 后触发自动补全

1. 编辑器将光标前全部文本送入解析器
2. 解析器词法分析 → 语法分析 → 找到光标位置的最佳匹配节点
3. 若最佳匹配为成员访问（MemberAccess），推导目标对象的 Java 类型
4. 返回该类型的属性/方法/枚举列表作为补全候选

### UC-2：用户鼠标悬停在变量名上

1. 解析器对全文进行语法分析（忽略错误）
2. 通过 `findBestMatch` 定位光标所在 AST 节点
3. 根据节点类型（VarDefine / VariableAccess / MemberAccess / FunctionCall 等）生成类型提示内容
4. monaco 渲染悬停浮层

### UC-3：用户在方法调用括号内输入时触发参数提示

1. 解析器分析到光标位置的 AST
2. 若最佳匹配为 MethodCall 节点，查找对应 Java 类的方法签名
3. 返回参数列表和文档作为 SignatureHelp

### UC-4：用户编写了语法错误的脚本

1. 解析器抛出 ParseException，携带精确的 Span（行号、列号、源码片段）
2. 调用方可选择忽略错误（`parse(true)`）以获取部分 AST，或向上抛出
3. 编辑器利用错误信息渲染诊断标记

## 3. 功能需求

### 3.1 词法分析（Tokenizer）

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-110-001 | 系统 MUST 将源码字符串切分为 Token 序列，每个 Token 携带类型（TokenType）和位置信息（Span） | `tokenizer.js:364-366`、`index.js:216-242` |
| FR-110-002 | 系统 MUST 识别以下字面量类别：布尔值、整数、长整数、浮点数、双精度、BigDecimal、字节、短整型、字符、字符串、正则表达式、null | `tokenizer.js:131-203`、`index.js:180-194` |
| FR-110-003 | 系统 MUST 支持多种数值进制：十进制、十六进制（`0x` 前缀）、二进制（`0b` 前缀），以及数值分隔符（下划线 `_`） | `tokenizer.js:132-161` |
| FR-110-004 | 系统 MUST 支持三种字符串定界符：单引号 `'`、双引号 `"`、三双引号 `"""`（多行字符串） | `tokenizer.js:92-121` |
| FR-110-005 | 系统 MUST 支持模板字符串（反引号 `` ` ``），其中 `${...}` 内嵌表达式递归词法分析 | `tokenizer.js:248-284` |
| FR-110-006 | 系统 MUST 支持正则表达式字面量（`/pattern/flags`），且仅在合法上下文（如赋值号后、逗号后、左括号后等）才识别为正则 | `tokenizer.js:3-90` |
| FR-110-007 | 系统 MUST 支持语言块语法（`` ```lang ... ``` ``），用于嵌入外部语言代码 | `tokenizer.js:205-224` |
| FR-110-008 | 系统 MUST 识别全部运算符 Token（约 50 种），包括算术、比较、逻辑、位运算、复合赋值、Lambda（`=>` / `->`）、空值传播（`?.`）、展开（`...`） | `index.js:118-195` |
| FR-110-009 | 系统 MUST 识别 SQL 风格关键字 Token：`and`、`or`、`<>`（不等），且 `<>` 仅在 LINQ 上下文中有效 | `index.js:172-174` |
| FR-110-010 | 系统 MUST 将 `true`/`false` 识别为布尔字面量，`null` 识别为空值字面量，`and`/`or` 识别为 SQL 逻辑运算符，其余标识符归类为 Identifier | `tokenizer.js:225-246` |
| FR-110-011 | 系统 MUST 跳过单行注释（`//`）和多行注释（`/* ... */`） | `tokenizer.js:294-301` |
| FR-110-012 | 系统 MUST 在遇到无法识别的字符时抛出 ParseException，携带该字符的 Span | `tokenizer.js:357-359` |

### 3.2 语法分析（Parser）

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-110-020 | 系统 MUST 提供递归下降 Parser，将 Token 序列解析为 AST 节点数组 | `parser.js:73-96` |
| FR-110-021 | 系统 MUST 支持以下语句类型：import、变量定义（var/let/const）、if/else、for-in、while、return、break、continue、try/catch/finally、async、exit、throw、assert | `parser.js:127-170` |
| FR-110-022 | 系统 MUST 支持表达式：二元运算（含优先级）、一元运算、三元运算、Lambda 函数、函数调用、方法调用、new 表达式、成员访问、Map/数组访问、展开表达式 | `parser.js:439-832` |
| FR-110-023 | 系统 MUST 支持 LINQ 风格查询表达式（`select ... from ... join ... where ... group by ... having ... order by ... limit ... offset`） | `parser.js:675-780` |
| FR-110-024 | 系统 MUST 支持类型转换语法（`expr :: typeName`），支持的目标类型包括：int、long、double、float、short、byte、date、json、stringify、sql | `parser.js:562-572`、`ast.js:629-665` |
| FR-110-025 | 系统 MUST 支持 Map 字面量（`{key: value}`）和 List 字面量（`[item]`），Map 支持展开语法（`...target`）和简写语法（`{key}` 等价于 `{key: key}`） | `parser.js:612-673` |
| FR-110-026 | 系统 MUST 支持 Lambda 的两种形式：表达式体（`(x) => x + 1`）和语句块体（`(x) => { return x + 1; }`） | `parser.js:515-538` |
| FR-110-027 | 系统 MUST 支持 try-with-resources 语法（`try (resource) { ... }`） | `parser.js:359-407` |
| FR-110-028 | 系统 MUST 支持可选链访问（`?.`），在 LINQ 上下文中支持通配符成员访问（`.*`） | `parser.js:597-605` |
| FR-110-029 | 系统 MUST 在二元运算中实现正确的运算符优先级（12 级，从赋值到乘除） | `parser.js:44-57` |
| FR-110-030 | 系统 MUST 在 LINQ 上下文中调整运算符优先级（赋值与比较同级） | `parser.js:58-70` |
| FR-110-031 | 系统 MUST 禁止将关键字用作变量名，并在定义时校验 | `parser.js:180-184` |
| FR-110-032 | 系统 MUST 禁止孤立字面量作为语句（如单独写 `42`） | `parser.js:121-125` |
| FR-110-033 | 系统 MUST 提供 `parse(ignoreError)` 方法，当 `ignoreError=true` 时捕获异常并返回已解析的部分 AST | `parser.js:79-96` |
| FR-110-034 | 系统 MUST 提供 `parseBest(position)` 方法，返回光标位置的最佳匹配 AST 节点及当前环境变量（类型上下文） | `parser.js:98-105` |
| FR-110-035 | 系统 MUST 提供 `parseJson(bodyStr)` 工具函数，将 JSON 风格的脚本字面量解析为请求参数结构树（嵌套的 name/dataType/children） | `parser.js:931-953` |

### 3.3 AST 节点与类型推导

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-110-040 | 系统 MUST 为每种语法结构定义对应的 AST 节点类，所有节点继承自 Node 基类，提供 `getSpan()`、`expressions()`、`getJavaType(env)` 接口 | `ast.js:4-31` |
| FR-110-041 | 系统 MUST 支持以下 AST 节点类型（30+）：Literal、MethodCall、FunctionCall、MemberAccess、VariableAccess、MapOrArrayAccess、IfStatement、LambdaFunction、Return、Continue、Break、Exit、Throw、Assert、NewStatement、AsyncCall、UnaryOperation、TryStatement、ForStatement、WhileStatement、Import、VarDefine、TernaryOperation、BinaryOperation、Spread、MapLiteral、ListLiteral、WholeLiteral、ClassConverter、LinqSelect、LinqField、LinqJoin、LinqOrder、LanguageExpression | `ast.js:39-695` |
| FR-110-042 | 系统 MUST 通过 `getJavaType(env)` 方法递归推导每个 AST 节点的 Java 类型，返回完全限定类名（如 `java.lang.String`） | `ast.js` 各节点实现 |
| FR-110-043 | 系统 MUST 在 VarDefine 节点中将变量名→类型映射写入 env，供后续节点引用 | `ast.js:458-467` |
| FR-110-044 | 系统 MUST 在 Import 节点中处理包导入逻辑（通配符 `.*`、模块导入 `@`、别名 `as`），并将映射写入 env | `ast.js:425-439` |
| FR-110-045 | 系统 MUST 在 BinaryOperation 中根据操作数类型和运算符推导结果类型（如 string 拼接返回 String，BigDecimal 优先等） | `ast.js:553-588` |
| FR-110-046 | 系统 MUST 在 MethodCall 中通过 JavaClass 查找方法签名并匹配参数类型，返回方法返回类型 | `ast.js:80-93` |
| FR-110-047 | 系统 MUST 在 MemberAccess 中通过 JavaClass 加载目标类，查找属性/枚举/方法类型 | `ast.js:148-177` |
| FR-110-048 | 系统 MUST 在 AsyncCall 中固定返回 `java.util.concurrent.Future` 类型 | `ast.js:355-357` |
| FR-110-049 | 系统 MUST 在 LinqSelect 中固定返回 `java.util.List` 类型 | `ast.js:692-694` |

### 3.4 错误定位

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-110-060 | 系统 MUST 在词法/语法错误时抛出 ParseException，携带错误消息和 Span | `index.js:1-7`、`tokenizer.js` 多处 |
| FR-110-061 | Span MUST 提供源码引用、起止偏移量、文本缓存，以及 `getLine()` 方法计算行号/列号 | `index.js:21-116` |
| FR-110-062 | Span MUST 支持 `inPosition(position)` 判断给定偏移量是否在当前 Span 范围内 | `index.js:56-58` |
| FR-110-063 | Span 的 `getLine()` MUST 返回包含起始行号、结束行号、起始列号、结束列号的 Line 对象 | `index.js:60-115` |
| FR-110-064 | 系统 MUST 在 Token 不匹配时提供期望 Token 与实际 Token 的对比消息 | `index.js:516-531` |

### 3.5 对外 API

| ID | 描述 | 实现位置 |
|---|---|---|
| FR-110-070 | 系统 MUST 导出默认函数 `tokenize(source)`，输入源码字符串，返回 Token 数组 | `tokenizer.js:364-366` |
| FR-110-071 | 系统 MUST 导出 `Parser` 类，构造函数接受 TokenStream，提供 `parse()`、`parseBest()`、`processEnv()`、`findBestMatch()` 方法 | `parser.js:73-860` |
| FR-110-072 | 系统 MUST 导出 `parseJson(bodyStr)` 函数，输入 JSON 风格脚本字符串，返回请求参数结构数组 | `parser.js:931-953` |
| FR-110-073 | 系统 MUST 导出以下类型供外部使用：Span、Token、TokenType、CharacterStream、TokenStream、LiteralToken、ParseException | `index.js:545-553` |
| FR-110-074 | 系统 MUST 导出全部 AST 节点类（30+），供语言服务进行 instanceof 判断 | `ast.js:698-735` |
| FR-110-075 | 系统 MUST 导出关键字数组 `keywords` 和 LINQ 关键字数组 `linqKeywords` | `parser.js:42-43` |

## 4. 关键实体

| 实体 | 描述 | 关键属性 |
|---|---|---|
| **Token** | 词法单元 | type (TokenType), span (Span), value/tokenStream |
| **TokenType** | Token 类型枚举 | literal (字面值), error (错误提示), inLinq (是否仅 LINQ 可用), modifiable (是否可复合赋值) |
| **Span** | 源码位置范围 | source (源码字符串), start/end (偏移量), cachedText (缓存文本), line (延迟计算的 Line 对象) |
| **Line** | 行号/列号信息 | lineNumber, endLineNumber, startCol, endCol |
| **Node** | AST 节点基类 | span, getSpan(), expressions(), getJavaType(env) |
| **TokenStream** | Token 序列游标 | tokens[], index, hasMore(), consume(), match(), expect() |
| **CharacterStream** | 字符流游标 | source, index, hasMore(), consume(), match(), matchIdentifierStart/Part() |
| **ParseException** | 解析异常 | message, span (错误位置) |

## 5. 接受场景

### 场景：正确解析变量定义并推导类型

- Given 源码 `var name = "hello"`
- When 调用 `parseBest(源码长度)`
- Then 最佳匹配为 VarDefine 节点，env 中 `name` 映射为 `java.lang.String`

### 场景：成员访问补全

- Given 源码 `import java.util.List; var list = new ArrayList(); list.`
- When 调用 `parseBest(源码长度)`
- Then 最佳匹配为 MemberAccess，`getJavaType(env)` 返回 `java.util.ArrayList`，补全候选包含 `add`、`get`、`size` 等方法

### 场景：语法错误定位

- Given 源码 `var x = `（缺少右值）
- When 调用 `parse(false)`
- Then 抛出 ParseException，其 Span 的 `getLine()` 返回正确的行号和列号

### 场景：LINQ 查询解析

- Given 源码 `select name, age from users where age > 18 order by age desc limit 10`
- When 调用 `parse()`
- Then 返回 LinqSelect 节点，包含 fields (name, age)、from (users)、where (age > 18)、orders (age desc)、limit (10)

### 场景：模板字符串内嵌表达式

- Given 源码 `` `Hello, ${user.name}!` ``
- When 调用 `tokenize(源码)`
- Then 返回 StringLiteral Token，其 tokenStream 包含 VariableAccess(user) → MemberAccess(name) 和 StringLiteral("!")

## 6. 非功能需求

| ID | 类别 | 描述 | 实现位置 |
|---|---|---|---|
| NFR-110-001 | 性能 | 词法分析 MUST 在 O(n) 时间内完成（n 为源码字符数），单次遍历 | `tokenizer.js:286-362` |
| NFR-110-002 | 性能 | 语法分析 MUST 在编辑器补全/悬停场景下于 50ms 内完成（典型 200 行脚本） | `parser.js:98-105` |
| NFR-110-003 | 容错 | Parser 在遇到语法错误时，若 `ignoreError=true`，MUST 返回已解析的部分 AST 而非空结果 | `parser.js:89-94` |
| NFR-110-004 | 容错 | 语言服务调用解析器时 MUST 捕获所有异常，不得将解析错误抛给 monaco | `completion.js:289-291`、`hover.js` 无 try-catch（依赖 parse(true)） |
| NFR-110-005 | 兼容性 | 标识符 MUST 支持中文字符（`\u4e00-\u9fa5`）和 `@` 前缀（用于模块导入） | `index.js:333`、`index.js:345` |
| NFR-110-006 | 可维护性 | TokenType 枚举 MUST 按字面量长度降序排列匹配，确保长 Token（如 `===`）优先于短 Token（如 `==`） | `index.js:197-214` |

## 7. 假设与约束

- **假设 1**：magic-script 的语法与后端 magic-api 的解析器保持一致。前端解析器是后端解析器的 JavaScript 移植版本。[NEEDS CLARIFICATION: 前端解析器与后端 magic-api 的语法同步策略是什么？当后端新增语法特性时，前端如何获知并同步更新？]
- **假设 2**：Java 类元数据（方法签名、属性、枚举）由 `java-class.js` 通过后端 API 异步加载，本模块不关心加载时机和缓存策略。
- **假设 3**：解析器仅用于编辑器辅助场景，不用于脚本验证或安全沙箱。
- **约束 1**：解析器为纯 JavaScript 实现，无 TypeScript 类型约束，依赖运行时行为保证正确性。
- **约束 2**：LINQ 语法为 magic-script 特有，非标准 SQL，其语义由后端 magic-api 解释执行。

## 8. 依赖

### 8.1 上游依赖（本模块消费）

| 模块 | 依赖内容 | 说明 |
|---|---|---|
| `java-class.js` | `JavaClass.findMethods()`, `JavaClass.loadClass()`, `JavaClass.findFunction()`, `JavaClass.findAttributes()`, `JavaClass.findEnums()`, `JavaClass.getImportClass()`, `JavaClass.getDefineModules()`, `JavaClass.getAutoImportClass()`, `JavaClass.getAutoImportModule()`, `JavaClass.getApiFinder()`, `JavaClass.getFunctionFinder()`, `JavaClass.getOnlineFunction()`, `JavaClass.matchTypes()`, `JavaClass.getWrapperClass()`, `JavaClass.findClass()`, `JavaClass.getSimpleClass()` | AST 节点类型推导和语言服务补全均依赖 Java 类元数据 |
| `request-parameter.js` | `RequestParameter.environmentFunction()` | 提供内置环境变量函数（如 log、db 等） |

### 8.2 下游依赖（消费本模块）

| 模块 | 消费内容 | 说明 |
|---|---|---|
| **012-script-language**（语言服务） | `tokenize`、`Parser`、`parseBest`、全部 AST 节点类 | completion.js、hover.js、signature.js 均直接调用解析器 |
| **001-editor-core**（编辑器核心） | 间接通过 012 模块 | monaco 语言注册后，语言服务自动触发解析 |
| **013-script-mybatis**（MyBatis 支持） | 无直接依赖 | MyBatis 标签在 `"""` 三引号内由 monaco 的 `nextEmbedded: 'mybatis'` 切换，不经过本解析器 |

### 8.3 与 monaco-editor 的集成点

| 集成点 | 文件 | 使用的解析器能力 |
|---|---|---|
| 自动补全 | `completion.js` | `tokenize()` → `Parser.parseBest()` → AST instanceof 判断 → `getJavaType(env)` |
| 悬停提示 | `hover.js` | `tokenize()` → `Parser.parse(true)` → `parser.findBestMatch()` → 按节点类型生成提示 |
| 参数提示 | `signature.js` | `tokenize()` → `Parser.parseBest()` → MethodCall 节点 → JavaClass 查找签名 |
| 代码折叠 | `folding.js` | **不依赖解析器**，基于缩进和 import 行识别 |
| 语法高亮 | `high-light.js` | **不依赖解析器**，使用 monaco Monarch 正则规则（与 Token 类型间接对齐） |

## 9. 源码引用清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/scripts/parsing/index.js` | 553 | 核心类型定义：ParseException、Line、Span、TokenType（70+ 枚举值）、Token、LiteralToken（含 getJavaType）、CharacterStream、TokenStream |
| `src/scripts/parsing/tokenizer.js` | 366 | 词法分析器：regexpToken、tokenizerString、tokenizerNumber、tokenizerLanguage、tokenizerIdentifier、tokenizerTemplateString、主 tokenizer 循环、默认导出 tokenize 函数 |
| `src/scripts/parsing/parser.js` | 954 | 递归下降语法分析器：Parser 类（parse/parseBest/processEnv/parseStatement/parseExpression/parseBinaryOperator/parseUnaryOperator/parseTernaryOperator/parseAccessOrCall/parseFunctionBody/parseImport/parseVarDefine/parseIfStatement/parseForStatement/parseWhileStatement/parseTryStatement/parseReturn/parseAsync/parseNewExpression/parseArguments/parseLambdaBody/parseMapLiteral/parseListLiteral/parseSelect/parseLinqJoins/parseLinqFields/parseGroup/parseLinqOrders/parseExit/parseThrow/parseAssert/findBestMatch）、parseJson 工具函数、processBody/getType/isSimpleObject 辅助函数 |
| `src/scripts/parsing/ast.js` | 735 | AST 节点定义（30+ 类）：Node、Expression、Literal、MethodCall、FunctionCall、MemberAccess、VariableAccess、MapOrArrayAccess、IfStatement、WholeLiteral、LambdaFunction、Return、Continue、Break、Exit、Throw、Assert、NewStatement、AsyncCall、UnaryOperation、TryStatement、ForStatement、WhileStatement、Import、VarDefine、TernaryOperation、BinaryOperation、Spread、MapLiteral、ListLiteral、LanguageExpression、LinqField、LinqJoin、LinqOrder、ClassConverter、LinqSelect |

**总计**：4 个文件，2608 行。
