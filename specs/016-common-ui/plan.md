# 016-common-ui 技术计划（As-Built）

> 本文档为反向归纳的技术计划，记录实际已构建的架构、设计决策与实现策略。
> 模块：016-common-ui
> 对应规范：[spec.md](./spec.md)
> 最后更新：2026-05-01

---

## 1. 技术上下文

### 1.1 运行环境

| 维度 | 值 | 证据 |
|---|---|---|
| 框架 | Vue 3.4.0（Options API 风格） | `package.json:22`、各组件 `export default { name, props, data, methods }` |
| 构建工具 | Vite 5.4.21 | `package.json:28`、`vite.config.js` |
| 浏览器目标 | 现代浏览器（ES Module / CSS Variables / `createApp`） | 无 polyfill、使用 `document.createElement`/`addEventListener` |
| 交付形态 | 应用模式（`dist-app/`）+ 库模式（`dist/`，UMD + ES） | `vite.config.js:118-207`、`package.json:10-16` |
| CSS 变量 | 通过主题系统 `Themes[name].styles` 注入 `.ma-container` 的 `:style` 绑定 | `theme.js:12`、`magic-editor.vue:2,6,90` |

### 1.2 依赖

| 依赖 | 版本 | 用途 | 本模块中的使用 |
|---|---|---|---|
| `vue` | ^3.4.0 | UI 框架 | 全部组件的基础；`createApp` 动态挂载（modal/contextmenu） |
| `axios` | ^0.21.0 | HTTP 客户端 | 本模块不直接使用，由 014-infra-transport 消费 |
| `monaco-editor` | ^0.29.1 | 代码编辑器 | 本模块不直接使用，由 001-editor-core 消费 |
| `qs` | ^6.9.4 | URL 编码 | 本模块不使用 |
| `@vitejs/plugin-vue` | ^5.2.4 | Vue SFC 编译 | 构建期 |
| `eslint` + `eslint-plugin-vue` | ^8.56.0 / ^9.21.0 | 代码检查 | 开发期 |

**内部依赖**：
- `@/scripts/utils.js` 的 `deepClone` → `magic-json-tree.vue:31`（缩进数组深拷贝）
- `@/scripts/editor/theme.js` 的 `defineTheme` / `Themes` → 主题注册与 CSS 变量注入
- `@/assets/images/` 下的 GIF 图片 → `magic-json-tree.vue:29-30`、`magic-json-tree-format.vue:12-15`

---

## 2. 宪法合规性检查

| 条款 | 合规状态 | 理由 |
|---|---|---|
| **第一条 单一主组件 + 注入式配置** | ✅ 合规 | 本模块不暴露根组件；所有组件通过 `index.js` 注册为插件，由 `MagicEditor` 统一装配。无硬编码后端地址。 |
| **第二条 前后端契约即真相** | ✅ 合规 | 本模块为纯 UI 组件，不持有业务数据，不持久化任何业务状态。 |
| **第三条 通信双通道** | ✅ 合规 | 本模块不涉及 HTTP 或 WebSocket 通信。 |
| **第四条 事件总线即全局状态** | ✅ 合规 | 本模块组件间通信使用 Vue 自身响应式（props/emit/v-model），不引入 Vuex/Pinia。命令式 API 通过 `createApp` 动态挂载，不依赖 bus。 |
| **第五条 monaco 围绕 magic-script** | ✅ 合规 | 本模块不涉及 monaco。 |
| **第六条 Header 表达类型契约** | ✅ 合规 | 不涉及 HTTP 请求。 |
| **第七条 国际化语言包索引化** | ✅ 合规 | 本模块 UI 文案为中文硬编码，与 overall-spec FR-081 一致。 |
| **第八条 双构建产物共存** | ✅ 合规 | `index.js` 同时支持 `app.use()` 插件注册和 `window.Vue.use()` 自动注册（`index.js:19-21`）。库模式下 `vue` 已 external。 |
| **第九条 错误反馈走模态框 + Bus** | ✅ 合规 | 本模块提供 `modal.magicAlert` 实现，是第九条的**实现方**。`request.js` 直接导入 `modal` 对象调用（`request.js:3`）。 |
| **第十条 源代码即文档真相** | ✅ 合规 | 本文档所有论断均附源码路径/行号。 |

