# 016-common-ui 测试用例

> 模块编号：016-common-ui
> 关联规范：[spec.md](./spec.md)
> 对应源码：`src/components/common/`、`src/index.js`、`src/main.js`
> 用例编号格式：`TC-016-NNN`

---

## 1. 测试范围

**纳入**：对话框族（Dialog/Alert/Confirm + 命令式 API）、右键菜单、表单输入族（Input/Textarea/Select/Checkbox/File）、树族（MagicTree/Item、JsonTree、JsonTreeFormat）、JSON 查看器与数据结构展示、Loading/底部面板/HTTP 方法图标、插件注册。

**排除**：主题 CSS 变量定义（→ overall-spec）、消费方业务逻辑（→ 003/008/009 等）、Beautifier（→ 015）。

---

## 2. 环境前置

| 项 | 期望 |
|---|---|
| 框架 | Vue 3 + jsdom（@vue/test-utils） |
| Mock | `document.body.querySelector('.ma-container')` 返回根容器；GIF 静态资源已配置 |
| 主题 | 测试时注入必要的 CSS 变量或忽略可视断言 |

---

## 3. Dialog（FR-016-001~008）

### TC-016-001 基础渲染
- **关联**：FR-016-001、US-016-01
- **优先级**：P0
- **预期**：传 `title/content/width/height/maxWidth/maxHeight/padding/className` 全部生效；`v-model:visible=true` 时挂到 body

### TC-016-002 v-model 双向绑定
- **关联**：FR-016-004
- **优先级**：P0
- **预期**：外部 visible→true 显示；点关闭→emit `update:visible(false)`

### TC-016-003 拖拽移动
- **关联**：FR-016-002、FR-016-003、NFR-016-005
- **优先级**：P1
- **输入**：标题栏 mousedown→mousemove(dx=200,dy=100)→mouseup
- **预期**：对话框 left/top 增加；超出 `.ma-container` 边界时被钳制

### TC-016-004 拖出视口被限制
- **关联**：FR-016-003、NFR-016-005
- **优先级**：P1
- **预期**：mousemove 至容器外，对话框位置不超过容器边界

### TC-016-005 content 与 buttons 插槽
- **关联**：FR-016-005
- **优先级**：P0
- **预期**：插槽内容渲染于 dialog 主体与底部按钮栏

### TC-016-006 shade 遮罩开关
- **关联**：FR-016-006
- **优先级**：P1
- **预期**：`shade=false` 默认无遮罩；`shade=true` 出现遮罩层

### TC-016-007 showClose 控制
- **关联**：FR-016-007
- **优先级**：P1
- **预期**：`showClose=false` 时无关闭图标

### TC-016-008 onClose 与 change
- **关联**：FR-016-008
- **优先级**：P0
- **预期**：关闭时 onClose 调用一次，emit `change(false)`

### TC-016-009 z-index 层级
- **关联**：NFR-016-008
- **优先级**：P2
- **预期**：z-index === 999999

---

## 4. Alert（FR-016-009、011）

### TC-016-010 单按钮 + 文本内容
- **关联**：FR-016-009、US-016-01
- **优先级**：P0
- **输入**：`magicAlert({ title:'错误', content:'<b>x</b>' })`
- **预期**：仅显示一个 OK 按钮；content 显示为字面量（不解析 HTML）

### TC-016-011 OK 按钮文字自定义
- **关联**：FR-016-011
- **优先级**：P1
- **预期**：`ok='确定'` 时按钮文字为"确定"

### TC-016-012 onOk / onClose
- **关联**：FR-016-009
- **优先级**：P0
- **预期**：点 OK→onOk 调用→对话框关闭→onClose 调用

---

## 5. Confirm（FR-016-010、011、US-016-02）

### TC-016-020 双按钮 + HTML 内容
- **关联**：FR-016-010、US-016-02
- **优先级**：P0
- **输入**：`magicConfirm({ content:'<b>确认?</b>', onOk })`
- **预期**：显示是/否两按钮；content 以 v-html 渲染（`<b>` 加粗）

