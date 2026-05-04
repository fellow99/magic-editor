# 012-script-language 测试用例

> 模块编号：012-script-language
> 关联规范：[spec.md](./spec.md)
> 对应源码：`src/scripts/editor/`（不含 mybatis.js）
> 用例编号格式：`TC-012-NNN`

---

## 1. 测试范围

**纳入**：monaco 语言注册、Monarch 高亮、补全、悬停、签名、折叠、格式化、主题、Java 类元数据加载与查询。

**排除**：底层 AST（011）、MyBatis 子语言（013）、编辑器实例生命周期（001）、Beautifier 内部（015）。

---

## 2. 环境前置

| 项 | 期望 |
|---|---|
| monaco-editor | 0.29.1 实例已挂载 |
| `JavaClass.initClasses()` | 后端 `/classes`、`/classes.txt` 可 mock |
| `RequestParameter.environmentFunction` | 提供内置环境变量 |
| `contants.config.autoImportPackage/autoImportModuleList` | 已注入 |

---

## 3. 语言注册（FR-001~006）

### TC-012-001 注册 magicscript 语言
- **关联**：FR-001、FR-002
- **优先级**：P0
- **步骤**：调用 `initializeMagicScript()`
- **预期**：`monaco.languages.getLanguages()` 含 `id='magicscript'`；语言配置已应用

### TC-012-002 自动闭合对
- **关联**：FR-003
- **优先级**：P0
- **预期**：输入 `{`/`[`/`(`/`"""`/`<where>`/`<if>`/`<set>`/`<foreach>`/`"`/`'`/`/**` 自动补齐对应闭合

### TC-012-003 Javadoc Enter 续行
- **关联**：FR-004
- **优先级**：P1
- **步骤**：在 `/**` 后回车
- **预期**：自动插入 ` * ` 与 ` */`，光标定位在中间行

### TC-012-004 注释配置
- **关联**：FR-005
- **优先级**：P0
- **预期**：行注释 `//`、块注释 `/* */`；触发 monaco "切换注释" 命令插入对应符号

### TC-012-005 运算符列表完整
- **关联**：FR-006
- **优先级**：P1
- **预期**：语言配置 operators 含全部比较 / 算术 / 逻辑 / 三元 / 复合赋值

---

## 4. 语法高亮（FR-010~017）

### TC-012-010 Monarch 提供器注册
- **关联**：FR-010
- **优先级**：P0
- **预期**：调用 `setMonarchTokensProvider('magicscript', ...)`

### TC-012-011 词法单元着色
- **关联**：FR-011
- **优先级**：P0
- **输入**：含关键字、SQL、`::`、括号、十六/二进制数字、注释、TODO、正则、字符串、反引号
- **预期**：每段 token 命中 `keyword/string/number/comment/regexp/...` 对应 token type

### TC-012-012 关键字集合
- **关联**：FR-012
- **优先级**：P0
- **预期**：spec 列出的全部 28 个关键字均着 keyword 色

### TC-012-013 SQL 关键字大小写不敏感
- **关联**：FR-013
- **优先级**：P0
- **输入**：`SELECT a FROM t WHERE x`
- **预期**：SELECT/FROM/WHERE 着 SQL 关键字色

### TC-012-014 三引号嵌入 mybatis
- **关联**：FR-014
- **优先级**：P0
- **输入**：`"""<where><if test="a"></if></where>"""`
- **预期**：内部以 mybatis token 着色（`nextEmbedded: 'mybatis'`）

### TC-012-015 反引号模板表达式
- **关联**：FR-015
- **优先级**：P0
- **输入**：`` `name=${user.name}` ``
- **预期**：`${user.name}` 段以表达式 token 着色，外层为 string

### TC-012-016 TODO/FIXME 标记
- **关联**：FR-016
- **优先级**：P2
- **输入**：`// TODO: x`、`/* FIXME */`
- **预期**：TODO/FIXME 单独着色

