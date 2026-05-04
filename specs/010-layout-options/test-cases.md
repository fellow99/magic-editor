# 010-layout-options 测试用例

> 模块编号：010-layout-options
> 关联规范：[spec.md](./spec.md)
> 对应源码：`src/components/layout/{magic-settings,magic-search,magic-todo,magic-options,magic-option}.vue`、`src/components/common/magic-bottom-panel.vue`
> 用例编号格式：`TC-010-NNN`

---

## 1. 测试范围

**纳入**：MagicSettings 全局参数/Header 编辑+持久化、MagicSearch 全局搜索对话框+语法高亮+预览+双击打开、MagicTodo 列表加载与跳转、MagicOptions 容器 Tab 路由+高度拖拽、MagicOption 接口选项表、MagicBottomPanel 子面板外壳。

**排除**：001 测试调用、008 子面板（Request/Run/Function/Group/Log/Debug/Event）、012 monaco 语言注册、007 主题切换、016 通用组件内部实现。

---

## 2. 环境前置

| 项 | 期望 |
|---|---|
| localStorage | 可用 |
| 后端 | `POST search` / `GET todo` / `GET options` / `GET get?id=` / `GET function/get?id=` 均可达 |
| monaco-editor | 已注册 magic-script 语言 |
| bus | `opened`/`switch-tab`/`api-group-selected`/`update-window-size`/`search-open`/`login` 通畅 |
| 资源列表组件 | `apiList` / `functionList` 通过 `$refs` 可达 |

---

## 3. 功能用例

### US-001 / US-002 / US-003 全局设置

#### TC-010-001 两个子页签
- **关联**：FR-001
- **优先级**：P0
- **预期**：左侧导航含"全局请求参数"与"全局请求 Header"

#### TC-010-002 参数表三列
- **关联**：FR-002、FR-010
- **优先级**：P0
- **预期**：键 / 值 / 描述

#### TC-010-003 Header 表三列
- **关联**：FR-003、FR-010
- **优先级**：P0
- **预期**：键 / 值 / 描述

#### TC-010-004 初始化读 localStorage
- **关联**：FR-004
- **优先级**：P0
- **前置**：`global-parameters=[{name:"k",value:"v"}]`
- **预期**：表格首行展示 k/v

#### TC-010-005 缺失键默认空数组
- **关联**：A-001
- **优先级**：P1
- **前置**：清除 localStorage
- **预期**：data.parameters/headers = []，渲染空表（实现可能至少 1 行空行）

#### TC-010-006 deep watch 自动持久化
- **关联**：FR-005、NFR-003
- **优先级**：P0
- **步骤**：修改任一格 → 等 watch 触发
- **预期**：localStorage `global-parameters` 更新为 JSON 数组字符串

#### TC-010-007 持久化为 JSON 字符串
- **关联**：FR-006、FR-007
- **优先级**：P0
- **预期**：`JSON.parse(store.get('global-parameters')) instanceof Array`

#### TC-010-008 +/- 按钮增删行
- **关联**：FR-008
- **优先级**：P0
- **预期**：+ 追加空行；- 删除该行

#### TC-010-009 删除最后一行自动补空
- **关联**：FR-009
- **优先级**：P1
- **预期**：表格保留至少一行

---

### US-004 / US-005 / US-006 全局搜索

#### TC-010-020 顶部搜索图标打开
- **关联**：FR-020、US-004
- **优先级**：P0
- **预期**：MagicHeader 调用 `$refs.search.show()` → 弹出"全局搜索"对话框

#### TC-010-021 600ms 防抖搜索
- **关联**：FR-021、NFR-001
- **优先级**：P0
- **前置**：watch inputText 设置 debounce
- **预期**：连续输入间隔 < 600ms 仅触发一次 `POST search`

#### TC-010-022 搜索请求体 keyword
- **关联**：FR-022
- **优先级**：P0
- **预期**：请求体 `{ keyword: "<text>" }`

#### TC-010-023 结果列表显示元信息
- **关联**：FR-023
- **优先级**：P0
- **预期**：每项含代码片段 + 接口/函数名 + 行号

#### TC-010-024 magic-script 语法高亮
- **关联**：FR-024、NFR-002
- **优先级**：P0
- **预期**：`tokenizeToString` 异步执行 → token span 着色

#### TC-010-025 关键词额外高亮
- **关联**：FR-025
- **优先级**：P1
- **预期**：`replaceKeywords()` 包裹关键词为黄色背景 span

#### TC-010-026 单击预览
- **关联**：FR-026
- **优先级**：P0
- **步骤**：单击结果项
- **预期**：下方只读编辑器加载完整代码并跳转/高亮匹配行

#### TC-010-027 双击 emit search-open
- **关联**：FR-027、FR-028
- **优先级**：P0
- **预期**：bus emit `search-open`, payload 含 `type, id`，对话框关闭

