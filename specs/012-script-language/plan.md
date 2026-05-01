# 012-script-language Technical Plan (As-Built)

> 本文档为反向工程生成的技术计划，记录已实现的架构、设计决策与实现策略。
> 模块：012-script-language
> 对应规范：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. Technical Context

### 1.1 Runtime Environment

| 维度 | 值 | 来源 |
|---|---|---|
| 运行环境 | 浏览器（Web Worker 由 monaco 内部管理） | `magic-script.js:1` |
| 前端框架 | Vue 3.4.x | `package.json` |
| 编辑器内核 | monaco-editor ^0.29.1 | `package.json` |
| 语言 | JavaScript（无 TypeScript） | 源码全为 `.js` |
| 构建工具 | Vite ^5.4.21 | `package.json` |
| 模块系统 | ES Modules（`import`/`export`） | 全局 |

### 1.2 Dependencies

#### 直接依赖（本模块 import）

| 依赖 | 版本/来源 | 用途 | 消费文件 |
|---|---|---|---|
| `monaco-editor` | ^0.29.1 | 语言注册 API、CompletionItemKind、FoldingRangeKind、Range、defineTheme | `magic-script.js`, `completion.js`, `folding.js`, `theme.js`, `java-class.js` |
| `../parsing/tokenizer.js` | 内部（011-script-parser） | 词法分析，返回 token 数组 | `completion.js:2`, `hover.js:1`, `signature.js:2` |
| `../parsing/parser.js` | 内部（011-script-parser） | 语法解析，构建 AST | `completion.js:4`, `hover.js:13`, `signature.js:4` |
| `../parsing/index.js` | 内部（011-script-parser） | TokenStream / ParseException 入口 | `completion.js:3`, `hover.js:2`, `signature.js:3` |
| `../parsing/ast.js` | 内部（011-script-parser） | AST 节点类（MemberAccess, MethodCall, NewStatement, VariableAccess, ClassConverter, FunctionCall, LinqSelect, MapOrArrayAccess, VarDefine, Node） | `completion.js:7`, `hover.js:3-12`, `signature.js:5` |
| `../beautifier/javascript/beautifier.js` | 内部（015-infra-bus-store） | JavaScript 风格格式化引擎 | `magic-script.js:8` |
| `@/api/request.js` | 内部 | HTTP 请求封装（axios + qs） | `java-class.js:1` |
| `@/scripts/contants.js` | 内部 | 读取 `config.autoImportPackage` / `autoImportModuleList` | `java-class.js:2` |
| `./mybatis.js` | 内部（013-script-mybatis） | MyBatis 子语言初始化 | `magic-script.js:7` |

#### 间接依赖（通过上游传递）

| 依赖 | 传递路径 | 用途 |
|---|---|---|
| `axios` | `request.js` → `java-class.js` | HTTP 请求加载 Java 类元数据 |
| `qs` | `request.js` → `java-class.js` | URL 编码序列化 |

### 1.3 文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `magic-script.js` | 97 | 语言注册入口：`initializeMagicScript()`，注册 magicscript 语言 + 全部语言服务 |
| `completion.js` | 368 | 补全提供器：import 补全、Java 类补全、方法补全、变量补全、快捷代码片段、类型转换补全 |
| `hover.js` | 152 | 悬浮提示提供器：变量/方法/类型转换/枚举/属性/在线函数悬停信息 |
| `signature.js` | 75 | 签名帮助提供器：方法参数提示、重载签名切换 |
| `folding.js` | 155 | 折叠范围提供器：缩进折叠 + import 块折叠，`RangesCollector` 类 |
| `high-light.js` | 121 | Monarch 语法高亮规则：关键字/SQL/字符串/注释/数字/正则/代码块 |
| `theme.js` | 13 | 主题注册机制：`defineTheme()` + `Themes` 对象 |
| `default-theme.js` | 40 | 默认主题配置：白色背景 + 语法着色规则 + 编辑器颜色 |
| `dark-theme.js` | 113 | 暗色主题配置：深色背景 + 语法着色规则 + 约 70 个 UI 组件样式映射 |
| `java-class.js` | 304 | Java 类元数据管理：加载/缓存/查询/扩展方法/自动导入/在线函数 |
| `request-parameter.js` | 5 | 环境函数注册接口：`setEnvironment()` |

