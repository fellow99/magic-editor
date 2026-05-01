# 012-script-language 模块规范（As-Built）

> 模块编号：012-script-language
> 状态：已实现
> 最后更新：2026-05-01
> 对应源码：`src/scripts/editor/` 目录下 11 个文件（不含 mybatis.js），总计约 1,200 行

---

## 1. 模块概述

### 1.1 目的

本模块为 monaco-editor 注册 **magic-script** 自定义语言（`id=magicscript`），提供完整的语言服务体验：

- 语法高亮（Monarch tokenizer）
- 自动补全（CompletionItemProvider）
- 鼠标悬停提示（HoverProvider）
- 函数签名帮助（SignatureHelpProvider）
- 代码折叠（FoldingRangeProvider）
- 文档格式化（DocumentFormattingEditProvider）
- 主题定义与注册（default / dark + 用户自定义主题）
- Java 类元数据管理（类/方法/属性/枚举/扩展方法/在线函数）

### 1.2 解决的问题

- 为 magic-script 脚本语言提供 IDE 级编辑体验，而非纯文本编辑
- 通过后端返回的 Java 类元数据，实现 Java 类型感知的智能补全与悬停提示
- 通过自研解析器（011-script-parser）的 AST 分析，实现上下文感知的补全与签名帮助
- 提供开箱即用的 default/dark 双主题，同时允许用户通过 `defineTheme()` 扩展自定义主题

### 1.3 范围

**包含**：
- monaco 语言注册（`magicscript`）与语言配置
- Monarch 语法高亮规则
- 自动补全提供器（变量/Java 类/方法/import/快捷代码片段/类型转换）
- Hover 悬浮提示（变量类型/方法签名/枚举值/属性/类型转换）
- 签名帮助（方法参数提示）
- 代码折叠（缩进折叠 + import 块折叠）
- 文档格式化（基于 beautifier）
- 主题定义与注册机制
- Java 类元数据加载、缓存、查询

**不包含**：
- magic-script 词法/语法解析器 → 模块 011-script-parser
- MyBatis 风格脚本支持（`<where>`/`<if>`/`<foreach>` 等标签）→ 模块 013-script-mybatis
- monaco 编辑器实例生命周期管理 → 模块 001-editor-core
- beautifier 格式化引擎实现 → 模块 015-infra-bus-store（beautifier/ 子目录）

---

## 2. 用户场景与用例

### US-001：编辑 magic-script 脚本时获得语法高亮

- **角色**：开发者
- **前置条件**：编辑器已加载，magic-script 语言已注册
- **流程**：
  1. 用户在编辑器中输入 magic-script 代码
  2. 系统根据 Monarch 规则实时着色：关键字（蓝色加粗）、字符串（绿色）、数字（蓝色）、注释（灰色斜体）、SQL 关键字等
  3. 三引号 `"""` 内的内容以 mybatis 子语言高亮
- **后置条件**：代码以正确的语法颜色显示

### US-002：输入代码时获得自动补全建议

- **角色**：开发者
- **前置条件**：脚本已打开，Java 类元数据已加载
- **流程**：
  1. 用户输入代码，触发补全（输入 `.` 或 `:` 或手动触发 `Alt+/`）
  2. 系统根据当前上下文提供补全建议：
     - 输入 `import ` 后：Java 包名/类名补全，支持逐级导航
     - 输入 `import "@` 后：API/函数引用补全
     - 输入 `对象.` 后：该 Java 对象的方法/属性/枚举补全
     - 输入 `::` 后：类型转换选项（int/long/date/string 等）
     - 空白输入时：内置函数、变量、快捷代码片段（if/for/log 等）
  3. 用户选择补全项，代码自动插入
- **后置条件**：补全内容插入到编辑器中

### US-003：鼠标悬停查看变量/方法信息

- **角色**：开发者
- **前置条件**：脚本已打开
- **流程**：
  1. 用户将鼠标悬停在代码中的变量/方法调用/类型转换上
  2. 系统显示悬浮提示：
     - 变量：变量名 + 类型
     - 方法调用：方法签名 + 参数说明 + 返回类型
     - 类型转换（`::json`/`::stringify`/`::sql`）：转换说明
     - 枚举值：枚举全限定名
     - 属性：属性名 + 类型 + 注释