### TC-016-021 是 → onOk
- **关联**：US-016-02
- **优先级**：P0
- **预期**：点"是"→onOk 调用→关闭

### TC-016-022 否 → onCancel
- **关联**：US-016-02
- **优先级**：P0
- **预期**：点"否"→onCancel 调用→关闭→onOk 不调用

### TC-016-023 自定义按钮文字
- **关联**：FR-016-011
- **优先级**：P1
- **预期**：`ok='Yes'`、`cancel='No'` 生效

---

## 6. 命令式 API（FR-016-012~014）

### TC-016-030 createApp 动态挂载
- **关联**：FR-016-012
- **优先级**：P0
- **预期**：调用 `modal.magicAlert({...})` 在 DOM 内创建 dialog 节点；优先挂到 `.ma-container`

### TC-016-031 options→props 展开 + visible 默认 true
- **关联**：FR-016-013
- **优先级**：P0
- **预期**：传入选项作为组件 props；visible 自动设为 true

### TC-016-032 关闭后从 DOM 移除
- **关联**：FR-016-012
- **优先级**：P0
- **预期**：关闭后挂载节点被卸载；body 子节点数恢复

### TC-016-033 全局属性注册
- **关联**：FR-016-014
- **优先级**：P0
- **预期**：`app.config.globalProperties.$magicAlert/$magicConfirm/$magicDialog` 均存在

---

## 7. Contextmenu（FR-016-020~029、US-016-03）

### TC-016-040 menus 数组渲染
- **关联**：FR-016-020
- **优先级**：P0
- **预期**：每项渲染 label、icon、divided 分隔线

### TC-016-041 三种状态
- **关联**：FR-016-021
- **优先级**：P0
- **预期**：`disabled` 灰色不可点；`children` 显示展开箭头；普通项可点击

### TC-016-042 hidden 不渲染
- **关联**：FR-016-020
- **优先级**：P1
- **预期**：`hidden=true` 项不出现在 DOM

### TC-016-043 hover 展开子菜单（同时仅一个）
- **关联**：FR-016-022
- **优先级**：P0
- **预期**：移到 A→A 子菜单展开；移到 B→A 关闭、B 展开

### TC-016-044 子菜单方向自动检测
- **关联**：FR-016-023、NFR-016-004
- **优先级**：P1
- **预期**：右侧空间不足→向左展开；底部不足→向上翻

### TC-016-045 外部点击关闭
- **关联**：FR-016-024
- **优先级**：P0
- **预期**：mousedown 菜单外、滚轮滚动→菜单关闭

### TC-016-046 单实例（新销旧）
- **关联**：FR-016-025、NFR-016-006
- **优先级**：P0
- **预期**：连续调用 `$magicContextmenu` 两次→第一次实例被销毁

### TC-016-047 位置取自 event 或 x/y
- **关联**：FR-016-026
- **优先级**：P0
- **预期**：传 `event` 用 clientX/Y；传 `x/y` 直接用

### TC-016-048 customClass / minWidth / zIndex
- **关联**：FR-016-027
- **优先级**：P1
- **预期**：DOM class、min-width 样式、z-index 生效

### TC-016-049 onClick 后自动关闭
- **关联**：US-016-03
- **优先级**：P0
- **预期**：点叶子项→onClick 调用→菜单关闭

### TC-016-050 destroy 静态方法
- **关联**：FR-016-028
- **优先级**：P1
- **预期**：`ContextmenuProxy.destroy()` 销毁当前实例

### TC-016-051 全局属性 $magicContextmenu
- **关联**：FR-016-029
- **优先级**：P0
- **预期**：`app.config.globalProperties.$magicContextmenu` 存在

---

## 8. MagicInput（FR-016-040~043）

### TC-016-060 props 渲染
- **关联**：FR-016-040
- **优先级**：P0
- **预期**：type/placeholder/readonly/width/icon 全生效

### TC-016-061 图标点击回调
- **关联**：FR-016-041
- **优先级**：P1
- **预期**：点击图标→`onClick` 调用

### TC-016-062 Enter 触发
- **关联**：FR-016-042
- **优先级**：P0
- **预期**：keypress Enter→`onEnter` 调用