---

## 2. Constitution Check

| 条款 | 状态 | 说明 |
|---|---|---|
| **第一条 单一主组件 + 注入式配置** | ✅ Compliant | 本模块不暴露根组件；`initializeMagicScript()` 由 `magic-script-editor.vue` 调用，配置通过 `contants.config` 注入（`java-class.js:230-239`） |
| **第二条 前后端契约即真相** | ✅ Compliant | Java 类元数据通过 `GET /classes` / `GET /classes.txt` / `POST /class` 从后端加载，模块自身不持久化任何业务数据 |
| **第三条 通信双通道** | ✅ Compliant | 仅使用 HTTP 加载元数据（`request.send('classes')` / `request.execute({url:'classes.txt'})`），不涉及 WebSocket |
| **第四条 事件总线即全局状态** | ✅ Compliant | 模块内部状态使用模块级变量（`scriptClass`/`extensions`/`importClass`/`functions`），未引入 Vuex/Pinia |
| **第五条 monaco 一切围绕 magic-script** | ✅ Compliant | 所有语言服务仅注册 `magicscript` 语言（`magic-script.js:12`），不通用化 |
| **第六条 类型契约由 Header 表达** | ✅ Compliant | 本模块不直接操作 HTTP Header，由 `request.js` 统一处理 |
| **第七条 国际化只信语言包索引化** | ✅ Compliant | 本模块不涉及 i18n，所有用户可见文本为中文硬编码字符串 |
| **第八条 双构建产物** | ✅ Compliant | 模块为纯 JS，无构建时特殊处理，两种构建模式均兼容 |
| **第九条 错误反馈走模态框 + Bus** | ⚠️ Partial | `completion.js:289-291`、`signature.js:70-72`、`java-class.js:217-219` 中 AST 解析异常和网络异常被静默吞掉，未走 `modal.magicAlert`。这与宪法第九条"静默失败必须显式注释说明原因"部分一致（有注释 `// console.error(e)`），但未向用户反馈 |
| **第十条 源代码即文档真相** | ✅ Compliant | 本文档所有论断均可在源码中找到证据 |

---

## 3. Project Structure

### 3.1 模块内部结构

```
src/scripts/editor/
├── magic-script.js          ← 入口：initializeMagicScript()
├── completion.js            ← CompletionItemProvider
├── hover.js                 ← HoverProvider
├── signature.js             ← SignatureHelpProvider
├── folding.js               ← FoldingRangeProvider
├── high-light.js            ← Monarch tokenizer 规则
├── theme.js                 ← defineTheme() + Themes 对象
├── default-theme.js         ← default 主题配置
├── dark-theme.js            ← dark 主题配置
├── java-class.js            ← JavaClass 元数据管理
└── request-parameter.js     ← RequestParameter 环境函数注册
```

### 3.2 模块间依赖关系

```
001-editor-core (magic-script-editor.vue)
    │
    ├── calls initializeMagicScript() ──→ magic-script.js
    │                                         │
    │                                         ├──→ initMybatis()          [013-script-mybatis]
    │                                         ├──→ HighLightOptions       [high-light.js]
    │                                         ├──→ CompletionItemProvider [completion.js]
    │                                         ├──→ FoldingRangeProvider   [folding.js]
    │                                         ├──→ SignatureHelpProvider  [signature.js]
    │                                         ├──→ HoverProvider          [hover.js]
    │                                         └──→ Beautifier             [015-infra-bus-store]
    │
    └── calls JavaClass.setupOnlineFunction() / setApiFinder() / setFunctionFinder()
                                              └──→ java-class.js

completion.js / hover.js / signature.js
    └──→ tokenizer, Parser, TokenStream, AST nodes  [011-script-parser]

java-class.js
    ├──→ request.send('classes') / request.execute()  [api/request.js]
    └──→ contants.config.autoImportPackage             [scripts/contants.js]
```

### 3.3 初始化时序

