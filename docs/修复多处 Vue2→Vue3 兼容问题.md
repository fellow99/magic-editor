# 修复多处 Vue2→Vue3 兼容问题

## 背景

magic-editor 原本基于 Vue2 开发，升级 Vue3 后出现大量运行时错误，导致接口树无法渲染、右键菜单无法正常弹出和定位、弹窗无法打开等问题。本次修复分两个提交完成（`560944b`、`a1cdee8`），覆盖 21 个文件，合计 241 处变更。

---

## 一、Vue2 API 全量迁移（`560944b`）

### 1. `this.$set()` → 直接赋值

Vue2 中必须用 `this.$set(obj, key, value)` 才能让新增属性具有响应式；Vue3 基于 `Proxy`，直接赋值即可触发更新。

```js
// Vue2
this.$set(this.info, 'responseBody', data)

// Vue3
this.info.responseBody = data
```

**影响文件**：全局搜索替换，共 64 处。

### 2. `this.$delete()` → `delete`

```js
// Vue2
this.$delete(this.headers, index)

// Vue3
delete this.headers[index]
```

### 3. `destroyed()` → `unmounted()`

Vue3 移除了 `destroyed` 生命周期钩子，对应钩子改名为 `unmounted`。

**影响文件**：`magic-script-editor.vue`、`magic-history.vue` 等共 4 处。

### 4. `magic-dialog` `:value` → `v-model`

Vue3 中子组件双向绑定统一改用 `v-model`，`:value` 单向绑定无法控制弹窗显隐。

```html
<!-- Vue2 -->
<magic-dialog :value="visible" />

<!-- Vue3 -->
<magic-dialog v-model="visible" />
```

**影响文件**：`magic-api-list.vue`、`magic-function-list.vue`、`magic-group-choose.vue` 等共 3 处。

### 5. 环境变量与配置路径

| 位置 | 修改前 | 修改后 | 原因 |
|---|---|---|---|
| `index.html` | `config-js` 相对路径 | `/magic/web/config-js` 绝对路径 | Vite dev server 下相对路径解析有误 |
| `App.vue` | `import.meta.env.DEV` | `import.meta.env.VITE_DEV_MODE` | Vite 只暴露 `VITE_` 前缀的自定义变量 |

---

## 二、右键菜单深度修复（`a1cdee8`）

### 问题现象

右键点击接口树节点后，菜单出现在视口外（`top: 900px`，正好在视口底部），所有菜单项均无法点击。

### 根因排查过程

**第一步：DOM 实测**

```js
// 实测结果：inline style 只有 min-width 和 z-index，完全没有 left/top
{ style: "min-width: 150px; z-index: 9999;" }
```

**第二步：定位根因**

`Contextmenu.vue` 通过 `createApp` 挂载 `Submenu.vue` 时，将 `style` 对象作为 prop 传入。`Submenu.vue` 的 `mounted()` 中直接对 prop 赋值：

```js
// 错误写法
this.style.top = this.position.y
this.style.left = this.position.x
```

Vue3 中，prop 通过 `Proxy` 包装，**直接写 prop 上的新键不会触发子组件模板重渲染**（`top`/`left` 在父组件传入的对象里本来不存在）。因此 `:style` 绑定始终看不到 `top`/`left`，菜单位置由 CSS 自然流决定，落在页面底部。

### 修复方案：引入 `localStyle`

在 `data()` 中从 prop 复制一份本地状态，所有位置计算均操作 `localStyle`：

```js
data() {
  return {
    // Vue3 不允许直接修改 prop，复制一份到本地用于动态调整 left/top 等位置
    localStyle: {
      left: this.style.left || 0,
      top: this.style.top || 0,
      minWidth: this.style.minWidth || 150,
      zIndex: this.style.zIndex || 2
    }
  }
}
```

模板绑定也改用 `localStyle`：

```html
:style="{
  left: localStyle.left + 'px',
  top: localStyle.top + 'px',
  minWidth: localStyle.minWidth + 'px',
  zIndex: localStyle.zIndex
}"
```

### 验证结果

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 顶部右键（y=63） | `top: 900px`，不可见 | `top: 63px`，正常向下展开 ✓ |
| 底部右键（y=850，菜单高 192px） | `top: 900px`，溢出视口 | `top: 658px`，自动向上翻转 ✓ |
| 点击菜单项 | 被 `<html>` 拦截，无响应 | 正常触发，弹出对应对话框 ✓ |

### 其他 `Submenu.vue` 修复项

**ASI 陷阱（Automatic Semicolon Insertion）**

```js
// 错误：JS 将 offsetHeight 当作函数调用
const menuHeight = menu.offsetHeight
(this.localOpenTrend === SUBMENU_OPEN_TREND_LEFT ? this.leftOpen : this.rightOpen)(...)

// 修复：行首加分号
const menuHeight = menu.offsetHeight
;(this.localOpenTrend === SUBMENU_OPEN_TREND_LEFT ? this.leftOpen : this.rightOpen)(...)
```

