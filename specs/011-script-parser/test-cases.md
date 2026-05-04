# 011-script-parser 测试用例

> 模块编号：011-script-parser
> 关联规范：[spec.md](./spec.md)
> 对应源码：`src/scripts/parsing/{index,tokenizer,parser,ast}.js`
> 用例编号格式：`TC-011-NNN`

---

## 1. 测试范围

**纳入**：词法分析（tokenize）、语法分析（Parser.parse / parseBest）、AST 节点 getJavaType 推导、Span 错误定位、parseJson、对外导出。

**排除**：脚本执行（后端）、monaco 高亮规则（012）、代码格式化（beautifier）、MyBatis 标签（013）、Java 类元数据加载（java-class.js 内部，仅 mock）。

---

## 2. 环境前置

| 项 | 期望 |
|---|---|
| 运行环境 | Node / 浏览器，纯 JS |
| `JavaClass` | 可 mock：返回固定方法/属性表 |
| `RequestParameter.environmentFunction()` | 可 mock 返回内置函数集合 |
| 输入 | UTF-8 字符串，含中文/转义/多行 |

---

## 3. 词法分析（FR-110-001~012）

### TC-011-001 Token 序列携带类型与 Span
- **关联**：FR-110-001
- **优先级**：P0
- **输入**：`var x = 1`
- **预期**：4 个 Token；每个 token 含 `type`、`getSpan().start/end` 正确

### TC-011-002 字面量类别识别
- **关联**：FR-110-002
- **优先级**：P0
- **输入**：`true false 42 42L 1.5 1.5d 1.5b 'c' "s" """ml""" /re/i null`
- **预期**：每段 token type 对应：BooleanLiteral、IntegerLiteral、LongLiteral、FloatLiteral、DoubleLiteral、BigDecimalLiteral、CharacterLiteral、StringLiteral、StringLiteral(三引号)、RegexpLiteral、NullLiteral

### TC-011-003 数值进制 + 下划线分隔
- **关联**：FR-110-003
- **优先级**：P0
- **输入**：`0xFF 0b1010 1_000_000`
- **预期**：均识别为合法整数字面量

### TC-011-004 三种字符串定界符
- **关联**：FR-110-004
- **优先级**：P0
- **输入**：`'a' "b" """multi\nline"""`
- **预期**：3 个 StringLiteral；三引号保留换行

### TC-011-005 模板字符串嵌套表达式
- **关联**：FR-110-005、接受场景"模板字符串内嵌表达式"
- **优先级**：P0
- **输入**：``` `Hello, ${user.name}!` ```
- **预期**：StringLiteral；`tokenStream` 含 Identifier(user)、Period、Identifier(name) 段

### TC-011-006 正则上下文识别
- **关联**：FR-110-006
- **优先级**：P0
- **输入 1**：`var r = /a/i` → RegexpLiteral
- **输入 2**：`a / b / c`（除法）→ 不识别为正则
- **预期**：上下文敏感判定正确

### TC-011-007 语言块
- **关联**：FR-110-007
- **优先级**：P1
- **输入**：``` ```sql select 1 ``` ```
- **预期**：单 LanguageToken，含 lang=sql + 内容

### TC-011-008 全套运算符
- **关联**：FR-110-008
- **优先级**：P0
- **输入**：`+ - * / % == === != !== < <= > >= && || ?? ?. ... => -> = += -= *= /= %= & | ^ ~ << >> >>>`
- **预期**：每个运算符对应正确 TokenType；`===` 优先于 `==`（NFR-110-006）

### TC-011-009 SQL 关键字 token
- **关联**：FR-110-009
- **优先级**：P1
- **输入**（LINQ 上下文）：`select a from t where a <> 1 and b or c`
- **预期**：`<>`、`and`、`or` 在 LINQ 上下文中识别为对应 token；非 LINQ 中 `<>` 不识别

### TC-011-010 关键字与标识符分类
- **关联**：FR-110-010
- **优先级**：P0
- **预期**：true/false → BooleanLiteral，null → NullLiteral，其它非保留字 → Identifier

### TC-011-011 注释跳过
- **关联**：FR-110-011
- **优先级**：P0
- **输入**：`// line\nvar /* block */ x = 1`
- **预期**：token 序列不含注释