```
1. magic-script-editor.vue beforeMount
   └── contants.loadConfig() 加载后端配置
2. magic-script-editor.vue mounted
   └── initializeMagicScript()
       ├── initMybatis()                          注册 mybatis 子语言
       ├── monaco.languages.register()            注册 magicscript 语言
       ├── monaco.languages.setLanguageConfiguration()  设置语言配置
       ├── monaco.languages.setMonarchTokensProvider()  注册语法高亮
       ├── monaco.languages.registerCompletionItemProvider() 注册补全
       ├── monaco.languages.registerFoldingRangeProvider()  注册折叠
       ├── monaco.languages.registerSignatureHelpProvider() 注册签名
       ├── monaco.languages.registerHoverProvider()       注册悬浮
       └── monaco.languages.registerDocumentFormattingEditProvider() 注册格式化
3. JavaClass.initClasses() + JavaClass.initImportClass()  异步加载元数据
   └── 成功后动态更新 builtinFunctions 并重新注册高亮
```

---

## 4. Phase 0 Research

### 4.1 monaco.languages.* API 调用点映射

| API | 文件 | 行号 | 实现细节 |
|---|---|---|---|
| `monaco.languages.register({id})` | `magic-script.js` | 14 | 注册 `magicscript` 语言标识 |
| `monaco.languages.setLanguageConfiguration()` | `magic-script.js` | 16-76 | 配置 wordPattern、brackets、onEnterRules（4 条 Javadoc 规则）、comments、operators、autoClosingPairs（11 对） |
| `monaco.languages.IndentAction.IndentOutdent` | `magic-script.js` | 29 | Javadoc `/** | */` 缩进动作 |
| `monaco.languages.IndentAction.None` | `magic-script.js` | 37,45,53 | Javadoc 续行无缩进动作 |
| `monaco.languages.setMonarchTokensProvider()` | `magic-script.js` | 79 | 初始注册高亮（使用 `HighLightOptions`） |
| `monaco.languages.setMonarchTokensProvider()` | `java-class.js` | 61 | `initClasses()` 成功后重新注册（更新 `builtinFunctions` 数组） |
| `monaco.languages.registerCompletionItemProvider()` | `magic-script.js` | 81 | 注册补全，triggerCharacters: `['.', ':']` |
| `monaco.languages.registerFoldingRangeProvider()` | `magic-script.js` | 83 | 注册折叠 |
| `monaco.languages.registerSignatureHelpProvider()` | `magic-script.js` | 85 | 注册签名，trigger/retrigger: `['(', ',']` |
| `monaco.languages.registerHoverProvider()` | `magic-script.js` | 87 | 注册悬浮 |
| `monaco.languages.registerDocumentFormattingEditProvider()` | `magic-script.js` | 89-96 | 注册格式化，使用 `Beautifier` |
| `monaco.languages.CompletionItemKind.*` | `completion.js` | 17,39,58,71,84,113,126,149,172,186,197,216,229,255,334,351 | Module/Class/Folder/Reference/Method/Variable/Text/Enum/Field/Struct/TypeParameter |
| `monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet` | `completion.js` | 20,43,62,87,152,175,189,200,259,338,352 | 所有补全项均使用 Snippet 模式 |
| `monaco.languages.FoldingRangeKind.Imports` | `folding.js` | 114,148 | import 块折叠标记 |
| `monaco.editor.defineTheme()` | `theme.js` | 11 | 注册 monaco 主题 |
| `monaco.Range` | `completion.js` | 75,117,130,160 | 补全项范围计算 |
| `monaco.Range` | `hover.js` | 145 | 悬浮提示范围 |

### 4.2 Monarch Tokenizer 状态机

`high-light.js` 定义了以下 tokenizer 状态：

| 状态 | 入口 | 出口 | 处理内容 |
|---|---|---|---|
| `root` | 初始状态 | 各子状态 | 关键字、SQL 关键字、数字、注释入口、字符串入口、正则、代码块、`::` 类型转换 |
| `comment` | `/*` 进入 | `*/` 弹出 | 块注释内容，识别 TODO/FIXME |
| `commentTodo` | `//` 进入 | 行末弹出 | 行注释内容，识别 TODO/FIXME |
| `regexp` | `/` 进入 | 闭合 `/` 弹出 | 正则表达式内容 |
| `regexrange` | `[` 进入 | `]` 弹出 | 正则字符类 |
| `string_multi_embedded` | `"""` 进入 | `"""` 弹出 | 三引号字符串，嵌入 mybatis 子语言 |
| `string_double` | `"` 进入 | `"` 弹出 | 双引号字符串 |
| `string_single` | `'` 进入 | `'` 弹出 | 单引号字符串 |
| `string_backtick` | `` ` `` 进入 | `` ` `` 弹出 | 反引号字符串，支持 `${}` 嵌套 |
| `bracketCounting` | `${` 进入 | `}` 弹出 | 模板表达式嵌套计数 |
| `codeblock` | `` ``` `` 进入 | `` ``` `` 弹出 | 代码块内容 |

