# 011-script-parser 技术实现计划（As-Built）

> 本文件以"已建成系统"视角记录 011-script-parser 模块的实际技术实现。
> 模块编号：011-script-parser
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. Technical Context

### 1.1 Runtime Environment

| 维度 | 值 | 来源 |
|---|---|---|
| 运行环境 | 浏览器（现代浏览器，ES2020+） | [TECH.md §7](../TECH.md#7-浏览器目标) |
| 模块系统 | ES Modules（Vite 构建） | `parsing/index.js:545` 使用 `export` |
| 语言 | JavaScript（无 TypeScript） | 源码全为 `.js`，无类型注解 |
| 执行上下文 | 同步词法/语法分析；`parseBest()` 为 async（因 `processEnv()` 异步加载 Java 类元数据） | `parser.js:98` |

### 1.2 Dependencies

#### 直接依赖（源码 import）

| 依赖 | 路径 | 用途 |
|---|---|---|
| `./index.js` | `tokenizer.js:1`, `parser.js:1`, `ast.js:2` | 核心类型：ParseException、Span、Token、TokenType、CharacterStream、TokenStream、LiteralToken |
| `./tokenizer.js` | `parser.js:2` | 词法分析器（默认导出 `tokenize` 函数） |
| `./ast.js` | `parser.js:4-39` | 30+ AST 节点类（Parser 构造 AST 时实例化） |
| `../editor/java-class.js` | `parser.js:3`, `ast.js:1` | Java 类元数据加载（方法签名查找、类加载、类型匹配、自动导入等） |
| `@/scripts/editor/request-parameter.js` | `parser.js:40` | `RequestParameter.environmentFunction()` 提供内置环境变量函数 |

#### 间接依赖

| 依赖 | 版本 | 用途 |
|---|---|---|
| `monaco-editor` | ^0.29.1 | 语言服务（completion/hover/signature）消费本模块的解析结果 |

#### 被依赖方（消费本模块）

| 模块 | 消费内容 | 路径 |
|---|---|---|
| 012-script-language（语言服务） | `tokenize`、`Parser`、`parseBest`、全部 AST 节点类、`parseJson` | `src/scripts/editor/completion.js`, `hover.js`, `signature.js` |
| 001-editor-core（编辑器核心） | 间接通过 012 模块；也直接 import `Parser`/`tokenizer` 做实时校验 | `src/components/editor/magic-script-editor.vue:77-79` |

---

## 2. Constitution Check

| 原则编号 | 原则名称 | 合规状态 | 依据 |
|---|---|---|---|
| 第一条 | 单一主组件 + 注入式配置 | ✅ Compliant | 本模块为纯逻辑库（无 Vue 组件），不涉及 props/config 注入；通过 `java-class.js` 异步获取 Java 类元数据，无硬编码后端地址 |
| 第二条 | 前后端契约即真相 | ✅ Compliant | 本模块不持久化任何业务数据；Java 类元数据由 `java-class.js` 从后端加载，本模块仅消费其接口 |
| 第三条 | 通信双通道：HTTP + WebSocket | ✅ Compliant | 本模块为纯解析器，不参与任何网络通信 |
| 第四条 | 事件总线即全局状态 | ✅ Compliant | 本模块无 bus 调用；状态通过函数参数（`env` 对象）传递，无全局可变状态 |
| 第五条 | monaco 一切围绕 magic-script | ✅ Compliant | 本模块专为 magic-script 设计：TokenType 枚举、关键字列表、LINQ 语法均为 magic-script 特有，不通用化 |
| 第六条 | 类型契约由 Header 表达 | ✅ Compliant | 本模块不涉及 HTTP 请求 |
| 第七条 | 国际化只信语言包索引化 | ✅ Compliant | 本模块无 i18n 内容；错误消息为中文硬编码字符串（如 `'变量名不能定义为关键字'`），非运行时切换语言 |
| 第八条 | 双构建产物共存 | ✅ Compliant | 本模块为纯 JS 库，无构建模式差异代码；ESM 导出在 app/lib 两种模式下均可正常工作 |
| 第九条 | 错误反馈走模态框 + Bus | ⚠️ Partial | 本模块通过 `ParseException` 抛出错误，不直接调用 `magicAlert`；调用方（如 001-editor-core `vue:302-315`）负责将解析错误转换为 monaco markers 或弹框。这是合理的分层设计，但 spec.md NFR-110-004 要求语言服务调用方必须捕获所有异常 |
| 第十条 | 源代码即文档真相 | ✅ Compliant | 本文档所有论断均附源码行号 |

### 例外登记

| ID | 违反条款 | 现状 | 备注 |
|---|---|---|---|
| E-011-001 | 第九条（衍生约束） | `parser.js:90` 中 `//console.error(e)` 被注释，语法错误在 `ignoreError=true` 时静默吞掉 | 这是 `parse(true)` 的容错设计，但缺少注释说明原因，违反第九条衍生约束"静默失败必须显式注释说明原因" |
| E-011-002 | 第五条（衍生约束） | `parser.js:823-827` 中 `LanguageExpression` 支持 `` ```lang ... ``` `` 嵌入外部语言，但本模块不解析嵌入内容 | 嵌入语言的实际高亮由 monaco `nextEmbedded` 处理（MyBatis 由 013 模块处理），本模块仅做 Token 标记，边界清晰 |

---

## 3. Project Structure

### 3.1 模块文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/scripts/parsing/index.js` | 553 | 核心类型定义：ParseException、Line、Span、TokenType（70+ 枚举值）、Token、LiteralToken（含 getJavaType）、CharacterStream、TokenStream |
| `src/scripts/parsing/tokenizer.js` | 366 | 词法分析器：regexpToken、tokenizerString、tokenizerNumber、tokenizerLanguage、tokenizerIdentifier、tokenizerTemplateString、主 tokenizer 循环、默认导出 tokenize 函数 |
| `src/scripts/parsing/parser.js` | 954 | 递归下降语法分析器：Parser 类（parse/parseBest/processEnv/parseStatement/parseExpression/parseBinaryOperator/parseUnaryOperator/parseTernaryOperator/parseAccessOrCall/parseFunctionBody/parseImport/parseVarDefine/parseIfStatement/parseForStatement/parseWhileStatement/parseTryStatement/parseReturn/parseAsync/parseNewExpression/parseArguments/parseLambdaBody/parseMapLiteral/parseListLiteral/parseSelect/parseLinqJoins/parseLinqFields/parseGroup/parseLinqOrders/parseExit/parseThrow/parseAssert/findBestMatch）、parseJson 工具函数、processBody/getType/isSimpleObject 辅助函数 |
| `src/scripts/parsing/ast.js` | 735 | AST 节点定义（30+ 类）：Node、Expression、Literal、MethodCall、FunctionCall、MemberAccess、VariableAccess、MapOrArrayAccess、IfStatement、WholeLiteral、LambdaFunction、Return、Continue、Break、Exit、Throw、Assert、NewStatement、AsyncCall、UnaryOperation、TryStatement、ForStatement、WhileStatement、Import、VarDefine、TernaryOperation、BinaryOperation、Spread、MapLiteral、ListLiteral、LanguageExpression、LinqField、LinqJoin、LinqOrder、ClassConverter、LinqSelect |

**总计**：4 个文件，2608 行。

### 3.2 模块内部结构

```
src/scripts/parsing/
├── index.js (553 行)          ← 类型层（Type System）
│   ├── ParseException         — 解析异常类
│   ├── Line                   — 行号/列号信息
│   ├── Span                   — 源码位置范围
│   ├── TokenType              — 70+ Token 类型枚举
│   ├── Token                  — 词法单元
│   ├── LiteralToken           — 字面量 Token（含 getJavaType）
│   ├── CharacterStream        — 字符流游标
│   └── TokenStream            — Token 序列游标
│
├── tokenizer.js (366 行)      ← 词法层（Lexer）
│   ├── regexpToken            — 正则表达式 Token 化
│   ├── tokenizerString        — 字符串 Token 化（' / " / """）
│   ├── tokenizerNumber        — 数值 Token 化（多进制 + 后缀）
│   ├── tokenizerLanguage      — 语言块 Token 化（```lang ... ```）
│   ├── tokenizerIdentifier    — 标识符/关键字/布尔/null Token 化
│   ├── tokenizerTemplateString— 模板字符串 Token 化（`...${...}...`）
│   ├── tokenizer (内部函数)    — 主循环
│   └── export default         — tokenize(source) 入口
│
├── parser.js (954 行)         ← 语法层（Parser）
│   ├── keywords / linqKeywords — 关键字数组
│   ├── binaryOperatorPrecedence — 12 级运算符优先级表
│   ├── linqBinaryOperatorPrecedence — LINQ 上下文优先级表
│   ├── unaryOperators          — 一元运算符列表
│   ├── class Parser            — 递归下降 Parser
│   │   ├── parse()             — 完整解析
│   │   ├── parseBest()         — 光标位置最佳匹配
│   │   ├── processEnv()        — 构建类型上下文
│   │   ├── parseStatement()    — 语句解析
│   │   ├── parseExpression()   — 表达式解析入口
│   │   ├── parseBinaryOperator() — 二元运算（优先级驱动）
│   │   ├── parseUnaryOperator()  — 一元运算 + Lambda 检测
│   │   ├── parseTernaryOperator()— 三元运算
│   │   ├── parseAccessOrCall()   — 成员访问/方法调用/函数调用
│   │   ├── parseAccessOrCallOrLiteral() — 字面量/变量/Map/List
│   │   ├── parseFunctionBody()   — 代码块解析
│   │   ├── parseImport()         — import 语句
│   │   ├── parseVarDefine()      — var/let/const 定义
│   │   ├── parseIfStatement()    — if/else if/else
│   │   ├── parseForStatement()   — for-in 循环
│   │   ├── parseWhileStatement() — while 循环
│   │   ├── parseTryStatement()   — try/catch/finally + with-resources
│   │   ├── parseReturn()         — return 语句
│   │   ├── parseAsync()          — async 调用
│   │   ├── parseNewExpression()  — new 表达式
│   │   ├── parseArguments()      — 方法/函数参数列表
│   │   ├── parseLambdaBody()     — Lambda 函数体
│   │   ├── parseMapLiteral()     — Map 字面量（含展开语法）
│   │   ├── parseListLiteral()    — List 字面量
│   │   ├── parseSelect()         — LINQ select 语句
│   │   ├── parseLinqJoins()      — LINQ join 子句
│   │   ├── parseLinqFields()     — LINQ 字段列表
│   │   ├── parseGroup()          — LINQ group by
│   │   ├── parseLinqOrders()     — LINQ order by
│   │   ├── parseExit()           — exit 语句
│   │   ├── parseThrow()          — throw 语句
│   │   ├── parseAssert()         — assert 语句
│   │   └── findBestMatch()       — 光标位置 AST 节点匹配
│   ├── parseJson()             — JSON 风格脚本 → 请求参数结构树
│   ├── processBody()           — 递归处理 Map/List 为参数树
│   ├── isSimpleObject()        — 判断是否为简单类型
│   └── getType()               — 推导 AST 节点的数据类型名
│
└── ast.js (735 行)            ← AST 层（Abstract Syntax Tree）
    ├── class Node              — AST 节点基类
    ├── class Expression        — 表达式基类
    ├── class Literal           — 通用字面量
    ├── class MethodCall        — 方法调用
    ├── class FunctionCall      — 函数调用
    ├── class MemberAccess      — 成员访问
    ├── class VariableAccess    — 变量访问
    ├── class MapOrArrayAccess  — Map/数组访问
    ├── class IfStatement       — if 语句
    ├── class WholeLiteral      — LINQ 通配符 *
    ├── class LambdaFunction    — Lambda 函数
    ├── class Return            — return 语句
    ├── class Continue          — continue 语句
    ├── class Break             — break 语句
    ├── class Exit              — exit 语句
    ├── class Throw             — throw 语句
    ├── class Assert            — assert 语句
    ├── class NewStatement      — new 表达式
    ├── class AsyncCall         — async 调用
    ├── class UnaryOperation    — 一元运算
    ├── class TryStatement      — try/catch/finally
    ├── class ForStatement      — for-in 循环
    ├── class WhileStatement    — while 循环
    ├── class Import            — import 语句
    ├── class VarDefine         — 变量定义
    ├── class TernaryOperation  — 三元运算
    ├── class BinaryOperation   — 二元运算
    ├── class Spread            — 展开表达式
    ├── class MapLiteral        — Map 字面量
    ├── class ListLiteral       — List 字面量
    ├── class LanguageExpression— 语言块表达式
    ├── class LinqField         — LINQ 字段
    ├── class LinqJoin          — LINQ join
    ├── class LinqOrder         — LINQ order
    ├── class ClassConverter    — 类型转换（::）
    └── class LinqSelect        — LINQ select
```

### 3.3 与相邻模块的物理边界

```
src/scripts/parsing/           ← 011-script-parser（本模块）
├── index.js                   — 类型定义（被 tokenizer/parser/ast 共用）
├── tokenizer.js               — 词法分析（被 parser 调用）
├── parser.js                  — 语法分析（被 012/001 调用）
└── ast.js                     — AST 节点（被 parser 构造，被 012 消费）

src/scripts/editor/
├── java-class.js              ← 上游依赖（Java 类元数据）
├── request-parameter.js       ← 上游依赖（内置环境变量）
├── completion.js              ← 下游消费（自动补全）
├── hover.js                   ← 下游消费（悬停提示）
└── signature.js               ← 下游消费（参数签名）

src/components/editor/
└── magic-script-editor.vue    ← 下游消费（实时语法校验）
```

---

## 4. Phase 0 Research

### 4.1 已解决的技术决策

| 决策点 | 选择 | 理由 | 源码证据 |
|---|---|---|---|
| 词法分析策略 | 单遍扫描 + 多子函数分发 | O(n) 时间复杂度，每种 Token 类型由专用函数处理，主循环按优先级依次尝试 | `tokenizer.js:286-362` |
| Token 匹配顺序 | 按字面量长度降序排列 | 确保长 Token（如 `===`）优先于短 Token（如 `==`），避免前缀误匹配 | `index.js:196-214` |
| 语法分析策略 | 递归下降 Parser + 优先级表驱动二元运算 | 代码结构清晰，优先级表（12 级）替代硬编码 if-else 链，易于维护 | `parser.js:44-70, 459-473` |
| LINQ 上下文处理 | 独立优先级表 + `linqLevel` 计数器 | LINQ 中赋值与比较同级，`<>` 为不等运算符，通过 `linqLevel` 切换优先级表 | `parser.js:58-70, 461, 677, 692` |
| 错误容错策略 | `parse(ignoreError)` 捕获异常返回部分 AST | 编辑器实时校验场景需要容忍语法错误，`ignoreError=true` 时返回已解析节点 | `parser.js:79-96` |
| 光标位置匹配 | 深度优先遍历 AST，`Span.inPosition()` 判断 | `findBestMatch()` 递归遍历子表达式，返回包含光标位置的最内层节点 | `parser.js:848-860` |
| 类型推导机制 | 每个 AST 节点实现 `getJavaType(env)` | `env` 对象维护变量名→Java 类型的映射，`processEnv()` 顺序遍历节点构建完整上下文 | `ast.js` 各节点实现 + `parser.js:107-119` |
| 模板字符串内嵌表达式 | 递归调用 tokenizer 生成子 TokenStream | `` `Hello, ${user.name}!` `` 中 `${...}` 部分递归词法分析，结果存入 `LiteralToken.tokenStream` | `tokenizer.js:248-284` |
| 正则表达式上下文检测 | 仅在前一个 Token 为特定类型时才尝试匹配 | 避免 `/` 被误识别为正则（如 `a / b` 中的除法），仅在赋值号、逗号、左括号等后识别 | `tokenizer.js:3-90` |
| Map 字面量简写语法 | `{key}` 等价于 `{key: key}` | 当 key 后紧跟 `,` 或 `}` 时，自动将 key 作为 VariableAccess 同时充当 value | `parser.js:640-648` |
| Lambda 解析策略 | 先尝试表达式体，失败后回退到语句块体 | `parseLambdaBody()` 中 try-catch 回退机制：先 `parseExpression()`，失败则尝试 `{...}` 块 | `parser.js:515-538` |
| assert 语句回退 | 解析失败时回退为普通表达式 | `parseAssert()` 中 try-catch 回退到 `parseExpression()`，兼容 assert 作为标识符使用的场景 | `parser.js:201-216` |
| parseJson 工具函数 | 先 JSON.parse 验证，再用 Parser 解析 | 确保输入为合法 JSON 风格脚本后，解析为请求参数结构树（name/dataType/children） | `parser.js:931-953` |

### 4.2 已识别的技术债

| 编号 | 问题 | 风险等级 | 缓解建议 |
|---|---|---|---|
| NC-001 | `parser.js:90` 静默吞掉语法异常（`//console.error(e)` 被注释） | 低 | 添加注释说明这是 `parse(true)` 的容错设计 |
| NC-002 | `ast.js:171-175` MemberAccess 对 `java.util.HashMap` 的 `get` 方法做特殊处理 | 中 | 硬编码类名 `java.util.HashMap`，若后端使用其他 Map 实现可能遗漏 |
| NC-003 | `parser.js:432-437` `expectCloseing()` 中 `}` 缺失时不抛异常（注释掉了 throw） | 中 | 代码块缺少右花括号时不报错，可能导致部分 AST 被静默截断 |
| NC-004 | `tokenizer.js:53-64` 正则 flag 匹配仅消费字符但不验证合法性 | 低 | `/pattern/xyz` 中 `xyz` 会被静默消费，应验证 flag 仅为 `gimsuy` 的子集 |
| NC-005 | `ast.js:193-199` VariableAccess 的类型查找逻辑中 `env['@import']` 遍历顺序为逆序 | 低 | 后导入的包优先匹配，符合 Java import 语义，但缺少注释说明 |

---

## 5. Phase 1 Design Outputs

### 5.1 Data Model（引用）

本模块涉及的数据模型已在以下文档中定义：

- **AST 节点体系**：[overall-data-model.md §7 magic-script AST](../overall-data-model.md#7-magic-script-ast前端侧解析结果) + [spec.md §4 关键实体](./spec.md#4-关键实体)
- **Token/Span 模型**：[spec.md §4 关键实体](./spec.md#4-关键实体)
- **配置常量模型**：[overall-data-model.md §2 配置常量模型](../overall-data-model.md#2-配置常量模型contants)
- **Java 类元数据缓存**：[overall-data-model.md §8 Java 类元数据缓存](../overall-data-model.md#8-java-类元数据缓存)

### 5.2 Contracts（引用）

本模块提供/消费的接口契约已在以下文档中定义：

- **对外 API**：[spec.md §3.5 对外 API](./spec.md#35-对外-api)（FR-110-070 ~ FR-110-075）
- **上游依赖接口**：[spec.md §8.1 上游依赖](./spec.md#81-上游依赖本模块消费)（java-class.js / request-parameter.js）
- **下游消费方**：[spec.md §8.2 下游依赖](./spec.md#82-下游依赖消费本模块)（012-script-language / 001-editor-core）
- **monaco 集成点**：[spec.md §8.3 与 monaco-editor 的集成点](./spec.md#83-与-monaco-editor-的集成点)

### 5.3 Quickstart

本模块为纯逻辑库，无独立运行方式。使用方式：

```javascript
// 词法分析
import tokenize from '@/scripts/parsing/tokenizer.js'
const tokens = tokenize('var name = "hello"')

// 语法分析
import { Parser } from '@/scripts/parsing/parser.js'
import { TokenStream } from '@/scripts/parsing/index.js'
const parser = new Parser(new TokenStream(tokens))
const ast = parser.parse(false)  // 严格模式

// 光标位置最佳匹配（用于补全/悬停）
const { best, env } = await parser.parseBest(cursorPosition)

// JSON 风格脚本 → 请求参数结构树
import { parseJson } from '@/scripts/parsing/parser.js'
const params = parseJson('{name: "test", age: 18}')
```

开发调试：
```bash
npm run serve        # 启动 dev server
# 在浏览器控制台中直接调用上述 API 测试
```

---

## 6. FR 实现策略映射

本节将 spec.md 中定义的每个 FR 映射到具体实现策略。

### 6.1 词法分析（FR-110-001 ~ FR-110-012）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-110-001 | `tokenizer()` 主循环遍历 CharacterStream，按类型分发到各子函数，返回 Token 数组 | `tokenizer.js:286-362` |
| FR-110-002 | `tokenizerNumber` 识别数值后缀（b/B/s/S/l/L/f/F/d/D/m/M），`tokenizerIdentifier` 识别 true/false/null | `tokenizer.js:131-203, 225-246` |
| FR-110-003 | `tokenizerNumber` 中 `0x`/`0X` 十六进制、`0b`/`0B` 二进制，`_` 分隔符通过 `matchAny(['_', ...], true)` 消费 | `tokenizer.js:132-161` |
| FR-110-004 | `tokenizerString` 按 SingleQuote/TripleQuote/DoubleQuote 顺序尝试，TripleQuote 支持跨行 | `tokenizer.js:92-121` |
| FR-110-005 | `tokenizerTemplateString` 匹配 `` ` `` 后循环扫描，遇到 `${` 时递归调用 `tokenizer(stream, [], "}")` 解析内嵌表达式 | `tokenizer.js:248-284` |
| FR-110-006 | `regexpToken` 检查前一个 Token 类型（Comma/Semicolon/Assignment/LeftParantheses 等 16 种合法上下文），仅在合法时尝试匹配 `/` | `tokenizer.js:3-90` |
| FR-110-007 | `tokenizerLanguage` 匹配 ` ``` ` 后读取标识符作为语言名，再 `skipUntil("```")` 读取内容 | `tokenizer.js:205-224` |
| FR-110-008 | `TokenType` 枚举定义 70+ 类型（`index.js:118-195`），主循环中 `TokenType.getSortedValues()` 按长度降序匹配 | `tokenizer.js:335-348` |
| FR-110-009 | `TokenType.SqlAnd`/`SqlOr`/`SqlNotEqual` 在 `tokenizerIdentifier` 中通过字符串比较识别 | `tokenizer.js:236-239` |
| FR-110-010 | `tokenizerIdentifier` 中 `"true"/"false"` → BooleanLiteral，`"null"` → NullLiteral，`"and"/"or"` → SqlAnd/SqlOr，其余 → Identifier | `tokenizer.js:232-242` |
| FR-110-011 | 主循环中 `match("//", true)` → `skipLine()`，`match("/*", true)` → `skipUntil("*/")` | `tokenizer.js:294-301` |
| FR-110-012 | 主循环末尾 `if (stream.hasMore())` 时抛出 `ParseException("Unknown token", ...)` | `tokenizer.js:357-359` |

### 6.2 语法分析（FR-110-020 ~ FR-110-035）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-110-020 | `Parser.parse()` 循环调用 `parseStatement()` 直到 TokenStream 耗尽，返回 Node 数组 | `parser.js:79-96` |
| FR-110-021 | `parseStatement()` 中 if-else 链匹配 import/var/let/const/if/for/while/continue/async/try/break/exit/throw/assert | `parser.js:127-170` |
| FR-110-022 | `parseExpression()` → `parseTernaryOperator()` → `parseBinaryOperator()` → `parseUnaryOperator()` → `parseAccessOrCallOrLiteral()` 递归下降 | `parser.js:439-832` |
| FR-110-023 | `parseSelect()` 解析 `select ... from ... join ... where ... group by ... having ... order by ... limit ... offset`，`linqLevel++` 切换优先级 | `parser.js:675-702` |
| FR-110-024 | `parseAccessOrCall()` 中 `TokenType.ColonColon` 匹配后创建 `ClassConverter` 节点，支持 int/long/double/float/short/byte/date 等目标类型 | `parser.js:562-572`, `ast.js:629-665` |
| FR-110-025 | `parseMapLiteral()` 支持 `{key: value}` 和 `{key}` 简写，`parseListLiteral()` 支持 `[item]`，Map 中 `...target` 创建 Spread 节点 | `parser.js:612-673` |
| FR-110-026 | `parseLambdaBody()` 先尝试 `parseExpression()`（表达式体），catch 后尝试 `{...}`（语句块体） | `parser.js:515-538` |
| FR-110-027 | `parseTryStatement()` 中 `match("(", true)` 后循环解析 `parseVarDefine()` 作为 resource，支持 `try (resource) { ... }` | `parser.js:359-407` |
| FR-110-028 | `parseAccessOrCall()` 中 `TokenType.QuestionPeriod` 设置 `optional=true`，LINQ 中 `TokenType.Asterisk` 创建 `MemberAccess(..., whole=true)` | `parser.js:597-605` |
| FR-110-029 | `binaryOperatorPrecedence` 数组定义 12 级优先级，`parseBinaryOperator()` 递归下降按级别解析 | `parser.js:44-57, 459-473` |
| FR-110-030 | `linqBinaryOperatorPrecedence` 将 Assignment 与比较运算符放在同一级（第 6 级），`linqLevel > 0` 时切换 | `parser.js:58-70, 461` |
| FR-110-031 | `checkKeyword()` 在 `parseVarDefine()` 和 `parseForStatement()` 中校验变量名不在 `keywords` 数组中 | `parser.js:180-184, 333, 337, 349` |
| FR-110-032 | `validateNode()` 在 `parse()` 和 `parseFunctionBody()` 中检查 `instanceof Literal` 并抛出异常 | `parser.js:121-125, 424` |
| FR-110-033 | `parse(ignoreError)` 中 try-catch 包裹主循环，`ignoreError !== true` 时 re-throw | `parser.js:79-96` |
| FR-110-034 | `parseBest(position)` 先 `parse()` 获取完整 AST，再 `processEnv()` 构建类型上下文，最后 `findBestMatch()` 定位节点 | `parser.js:98-105` |
| FR-110-035 | `parseJson(bodyStr)` 先 `JSON.parse()` 验证，再 `new Parser(new TokenStream(tokenizer(bodyStr)))` 解析为参数结构树 | `parser.js:931-953` |

### 6.3 AST 节点与类型推导（FR-110-040 ~ FR-110-049）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-110-040 | `Node` 基类提供 `getSpan()`、`expressions()`、`getJavaType(env)` 接口，所有 30+ 节点类继承 | `ast.js:4-31` |
| FR-110-041 | `ast.js` 中定义 35 个类（Node/Expression + 33 个具体节点），通过 `export { ... }` 导出 | `ast.js:698-735` |
| FR-110-042 | 每个节点类覆盖 `getJavaType(env)` 方法，返回完全限定类名（如 `java.lang.String`） | `ast.js` 各节点实现 |
| FR-110-043 | `VarDefine.getJavaType()` 中 `env[this.varName] = type` 写入变量类型映射 | `ast.js:458-467` |
| FR-110-044 | `Import.getJavaType()` 中处理 `.*` 通配符（推入 `env['@import']`）、模块导入（`@` 前缀）、别名（`as`） | `ast.js:425-439` |
| FR-110-045 | `BinaryOperation.getJavaType()` 中按操作数类型和运算符推导：string 拼接→String、BigDecimal 优先、数值类型提升 | `ast.js:553-588` |
| FR-110-046 | `MethodCall.getJavaType()` 中 `JavaClass.findMethods(targetType)` 查找方法，`JavaClass.matchTypes()` 匹配参数类型 | `ast.js:80-93` |
| FR-110-047 | `MemberAccess.getJavaType()` 中 `JavaClass.loadClass(javaType)` 加载类，查找 attributes/enums/methods | `ast.js:148-177` |
| FR-110-048 | `AsyncCall.getJavaType()` 固定返回 `java.util.concurrent.Future` | `ast.js:355-357` |
| FR-110-049 | `LinqSelect.getJavaType()` 固定返回 `java.util.List` | `ast.js:692-694` |

### 6.4 错误定位（FR-110-060 ~ FR-110-064）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-110-060 | `ParseException` 继承 Error，携带 message 和 Span；tokenizer/parser 中多处 throw | `index.js:1-7`, `tokenizer.js` 多处, `parser.js` 多处 |
| FR-110-061 | `Span` 存储 source/start/end/cachedText，`getLine()` 延迟计算行号/列号 | `index.js:21-116` |
| FR-110-062 | `Span.inPosition(position)` 判断 `this.start <= position && this.end >= position` | `index.js:56-58` |
| FR-110-063 | `Span.getLine()` 向前扫描到行首，向后扫描到行尾，计算 lineNumber/endLineNumber/startCol/endCol | `index.js:60-115` |
| FR-110-064 | `TokenStream.expect()` 中抛出 `"Expected '...', but got '...'"` 对比消息 | `index.js:516-531` |

### 6.5 对外 API（FR-110-070 ~ FR-110-075）

| FR | 实现策略 | 关键代码位置 |
|---|---|---|
| FR-110-070 | `export default (source) => tokenizer(new CharacterStream(source, 0, source.length), [])` | `tokenizer.js:364-366` |
| FR-110-071 | `export class Parser` 提供 `parse()`/`parseBest()`/`processEnv()`/`findBestMatch()` 方法 | `parser.js:73-860` |
| FR-110-072 | `export function parseJson(bodyStr)` 返回请求参数结构数组 | `parser.js:931-953` |
| FR-110-073 | `index.js:545-553` 导出 Span/Token/TokenType/CharacterStream/TokenStream/LiteralToken/ParseException | `index.js:545-553` |
| FR-110-074 | `ast.js:698-735` 导出全部 35 个 AST 节点类 | `ast.js:698-735` |
| FR-110-075 | `export const keywords` 和 `export const linqKeywords` 数组 | `parser.js:42-43` |

---

## 7. Complexity Tracking

### 7.1 复杂度热点

| 区域 | 复杂度来源 | 行数 | 说明 |
|---|---|---|---|
| `tokenizer()` 主循环 | 10 种 Token 类型的分发逻辑 + 正则上下文检测 + 模板字符串递归 | 77 行（tokenizer.js:286-362） | 包含 8 个 continue 分支 + 正则前置条件检查（16 种合法上下文） |
| `parseAccessOrCall()` | 方法调用/函数调用/成员访问/Map 访问/类型转换/可选链/LINQ 通配符 | 61 行（parser.js:548-610） | while 循环中 5 种分支（`::`/`()`/`[]`/`.`/`?.`），每种分支内部还有子分支 |
| `parseAccessOrCallOrLiteral()` | 30+ 种字面量/表达式的匹配 | 50 行（parser.js:782-832） | 18 个 if-else 分支匹配不同 Token 类型 |
| `parseMapLiteral()` | Map 字面量的多种语法（key:value / [key]:value / 简写 / 展开） | 48 行（parser.js:612-659） | 包含 Spread 检测、三种 key 类型、简写语法自动补 value |
| `BinaryOperation.getJavaType()` | 12 种数值类型的优先级推导 + string 拼接 + 比较运算 | 36 行（ast.js:553-588） | 8 层 if-else 类型提升链 |
| `MemberAccess.getJavaType()` | Java 类属性/枚举/方法查找 + HashMap 特殊处理 | 30 行（ast.js:148-177） | 3 种查找路径（attributes → enums → methods） |
| `Span.getLine()` | 行号/列号计算算法 | 56 行（index.js:60-115） | 向前/向后扫描 + 行号计数 + 列号计算 |

### 7.2 圈复杂度评估

| 函数/方法 | 分支数 | 评估 |
|---|---|---|
| `tokenizer()` 主循环 | 12+ | 高 — 10 种子 Token 函数 + 正则检测 + Lambda + 简单 Token 循环 + 未知字符 |
| `parseStatement()` | 14+ | 高 — 14 种语句类型匹配 + fallback 到表达式 |
| `parseAccessOrCall()` | 8+ | 高 — 5 种主分支 + 各分支内部子条件 |
| `parseAccessOrCallOrLiteral()` | 18+ | 高 — 18 种 Token 类型匹配 |
| `parseMapLiteral()` | 6+ | 中 — Spread/字符串 key/方括号 key/标识符 key/简写/标准 key-value |
| `parseTryStatement()` | 6+ | 中 — with-resources/标准 try/catch/finally 组合 |
| `BinaryOperation.getJavaType()` | 10+ | 中 — 运算符判断 + 8 层类型提升 |
| `MemberAccess.getJavaType()` | 5+ | 中 — 属性/枚举/方法三种查找 + HashMap 特殊处理 |
| `findBestMatch()` | 3 | 低 — 递归遍历 + 位置判断 |
| `parseLambdaBody()` | 4 | 低 — try-catch 回退 + 三种 Lambda 体形式 |

### 7.3 Token 类型覆盖率

| 类别 | 数量 | 说明 |
|---|---|---|
| 运算符 Token | 45+ | 算术/比较/逻辑/位运算/复合赋值/Lambda/空值传播/展开 |
| 字面量 Token | 11 | Boolean/Double/Decimal/Float/Long/Integer/Short/Byte/Character/Regexp/String/Null |
| 分隔符 Token | 10 | 括号/方括号/花括号/逗号/分号/冒号/问号/点号 |
| 特殊 Token | 5 | SqlAnd/SqlOr/SqlNotEqual/Language/Identifier/Unknown |

---

## 8. Progress Tracking

### 8.1 文档完成状态

| 章节 | 状态 | 备注 |
|---|---|---|
| 1. Technical Context | ✅ 完成 | 运行环境 + 依赖清单（直接/间接/被依赖方），附源码路径 |
| 2. Constitution Check | ✅ 完成 | 10 条原则逐一检查，2 条例外登记 |
| 3. Project Structure | ✅ 完成 | 4 文件清单 + 完整内部结构树 + 物理边界 |
| 4. Phase 0 Research | ✅ 完成 | 13 项技术决策 + 5 项技术债 |
| 5. Phase 1 Design Outputs | ✅ 完成 | data-model/contracts/quickstart 引用对齐 |
| 6. FR 实现策略映射 | ✅ 完成 | 全部 43 个 FR（FR-110-001 ~ FR-110-075）一一映射到实现策略 |
| 7. Complexity Tracking | ✅ 完成 | 7 个复杂度热点 + 10 项圈复杂度评估 + Token 类型覆盖率 |
| 8. Progress Tracking | ✅ 完成 | 本章节 |

### 8.2 与总体文档对齐检查

| 对齐项 | 状态 | 说明 |
|---|---|---|
| overall-data-model.md AST 抽象结构 | ✅ 对齐 | spec.md §4 关键实体与 overall-data-model §7 AST 抽象结构一致 |
| overall-data-model.md Java 类元数据 | ✅ 对齐 | FR-110-046/047 使用的 JavaClass 接口与 overall-data-model §8 一致 |
| constitution.md 原则 | ✅ 对齐 | 10 条原则全部检查，2 条例外已登记 |
| spec.md FR 编号 | ✅ 对齐 | FR-110-001~FR-110-075 共 43 个需求全部映射 |
| spec.md NFR 编号 | ✅ 对齐 | NFR-110-001~NFR-110-006 在 Phase 0 技术决策中体现 |
| spec.md 源码引用清单 | ✅ 对齐 | 4 文件 2608 行与实际 `wc -l` 一致 |