**`$refs.menu` 兼容处理**

Vue3 中 `ref` 挂在原生元素上返回 DOM，挂在组件上返回组件实例：

```js
const menuRef = this.$refs.menu
if (!menuRef) return
// 兼容两种情况
const menu = menuRef.$el || menuRef
if (!menu || typeof menu.offsetWidth === 'undefined') return
```

**子菜单创建方式**

Vue3 移除了 `extends + propsData`，改用标准 `createApp(Component, props)`：

```js
// Vue2 写法（Vue3 已移除）
const app = createApp({
  extends: this.$options,
  propsData: { menus, style, ... }
})

// Vue3 写法
import SubmenuComponent from './Submenu.vue'
const app = createApp(SubmenuComponent, { menus, style: submenuStyle, ... })
app.component('Submenu', SubmenuComponent)
```

---

## 三、其他组件修复

### `magic-input.vue`：v-model 协议

Vue3 中自定义组件的 `v-model` 使用 `modelValue` prop + `update:modelValue` 事件，不再是 Vue2 的 `value` + `input`：

```js
// Vue3
props: ['modelValue'],
emits: ['update:modelValue'],
methods: {
  onInput(e) {
    this.$emit('update:modelValue', e.target.value)
  }
}
```

### `magic-api-list.vue` / `magic-function-list.vue`：响应式优化

| 问题 | 修复 |
|---|---|
| `tree` 用深度响应式 `ref`，树节点变更触发大量递归 watcher | 改用 `shallowRef`，避免深度追踪 |
| `arrayToTree` 直接操作原始接口数据 | 改为浅拷贝后操作，避免污染原始数据 |
| `listGroupData` / `listChildrenData` 临时变量放入响应式 `data` | 改为普通变量，不参与响应式追踪 |
| `createGroupObj.type`、`parentId`、`tmpName`、`tmpPath` 未做 null 守卫 | 加 null/undefined 判断 |

### `magic-datasource-list.vue`：null guard

初始化时数据源列表可能为 `null`，加入守卫防止 `.map()` 抛错。

### `src/api/web.js`：资源树数据适配

新增 `normalizeTreeNode` / `normalizeTreeData` 工具函数，将后端返回的扁平列表在前端展平为组件期望的树结构，解耦后端数据格式与前端组件。

---

## 四、涉及文件总览

| 文件 | 主要改动 |
|---|---|
| `src/components/common/magic-contextmenu/Submenu.vue` | `localStyle` 重构、ASI 修复、`$refs` 兼容、`createApp` 修复 |
| `src/components/common/magic-input.vue` | `modelValue` + `update:modelValue` |
| `src/components/editor/magic-script-editor.vue` | `$delete` → `delete`、语法 bug 修复、`destroyed` → `unmounted` |
| `src/components/editor/magic-history.vue` | `destroyed` → `unmounted` |
| `src/components/layout/magic-header.vue` | `$set` → 直接赋值 |
| `src/components/layout/magic-options.vue` | `$set` → 直接赋值、tab 常量模块级 `Object.freeze` |
| `src/components/layout/magic-request.vue` | `$set` → 直接赋值 |
| `src/components/layout/magic-run.vue` | `$set` → 直接赋值、移除引发无限循环的 `updated()` 钩子 |
| `src/components/layout/magic-search.vue` | `$set` → 直接赋值 |
| `src/components/resources/magic-api-list.vue` | `shallowRef`、null guard、`$set/$delete` 迁移、`v-model` 修复 |
| `src/components/resources/magic-datasource-list.vue` | null guard |
| `src/components/resources/magic-function-list.vue` | `shallowRef`、null guard、`$set/$delete` 迁移、`v-model` 修复 |
| `src/components/resources/magic-group-choose.vue` | `$set` → 直接赋值、`v-model` 修复 |
| `src/components/resources/magic-resource-choose.vue` | `$set` → 直接赋值 |
| `src/components/magic-editor.vue` | `$set` → 直接赋值 |
| `src/api/web.js` | `normalizeTreeNode/normalizeTreeData`、`loadResourceTree` 展平 |
| `index.html` | config-js 路径改为绝对路径 |
| `src/App.vue` | `VITE_DEV_MODE` 环境变量 |

---

## 五、已知遗留问题

- `magic-run.vue` / `magic-request.vue`：`watch` 中仍有对 prop 的直接写操作（`info.responseBodyDefinition` / `info.requestBodyDefinition`），会产生 Vue3 prop mutation 警告，待下一轮修复。
- `修改分组` 对话框标题显示为「创建分组」，弹窗组件未区分创建/编辑模式，待单独处理。