### 4.3 AST 节点消费矩阵

| AST 节点 | completion.js | hover.js | signature.js |
|---|---|---|---|
| `VariableAccess` | FR-025/028: 变量类型推断 + import 补全 | FR-043: 变量名+类型 / 函数签名 | — |
| `MemberAccess` | FR-026: 目标对象方法/属性/枚举补全 | FR-044: 方法签名/枚举/属性 | — |
| `MethodCall` | FR-026: 方法补全 | FR-045: 函数调用签名 | FR-051: 方法参数签名 |
| `NewStatement` | FR-027: 构造函数补全 + 自动 import | FR-046: "创建对象"提示 | — |
| `ClassConverter` | — | FR-042: 类型转换说明 | — |
| `FunctionCall` | — | FR-045: 内置/在线函数签名 | — |
| `MapOrArrayAccess` | — | FR-047: "访问 Map 或数组" | — |
| `LinqSelect` | — | FR-048: "linq 查询" | — |
| `VarDefine` | — | FR-041: 变量定义+类型 | — |

---

## 5. Phase 1 Design Outputs

### 5.1 FR 映射矩阵

| FR ID | 需求摘要 | 实现文件 | 关键代码行 | 实现策略 |
|---|---|---|---|---|
| FR-001 | 注册 `magicscript` 语言 | `magic-script.js` | 14 | `monaco.languages.register({id: 'magicscript'})` |
| FR-002 | 语言配置（词模式/括号/注释/运算符/自动闭合/Enter） | `magic-script.js` | 16-76 | `setLanguageConfiguration()` 含 4 条 onEnterRules + 11 对 autoClosingPairs |
| FR-003 | 自动闭合对（11 对） | `magic-script.js` | 64-75 | 含 `"""`、`<where>`、`<if>`、`<set>`、`<foreach>` 等 MyBatis 标签 |
| FR-004 | Javadoc Enter 续行 | `magic-script.js` | 24-56 | 4 条正则规则匹配 `/**`、` * `、` */` |
| FR-005 | 注释配置 `//` + `/* */` | `magic-script.js` | 58-61 | `comments: {lineComment, blockComment}` |
| FR-006 | 运算符列表 | `magic-script.js` | 62 | 18 个运算符数组 |
| FR-010 | 注册 Monarch 高亮 | `magic-script.js` | 79 | `setMonarchTokensProvider(language, HighLightOptions)` |
| FR-011 | 词法单元识别 | `high-light.js` | 10-120 | root 状态 15 条规则 + 8 个子状态 |
| FR-012 | 关键字列表 | `high-light.js` | 16 | 27 个关键字正则 |
| FR-013 | SQL 关键字 | `high-light.js` | 17 | 14 个 SQL 关键字（大小写不敏感） |
| FR-014 | 三引号嵌入 mybatis | `high-light.js` | 34 | `nextEmbedded: 'mybatis'` |
| FR-015 | 反引号 `${}` 嵌套 | `high-light.js` | 109-119 | `bracketCounting` 状态递归计数 |
| FR-016 | TODO/FIXME 标记 | `high-light.js` | 43-51 | comment/commentTodo 状态特殊着色 |
| FR-017 | builtinFunctions 动态填充 | `java-class.js` | 61 | `initClasses()` 成功后更新并重新注册 |
| FR-020 | 补全提供器 + 触发字符 | `magic-script.js` / `completion.js` | 81 / 366 | `triggerCharacters: ['.', ':']` |
| FR-021 | 快捷代码片段 | `completion.js` | 294-307 | 12 个 Snippet 模板 |
| FR-022 | import Java 包名补全 | `completion.js` | 92-136 | `completionImport()` → `completionImportJavaPackage()`，逐级导航 + `editor.action.triggerSuggest` |
| FR-023 | import @ API/函数补全 | `completion.js` | 103-133 | `getApiFinder()` / `getFunctionFinder()` 返回引用列表 |
| FR-024 | `::` 类型转换补全 | `completion.js` | 346-354 | 11 个类型转换选项 |
| FR-025 | `.` 结尾 AST 类型推断 | `completion.js` | 275-276 | `parser.parseBest()` → `best.getJavaType(env)` |
| FR-026 | MemberAccess/MethodCall 补全 | `completion.js` | 278-279 | `completionMethod()` 加载类元数据 |
| FR-027 | NewStatement 构造函数补全 | `completion.js` | 280-281 | `completionFunction()` + `additionalTextEdits` 自动 import |
| FR-028 | 降级补全（内置函数/变量/文本标识符） | `completion.js` | 282-287 | `completionFunction()` 三级降级 |
| FR-029 | Snippet 模式 | `completion.js` | 多处 | 所有补全项 `InsertAsSnippet` |
| FR-030 | Java 类补全上限 100 | `completion.js` | 23 | `suggestions.length < 100` 循环条件 |
| FR-031 | Object 类型 import 匹配 | `completion.js` | 139-165 | `getJavaType() === 'java.lang.Object'` 时遍历 importClass 匹配 |
| FR-040 | 注册 Hover 提供器 | `magic-script.js` | 87 | `registerHoverProvider()` |
| FR-041 | 变量定义悬停 | `hover.js` | 92-94 | `VarDefine` 节点 → 变量名+类型 |
| FR-042 | 类型转换悬停 | `hover.js` | 96-105 | `ClassConverter` 节点 → json/stringify/sql 特殊说明 |
| FR-043 | 变量访问悬停 | `hover.js` | 106-113 | `VariableAccess` → 变量名+类型 / 函数签名 |
| FR-044 | 成员访问悬停 | `hover.js` | 114-128 | `MemberAccess` → 方法/枚举/属性 |
| FR-045 | 函数调用悬停 | `hover.js` | 46-69 | `FunctionCall` → 内置函数 / 在线函数 |
| FR-046 | NewStatement 悬停 | `hover.js` | 132-136 | "创建对象" + 类型信息 |
| FR-047 | MapOrArrayAccess 悬停 | `hover.js` | 137-138 | "访问 Map 或数组" |
| FR-048 | LinqSelect 悬停 | `hover.js` | 139-140 | "linq 查询" |
| FR-050 | 注册签名提供器 + 触发字符 | `magic-script.js` / `signature.js` | 85 / 8-9 | `triggerCharacters: ['(', ',']`, `retrigger: ['(', ',']` |
| FR-051 | MethodCall 签名查找 | `signature.js` | 33-57 | AST → `loadClass()` → `findMethods()` 过滤重载 |
| FR-052 | 签名内容（全名/注释/参数） | `signature.js` | 40-55 | `fullName` + `comment` + 参数列表 |
| FR-053 | `,` 切换重载 | `signature.js` | 11-21 | `context.activeSignatureHelp.activeSignature += 1` 循环 |
| FR-054 | 无匹配静默返回 | `signature.js` | 58-68 | `signatures.length === 0` 时不返回 |
| FR-060 | 注册折叠提供器 | `magic-script.js` | 83 | `registerFoldingRangeProvider()` |
| FR-061 | 缩进折叠 | `folding.js` | 125-142 | `previousRegions` 栈 + 缩进比较 |
| FR-062 | import 块折叠 | `folding.js` | 97-119,144-149 | 扫描连续 import 行，标记 `FoldingRangeKind.Imports` |
| FR-063 | 折叠上限 5000 | `folding.js` | 94 | `RangesCollector(5000)` + 缩进优先级截断 |
| FR-064 | 最小长度 1 行 | `folding.js` | 133 | `endLineNumber - line_1 >= 1` |
| FR-070 | 注册格式化提供器 | `magic-script.js` | 89-96 | `registerDocumentFormattingEditProvider()` |
| FR-071 | Beautifier 格式化 | `magic-script.js` | 8,92 | `new Beautifier(model.getValue()).beautify()` |
| FR-072 | 全文替换 | `magic-script.js` | 93 | `range: model.getFullModelRange()` |
| FR-080 | defineTheme() | `theme.js` | 4-12 | 注册 monaco 主题 + 存入 Themes 对象 |
| FR-081 | 主题配置结构 | `theme.js` | 6,12 | `editor` + `styles` 两部分 |
| FR-082 | default 主题 | `default-theme.js` | 1-40 | base: `vs`，白色背景 + 语法着色 |
| FR-083 | dark 主题 | `dark-theme.js` | 1-39 | base: `vs-dark`，深色背景 + 语法着色 |
| FR-084 | dark UI 样式映射 | `dark-theme.js` | 40-112 | 约 70 个 CSS 变量 |
| FR-085 | Themes 对象存储 | `theme.js` | 3,12 | `Themes[name] = options.styles` |
| FR-090 | GET /classes 加载 | `java-class.js` | 54-68 | `request.send('classes')` → `scriptClass`/`extensions`/`functions` |
| FR-091 | GET /classes.txt 加载 | `java-class.js` | 70-91 | `request.execute({url:'classes.txt'})` → `importClass` 数组 |
| FR-092 | 类元数据结构 | `java-class.js` | 57-59 | `data.classes` → `scriptClass` 对象 |
| FR-093 | 方法元数据 | `java-class.js` | 105-134 | `processMethod()` 生成 `insertText`/`fullName`/`signature`/`sortText` |
| FR-094 | POST /class 动态加载 | `java-class.js` | 207-224 | `loadClass()` 按需加载未缓存类 |
| FR-095 | 扩展方法 | `java-class.js` | 184-187 | `extensions[clazz.className]` → `sortText + 10000` 排在最后 |
| FR-096 | 自动导入 | `java-class.js` | 230-257 | `initAutoImport()` 读取 `contants.config` |
| FR-097 | 在线函数加载器 | `java-class.js` | 260-265 | `setupOnlineFunction(loader)` |
| FR-098 | API/函数查找器 | `java-class.js` | 267-276 | `setApiFinder()` / `setFunctionFinder()` |
| FR-099 | 基本类型映射 | `java-class.js` | 13-38 | `getWrapperClass()` 映射到 Java 包装类 |
| FR-100 | 可变参数处理 | `java-class.js` | 112-113 | `varArgs` → `...` 语法 |