### TC-016-063 双事件
- **关联**：FR-016-043
- **优先级**：P0
- **预期**：输入→emit `update:value` 与 `input`

---

## 9. MagicTextarea（FR-016-044）

### TC-016-070 不可缩放
- **关联**：FR-016-044
- **优先级**：P1
- **预期**：style `resize: none`

### TC-016-071 v-model 与 focus
- **关联**：FR-016-044
- **优先级**：P0
- **预期**：输入更新 value；focus 事件回调被调用

---

## 10. MagicSelect（FR-016-045~049）

### TC-016-080 options 渲染
- **关联**：FR-016-045
- **优先级**：P0
- **预期**：列表项数 = options.length；显示 text，选中后写入 value

### TC-016-081 inputable 模式
- **关联**：FR-016-046
- **优先级**：P1
- **预期**：`inputable=true`→显示 input；可手动输入；非 inputable→显示 span

### TC-016-082 自动翻转
- **关联**：FR-016-047
- **优先级**：P1
- **预期**：底部空间不足→列表显示在选择框上方

### TC-016-083 外部点击关闭
- **关联**：FR-016-048
- **优先级**：P0
- **预期**：点击 `$root.$el` 外部→列表关闭

### TC-016-084 defaultValue 回退
- **关联**：FR-016-049
- **优先级**：P1
- **预期**：value 为空且 defaultValue 设置→显示 defaultValue 对应 text

---

## 11. MagicCheckbox（FR-016-050~051）

### TC-016-090 v-model + 半选
- **关联**：FR-016-050
- **优先级**：P0
- **预期**：`value=true` 全选样式；`checkedHalf=true` 半选样式

### TC-016-091 阻止冒泡
- **关联**：FR-016-051
- **优先级**：P0
- **预期**：click 事件不冒泡到父元素

### TC-016-092 cboId 唯一
- **关联**：C-016-003
- **优先级**：P2
- **预期**：极短时间内创建多个实例的 cboId 风险登记

---

## 12. MagicFile（FR-016-052~054）

### TC-016-100 显示已选文件名
- **关联**：FR-016-052
- **优先级**：P0
- **预期**：选择文件后 MagicInput 显示文件名

### TC-016-101 accept / multiple
- **关联**：FR-016-053
- **优先级**：P1
- **预期**：input 元素 attr accept、multiple 与 props 一致

### TC-016-102 getFile / getFiles
- **关联**：FR-016-054
- **优先级**：P0
- **预期**：返回原生 File 对象 / FileList

---

## 13. MagicTree / MagicTreeItem（FR-016-060~065）

### TC-016-110 数据渲染
- **关联**：FR-016-060
- **优先级**：P0
- **预期**：根节点数 = data.length；按 folder 走 folder 插槽，否则 file 插槽

### TC-016-111 loading 延迟隐藏
- **关联**：FR-016-061、NFR-016-007
- **优先级**：P1
- **预期**：loading=true→显示；置 false 后 ≥500ms 才隐藏

### TC-016-112 空数据提示
- **关联**：FR-016-062
- **优先级**：P0
- **预期**：data=[] → 显示"无数据"

### TC-016-113 forceUpdate 刷新
- **关联**：FR-016-063
- **优先级**：P2
- **预期**：prop 变更触发子组件重新渲染

### TC-016-114 插槽透传
- **关联**：FR-016-064、FR-016-065
- **优先级**：P0
- **预期**：父级 folder/file/default 插槽内容传递到所有层级

### TC-016-115 id 唯一假设
- **关联**：A-016-002、Q-016-001
- **优先级**：P1
- **预期**：id 重复时 Vue 警告 duplicate keys（约束记录）

---

## 14. JSON 树（FR-016-066~069）

### TC-016-120 递归渲染 Object/Array
- **关联**：FR-016-066
- **优先级**：P0
- **预期**：嵌套 children 全部展开渲染

### TC-016-121 类型着色
- **关联**：FR-016-067
- **优先级**：P0
- **预期**：number/boolean/string 三色分别匹配 CSS 类（粉/橙/绿）