### TC-011-012 非法字符抛 ParseException 含 Span
- **关联**：FR-110-012、FR-110-060
- **优先级**：P0
- **输入**：`var x = §`
- **预期**：抛 ParseException；`err.span.start` 指向 `§`

### TC-011-013 中文标识符
- **关联**：NFR-110-005
- **优先级**：P1
- **输入**：`var 用户名 = "x"`
- **预期**：Identifier token 文本=用户名

### TC-011-014 @ 前缀模块标识符
- **关联**：NFR-110-005
- **优先级**：P1
- **输入**：`import @utils as u`
- **预期**：`@utils` 作为合法 Identifier 解析

---

## 4. 语法分析（FR-110-020~035）

### TC-011-030 parse() 返回 AST 数组
- **关联**：FR-110-020
- **优先级**：P0
- **输入**：`var x = 1; return x;`
- **预期**：返回长度为 2 的数组，元素分别为 VarDefine、Return

### TC-011-031 语句类型全覆盖
- **关联**：FR-110-021
- **优先级**：P0
- **预期**：以下脚本各产生对应节点类：
  - `import a from 'a'` → Import
  - `var/let/const x = 1` → VarDefine
  - `if(a){}else{}` → IfStatement
  - `for(x in [1])` → ForStatement
  - `while(true){}` → WhileStatement
  - `return x` → Return
  - `break` / `continue` → Break / Continue
  - `try{}catch(e){}finally{}` → TryStatement
  - `async f()` → AsyncCall
  - `exit 0` → Exit
  - `throw 'e'` → Throw
  - `assert true,'m'` → Assert

### TC-011-032 表达式语法树
- **关联**：FR-110-022
- **优先级**：P0
- **预期**：覆盖 BinaryOperation / UnaryOperation / TernaryOperation / LambdaFunction / FunctionCall / MethodCall / NewStatement / MemberAccess / MapOrArrayAccess / Spread

### TC-011-033 LINQ 完整子句
- **关联**：FR-110-023、接受场景"LINQ 查询解析"
- **优先级**：P0
- **输入**：`select name,age from users join roles on users.id = roles.uid where age > 18 group by age having count(1) > 0 order by age desc limit 10 offset 5`
- **预期**：LinqSelect.fields/from/joins/where/groups/having/orders/limit/offset 均填充

### TC-011-034 类型转换 ::
- **关联**：FR-110-024
- **优先级**：P0
- **输入**：`expr :: int`、`:: long/double/float/short/byte/date/json/stringify/sql`
- **预期**：每例产生 ClassConverter 节点；非法目标类型抛 ParseException

### TC-011-035 Map / List 字面量及展开 / 简写
- **关联**：FR-110-025
- **优先级**：P0
- **输入**：`{a:1, ...obj, b}`、`[1,2,3]`
- **预期**：MapLiteral 解析三类条目（kv / spread / 简写={b:b}）；ListLiteral 含 3 元素

### TC-011-036 Lambda 两种体
- **关联**：FR-110-026
- **优先级**：P0
- **输入**：`(x) => x+1`、`(x) => { return x+1; }`
- **预期**：均产生 LambdaFunction，body 形式不同但语义等价

### TC-011-037 try-with-resources
- **关联**：FR-110-027
- **优先级**：P1
- **输入**：`try (var r = open()) { use(r) }`
- **预期**：TryStatement 含 resources 列表

### TC-011-038 ?. 与 .* 通配符
- **关联**：FR-110-028
- **优先级**：P0
- **输入**：`a?.b`，LINQ 中 `select user.* from users`
- **预期**：MemberAccess `optional=true`；LINQ 中接受 `.*`

### TC-011-039 12 级运算符优先级
- **关联**：FR-110-029
- **优先级**：P0
- **输入**：`a = b ? c||d&&e==f<g+h*i : j`
- **预期**：AST 嵌套与运算符优先级一致；`*` 内层、`=` 外层

### TC-011-040 LINQ 优先级调整
- **关联**：FR-110-030
- **优先级**：P1
- **输入**（LINQ）：`where a = 1`
- **预期**：`=` 与比较同级，不被解析为赋值

### TC-011-041 关键字不可作变量名
- **关联**：FR-110-031
- **优先级**：P0
- **输入**：`var return = 1`
- **预期**：抛 ParseException