#### TC-010-028 search-open 切工具栏
- **关联**：FR-028（消费侧）
- **优先级**：P0
- **预期**：magic-editor 根据 type=1/2 切换工具栏索引 0/1 并打开资源

#### TC-010-029 缓存资源对象
- **关联**：FR-029、A-005
- **优先级**：P1
- **预期**：结果项 `cache` 字段=对应 apiList/functionList getItemById 结果

#### TC-010-030 结果列表高度 200px
- **关联**：FR-030、NFR-006
- **优先级**：P2
- **预期**：max-height 限制 + 可滚动

#### TC-010-031 预览编辑器 300px 只读
- **关联**：FR-031
- **优先级**：P1
- **预期**：高度 300px，readOnly=true，wordWrap=on

#### TC-010-032 字体配置
- **关联**：FR-032、NFR-008
- **优先级**：P2
- **预期**：fontFamily=contants.EDITOR_FONT_FAMILY，fontSize=EDITOR_FONT_SIZE

#### TC-010-033 主题跟随 store
- **关联**：FR-033、NFR-009
- **优先级**：P2
- **前置**：`store.set('skin','dark')`
- **预期**：编辑器 theme=dark

#### TC-010-034 minimap 禁用
- **关联**：NFR-007
- **优先级**：P2
- **预期**：`minimap.enabled=false`

#### TC-010-035 无结果占位
- **关联**：FR-034
- **优先级**：P1
- **预期**：显示"没有搜索到内容"

#### TC-010-036 关闭销毁编辑器
- **关联**：FR-035
- **优先级**：P1
- **预期**：destroyed 钩子中 `editor.dispose()` 被调用

#### TC-010-037 显示文本格式
- **关联**：FR-036
- **优先级**：P2
- **预期**：`groupName/name(groupPath/path)` 无双斜杠

---

### US-007 / US-008 TODO 列表

#### TC-010-050 mounted 加载
- **关联**：FR-040
- **优先级**：P0
- **预期**：发起 `GET todo`

#### TC-010-051 login 后刷新
- **关联**：FR-041
- **优先级**：P0
- **前置**：bus emit `login`
- **预期**：再次 `GET todo`

#### TC-010-052 列表两列
- **关联**：FR-042
- **优先级**：P0
- **预期**：名称（图标+名+路径） / 行号:内容

#### TC-010-053 type 区分接口/函数
- **关联**：FR-043、A-004
- **优先级**：P0
- **预期**：type=1 → 接口图标；type=2 → 函数图标

#### TC-010-054 内容斜体+CSS 变量颜色
- **关联**：FR-044
- **优先级**：P2
- **预期**：italic，color=var(--todo-color)

#### TC-010-055 点击跳转
- **关联**：FR-045、US-008
- **优先级**：P0
- **预期**：调用 apiList.openItemById 或 functionList.openItemById

#### TC-010-056 loading 动画
- **关联**：FR-046、NFR-011
- **优先级**：P1
- **预期**：加载期间显示旋转图标+"加载中..."

#### TC-010-057 暂无数据占位
- **关联**：FR-047
- **优先级**：P2
- **前置**：返回 []
- **预期**：显示"暂无数据"

#### TC-010-058 刷新按钮
- **关联**：FR-048
- **优先级**：P1
- **预期**：点击 → 重新 `GET todo`

#### TC-010-059 缓存资源对象
- **关联**：FR-049
- **优先级**：P1
- **预期**：item.cache=apiList/functionList getItemById 结果

#### TC-010-060 偶数行斑马纹
- **关联**：FR-050
- **优先级**：P2
- **预期**：偶数行 background=var(--table-even-background)

---

### US-009 底部面板容器

#### TC-010-070 API 类型 Tab 集合
- **关联**：FR-061
- **优先级**：P0
- **前置**：bus emit `opened`，info._type='api'
- **预期**：左侧 Tab=接口信息+接口选项+执行结果+调试信息；右侧公共 Tab=运行日志+全局参数+TODO+事件

#### TC-010-071 Function 类型 Tab 集合
- **关联**：FR-062
- **优先级**：P0
- **前置**：info._type='function'
- **预期**：左侧 Tab=函数信息

#### TC-010-072 分组 Tab 集合
- **关联**：FR-063、FR-066
- **优先级**：P0
- **前置**：bus emit `api-group-selected`
- **预期**：左侧 Tab=分组信息

#### TC-010-073 公共 Tab 始终存在
- **关联**：FR-064
- **优先级**：P0
- **预期**：所有类型下右侧公共 Tab 不变

#### TC-010-074 opened 事件刷新 info+广播
- **关联**：FR-065、FR-070
- **优先级**：P0
- **预期**：data.info 更新；bus emit `update-request-body-definition`/`update-request-body`/`update-response-body-definition`/`update-response-body`

#### TC-010-075 switch-tab 切换页签
- **关联**：FR-067
- **优先级**：P0
- **前置**：bus emit `switch-tab','run'`
- **预期**：selectedTab='run'