- **后置条件**：悬浮提示框显示

### US-004：输入函数参数时获得签名帮助

- **角色**：开发者
- **前置条件**：脚本已打开，Java 类元数据已加载
- **流程**：
  1. 用户输入方法名并键入 `(`
  2. 系统显示方法签名提示，包含参数名、类型、注释
  3. 用户输入 `,` 切换到下一个重载签名
- **后置条件**：签名帮助框显示

### US-005：折叠代码块

- **角色**：开发者
- **前置条件**：脚本已打开
- **流程**：
  1. 编辑器自动识别缩进层级和 import 块
  2. 用户点击行号旁的折叠图标
  3. 对应代码块折叠/展开
- **后置条件**：代码块折叠或展开

### US-006：格式化文档

- **角色**：开发者
- **前置条件**：脚本已打开
- **流程**：
  1. 用户触发格式化（快捷键 `Ctrl/Cmd+Alt+L` 或右键菜单）
  2. 系统使用内置 beautifier 格式化全文
  3. 编辑器内容替换为格式化后的代码
- **后置条件**：代码按规范缩进和换行

### US-007：切换编辑器主题

- **角色**：开发者
- **前置条件**：主题已注册
- **流程**：
  1. 用户通过 UI 切换皮肤（default / dark）
  2. 系统应用对应主题，包括编辑器语法着色和 UI 组件样式
- **后置条件**：编辑器外观切换

---

## 3. 功能需求

### 3.1 语言注册与配置

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-001 | 系统 MUST 向 monaco 注册语言 `magicscript`（`id: 'magicscript'`） | `magic-script.js:14` |
| FR-002 | 系统 MUST 设置语言配置，包括：词模式、括号对、注释符号、运算符、自动闭合对、Enter 规则 | `magic-script.js:16-76` |
| FR-003 | 自动闭合对 MUST 包含：`{}` `[]` `()` `"""` `"<where></where>"` `<if>` `<set>` `<foreach>` `""` `''` `/** */` | `magic-script.js:64-75` |
| FR-004 | Enter 规则 MUST 支持 Javadoc 风格注释的自动续行（`/** | */` / ` * ...` / ` */`） | `magic-script.js:24-56` |
| FR-005 | 注释配置 MUST 指定行注释为 `//`，块注释为 `/* */` | `magic-script.js:58-61` |
| FR-006 | 运算符列表 MUST 包含：比较运算符、算术运算符、逻辑运算符、三元运算符、复合赋值运算符 | `magic-script.js:62` |