---

## 3. 研究发现

### 3.1 命令式 API 架构

**决策**：对话框和右键菜单采用 `createApp` 动态挂载模式，而非在模板中预声明组件。

**实现方式**：
- `modal/index.js` 的 `createModalProxy(Component)` 工厂函数：创建临时 DOM 容器 → `createApp` 挂载 → 将容器追加到 `.ma-container` → 返回代理函数
- `magic-contextmenu/index.js` 的 `ContextmenuProxy`：单例模式（`lastInstance`/`lastApp`），新调用先销毁旧实例

**理由**：
- 错误提示、确认对话框、右键菜单等场景需要"即用即抛"，无需在调用方模板中维护 `v-model` 状态
- 挂载到 `.ma-container` 内确保对话框受主题 CSS 变量控制
- 右键菜单单例避免多个菜单同时存在导致的 z-index 冲突

**替代方案**：使用 Teleport（Vue 3 内置）→ 未采用，可能因 Vue 3.4.0 的 Teleport 在库模式下存在兼容性问题。

### 3.2 CSS 变量主题联动

**决策**：组件不定义颜色默认值，完全依赖 CSS 变量。

**实现方式**：
- `defineTheme(name, options)` 将 `options.styles` 存入 `Themes[name]`（`theme.js:12`）
- `magic-editor.vue` 的 `themeStyle` 响应式对象绑定到 `.ma-container` 的 `:style`（`magic-editor.vue:2`）
- `magic-header.vue` 通过 `v-model:themeStyle` 更新主题样式（`magic-editor.vue:6`）
- **仅 dark 主题定义了 `styles` 对象**（`dark-theme.js:40-112`，73 个 CSS 变量）；default 主题无 `styles`，依赖浏览器默认色值

**关键 CSS 变量清单**（本模块消费的变量）：

| 变量名 | 用途 | 定义位置 |
|---|---|---|
| `--input-border-color` | 输入框/选择器边框 | `dark-theme.js:62` |
| `--input-border-foucs-color` | 输入框聚焦边框 | `dark-theme.js:63` |
| `--input-background` | 输入框背景 | `dark-theme.js:64` |
| `--input-color` | 输入框文字色 | `dark-theme.js:64`（注：变量名拼写为 `foucs` 非 `focus`） |
| `--select-background` | 选择器背景 | `dark-theme.js:82` |
| `--select-hover-background` | 选择器悬停背景 | `dark-theme.js:83` |
| `--select-option-background` | 下拉选项背景 | `dark-theme.js:84` |
| `--select-option-hover-background` | 下拉选项悬停背景 | `dark-theme.js:85` |
| `--select-option-hover-color` | 下拉选项悬停文字色 | `dark-theme.js:86` |
| `--select-inputable-background` | 可输入选择器背景 | `dark-theme.js:87` |
| `--select-inputable-border` | 可输入选择器边框 | `dark-theme.js:88` |
| `--select-border-color` | 下拉列表边框 | `dark-theme.js:84` |
| `--select-option-disabled-color` | 禁用选项文字色 | [NEEDS CLARIFICATION: 未在 dark-theme.js 中显式定义] |
| `--dialog-border-color` | 对话框边框 | `dark-theme.js:68` |
| `--dialog-shadow-color` | 对话框阴影 | `dark-theme.js:69` |
| `--dialog-button-hover-background` | 对话框按钮悬停背景 | `dark-theme.js:70` |
| `--dialog-button-hover-border-color` | 对话框按钮悬停边框 | `dark-theme.js:71` |
| `--dialog-button-background` | 对话框按钮背景 | `dark-theme.js:72` |
| `--dialog-button-border` | 对话框按钮边框 | `dark-theme.js:73` |
| `--checkbox-background` | 复选框未选中背景 | `dark-theme.js:89` |
| `--checkbox-border` | 复选框未选中边框 | `dark-theme.js:90` |
| `--checkbox-selected-background` | 复选框选中背景 | `dark-theme.js:92` |
| `--checkbox-selected-border` | 复选框选中边框 | `dark-theme.js:93` |
| `--checkbox-text-color` | 复选框文字色 | `dark-theme.js:91` |
| `--border-color` | 通用边框色 | `dark-theme.js:54` |
| `--background` | 通用背景色 | `dark-theme.js:41` |
| `--color` | 通用文字色 | `dark-theme.js:48` |
| `--icon-color` | 图标色 | `dark-theme.js:49` |
| `--tab-bar-border-color` | 底部面板标题栏边框 | `dark-theme.js:61` |
| `--text-number-color` | 数字文本色 | `dark-theme.js:97` |
| `--text-string-color` | 字符串文本色 | `dark-theme.js:96` |
| `--text-boolean-color` | 布尔文本色 | `dark-theme.js:98` |
| `--text-key-color` | 键名文本色 | `dark-theme.js:100` |
| `--text-property-color` | 属性文本色 | `dark-theme.js:99` |
| `--toolbox-list-hover-background` | 列表悬停背景 | `dark-theme.js:58` |