#### TC-010-076 拖拽改高度
- **关联**：FR-068、NFR-004、US-009
- **优先级**：P0
- **预期**：mousemove → height 跟随；< 150 强制 150

#### TC-010-077 切换/拖动 emit update-window-size
- **关联**：FR-069
- **优先级**：P0
- **预期**：bus emit `update-window-size`

#### TC-010-078 点击已选 Tab 收起
- **关联**：FR-071
- **优先级**：P1
- **预期**：selectedTab=null，面板内容隐藏

#### TC-010-079 默认高度 300
- **关联**：FR-072
- **优先级**：P2
- **预期**：data.height=300

---

### US-010 接口选项

#### TC-010-090 三列表格
- **关联**：FR-080、FR-086
- **优先级**：P0
- **预期**：键（搜索下拉）/ 值 / 描述

#### TC-010-091 mounted 加载 /options
- **关联**：FR-081
- **优先级**：P0
- **预期**：`GET options`

#### TC-010-092 与 contants.OPTIONS 合并
- **关联**：FR-082、A-002、A-003
- **优先级**：P1
- **预期**：下拉选项=后端返回 + 内置数组合并

#### TC-010-093 选键自动填充描述/默认值
- **关联**：FR-083
- **优先级**：P0
- **预期**：选项被选中后该行 description+value 自动写入

#### TC-010-094 +/- 增删行
- **关联**：FR-084
- **优先级**：P0
- **预期**：+ 追加空行；- 删除当前

#### TC-010-095 无 info.option 提示
- **关联**：FR-085
- **优先级**：P1
- **前置**：info.option 不存在
- **预期**：弹出"请先添加或选择接口"

---

### MagicBottomPanel 外壳

#### TC-010-100 标题栏 + 标题
- **关联**：FR-090
- **优先级**：P0
- **预期**：title prop 渲染到标题栏

#### TC-010-101 buttons 渲染
- **关联**：FR-091
- **优先级**：P1
- **预期**：buttons 数组按序渲染为图标按钮

#### TC-010-102 最小化按钮
- **关联**：FR-092
- **优先级**：P0
- **预期**：点击 → emit `update:selectedTab`，父组件收起面板

#### TC-010-103 slot 内容渲染
- **关联**：FR-093
- **优先级**：P0
- **预期**：默认 slot 渲染于内容区

---

## 4. 边界与异常

| 编号 | 场景 | 预期 |
|---|---|---|
| TC-010-200 | localStorage 损坏（非 JSON） | 解析失败 → 静默回退为 []（建议；当前实现可能抛错，记 NC） |
| TC-010-201 | 全局参数含特殊字符（中文/换行） | 持久化与回读保留原值 |
| TC-010-202 | 搜索关键词为空 | 不发请求，结果列表清空 |
| TC-010-203 | 搜索请求 5xx | 列表空，无未处理异常 |
| TC-010-204 | 搜索结果 type 非 1/2 | 跳过/容错（双击不报错） |
| TC-010-205 | 搜索预览编辑器在 dialog 关闭后再次打开 | 重新创建编辑器实例，不复用旧实例 |
| TC-010-206 | TODO 接口超时 | loading 持续后报错或停止；不阻塞其他 Tab |
| TC-010-207 | TODO 资源已被删除 | openItemById 返回空 → 不跳转或提示未找到 |
| TC-010-208 | opened 事件 info=null | 容错，不抛错，Tab 集合保持上一次 |
| TC-010-209 | switch-tab 目标不存在 | selectedTab 不变或置 null |
| TC-010-210 | 高度拖拽到极小值 | 锁 150px |
| TC-010-211 | 高度拖拽到大于视口 | 不限制上限（当前实现）；可记 NC |
| TC-010-212 | /options 失败 | 下拉仅含 contants.OPTIONS |
| TC-010-213 | 切换资源后选项表脏数据 | 写入到当前 info.option，不串读 |
| TC-010-214 | $parent.$parent.$refs 链断裂（NC-001/002） | 跳转失败但不抛错 |
| TC-010-215 | 全局参数与接口本地参数同名 | 由 001 mergeGlobalSettings 决定优先级（本模块仅持久化） |

---

## 5. 索引摘要

| 用户故事 | 用例区间 | 数量 |
|---|---|---|
| US-001~003 全局设置 | TC-010-001~009 | 9 |
| US-004~006 全局搜索 | TC-010-020~037 | 18 |
| US-007/008 TODO | TC-010-050~060 | 11 |
| US-009 底部容器 | TC-010-070~079 | 10 |
| US-010 接口选项 | TC-010-090~095 | 6 |
| 子面板外壳 | TC-010-100~103 | 4 |
| 边界异常 | TC-010-200~215 | 16 |
| **合计** | | **74** |

> P0 ≈ 36，P1 ≈ 22，P2 ≈ 16