### TC-012-017 builtinFunctions 动态填充
- **关联**：FR-017
- **优先级**：P1
- **mock**：`/classes` 返回 functions=[`log`, `db`]
- **预期**：`initClasses()` 后高亮规则中 `log`/`db` 着 builtin 色

---

## 5. 自动补全（FR-020~031）

### TC-012-020 注册补全提供器与触发字符
- **关联**：FR-020
- **优先级**：P0
- **预期**：`registerCompletionItemProvider` 触发字符为 `.` 与 `:`

### TC-012-021 快捷代码片段
- **关联**：FR-021
- **优先级**：P0
- **输入前缀**：bre / con / imp / if / ife / for / exit / logi / logd / loge / logw / ass
- **预期**：每个前缀返回对应 snippet，`InsertAsSnippet` 模式

### TC-012-022 import 包名逐级
- **关联**：FR-022、接受场景"import 补全逐级导航"
- **优先级**：P0
- **输入**：`import java.u`
- **预期**：列表含 `java.util.` 子包；选中后自动二次触发显示该包下类

### TC-012-023 import @ API/函数
- **关联**：FR-023
- **优先级**：P0
- **mock**：`apiFinder()` 返回 [{method:'GET',path:'/u'}]，`functionFinder()` 返回 [{path:'/f'}]
- **输入**：`import "@`
- **预期**：列表含 `@GET:/u`、`@/f`

### TC-012-024 :: 类型转换
- **关联**：FR-024、接受场景"类型转换补全"
- **优先级**：P0
- **输入**：`x ::`
- **预期**：建议 11 项：int/long/date/string/short/byte/float/double/json/stringify/sql

### TC-012-025 . 后基于 AST 的方法补全
- **关联**：FR-025、FR-026、接受场景"对象方法补全"
- **优先级**：P0
- **前置**：env.list = `java.util.List`
- **输入**：`list.`
- **预期**：含 add/get/size 等方法，参数占位符就位

### TC-012-026 NewStatement 自动 import
- **关联**：FR-027
- **优先级**：P0
- **输入**：`new ArrayLi`
- **预期**：选择 `ArrayList` 后自动在文件头部插入 `import java.util.ArrayList`

### TC-012-027 兜底补全
- **关联**：FR-028
- **优先级**：P0
- **预期**：无 AST 上下文时同时返回内置函数 + 环境变量 + 文本中已出现标识符

### TC-012-028 Snippet 模式
- **关联**：FR-029
- **优先级**：P0
- **预期**：所有补全项 `insertTextRules = InsertAsSnippet`

### TC-012-029 Java 类补全 100 条上限
- **关联**：FR-030、NFR-001
- **优先级**：P1
- **mock**：classes.txt 返回 500 条匹配
- **预期**：UI 仅展示前 100 条

### TC-012-030 Object 类型 import 补全
- **关联**：FR-031
- **优先级**：P1
- **预期**：当推导出 `java.lang.Object` 时，补全列表附带候选 import

---

## 6. 悬停（FR-040~048）

### TC-012-040 注册 Hover 提供器
- **关联**：FR-040
- **优先级**：P0
- **预期**：`registerHoverProvider('magicscript', ...)` 被调用

### TC-012-041 变量 Hover
- **关联**：FR-041、接受场景"悬停查看变量类型"
- **优先级**：P0
- **输入**：`var name = "a"`，hover 在 `name`
- **预期**：显示"访问变量：name"+"java.lang.String"

### TC-012-042 :: Hover 文本
- **关联**：FR-042
- **优先级**：P0
- **预期**：`::json`/`::stringify`/`::sql` 各显示对应固定说明文案

### TC-012-043 函数调用 Hover
- **关联**：FR-043、FR-045
- **优先级**：P0
- **预期**：内置函数显示 builtin 签名；在线函数走 `setupOnlineFunction` 加载器

### TC-012-044 MemberAccess Hover
- **关联**：FR-044
- **优先级**：P0
- **预期**：方法/枚举/属性分别命中各自分支，含类型与注释