### 5.2 核心算法说明

#### 5.2.1 补全上下文推断（`completionScript`）

```
输入：当前光标位置前的全部文本
流程：
  1. tokenizer() 词法分析 → tokens 数组
  2. Parser(TokenStream(tokens)).parseBest(index) → {best, env}
  3. 根据 best 的 AST 节点类型分发：
     - input 以 "." 结尾 → best.getJavaType(env) → completionMethod()
     - MemberAccess / MethodCall → best.target.getJavaType(env) → completionMethod()
     - NewStatement → completionFunction() + 自动 import
     - 其他 → completionFunction() 降级补全
  4. 异常静默捕获
```

#### 5.2.2 import 补全逐级导航（`completionImportJavaPackage`）

```
输入：keyword（已输入的包名前缀）
流程：
  1. 匹配 defineModules（有 module 属性的类）→ Module 图标
  2. 遍历 importClass 数组（全量类名列表），suggestions < 100 时停止
  3. 匹配逻辑：
     - keyword 在类名中 → 提取子包名 → Folder 图标 + triggerSuggest 命令
     - 类名匹配 keyword → Class 图标
  4. 使用 Set 去重子包名
```

#### 5.2.3 折叠范围计算（`RangesCollector`）

```
输入：monaco text model
流程：
  1. 从最后一行向前扫描
  2. 识别连续 import 行 → 标记为 Imports 折叠
  3. 缩进栈（previousRegions）：
     - indent > previous.indent → 压栈（新折叠开始）
     - indent === previous.indent → 更新 endAbove
     - indent < previous.indent → 弹栈直到匹配，形成折叠范围
  4. RangesCollector 限制 5000 条，超出时按缩进层级优先级截断
```