### 3.3 右键菜单自动定位算法

**实现**（`Submenu.vue:107-151`）：
1. 获取视口宽高（`document.documentElement.clientWidth/clientHeight`）
2. 获取菜单自身宽高（`offsetWidth/offsetHeight`）
3. 根据 `openTrend` 决定左右展开：
   - 向右：`left = position.x + position.width`；若超出右边界 → 切换为向左
   - 向左：`left = position.x - menuWidth`；若超出左边界 → 切换为向右
4. 垂直方向：若底部超出 → 上翻（`top = windowHeight - menuHeight`）

### 3.4 对话框拖拽实现

**实现**（`magic-dialog.vue:91-116`）：
1. `mousedown` 在标题栏：记录起始位置、获取对话框当前 `getBoundingClientRect()`、获取根容器边界
2. `mousemove` 在根容器：计算新位置，使用 `Math.min/Math.max` 限制在根容器范围内
3. `mouseup`：停止拖拽
4. 拖拽时将 `position` 从 `relative` 切换为 `fixed`，`top/left` 从 `auto` 切换为具体像素值

### 3.5 大数据量数组分块

**实现**（`magic-structure-array.vue:59-71`）：
- 阈值：`chunkSize = 100`
- 当 `data.length > 100` 时，生成 `chunkRange` 数组：`[[0,100], [100,200], ...]`
- 每个区间渲染为 `[start...end]` 可展开节点
- 展开后使用 `data.slice(range[0], range[1])` 获取子数组

---

## 4. 数据模型

### 4.1 组件 Props 类型汇总

#### 对话框

```javascript
// MagicDialog props
{
  title: String,
  className: String (default: ''),
  showClose: Boolean (default: true),
  align: String,
  moveable: Boolean (default: true),
  content: String,
  onClose: Function,
  modelValue: Boolean (default: false),
  width: String (default: 'auto'),
  height: String (default: 'auto'),
  maxWidth: String,
  maxHeight: String,
  contentHeight: String,
  padding: String (default: '5px 10px'),
  shade: Boolean (default: false)
}

// MagicAlert props
{
  title: String (default: '提示'),
  content: String,
  ok: String (default: 'OK'),
  onOk: Function,
  onClose: Function,
  value: Boolean (default: false)
}

// MagicConfirm props
{
  title: String (default: '提示'),
  content: String,
  ok: String (default: '是'),
  cancel: String (default: '否'),
  onOk: Function,
  onCancel: Function,
  onClose: Function,
  value: Boolean (default: false)
}
```

#### 右键菜单