### TC-016-122 jsonClick 事件
- **关联**：FR-016-068
- **优先级**：P0
- **预期**：点击节点→emit `jsonClick(node)`

### TC-016-123 缩进 GIF 渲染
- **关联**：FR-016-069
- **优先级**：P2
- **预期**：根据 level 渲染 elbow/elbow-end/elbow-line/s.gif

---

## 15. MagicJson 查看器（FR-016-080~084、US-016-04）

### TC-016-140 双面板布局
- **关联**：FR-016-080
- **优先级**：P0
- **预期**：左侧 JSON 树、右侧属性面板同屏渲染

### TC-016-141 基本类型字段
- **关联**：FR-016-081
- **优先级**：P0
- **预期**：选中 string 节点→右侧显示 Key/Value/参数类型/是否必填/默认值/验证方式/表达式/验证说明/注释

### TC-016-142 Object/Array 字段简化
- **关联**：FR-016-081
- **优先级**：P0
- **预期**：选中对象/数组节点→右侧仅显示 Key/对象注释/是否必填

### TC-016-143 type=request 字段差异
- **关联**：FR-016-082
- **优先级**：P1
- **预期**：`type='request'`→出现是否必填、默认值、验证方式相关字段

### TC-016-144 参数类型选项
- **关联**：FR-016-083
- **优先级**：P1
- **预期**：下拉含 String/Integer/Double/Long/Short/Float/Byte/Boolean

### TC-016-145 验证方式选项
- **关联**：FR-016-084
- **优先级**：P1
- **预期**：下拉含 不验证/表达式验证/正则验证

### TC-016-146 双向绑定 mutation
- **关联**：US-016-04、Q-016-002
- **优先级**：P1
- **预期**：编辑右侧→jsonData 节点对象引用被直接修改（约束记录，留待澄清）

---

## 16. MagicStructure 族（FR-016-085~088、US-016-05）

### TC-016-160 类型识别
- **关联**：FR-016-085
- **优先级**：P0
- **预期**：`java.lang.String/Integer/...`→直接文本；其他→尝试 JSON.parse

### TC-016-161 简单/展开模式
- **关联**：FR-016-086
- **优先级**：P0
- **预期**：默认 `{...}`；点击展开图标→逐行属性

### TC-016-162 数组分块（>100）
- **关联**：FR-016-087、NFR-016-002
- **优先级**：P0
- **输入**：250 元素数组
- **预期**：渲染 `[0...99]`、`[100...199]`、`[200...249]` 三个区间

### TC-016-163 数组 ≤100 不分块
- **关联**：FR-016-087
- **优先级**：P1
- **预期**：100 元素数组直接展开渲染

### TC-016-164 类型着色
- **关联**：FR-016-088
- **优先级**：P1
- **预期**：number/string/boolean/property 各自对应 CSS 类

### TC-016-165 解析失败回退
- **关联**：FR-016-085
- **优先级**：P1
- **预期**：非法 JSON 字符串→以原始文本展示，不抛错

---

## 17. 辅助组件（FR-016-100~107、US-016-06）

### TC-016-180 Loading 渲染
- **关联**：FR-016-100、US-016-06
- **优先级**：P0
- **预期**：显示 "Loading" 逐字 span 与 "By magic-editor x.x.x"

### TC-016-181 title/version props
- **关联**：FR-016-101
- **优先级**：P1
- **预期**：自定义 title/version 文本生效

### TC-016-182 z-index 9999999
- **关联**：FR-016-102、NFR-016-008
- **优先级**：P1
- **预期**：覆盖层 z-index===9999999

### TC-016-183 CSS 动画
- **关联**：NFR-016-003
- **优先级**：P2
- **预期**：动画通过 `@keyframes` 实现，无 setTimeout/setInterval

### TC-016-184 底部面板渲染
- **关联**：FR-016-103
- **优先级**：P0
- **预期**：显示 title、操作按钮 icons 数组、最小化按钮

### TC-016-185 最小化触发
- **关联**：FR-016-104
- **优先级**：P0
- **预期**：点最小化→emit `update:selectedTab(null)`