### TC-012-045 New / MapOrArrayAccess / LinqSelect Hover
- **关联**：FR-046、FR-047、FR-048
- **优先级**：P1
- **预期**：分别显示"创建对象"/"访问 Map 或数组"/"linq 查询"

---

## 7. 签名帮助（FR-050~054）

### TC-012-060 注册签名提供器
- **关联**：FR-050
- **优先级**：P0
- **预期**：触发字符为 `(` 与 `,`

### TC-012-061 重载签名生成
- **关联**：FR-051、FR-052、接受场景"方法签名提示"
- **优先级**：P0
- **输入**：`log.info(`
- **预期**：返回若干签名，每签名含 fullName / 参数名 / 类型 / 注释

### TC-012-062 逗号切换签名
- **关联**：FR-053
- **优先级**：P0
- **预期**：输入 `,` 后 activeSignature 切换至下一重载（循环）

### TC-012-063 无匹配静默
- **关联**：FR-054、NFR-003
- **优先级**：P1
- **预期**：未命中方法时返回空，UI 不弹出

---

## 8. 代码折叠（FR-060~064）

### TC-012-070 注册折叠提供器
- **关联**：FR-060
- **优先级**：P0
- **预期**：`registerFoldingRangeProvider` 调用

### TC-012-071 缩进折叠
- **关联**：FR-061
- **优先级**：P0
- **输入**：含 `if (a) { ... }`
- **预期**：返回相应 FoldingRange

### TC-012-072 import 块折叠 kind=Imports
- **关联**：FR-062、接受场景"import 块折叠"
- **优先级**：P0
- **输入**：连续 5 行 import
- **预期**：单一折叠范围 kind=`Imports`

### TC-012-073 5000 条上限
- **关联**：FR-063、NFR-002
- **优先级**：P2
- **预期**：超大文件按缩进优先级截断到 5000

### TC-012-074 最小折叠 1 行
- **关联**：FR-064
- **优先级**：P1
- **预期**：单行块不产生折叠

---

## 9. 格式化（FR-070~072）

### TC-012-080 注册格式化提供器
- **关联**：FR-070
- **优先级**：P0
- **预期**：`registerDocumentFormattingEditProvider` 调用

### TC-012-081 全文替换
- **关联**：FR-071、FR-072
- **优先级**：P0
- **预期**：返回 edit 的 range 等于 `getFullModelRange()`，text 为 Beautifier 输出

---

## 10. 主题（FR-080~085）

### TC-012-090 defineTheme 注册
- **关联**：FR-080、FR-085
- **优先级**：P0
- **预期**：调用 `defineTheme('foo',{editor,styles})` 后 `Themes.foo` 含两部分

### TC-012-091 主题包含 editor + styles
- **关联**：FR-081
- **优先级**：P0
- **预期**：editor 传给 `monaco.editor.defineTheme`；styles 用于 UI 变量

### TC-012-092 default 主题
- **关联**：FR-082
- **优先级**：P0
- **预期**：base=`vs`，关键字蓝色加粗，字符串绿色

### TC-012-093 dark 主题
- **关联**：FR-083、FR-084
- **优先级**：P0
- **预期**：base=`vs-dark`；styles 含 ~70 个 UI CSS 变量

---

## 11. Java 类元数据（FR-090~100）

### TC-012-100 启动加载 /classes
- **关联**：FR-090、FR-092、FR-093
- **优先级**：P0
- **预期**：`initClasses()` 调用 GET `/classes`；缓存 classes/extensions/functions；方法元数据含参数（name/type/comment/varArgs）/returnType/comment

### TC-012-101 加载 /classes.txt
- **关联**：FR-091
- **优先级**：P0
- **预期**：调用 GET `/classes.txt`；解析为全量类名数组供 import 补全

### TC-012-102 按需 POST /class
- **关联**：FR-094
- **优先级**：P0
- **预期**：`loadClass(className)` 调用 POST `/class`；结果合并到缓存