### TC-011-042 孤立字面量非法
- **关联**：FR-110-032
- **优先级**：P1
- **输入**：`42`（单独一行）
- **预期**：抛 ParseException

### TC-011-043 ignoreError=true 返回部分 AST
- **关联**：FR-110-033、NFR-110-003
- **优先级**：P0
- **输入**：`var x = 1; var y = ` 第二条不完整
- **预期**：`parse(true)` 返回数组含至少 1 个 VarDefine（x），不抛错

### TC-011-044 parseBest 返回最佳匹配 + env
- **关联**：FR-110-034
- **优先级**：P0
- **输入**：`import java.util.ArrayList as L; var l = new L(); l`，position=源码长度
- **预期**：返回 `{node: VariableAccess(l), env}`，env.l = `java.util.ArrayList`

### TC-011-045 parseJson 解析参数树
- **关联**：FR-110-035
- **优先级**：P0
- **输入**：`{name:"a", age:1, addr:{city:"x"}, tags:["t1"]}`
- **预期**：返回 `[{name,dataType,children?}]` 树形：addr.children 含 city；tags 数组类型

---

## 5. AST 类型推导（FR-110-040~049）

### TC-011-060 Node 基类接口
- **关联**：FR-110-040
- **优先级**：P0
- **预期**：每节点实例 `getSpan()` 返回 Span；`expressions()` 返回数组；`getJavaType(env)` 返回字符串

### TC-011-061 节点类型枚举完整
- **关联**：FR-110-041
- **优先级**：P0
- **预期**：30+ 节点类全部从模块导出，`new` 后 instanceof 自身

### TC-011-062 VarDefine 写 env
- **关联**：FR-110-043
- **优先级**：P0
- **输入**：`var s = "a"`
- **预期**：getJavaType 后 env.s = `java.lang.String`

### TC-011-063 Import 处理三形态
- **关联**：FR-110-044
- **优先级**：P0
- **预期**：
  - `import java.util.List` → env.List = `java.util.List`
  - `import java.util.* `→ 写入 autoImport
  - `import @utils as u` → env.u = 模块映射

### TC-011-064 BinaryOperation 类型推导
- **关联**：FR-110-045
- **优先级**：P0
- **预期**：
  - `"a" + 1` → String
  - `1.0 + 2` → Double / BigDecimal（按 spec 实现）
  - `1 + 2` → Integer/Long
  - `a == b` → Boolean

### TC-011-065 MethodCall 走 JavaClass.findMethods
- **关联**：FR-110-046
- **优先级**：P0
- **mock**：`JavaClass.findMethods("java.util.List","get",[Integer])` → `Object`
- **输入**：`list.get(0)` 且 env.list=`java.util.List`
- **预期**：getJavaType 调用了 mock，返回 `java.lang.Object`

### TC-011-066 MemberAccess 命中属性 / 枚举 / 方法
- **关联**：FR-110-047
- **优先级**：P0
- **预期**：分别走 findAttributes / findEnums / findMethods 路径，返回各自类型

### TC-011-067 AsyncCall 固定 Future 类型
- **关联**：FR-110-048
- **优先级**：P1
- **输入**：`async f()`
- **预期**：getJavaType = `java.util.concurrent.Future`

### TC-011-068 LinqSelect 固定 List 类型
- **关联**：FR-110-049
- **优先级**：P1
- **预期**：LinqSelect.getJavaType = `java.util.List`

---

## 6. Span 错误定位（FR-110-060~064）

### TC-011-080 ParseException 含 message + span
- **关联**：FR-110-060
- **优先级**：P0
- **预期**：`err instanceof ParseException && err.span instanceof Span`

### TC-011-081 Span 字段完备
- **关联**：FR-110-061
- **优先级**：P0
- **预期**：含 `source`、`start`、`end`、`getText()`；多次调用 getText 命中缓存

### TC-011-082 Span.inPosition
- **关联**：FR-110-062
- **优先级**：P1
- **预期**：start ≤ position ≤ end → true；越界 → false

### TC-011-083 Line 计算行号 / 列号
- **关联**：FR-110-063、接受场景"语法错误定位"
- **优先级**：P0
- **输入**：`var x = \nvar y =` 第 2 行错误
- **预期**：line.lineNumber=2，startCol 与 `=` 列对齐