#### 5.2.4 签名帮助重载切换

```
输入：context.activeSignatureHelp
流程：
  1. 若存在 activeSignatureHelp → activeSignature += 1，循环回 0
  2. 否则 → AST 分析 → MethodCall → loadClass → findMethods 过滤
  3. 构建 signatures 数组（label + documentation + parameters）
  4. 返回 {activeParameter: 0, activeSignature: 0, signatures}
```

### 5.3 错误处理策略

| 场景 | 文件 | 行号 | 处理方式 |
|---|---|---|---|
| 补全 AST 解析异常 | `completion.js` | 289-291 | 静默捕获（`catch (e) { // console.error(e) }`） |
| 签名 AST 解析异常 | `signature.js` | 70-72 | 静默捕获（`catch (e) { // console.log(e) }`） |
| 动态加载类元数据异常 | `java-class.js` | 217-219 | 静默捕获（空 catch 块） |
| initClasses 网络异常 | `java-class.js` | 63-67 | Promise reject，builtinFunctions 保持空数组 |
| initImportClass 网络异常 | `java-class.js` | 87-89 | Promise reject，importClass 保持空数组 |

### 5.4 性能约束实现

| 约束 | 实现位置 | 机制 |
|---|---|---|
| 补全上限 100 条 | `completion.js:23` | `suggestions.length < 100` 循环守卫 |
| 折叠上限 5000 条 | `folding.js:94` | `RangesCollector(5000)` + 缩进优先级截断算法 |
| 方法去重 | `completion.js:241-244` | `mmap[method.signature]` 签名去重 |
| 子包去重 | `completion.js:51-54` | `Set` 去重子包名 |