### TC-016-186 默认插槽
- **关联**：FR-016-105
- **优先级**：P1
- **预期**：插槽内容渲染于面板主体

### TC-016-187 HTTP 方法图标颜色
- **关联**：FR-016-106
- **优先级**：P1
- **预期**：GET/POST/DELETE/PUT/function 对应不同 CSS 类

### TC-016-188 DELETE→DEL / function→Fn
- **关联**：FR-016-107
- **优先级**：P0
- **预期**：value=DELETE→显示"DEL"；value=function→显示"Fn"

---

## 18. 插件注册（FR-016-120~122）

### TC-016-200 install 注册
- **关联**：FR-016-120
- **优先级**：P0
- **预期**：调用 `app.use(MagicEditor)` 后所有组件 + 全局属性可用

### TC-016-201 库模式 window.Vue 自动安装
- **关联**：FR-016-121
- **优先级**：P1
- **预期**：浏览器存在 `window.Vue`→自动 `window.Vue.use(plugin)`

### TC-016-202 应用模式手动 use
- **关联**：FR-016-122
- **优先级**：P1
- **预期**：`main.js` 中 `app.use(modal)` / `app.use(contextmenu)` 后命令式 API 可用

---

## 19. 边界与待澄清

| 编号 | 场景 | 关联 | 预期 |
|---|---|---|---|
| TC-016-300 | 无 `.ma-container` | C-016-001 | 拖拽范围计算降级（位置不更新或回到默认） |
| TC-016-301 | Select 滚动容器内定位 | C-016-004 | 风险记录：fixed 定位下滚动会偏移 |
| TC-016-302 | Select unmounted 未移除 click 监听 | Q-016-003 | 风险记录：可能残留监听器 |
| TC-016-303 | 同时 100+ Checkbox | C-016-003 | id 冲突风险记录 |
| TC-016-304 | Confirm content 含脚本 | FR-016-010 | v-html 渲染 → XSS 风险，调用方需保证可信 |
| TC-016-305 | Contextmenu 全空 menus | FR-016-020 | 渲染空容器，仍可点外关闭 |
| TC-016-306 | Tree data 极大（>1000） | NFR-016-002 | 性能基线观察（无虚拟滚动） |
| TC-016-307 | MagicJson jsonData 直接 mutate | Q-016-002 | 父组件感知到引用相同，深拷贝 vs 引用编辑待确认 |
| TC-016-308 | Dialog 多实例叠加 | FR-016-012 | z-index 同值，后渲染者在上 |
| TC-016-309 | Loading 硬编码颜色 | NFR-016-001 | 与主题不联动（已知例外） |
| TC-016-310 | $magicAlert 在无 app.use 时 | FR-016-014 | 通过 `modal.magicAlert` 直接调用仍可用 |

---

## 20. 索引摘要

| 章节 | 用例区间 | 数量 |
|---|---|---|
| Dialog | TC-016-001~009 | 9 |
| Alert | TC-016-010~012 | 3 |
| Confirm | TC-016-020~023 | 4 |
| 命令式 API | TC-016-030~033 | 4 |
| Contextmenu | TC-016-040~051 | 12 |
| MagicInput | TC-016-060~063 | 4 |
| MagicTextarea | TC-016-070~071 | 2 |
| MagicSelect | TC-016-080~084 | 5 |
| MagicCheckbox | TC-016-090~092 | 3 |
| MagicFile | TC-016-100~102 | 3 |
| MagicTree | TC-016-110~115 | 6 |
| JSON Tree | TC-016-120~123 | 4 |
| MagicJson | TC-016-140~146 | 7 |
| MagicStructure | TC-016-160~165 | 6 |
| 辅助组件 | TC-016-180~188 | 9 |
| 插件注册 | TC-016-200~202 | 3 |
| 边界/待澄清 | TC-016-300~310 | 11 |
| **合计** | | **95** |

> P0 ≈ 47、P1 ≈ 33、P2 ≈ 4、边界 11。覆盖 6 个 US、122 个 FR、8 个 NFR、4 个约束、3 个待澄清。