```javascript
// Contextmenu props
{
  menus: Array (default: []),
  position: Object (default: { x: 0, y: 0 }),
  customClass: String (default: null),
  minWidth: Number (default: 150),
  zIndex: Number (default: 2),
  destroy: Function (default: null)
}

// MenuItem 结构
{
  label: String,
  icon: String,          // 可选，ma-icon 类名
  onClick: Function,     // 点击回调
  disabled: Boolean,     // 禁用
  hidden: Boolean,       // 隐藏
  divided: Boolean,      // 下部分隔线
  children: Array,       // 子菜单（MenuItem[]）
  minWidth: Number,      // 可选，子菜单最小宽度
  customClass: String    // 可选，子菜单自定义类
}
```

#### 表单输入

```javascript
// MagicInput props
{
  type: String (default: 'text'),
  placeholder: String (default: ''),
  value: String,
  readonly: Boolean (default: false),
  focus: Function (default: () => {}),
  width: String,
  icon: String,
  onClick: Function (default: () => {}),
  onEnter: Function (default: () => {})
}

// MagicSelect props
{
  value: String,
  placeholder: String,
  defaultValue: String,
  options: Array,       // [{ value, text }]
  border: Boolean (default: true),
  inputable: Boolean (default: false),
  select: Function
}

// MagicCheckbox props
{
  value: Number | Boolean (default: false),
  checkedHalf: Boolean (default: false)
}

// MagicFile props
{
  placeholder: String (default: ''),
  accept: String (default: null),
  multiple: Boolean (default: false),
  value: FileList | String,
  width: String
}
```

#### 树/JSON

```javascript
// MagicTree props
{
  data: Array,          // [{ id, folder, opened, children }]
  forceUpdate: Boolean,
  loading: Boolean (default: false),
  loadingTime: Number (default: 500)
}

// MagicJson props
{
  jsonData: Object | Array | String | Number | Boolean | Function (required),
  forceUpdate: Boolean,
  type: String          // 'request' 时显示请求参数字段
}

// MagicStructure props
{
  data: String,
  type: String          // 'java.lang.*' 前缀时直接显示
}
```

### 4.2 内部状态

| 组件 | 状态字段 | 类型 | 用途 |
|---|---|---|---|
| `MagicDialog` | `position/top/left/visible` | String/Boolean | 拖拽位置与可见性 |
| `MagicSelect` | `marginTop/width/visible/visible/ marginLeft` | String/Boolean | 下拉列表定位与显隐 |
| `MagicCheckbox` | `cboId` | String | 唯一 ID（`Date.now() + random`） |
| `MagicTree` | `showLoading` | Boolean | 延迟 loading 显示 |
| `MagicJson` | `fieldObj/activeNodeFlag/validates/bodyTypes` | Object/Boolean/Array | 右侧面板数据与选项 |
| `MagicStructureObject` | `expand/expandKeys` | Boolean/Object | 展开状态 |
| `MagicStructureArray` | `expand/expandKeys/chunk/chunkRange` | Boolean/Object/Boolean/Array | 展开状态与分块 |
| `Submenu` | `activeSubmenu/visible/hasIcon/localOpenTrend` | Object/Boolean/Boolean/String | 子菜单管理与定位 |
| `Contextmenu` | `style/mainMenuInstance/mainMenuApp/mouseListening/commonClass` | Object/App/Boolean/Object | 菜单实例与事件监听 |

### 4.3 事件协议

| 组件 | 事件名 | 载荷 | 消费方 |
|---|---|---|---|
| `MagicDialog` | `change` | `boolean`（可见性） | 调用方 v-model |
| `MagicDialog` | `update:modelValue` | `boolean` | 调用方 v-model |
| `MagicDialog` | `onClose` | 无 | 调用方 `@onClose` |
| `MagicAlert` | 无（通过回调 `onOk`/`onClose`） | — | — |
| `MagicConfirm` | 无（通过回调 `onOk`/`onCancel`/`onClose`） | — | — |
| `MagicInput` | `update:value` | `string` | 调用方 v-model |
| `MagicInput` | `input` | `string` | 调用方 `@input` |
| `MagicSelect` | `update:value` | `string` | 调用方 v-model |
| `MagicCheckbox` | `update:value` | `boolean` | 调用方 v-model |
| `MagicCheckbox` | `change` | `boolean` | 调用方 `@change` |
| `MagicCheckbox` | `click` | `Event` | 调用方 `@click` |
| `MagicFile` | `update:value` | `FileList` | 调用方 v-model |
| `MagicBottomPanel` | `update:selectedTab` | `null` | 调用方 v-model |
| `MagicJsonTree` | `jsonClick` | `JsonNode` | `MagicJson` |
| `Submenu` | `close` | 无 | `Contextmenu` |