### TC-011-084 Token 不匹配错误信息
- **关联**：FR-110-064
- **优先级**：P1
- **预期**：错误消息包含 expected 与 actual token 的文本

---

## 7. 对外 API（FR-110-070~075）

### TC-011-100 默认导出 tokenize
- **关联**：FR-110-070
- **优先级**：P0
- **预期**：`import tokenize from '.../parsing/tokenizer'`，调用返回 Token 数组

### TC-011-101 Parser 类导出 + 4 方法
- **关联**：FR-110-071
- **优先级**：P0
- **预期**：parse / parseBest / processEnv / findBestMatch 均为函数

### TC-011-102 parseJson 导出
- **关联**：FR-110-072
- **优先级**：P0
- **预期**：可独立 import 调用

### TC-011-103 类型导出
- **关联**：FR-110-073
- **优先级**：P0
- **预期**：Span/Token/TokenType/CharacterStream/TokenStream/LiteralToken/ParseException 均可 import

### TC-011-104 AST 节点全部导出
- **关联**：FR-110-074
- **优先级**：P0
- **预期**：消费方可 `import { MethodCall } from 'parsing/ast'`

### TC-011-105 keywords / linqKeywords 导出
- **关联**：FR-110-075
- **优先级**：P1
- **预期**：两个数组非空，含 `var/return/select/from` 等

---

## 8. 性能 / 容错（NFR）

### TC-011-120 词法 O(n)
- **关联**：NFR-110-001
- **优先级**：P2
- **输入**：1KB / 10KB / 100KB 等量级源码
- **预期**：耗时近似线性增长

### TC-011-121 200 行解析 < 50ms
- **关联**：NFR-110-002
- **优先级**：P1
- **预期**：典型脚本 parseBest 单次 < 50ms

### TC-011-122 Token 长优先匹配
- **关联**：NFR-110-006
- **优先级**：P0
- **输入**：`a === b`
- **预期**：识别为 `===`，非 `==` + `=`

---

## 9. 边界与异常

| 编号 | 场景 | 预期 |
|---|---|---|
| TC-011-200 | 空源码 | tokenize 返回 []；parse 返回 [] |
| TC-011-201 | 仅注释 | tokenize 返回 []；parse 返回 [] |
| TC-011-202 | 三引号未闭合 | ParseException，span 指向起始 |
| TC-011-203 | 模板字符串内 ${...} 未闭合 | ParseException |
| TC-011-204 | 模板字符串嵌套 ${`${a}`} | 递归 tokenize 不死循环 |
| TC-011-205 | 数字下划线非法位置（前置/连续） | 抛错或按字符串处理（按实现记录） |
| TC-011-206 | LINQ 外使用 `<>` | 不识别为运算符，作为词法错误或拆为 `<` `>` |
| TC-011-207 | parseBest position 越界（>length 或 <0） | 返回最末/最初节点或 null，不抛错 |
| TC-011-208 | env 中变量未定义即引用 | getJavaType 返回 undefined / `java.lang.Object`，不抛错 |
| TC-011-209 | JavaClass mock 返回 null | getJavaType 走兜底，不抛错 |
| TC-011-210 | parseJson 输入空字符串 | 返回 [] |
| TC-011-211 | parseJson 输入非 Map/List 顶层 | 返回 [] 或单元素结构（按实现记录） |
| TC-011-212 | Lambda 参数缺右括号 | ParseException |
| TC-011-213 | for-in 缺迭代变量 | ParseException |
| TC-011-214 | Map 字面量重复键 | 接受（不强制唯一），覆盖语义由后端决定 |
| TC-011-215 | import * as x（无包名） | ParseException |
| TC-011-216 | 极深递归（1000+ 嵌套表达式） | 不栈溢出（如溢出则记 NC） |

---

## 10. 索引摘要

| 章节 | 用例区间 | 数量 |
|---|---|---|
| 词法 | TC-011-001~014 | 14 |
| 语法 | TC-011-030~045 | 16 |
| AST 类型推导 | TC-011-060~068 | 9 |
| Span / 错误 | TC-011-080~084 | 5 |
| 对外 API | TC-011-100~105 | 6 |
| NFR | TC-011-120~122 | 3 |
| 边界异常 | TC-011-200~216 | 17 |
| **合计** | | **70** |

> P0 ≈ 38，P1 ≈ 16，P2 ≈ 16