---

## 6. Complexity Tracking

| 复杂度维度 | 评级 | 说明 |
|---|---|---|
| **补全逻辑** | 🔴 高 | `completion.js` 368 行，包含 6 种补全场景（import/Java 类/方法/变量/快捷片段/类型转换），AST 解析 + 类型推断 + 降级策略，是模块中最复杂的文件 |
| **Hover 逻辑** | 🟡 中 | `hover.js` 152 行，8 种 AST 节点类型的悬停处理，依赖完整的 AST 遍历（`findBestMatch` 递归） |
| **签名帮助** | 🟢 低 | `signature.js` 75 行，仅处理 MethodCall 节点，重载切换逻辑简单 |
| **折叠逻辑** | 🟡 中 | `folding.js` 155 行，`RangesCollector` 类实现缩进栈算法 + import 块识别 + 5000 条截断 |
| **高亮规则** | 🟡 中 | `high-light.js` 121 行，Monarch 状态机含 11 个状态，规则密集但声明式 |
| **Java 类管理** | 🟡 中 | `java-class.js` 304 行，元数据加载/缓存/查询/扩展方法/自动导入/在线函数，状态管理复杂但逻辑线性 |
| **主题系统** | 🟢 低 | `theme.js` 13 行 + 两个主题配置文件，纯数据声明 |
| **语言注册** | 🟢 低 | `magic-script.js` 97 行，编排式代码，无复杂逻辑 |

---

## 7. Progress Tracking

| 章节 | 状态 | 备注 |
|---|---|---|
| 1. Technical Context | ✅ Done | 运行时环境、依赖版本、文件清单 |
| 2. Constitution Check | ✅ Done | 10 条宪法条款逐一检查，1 条 Partial |
| 3. Project Structure | ✅ Done | 模块内部结构、依赖关系图、初始化时序 |
| 4. Phase 0 Research | ✅ Done | monaco API 映射、Tokenizer 状态机、AST 消费矩阵 |
| 5. Phase 1 Design Outputs | ✅ Done | FR 全量映射、核心算法说明、错误处理、性能约束 |
| 6. Complexity Tracking | ✅ Done | 8 个文件的复杂度评级 |
| 7. Progress Tracking | ✅ Done | 本章节 |

---

## 8. 待澄清事项（与 spec.md 一致）

| ID | 位置 | 描述 |
|---|---|---|
| NC-001 | `completion.js:289-291` | 补全中的 AST 解析异常被静默吞掉。是否应在开发模式下输出到控制台以便调试？ |
| NC-002 | `java-class.js:217-219` | 动态加载类元数据时的异常也被静默吞掉。若后端 `/class` 接口返回异常，用户将无法获得任何补全提示，且无任何反馈。是否应增加错误提示？ |
| NC-003 | `high-light.js:3` | `builtinFunctions` 初始化为空数组，仅在 `initClasses()` 成功后更新。若 `initClasses()` 失败（网络异常），高亮中将缺失内置函数着色。是否有降级方案？ |