---

## 5. 接口契约

### 5.1 提供的接口

#### 插件注册（Vue Plugin）

```javascript
// Modal 插件
{
  install(app) {
    app.config.globalProperties.$magicAlert = MagicAlertProxy
    app.config.globalProperties.$magicConfirm = MagicConfirmProxy
    app.config.globalProperties.$magicDialog = MagicDialogProxy
  },
  magicAlert: MagicAlertProxy,    // 直接导入使用
  magicConfirm: MagicConfirmProxy,
  magicDialog: MagicDialogProxy
}

// Contextmenu 插件
{
  install(app) {
    app.config.globalProperties.$magicContextmenu = ContextmenuProxy
  }
}
```

#### 命令式 API 签名

```javascript
// 对话框
$magicAlert({ title?, content, ok?, onOk?, onClose?, value? })
$magicConfirm({ title?, content, ok?, cancel?, onOk?, onCancel?, onClose?, value? })
$magicDialog({ title?, content, className?, width?, height?, ...DialogOptions })

// 右键菜单
$magicContextmenu({
  menus: MenuItem[],
  event?: MouseEvent,   // 或显式 x/y
  x?: number,
  y?: number,
  customClass?: string,
  minWidth?: number,
  zIndex?: number,
  destroy?: Function
})

// 右键菜单销毁
ContextmenuProxy.destroy()
```

### 5.2 消费的接口

| 接口 | 来源 | 用途 |
|---|---|---|
| `deepClone(obj, ignoreFields?)` | `@/scripts/utils.js:71-89` | JSON 树缩进数组深拷贝 |
| `defineTheme(name, options)` | `@/scripts/editor/theme.js:4-12` | 主题注册（由根组件调用） |
| `Themes` | `@/scripts/editor/theme.js:3` | 主题样式对象（由根组件消费） |
| `document.createElement / appendChild` | 浏览器 DOM API | 动态挂载对话框/菜单 |
| `document.getElementsByClassName` | 浏览器 DOM API | 菜单区域检测 |
| `document.addEventListener/removeEventListener` | 浏览器 DOM API | 菜单自动关闭监听 |

### 5.3 组件内部组合关系

```
MagicJson
├── MagicJsonTree
│   └── MagicJsonTreeFormat
├── MagicInput
├── MagicSelect
└── MagicCheckbox

MagicAlert ──→ MagicDialog
MagicConfirm ──→ MagicDialog

MagicFile ──→ MagicInput

MagicTree ──→ MagicTreeItem（递归）

MagicStructure
├── MagicStructureObject ──→ MagicStructureArray（动态 import）
└── MagicStructureArray ──→ MagicStructureObject（动态 import）
```

---

## 6. 实现策略

### 6.1 架构模式

本模块采用**混合模式**：

1. **声明式组件**（大部分组件）：通过 props/emit/slot 标准 Vue 组件模式，由调用方在模板中声明使用
2. **命令式组件**（modal/contextmenu）：通过 `createApp` 动态挂载，调用方通过全局 API 函数触发，无需模板声明

**选择命令式的原因**：
- 错误提示、确认对话框、右键菜单属于"即用即抛"场景
- 避免在数十个调用方组件中重复声明 `<magic-alert v-model="showAlert">` 模板代码
- 挂载到 `.ma-container` 内确保主题 CSS 变量生效

### 6.2 关键算法

#### 对话框拖拽边界计算

```
新 Y = clamp(原Y + 鼠标偏移Y, 容器顶边, 容器底边 - 对话框高度)
新 X = clamp(原X + 鼠标偏移X, 容器左边, 容器右边 - 对话框宽度)
```