### 3.2 语法高亮（Monarch Tokenizer）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-010 | 系统 MUST 为 `magicscript` 注册 Monarch 语法高亮提供器 | `magic-script.js:79` |
| FR-011 | 高亮规则 MUST 识别以下词法单元：空白、代码块（```）、标识符、关键字、SQL 关键字、类型转换（`::`）、括号、数字（十进制/十六进制/二进制）、注释（块注释/行注释/TODO）、正则表达式、分隔符、字符串（三引号/双引号/单引号/反引号） | `high-light.js:10-120` |
| FR-012 | 关键字 MUST 包含：`new` `var` `if` `else` `for` `in` `return` `import` `break` `continue` `as` `null` `true` `false` `try` `catch` `finally` `async` `while` `exit` `asc` `desc` `ASC` `DESC` `assert` `let` `const` `throw` | `high-light.js:16` |
| FR-013 | SQL 关键字 MUST 包含：`select` `from` `left` `join` `on` `and` `or` `order` `by` `where` `group` `having` `limit` `offset`（大小写不敏感） | `high-light.js:17` |
| FR-014 | 三引号字符串 `"""` MUST 嵌入 mybatis 子语言高亮 | `high-light.js:34` |
| FR-015 | 反引号字符串 MUST 支持 `${}` 模板表达式嵌套 | `high-light.js:109-119` |
| FR-016 | 块注释和行注释 MUST 识别 TODO/FIXME 标记并特殊着色 | `high-light.js:43-51` |
| FR-017 | `builtinFunctions` 数组 MUST 由后端返回的函数列表动态填充 | `java-class.js:61` |

### 3.3 自动补全（CompletionItemProvider）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-020 | 系统 MUST 为 `magicscript` 注册补全提供器，触发字符为 `.` 和 `:` | `magic-script.js:81`、`completion.js:366` |
| FR-021 | 快捷代码片段 MUST 包含：`bre`（break）、`con`（continue）、`imp`（import）、`if`/`ife`（条件判断）、`for`（循环）、`exit`（退出）、`logi`/`logd`/`loge`/`logw`（日志）、`ass`（断言） | `completion.js:294-307` |
| FR-022 | 当当前行以 `import` 开头时，系统 MUST 提供 Java 包名/类名补全，支持逐级导航（输入包名前缀 → 显示子包 → 选择后触发二次补全） | `completion.js:92-136` |
| FR-023 | 当 `import` 后跟 `@` 时，系统 MUST 提供 API 和函数引用补全（格式：`@METHOD:PATH` 或 `@PATH`） | `completion.js:103-133` |
| FR-024 | 当输入以 `::` 结尾时，系统 MUST 提供类型转换选项：`int` `long` `date` `string` `short` `byte` `float` `double` `json` `stringify` `sql` | `completion.js:346-354` |
| FR-025 | 当输入以 `.` 结尾时，系统 MUST 通过 AST 分析获取目标 Java 类型，并提供该类型的方法/属性/枚举补全 | `completion.js:275-276` |
| FR-026 | 当光标位于 `MemberAccess` 或 `MethodCall` AST 节点时，系统 MUST 提供目标对象的方法/属性/枚举补全 | `completion.js:278-279` |
| FR-027 | 当光标位于 `NewStatement` AST 节点时，系统 MUST 提供构造函数补全并自动插入 `import` 语句 | `completion.js:280-281` |
| FR-028 | 当无法通过 AST 确定上下文时，系统 MUST 提供：内置函数补全、环境变量补全、文本中出现过的标识符补全 | `completion.js:282-287` |
| FR-029 | 补全项 MUST 使用 Snippet 模式（`InsertAsSnippet`），支持占位符跳转 | `completion.js:20,43,62,87,152,175,189,200,259,338,352` |
| FR-030 | Java 类补全 MUST 限制最多 100 条建议，避免性能问题 | `completion.js:23` |
| FR-031 | 当变量类型为 `java.lang.Object` 时，系统 MUST 尝试从已导入类中匹配类名并提供 import 补全 | `completion.js:139-165` |

### 3.4 悬浮提示（HoverProvider）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-040 | 系统 MUST 为 `magicscript` 注册 Hover 提供器 | `magic-script.js:87` |
| FR-041 | 悬停在变量定义上时，MUST 显示变量名和类型 | `hover.js:92-94` |
| FR-042 | 悬停在类型转换上时，MUST 显示转换说明（`::json` → "强制转换为 JSON 类型"，`::stringify` → "转换为 JSON 字符串"，`::sql` → 等同于 `SqlParameterValue` 构造） | `hover.js:96-105` |
| FR-043 | 悬停在变量访问上时，MUST 显示变量名和类型；若为函数调用，MUST 显示函数签名 | `hover.js:106-113` |
| FR-044 | 悬停在成员访问上时，MUST 显示方法签名/枚举值/属性信息（含类型和注释） | `hover.js:114-128` |
| FR-045 | 悬停在函数调用上时，MUST 区分内置函数和在线函数，分别显示对应签名 | `hover.js:46-69` |
| FR-046 | 悬停在 `NewStatement` 上时，MUST 显示"创建对象"及类型信息 | `hover.js:132-136` |
| FR-047 | 悬停在 `MapOrArrayAccess` 上时，MUST 显示"访问 Map 或数组" | `hover.js:137-138` |
| FR-048 | 悬停在 `LinqSelect` 上时，MUST 显示"linq 查询" | `hover.js:139-140` |

### 3.5 签名帮助（SignatureHelpProvider）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-050 | 系统 MUST 为 `magicscript` 注册签名帮助提供器，触发字符为 `(` 和 `,` | `magic-script.js:85`、`signature.js:8-9` |
| FR-051 | 当光标位于 `MethodCall` AST 节点时，系统 MUST 通过 Java 类元数据查找对应方法的所有重载签名 | `signature.js:33-57` |
| FR-052 | 每个签名 MUST 包含：方法全名、注释、参数列表（参数名 + 类型/注释） | `signature.js:40-55` |
| FR-053 | 用户输入 `,` 时，系统 MUST 循环切换到下一个重载签名 | `signature.js:11-21` |
| FR-054 | 若无匹配签名，系统 MUST 不显示签名帮助（静默返回） | `signature.js:58-68` |

### 3.6 代码折叠（FoldingRangeProvider）

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-060 | 系统 MUST 为 `magicscript` 注册折叠范围提供器 | `magic-script.js:83` |
| FR-061 | 系统 MUST 基于缩进层级计算折叠范围（相邻行缩进减少时形成折叠边界） | `folding.js:125-142` |
| FR-062 | 系统 MUST 识别连续的 `import` 语句块并标记为 `Imports` 类型折叠 | `folding.js:97-119,144-149` |
| FR-063 | 折叠范围 MUST 限制最大 5000 条，超出时按缩进层级优先级截断 | `folding.js:94` |
| FR-064 | 折叠范围最小长度为 1 行（`endLineNumber - startLineNumber >= 1`） | `folding.js:133` |

### 3.7 文档格式化

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-070 | 系统 MUST 为 `magicscript` 注册文档格式化提供器 | `magic-script.js:89-96` |
| FR-071 | 格式化 MUST 使用内置 `Beautifier` 对全文进行 JavaScript 风格格式化 | `magic-script.js:8,92` |
| FR-072 | 格式化结果 MUST 替换整个文档内容（`range: model.getFullModelRange()`） | `magic-script.js:93` |

### 3.8 主题系统

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-080 | 系统 MUST 提供 `defineTheme(name, options)` 函数用于注册自定义主题 | `theme.js:4-12` |
| FR-081 | 主题配置 MUST 包含 `editor`（monaco 主题定义）和 `styles`（UI 组件 CSS 变量映射）两部分 | `theme.js:6,12` |
| FR-082 | 默认主题（default）MUST 基于 `vs` 基础主题，提供白色背景 + 关键字蓝色加粗 + 字符串绿色等规则 | `default-theme.js:1-40` |
| FR-083 | 暗色主题（dark）MUST 基于 `vs-dark` 基础主题，提供深色背景 + 关键字橙色 + 字符串绿色等规则 | `dark-theme.js:1-39` |
| FR-084 | 暗色主题 MUST 额外提供完整的 UI 组件样式映射（约 70 个 CSS 变量），覆盖背景、边框、文字、按钮、表格、日志颜色等 | `dark-theme.js:40-112` |
| FR-085 | 注册的主题 MUST 存入 `Themes` 对象供外部查询 | `theme.js:3,12` |

### 3.9 Java 类元数据管理

| ID | 需求 | 源码证据 |
|---|---|---|
| FR-090 | 系统 MUST 在启动时通过 `GET /classes` 加载 Java 类元数据（类/扩展/内置函数） | `java-class.js:54-68` |
| FR-091 | 系统 MUST 在启动时通过 `GET /classes.txt` 加载全量类名列表（用于 import 补全） | `java-class.js:70-91` |
| FR-092 | 类元数据 MUST 包含：类名、父类、接口、方法列表、属性列表、枚举值列表 | `java-class.js:57-59` |
| FR-093 | 方法元数据 MUST 包含：方法名、参数列表（名/类型/注释/可变参数）、返回类型、注释 | `java-class.js:105-134` |
| FR-094 | 系统 MUST 支持按需通过 `POST /class` 动态加载未缓存的类元数据 | `java-class.js:207-224` |
| FR-095 | 系统 MUST 支持扩展方法（extension methods），扩展方法在补全/签名中排在原生方法之后 | `java-class.js:184-187` |
| FR-096 | 系统 MUST 支持自动导入模块和自动导入类（从 `contants.config.autoImportModuleList` / `autoImportPackage` 读取配置） | `java-class.js:230-257` |
| FR-097 | 系统 MUST 提供 `setupOnlineFunction(loader)` 注册在线函数加载器，用于悬停提示中显示在线函数签名 | `java-class.js:260-265` |
| FR-098 | 系统 MUST 提供 `setApiFinder(finder)` / `setFunctionFinder(finder)` 注册 API/函数查找器，用于 `import @` 补全 | `java-class.js:267-276` |
| FR-099 | 基本类型（int/string/double/float/byte/short/long）MUST 映射到对应的 Java 包装类 | `java-class.js:13-38` |
| FR-100 | 方法签名生成 MUST 处理可变参数（varArgs），在补全文本中显示为 `...` 语法 | `java-class.js:112-113` |

---

## 4. 非功能需求

| ID | 类别 | 需求 | 源码证据 |
|---|---|---|---|
| NFR-001 | 性能 | 补全建议 MUST 限制 Java 类最多 100 条，避免大量类时 UI 卡顿 | `completion.js:23` |
| NFR-002 | 性能 | 折叠范围 MUST 限制最大 5000 条，超大文件按缩进优先级截断 | `folding.js:94` |
| NFR-003 | 健壮性 | 补全和签名帮助中的 AST 解析异常 MUST 静默捕获（不抛出到 monaco） | `completion.js:289-291`、`signature.js:70-72` |
| NFR-004 | 兼容性 | 语言服务 MUST 兼容 monaco-editor 0.29.1 API | 全局 |
| NFR-005 | 可配置性 | 自动导入的包列表 MUST 通过后端 `config.autoImportPackage` 配置 | `java-class.js:239` |
| NFR-006 | 可配置性 | 自动导入的模块列表 MUST 通过后端 `config.autoImportModuleList` 配置 | `java-class.js:233-237` |

---

## 5. 关键实体

| 实体 | 描述 | 关键属性 |
|---|---|---|
| **JavaClass 元数据** | 后端返回的 Java 类信息 | `className`、`superClass`、`interfaces`、`methods[]`、`attributes[]`、`enums[]`、`module` |
| **方法元数据** | Java 方法的描述信息 | `name`、`parameters[]`（name/type/comment/varArgs）、`returnType`、`comment`、`insertText`、`fullName`、`signature`、`sortText`、`extension` |
| **属性元数据** | Java 类字段信息 | `name`、`type`、`comment` |
| **快捷代码片段** | 预定义的补全模板 | 触发前缀、Snippet 模板、描述 |
| **主题配置** | monaco 主题 + UI 样式映射 | `editor`（base/rules/colors）、`styles`（CSS 变量映射） |

---

## 6. 接受场景

### 场景：import 补全逐级导航

- **前置条件**：Java 类元数据已加载
- **操作**：用户在空行输入 `import java.u`
- **预期**：补全列表显示 `java.util.` 等匹配的子包，选择后自动触发二次补全显示该包下的类

### 场景：对象方法补全

- **前置条件**：Java 类元数据已加载，变量 `list` 类型为 `java.util.List`
- **操作**：用户输入 `list.`
- **预期**：补全列表显示 `List` 接口及其父类/接口的所有方法（`add`、`get`、`size` 等），含参数占位符

### 场景：类型转换补全

- **前置条件**：编辑器已打开
- **操作**：用户输入 `var ::`
- **预期**：补全列表显示 `int`、`long`、`date`、`string`、`json`、`stringify`、`sql` 等类型转换选项

### 场景：方法签名提示

- **前置条件**：Java 类元数据已加载
- **操作**：用户输入 `log.info(`
- **预期**：签名帮助框显示 `info(Object message)` 等重载签名，含参数名和类型

### 场景：悬停查看变量类型

- **前置条件**：脚本已打开，变量 `name` 已定义
- **操作**：用户将鼠标悬停在 `name` 上
- **预期**：悬浮提示显示"访问变量：name"和"变量类型：java.lang.String"

### 场景：import 块折叠

- **前置条件**：脚本包含多行连续的 import 语句
- **操作**：用户点击 import 块旁的折叠图标
- **预期**：所有 import 行折叠为一行，标记为 "Imports"

---

## 7. 假设与约束

### 7.1 假设

- A-001：后端 `/classes` 和 `/classes.txt` 接口始终可用，返回格式稳定
- A-002：magic-script 语言的语法与 JavaScript 高度相似，因此复用 JavaScript Beautifier 进行格式化
- A-003：`contants.config` 在 `initAutoImport()` 调用时已就绪（由 `magic-editor.vue` 的 `beforeMount` 保证）
- A-004：在线函数加载器由外部模块（001-editor-core）通过 `JavaClass.setupOnlineFunction()` 注册

### 7.2 约束

- C-001：本模块仅为 `magicscript` 语言服务，不得通用化为多语言 IDE（宪法第五条）
- C-002：补全/签名/Hover 均依赖 011-script-parser 的 AST 解析能力，解析失败时静默降级
- C-003：格式化使用 JavaScript Beautifier，对 magic-script 特有语法（如 `::` 类型转换、`exit` 语句）可能不完全适配
- C-004：`java-class.js` 中的类元数据缓存在模块级变量中（`scriptClass`/`extensions`/`importClass`），页面刷新后丢失

---

## 8. 依赖清单

### 8.1 上游依赖（本模块消费）

| 依赖 | 类型 | 用途 | 源码行 |
|---|---|---|---|
| 011-script-parser | 内部模块 | `tokenizer`、`Parser`、`TokenStream`、AST 节点类 | `completion.js:2-7`、`hover.js:1-13`、`signature.js:2-5` |
| 015-infra-bus-store (beautifier) | 内部模块 | `Beautifier` 格式化引擎 | `magic-script.js:8` |
| 001-editor-core | 内部模块 | 调用 `initializeMagicScript()` 触发初始化 | `magic-script-editor.vue:69,107` |
| contants | 内部模块 | 读取 `config.autoImportPackage` / `autoImportModuleList` | `java-class.js:2,231-239` |
| api/request | 内部模块 | HTTP 请求加载 Java 类元数据 | `java-class.js:1,55,72` |
| monaco-editor | 外部库（0.29.1） | 语言注册 API、补全/Hover/签名/折叠/格式化 API | 全局 |

### 8.2 下游依赖（本模块提供）

| 依赖方 | 消费内容 | 交互方式 |
|---|---|---|
| 001-editor-core | `initializeMagicScript()` 函数 | 直接 import 调用 |
| 013-script-mybatis | `initMybatis()` 在 `initializeMagicScript()` 中被调用 | 内部调用 |
| 001-editor-core | `JavaClass.setupOnlineFunction()` / `setApiFinder()` / `setFunctionFinder()` | 直接 import 调用 |
| 001-editor-core | `RequestParameter.setEnvironment()` | 直接 import 调用 |
| 001-editor-core | `Themes` 对象（主题样式映射） | 通过 `theme.js` export |
| 001-editor-core | `defineTheme()` 函数 | 通过 `theme.js` export |

### 8.3 与相邻模块的边界

| 边界 | 本模块负责 | 相邻模块负责 | 交互方式 |
|---|---|---|---|
| **与 011-script-parser** | 消费 AST 节点进行补全/Hover/签名分析 | 提供 tokenizer/Parser/AST 解析能力 | 直接 import |
| **与 013-script-mybatis** | 注册 `magicscript` 语言 + 调用 `initMybatis()` | 注册 `mybatis` 子语言 + MyBatis 标签补全/高亮 | `magic-script.js:7,11` 内部调用 |
| **与 001-editor-core** | 提供语言服务注册函数 `initializeMagicScript()` | 创建 monaco 编辑器实例、管理 Tab/断点/调试 | `magic-script-editor.vue:69,107` 调用 |
| **与 015-infra-bus-store (beautifier)** | 调用 `Beautifier` 进行格式化 | 提供 JavaScript 格式化引擎实现 | `magic-script.js:8` import |

---

## 9. monaco.languages.* API 调用点清单

| API | 文件 | 行号 | 用途 |
|---|---|---|---|
| `monaco.languages.register` | `magic-script.js` | 14 | 注册 `magicscript` 语言 |
| `monaco.languages.setLanguageConfiguration` | `magic-script.js` | 16 | 设置语言配置（括号/注释/运算符/自动闭合/Enter 规则） |
| `monaco.languages.IndentAction.IndentOutdent` | `magic-script.js` | 29 | Javadoc Enter 缩进动作 |
| `monaco.languages.IndentAction.None` | `magic-script.js` | 37,45,53 | Javadoc Enter 无缩进动作 |
| `monaco.languages.setMonarchTokensProvider` | `magic-script.js` | 79 | 注册语法高亮 |
| `monaco.languages.setMonarchTokensProvider` | `java-class.js` | 61 | 动态更新 builtinFunctions 后重新注册高亮 |
| `monaco.languages.registerCompletionItemProvider` | `magic-script.js` | 81 | 注册补全提供器 |
| `monaco.languages.registerFoldingRangeProvider` | `magic-script.js` | 83 | 注册折叠提供器 |
| `monaco.languages.registerSignatureHelpProvider` | `magic-script.js` | 85 | 注册签名帮助提供器 |
| `monaco.languages.registerHoverProvider` | `magic-script.js` | 87 | 注册悬浮提示提供器 |
| `monaco.languages.registerDocumentFormattingEditProvider` | `magic-script.js` | 89 | 注册格式化提供器 |
| `monaco.languages.CompletionItemKind.*` | `completion.js` | 17,39,58,71,84,113,126,149,172,186,197,216,229,255,334,351 | 补全项图标类型 |
| `monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet` | `completion.js` | 20,43,62,87,152,175,189,200,259,338,352 | Snippet 插入模式 |
| `monaco.languages.FoldingRangeKind.Imports` | `folding.js` | 114,148 | import 块折叠标记 |
| `monaco.editor.defineTheme` | `theme.js` | 11 | 注册 monaco 主题 |

---

## 10. 待澄清

| ID | 位置 | 描述 |
|---|---|---|
| NC-001 | `completion.js:289-291` | 补全中的 AST 解析异常被静默吞掉（`catch (e) { // console.error(e) }`）。是否应在开发模式下输出到控制台以便调试？ |
| NC-002 | `java-class.js:217-219` | 动态加载类元数据时的异常也被静默吞掉。若后端 `/class` 接口返回异常，用户将无法获得任何补全提示，且无任何反馈。是否应增加错误提示？ |
| NC-003 | `high-light.js:3` | `builtinFunctions` 初始化为空数组，仅在 `initClasses()` 成功后更新。若 `initClasses()` 失败（网络异常），高亮中将缺失内置函数着色。是否有降级方案？ |

---

## 附录：源码引用清单

| 文件 | 行号范围 | 引用说明 |
|---|---|---|
| `src/scripts/editor/magic-script.js` | 1-97 | 语言注册入口：`initializeMagicScript()`，注册 magicscript 语言 + 全部语言服务 |
| `src/scripts/editor/completion.js` | 1-368 | 补全提供器：import 补全、Java 类补全、方法补全、变量补全、快捷代码片段、类型转换补全 |
| `src/scripts/editor/hover.js` | 1-152 | 悬浮提示提供器：变量/方法/类型转换/枚举/属性/在线函数悬停信息 |
| `src/scripts/editor/signature.js` | 1-75 | 签名帮助提供器：方法参数提示、重载签名切换 |
| `src/scripts/editor/folding.js` | 1-155 | 折叠范围提供器：缩进折叠 + import 块折叠，`RangesCollector` 类 |
| `src/scripts/editor/high-light.js` | 1-121 | Monarch 语法高亮规则：关键字/SQL/字符串/注释/数字/正则/代码块 |
| `src/scripts/editor/theme.js` | 1-13 | 主题注册机制：`defineTheme()` + `Themes` 对象 |
| `src/scripts/editor/default-theme.js` | 1-40 | 默认主题配置：白色背景 + 语法着色规则 + 编辑器颜色 |
| `src/scripts/editor/dark-theme.js` | 1-113 | 暗色主题配置：深色背景 + 语法着色规则 + 约 70 个 UI 组件样式映射 |
| `src/scripts/editor/java-class.js` | 1-304 | Java 类元数据管理：加载/缓存/查询/扩展方法/自动导入/在线函数 |
| `src/scripts/editor/request-parameter.js` | 1-5 | 环境函数注册接口：`setEnvironment()` |
| `src/components/editor/magic-script-editor.vue` | 69,107 | 调用 `initializeMagicScript()` 初始化语言服务 |
| `src/scripts/parsing/tokenizer.js` | 1-365 | 词法分析器（被 completion/hover/signature 消费） |
| `src/scripts/parsing/parser.js` | 1-954 | 语法解析器（被 completion/hover/signature 消费） |
| `src/scripts/parsing/ast.js` | 1-735 | AST 节点定义（被 completion/hover/signature 消费） |
| `src/scripts/parsing/index.js` | 1-552 | TokenStream / ParseException 入口 |
| `src/scripts/beautifier/javascript/beautifier.js` | — | JavaScript 格式化引擎（被 magic-script.js 消费） |