### TC-012-103 扩展方法排序
- **关联**：FR-095
- **优先级**：P1
- **预期**：补全/签名结果中扩展方法 sortText 在原生方法之后

### TC-012-104 自动导入配置
- **关联**：FR-096、NFR-005、NFR-006
- **优先级**：P0
- **预期**：env 自动包含 autoImportPackage 中的类与 autoImportModuleList 中的模块

### TC-012-105 setupOnlineFunction
- **关联**：FR-097
- **优先级**：P1
- **预期**：注册后 hover 在线函数返回该 loader 的签名

### TC-012-106 setApiFinder / setFunctionFinder
- **关联**：FR-098
- **优先级**：P1
- **预期**：注册后 import @ 补全使用之

### TC-012-107 基本类型映射
- **关联**：FR-099
- **优先级**：P0
- **预期**：int→`java.lang.Integer`、long→Long、double→Double、float→Float、byte→Byte、short→Short、string→String

### TC-012-108 可变参数
- **关联**：FR-100
- **优先级**：P1
- **预期**：方法 `printf(String, Object...)` 在补全/签名文本中显示为 `...`

---

## 12. 健壮性 / 兼容性（NFR-003~004）

### TC-012-120 补全 AST 异常静默
- **关联**：NFR-003、NC-001
- **优先级**：P0
- **输入**：故意制造解析异常源码
- **预期**：补全 provider 不抛错；返回 [] 或兜底建议

### TC-012-121 签名 AST 异常静默
- **关联**：NFR-003
- **优先级**：P0
- **预期**：异常被吞，UI 不弹错

### TC-012-122 monaco 0.29.1 API 兼容
- **关联**：NFR-004
- **优先级**：P0
- **预期**：所有 `monaco.languages.*` 调用未触发 deprecation 警告或类型缺失

---

## 13. 边界与异常

| 编号 | 场景 | 预期 |
|---|---|---|
| TC-012-200 | /classes 失败 | 高亮 builtinFunctions 为空但其他规则正常；NC-003 风险记录 |
| TC-012-201 | /class 动态加载失败 | 当前类的补全为空，不影响其他类（NC-002） |
| TC-012-202 | initClasses 重复调用 | 不重复请求或幂等覆盖（按实现记录） |
| TC-012-203 | 主题名重复 defineTheme | 后注册覆盖前者 |
| TC-012-204 | 三引号未闭合 | mybatis 子语言进入态保留至文件末，不抛错 |
| TC-012-205 | 折叠超过 5000 | 截断按缩进层级优先级保留外层 |
| TC-012-206 | 极长行（>10k 字符） | 高亮不卡死（性能记录） |
| TC-012-207 | 补全在文件首行触发 | 不报越界，import 补全可用 |
| TC-012-208 | hover 在空白处 | 返回 null，不弹框 |
| TC-012-209 | 签名在嵌套调用 `f(g(,))` | activeSignature 命中外层 / 内层取决于光标，不报错 |
| TC-012-210 | 格式化空文档 | 返回空 edit 或 noop |
| TC-012-211 | autoImportModuleList 为空 | env 不报错，仅缺少自动模块 |
| TC-012-212 | initializeMagicScript 重复调用 | 不重复 register（monaco 自身去重）或幂等 |

---

## 14. 索引摘要

| 章节 | 用例区间 | 数量 |
|---|---|---|
| 语言注册 | TC-012-001~005 | 5 |
| 高亮 | TC-012-010~017 | 8 |
| 补全 | TC-012-020~030 | 11 |
| 悬停 | TC-012-040~045 | 6 |
| 签名 | TC-012-060~063 | 4 |
| 折叠 | TC-012-070~074 | 5 |
| 格式化 | TC-012-080~081 | 2 |
| 主题 | TC-012-090~093 | 4 |
| Java 元数据 | TC-012-100~108 | 9 |
| NFR | TC-012-120~122 | 3 |
| 边界异常 | TC-012-200~212 | 13 |
| **合计** | | **70** |

> P0 ≈ 41，P1 ≈ 17，P2 ≈ 12