实现：`magic-dialog.vue:106-109`

#### 子菜单自动定位

```
if (openTrend === 'right') {
  left = 触发元素右边
  if (left + 菜单宽度 > 视口宽度) → 切换为 left
}
if (openTrend === 'left') {
  left = 触发元素左边 - 菜单宽度
  if (left < 0) → 切换为 right
}
if (top + 菜单高度 > 视口高度) → top = 视口高度 - 菜单高度
```

实现：`Submenu.vue:114-151`

#### 数组分块

```
chunkSize = 100
if (data.length > chunkSize) {
  ranges = []
  for (i = 0; i < len; i += chunkSize) {
    ranges.push([i, min(i + chunkSize, len)])
  }
}
```

实现：`magic-structure-array.vue:59-71`

### 6.3 错误处理

| 场景 | 处理方式 | 位置 |
|---|---|---|
| 对话框拖拽时 `.ma-container` 不存在 | `getRootEl()` 返回 `undefined`，`getBoundingClientRect()` 报错 | `magic-dialog.vue:137` |
| 右键菜单销毁时主菜单实例不存在 | 判空后调用 `close()` 和 `unmount()` | `Contextmenu.vue:62-72` |
| JSON 解析失败（MagicStructure） | `JSON.parse` 抛出异常，未捕获 → 组件渲染失败 | `magic-structure.vue:26` |
| 树数据为空 | 显示"无数据"提示 | `magic-tree.vue:20` |

### 6.4 性能考量

| 优化点 | 策略 | 位置 |
|---|---|---|
| 数组 >100 项分块渲染 | 每块 100 项，按需展开 | `magic-structure-array.vue:59-71` |
| Loading 动画 | CSS `animation` 而非 JS 定时器 | `magic-loading.vue:70-103` |
| 树组件 loading 防闪烁 | 延迟 500ms 隐藏 loading | `magic-tree.vue:55-57` |
| 动态 import | `MagicStructureObject`/`MagicStructureArray` 使用 `()=> import()` 懒加载 | `magic-structure-object.vue:55`、`magic-structure-array.vue:57` |
| 右键菜单单例 | 新实例创建前销毁旧实例 | `magic-contextmenu/index.js:26` |

---

## 7. 测试考虑

### 7.1 可测试性分析

| 组件 | 可测试性 | 建议测试类别 |
|---|---|---|
| `MagicDialog` | 高 | 拖拽边界、v-model 双向绑定、插槽渲染、关闭回调 |
| `MagicAlert`/`MagicConfirm` | 中 | 命令式调用、按钮回调执行、DOM 挂载/卸载 |
| `MagicInput` | 高 | v-model、Enter 回调、图标点击、readonly 模式 |
| `MagicSelect` | 中 | 下拉展开/关闭、翻转定位、可输入模式、选项选择 |
| `MagicCheckbox` | 高 | 选中/取消/半选、v-model、事件冒泡阻止 |
| `MagicTree` | 中 | 数据渲染、loading 延迟、空数据提示、插槽透传 |
| `MagicJson` | 中 | 双面板联动、节点点击、请求模式字段显示 |
| `MagicStructure` | 高 | 类型识别、对象展开/收起、数组分块 |
| `MagicLoading` | 低 | 动画渲染（视觉测试） |

### 7.2 边界场景

| 场景 | 涉及组件 | 风险 |
|---|---|---|
| 对话框拖拽时窗口 resize | `MagicDialog` | 边界计算基于初始窗口大小，resize 后可能越界 |
| 右键菜单在极小视口（<150px 宽） | `Submenu` | `minWidth=150` 可能超出视口 |
| `MagicSelect` 在滚动容器内 | `MagicSelect` | `position: fixed` 导致下拉列表位置偏移 |
| `MagicCheckbox` 极短时间内批量创建 | `MagicCheckbox` | `cboId` 可能冲突（`Date.now() + random`） |
| `MagicJson` 的 `jsonData` 为循环引用对象 | `MagicJson` | 递归渲染可能栈溢出 |
| `MagicStructure` 的 `data` 为非法 JSON 字符串 | `MagicStructure` | `JSON.parse` 未捕获异常 |
| `MagicSelect` 组件卸载时未移除全局 click 监听 | `MagicSelect` | 内存泄漏（`mounted` 监听 `$root.$el`，无 `unmounted` 清理） |

---

## 8. 文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/components/common/modal/index.js` | 58 | Modal 插件：`createModalProxy` 工厂、`install` 注册、`modal` 导出 |
| `src/components/common/modal/magic-dialog.vue` | 239 | 通用对话框：模板/脚本/样式，拖拽逻辑 |
| `src/components/common/modal/magic-alert.vue` | 69 | Alert 对话框：组合 MagicDialog |
| `src/components/common/modal/magic-confirm.vue` | 85 | Confirm 对话框：组合 MagicDialog |
| `src/components/common/magic-contextmenu/index.js` | 45 | Contextmenu 插件：`ContextmenuProxy`、单例管理、`install` 注册 |
| `src/components/common/magic-contextmenu/Contextmenu.vue` | 154 | 右键菜单容器：事件监听、子菜单创建/销毁 |
| `src/components/common/magic-contextmenu/Submenu.vue` | 294 | 子菜单组件：渲染、定位、悬停展开、递归子菜单 |
| `src/components/common/magic-contextmenu/util.js` | 24 | DOM 工具：`hasClass`、`getElementsByClassName` |
| `src/components/common/magic-contextmenu/constant.js` | 5 | 常量：偏移量、打开方向、组件名 |
| `src/components/common/magic-tree.vue` | 98 | 树组件：数据渲染、loading、空数据 |
| `src/components/common/magic-tree-item.vue` | 27 | 树节点：递归渲染、插槽透传 |
| `src/components/common/magic-input.vue` | 81 | 输入框：模板/脚本/样式 |
| `src/components/common/magic-textarea.vue` | 42 | 多行文本框：模板/脚本/样式 |
| `src/components/common/magic-select.vue` | 161 | 下拉选择器：定位计算、翻转逻辑 |
| `src/components/common/magic-checkbox.vue` | 82 | 复选框：CSS 伪元素图标、半选状态 |
| `src/components/common/magic-file.vue` | 56 | 文件选择器：封装原生 input |
| `src/components/common/magic-loading.vue` | 141 | Loading 覆盖层：CSS 动画 |
| `src/components/common/magic-bottom-panel.vue` | 63 | 底部面板：标题栏、按钮、最小化 |
| `src/components/common/magic-text-icon.vue` | 44 | HTTP 方法图标：SVG 渲染、颜色映射 |
| `src/components/common/magic-json.vue` | 242 | JSON 查看器：双面板、属性编辑 |
| `src/components/common/magic-json-tree.vue` | 110 | JSON 树：递归渲染、类型着色、filters |
| `src/components/common/magic-json-tree-format.vue` | 39 | JSON 树缩进线：GIF 图片 |
| `src/components/common/magic-structure.vue` | 86 | 数据结构展示：类型识别、分发 |
| `src/components/common/magic-structure-object.vue` | 90 | 对象展示：简单/展开模式 |
| `src/components/common/magic-structure-array.vue` | 101 | 数组展示：分块、展开模式 |
| `src/index.js` | 23 | 库模式入口：组件注册 + 插件安装 |
| `src/main.js` | 11 | 应用模式入口：插件安装 + 挂载 |
| `src/scripts/editor/theme.js` | 13 | 主题注册：`defineTheme`、`Themes` |
| `src/scripts/editor/default-theme.js` | 40 | 默认主题：monaco 规则（无 CSS 变量） |
| `src/scripts/editor/dark-theme.js` | 113 | 暗色主题：monaco 规则 + 73 个 CSS 变量 |
| `src/scripts/utils.js` | 182 | 工具函数：`deepClone` 等 |

**总计**：31 个文件，约 2,800 行代码。
