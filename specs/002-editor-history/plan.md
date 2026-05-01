# 002-editor-history 技术实现计划（As-Built）

> 本文档为反向归纳的技术计划，描述实际已构建的架构、设计决策与实现策略。
> 模块：002-editor-history
> 对应 spec：[spec.md](./spec.md)
> 最后更新：2026-05-01
> 源码入口：`src/components/editor/magic-history.vue`（158 行）

---

## 1. 技术上下文

### 1.1 运行环境

| 维度 | 值 | 证据 |
|---|---|---|
| 运行时 | 现代浏览器（Chrome/Edge/Firefox/Safari） | `vite.config.js`，无 polyfill |
| 框架 | Vue 3.4.0（Options API） | `package.json:22`、`magic-history.vue:24-96` |
| 构建工具 | Vite 5.4.21 | `package.json:28` |
| 编辑器内核 | monaco-editor 0.29.1 | `package.json:20` |
| 交付形态 | jar 内嵌 SPA（`dist-app/`）+ NPM 库（`dist/`） | `vite.config.js:118-207` |

### 1.2 依赖清单

| 依赖 | 版本 | 用途 | 类型 | 源码证据 |
|---|---|---|---|---|
| `monaco-editor` | ^0.29.1 | diff editor 创建 + model 管理 | 直接 | `magic-history.vue:18, 39, 64, 76` |
| `axios` | ^0.21.0 | HTTP 请求（通过 `request.js` 封装） | 间接 | `request.js:1` |
| `qs` | ^6.9.4 | 请求体 form-urlencoded 编码 | 间接 | `request.js:2, 31` |
| `vue` | ^3.4.0 | 组件框架 | 直接 | `magic-history.vue:24` |

**间接依赖（通过项目内部模块）**：

| 模块 | 文件 | 用途 | 源码证据 |
|---|---|---|---|
| bus | `src/scripts/bus.js` | 订阅 `update-window-size` 事件 | `magic-history.vue:19, 52` |
| contants | `src/scripts/contants.js` | 读取字体族/字号配置 | `magic-history.vue:22, 48-49` |
| utils | `src/scripts/utils.js` | `formatDate()` 时间格式化、`isVisible()` DOM 可见性判断 | `magic-history.vue:20, 79, 87` |
| request | `src/api/request.js` | HTTP 请求封装（`send().success()` 链式调用） | `magic-history.vue:21, 57-70` |

---

## 2. Constitution 合规性检查

| 条款 | 状态 | 检查项 | 判定依据 |
|---|---|---|---|
| **第一条** 单一主组件 + 注入式配置 | ✅ 合规 | 本模块不暴露根组件，不硬编码后端地址 | 无 `baseURL`/`serverURL` 硬编码；HTTP 路径通过 `request.send()` 相对路径发起 |
| **第二条** 前后端契约即真相 | ✅ 合规 | 不持久化业务数据，历史版本从后端拉取 | `magic-history.vue:57-70` 通过 HTTP 拉取，无 localStorage 写入 |
| **第三条** 通信双通道 | ✅ 合规 | 历史版本拉取走 HTTP，不走 WebSocket | `magic-history.vue:57-70` 使用 `request.send()` |
| **第四条** 事件总线即全局状态 | ✅ 合规 | 跨组件通信通过 bus 订阅 `update-window-size` | `magic-history.vue:52`；组件内部状态使用 Vue `data()` |
| **第五条** monaco 围绕 magic-script | ✅ 合规 | diff editor 语言模式设为 `magicscript` | `magic-history.vue:64, 76` |
| **第六条** Header 表达类型契约 | ✅ 合规 | 不自行设置 Header，由 `request.js` 统一注入 `magic-token` | `request.js:112` 自动注入 |
| **第七条** 国际化语言包索引化 | ✅ 合规 | 不涉及 monaco 语言切换 | 无 `monaco.editor.setLocale()` 调用 |
| **第八条** 双构建产物共存 | ✅ 合规 | 组件为纯 Vue SFC，两种构建模式均可打包 | 无构建模式特定代码 |
| **第九条** 错误反馈走模态框 + Bus | ⚠️ 部分合规 | HTTP 错误由 `request.js` 统一处理弹框，但本模块 `open()` 方法中 `JSON.parse(info.content)` 未捕获解析异常 | `magic-history.vue:63` 无 try-catch |
| **第十条** 源代码即文档真相 | ✅ 合规 | 本文档所有论断均可溯源 | 每条均附 file:line |

---

## 3. 研究发现

### 3.1 Diff Editor 初始化策略

**决策**：在 `mounted` 钩子中创建 monaco diff editor 实例，而非懒加载。

**理由**：
- 组件挂载时 diff editor 容器 DOM 已存在（`this.$refs.diffEditor`）
- 父组件通过 `magic-dialog` 包裹，对话框打开时组件已挂载
- 避免重复创建/销毁 editor 实例的性能开销

**源码证据**：`magic-history.vue:38-53`

### 3.2 Model 生命周期管理

**决策**：`scriptModel`（modified 侧）在 `load()` 时创建一次，`originalModel`（original 侧）在每次 `open()` 时重新创建。

**实现细节**：
1. `load()` 中通过 `this.scriptEditor.getValue()` 获取当前编辑器内容，创建 `scriptModel`
2. `load()` 中同时将 `originalModel` 初始指向 `scriptModel`（此时两侧相同，diff 无差异）
3. `open()` 中通过 `monaco.editor.createModel(info.script, 'magicscript')` 创建新的 `originalModel`
4. 通过 `this.diffEditor.setModel({ original, modified })` 更新 diff 视图

**风险**：旧 `originalModel` 未调用 `dispose()` 释放，存在内存泄漏风险（见 spec.md NC-002）。

**源码证据**：`magic-history.vue:64, 76-77`

### 3.3 HTTP 路径动态选择

**决策**：通过 `isApi` 布尔值在运行时选择后端路径。

```js
this.isApi ? 'backup/get' : 'function/backup/get'
```

**理由**：接口（API）和函数（Function）在 magic-api 后端是两种不同的资源类型，各自有独立的 backup 端点。`isApi` 由父组件从 `this.info._type === 'api'` 推导后传入。

**源码证据**：`magic-history.vue:58`、`magic-script-editor.vue:641`

### 3.4 布局重算策略

**决策**：使用 `$nextTick` 双层嵌套 + `isVisible()` 守卫确保 diff editor 在 DOM 可见后才调用 `layout()`。

**理由**：
- monaco diff editor 在隐藏容器中调用 `layout()` 会计算为 0 尺寸
- 父组件通过 `magic-dialog` 控制显示/隐藏，对话框打开后 DOM 需要渲染周期才可见
- `isVisible()` 检查 `offsetWidth/offsetHeight/getClientRects` 三重条件

**源码证据**：`magic-history.vue:85-90`、`utils.js:4`

### 3.5 回滚实现策略

**决策**：`reset()` 直接通过 `this.scriptEditor.setValue(this.originalModel.getValue())` 将历史版本内容写入父组件的编辑器。

**含义**：
- 回滚操作仅替换编辑器文本，**不触发保存**
- 用户需手动 Ctrl+S 保存回滚后的内容
- 回滚后 diff 视图的 original 侧与 modified 侧内容一致（无差异）

**源码证据**：`magic-history.vue:92-94`

---

## 4. 数据模型

### 4.1 历史版本项（HistoryItem）

```js
{
  id: string,        // 资源 ID（从父组件 item.id 传入）
  timestamp: number, // 版本时间戳（秒级 Unix 时间戳，来自后端 t.createDate）
  dateTime: string,  // 格式化后的日期时间 "YYYY-MM-DD HH:mm:ss"
  createBy: string   // 创建者用户名（可能为空字符串，显示时 fallback 为 'guest'）
}
```

**转换逻辑**（`magic-history.vue:78-80`）：
```js
timestampes.map((t) => ({
  id: item.id,
  timestamp: t.createDate,
  dateTime: formatDate(t.createDate * 1),
  createBy: t.createBy
}))
```

### 4.2 后端响应结构

```js
// POST backup/get 或 function/backup/get 的响应
{
  code: 1,
  data: {
    content: string  // JSON 字符串，需 JSON.parse 后取 .script 字段
  }
}
```

**解析后**：
```js
{
  script: string  // 历史版本的脚本源码内容
}
```

### 4.3 组件内部状态（data）

| 字段 | 类型 | 初始值 | 用途 |
|---|---|---|---|
| `displayText` | string | `''` | 未使用（遗留字段） |
| `timestampes` | Array\<HistoryItem\> | `[]` | 历史版本列表 |
| `currentItem` | HistoryItem | `{}` | 当前选中版本 |
| `scriptEditor` | MonacoEditor | `null` | 父组件编辑器实例引用 |
| `diffEditor` | MonacoDiffEditor | `null` | diff editor 实例 |
| `scriptModel` | MonacoITextModel | `null` | modified 侧 model |
| `originalModel` | MonacoITextModel | `null` | original 侧 model |
| `isApi` | boolean | `true` | 资源类型标志 |

---

## 5. 接口契约

### 5.1 提供的接口（被父组件调用）

| 方法 | 签名 | 调用方式 | 源码证据 |
|---|---|---|---|
| `load` | `(timestampes: Array, item: Object, scriptEditor: MonacoEditor, isApi: boolean) => void` | `this.$refs.history.load(...)` | `magic-history.vue:72-83` |
| `reset` | `() => void` | `this.$refs.history.reset()` | `magic-history.vue:92-94` |

### 5.2 消费的接口

| 来源 | 接口 | 用途 | 源码证据 |
|---|---|---|---|
| `monaco-editor` | `editor.createDiffEditor(container, options)` | 创建 diff editor | `magic-history.vue:39` |
| `monaco-editor` | `editor.createModel(value, language)` | 创建 text model | `magic-history.vue:64, 76` |
| `request` | `send(url, params).success(callback)` | 拉取历史版本内容 | `magic-history.vue:57-70` |
| `bus` | `$on('update-window-size', handler)` | 订阅窗口尺寸变化 | `magic-history.vue:52` |
| `contants` | `EDITOR_FONT_FAMILY`, `EDITOR_FONT_SIZE` | 读取字体配置 | `magic-history.vue:48-49` |
| `utils` | `formatDate(timestamp)`, `isVisible(element)` | 时间格式化 / DOM 可见性 | `magic-history.vue:20, 79, 87` |

### 5.3 事件协议

| 事件名 | 方向 | 触发方 | 消费方 | 载荷 |
|---|---|---|---|---|
| `update-window-size` | bus → 本模块 | 父组件/布局 | `magic-history.vue:52` | 无（仅通知） |

### 5.4 与父组件的交互协议

```
父组件 (magic-script-editor.vue)                    本模块 (magic-history.vue)
    │                                                      │
    │── GET backups?id=xxx ──→ 后端                         │
    │←── timestampes[] ──────                               │
    │                                                      │
    │── load(timestampes, info, editor, isApi) ──────────→ │
    │                                                      │── createModel(editor.getValue())
    │                                                      │── map timestampes → HistoryItem[]
    │                                                      │── open(first item)
    │                                                      │── POST backup/get
    │                                                      │←── content JSON
    │                                                      │── createModel(script)
    │                                                      │── setModel({original, modified})
    │                                                      │
    │←── diff 视图渲染完成                                  │
    │                                                      │
    │  用户点击列表项                                       │
    │────────────────────────────────────────────────────→ │
    │                                                      │── open(selected item)
    │                                                      │── POST backup/get
    │                                                      │── 更新 original model
    │                                                      │
    │  用户点击"恢复"按钮                                   │
    │── reset() ─────────────────────────────────────────→ │
    │                                                      │── scriptEditor.setValue(originalModel.getValue())
    │←── 编辑器内容已替换                                    │
```

---

## 6. 实现策略

### 6.1 架构模式

**模式**：受控子组件（Controlled Child Component）

- 本组件无 props，所有数据通过 `load()` 方法注入
- 无 emit，所有输出通过直接操作父组件传入的 `scriptEditor` 实例
- 组件生命周期：`mounted` 创建 diff editor → `load()` 注入数据 → `open()` 渲染 diff → `reset()` 回滚

### 6.2 关键算法

#### 6.2.1 时间戳格式化

后端返回的 `createDate` 为秒级 Unix 时间戳，需 `* 1` 转为数值类型后传入 `formatDate()`。`formatDate()` 内部判断：13 位数字视为毫秒时间戳，否则视为秒级并 `* 1000`。

**源码证据**：`magic-history.vue:79`、`utils.js:17-33`

#### 6.2.2 Diff Model 更新流程

```
1. open(item) 被调用
2. POST backup/get { id, timestamp }
3. 收到 response → JSON.parse(info.content) → 提取 .script
4. monaco.editor.createModel(script, 'magicscript') → originalModel
5. diffEditor.setModel({ original: originalModel, modified: scriptModel })
6. layout() 重新计算布局
```

### 6.3 错误处理

| 错误场景 | 处理方式 | 源码证据 |
|---|---|---|
| HTTP 请求失败（网络/超时） | `request.js` 统一弹框（`modal.magicAlert`） | `request.js:117-127` |
| HTTP 响应 code ≠ 1 | `request.js` 弹框显示异常代码和消息 | `request.js:62-66` |
| HTTP 401 | `request.js` 触发 `bus.$emit('showLogin')` | `request.js:151-153` |
| `JSON.parse(info.content)` 解析失败 | **未捕获**，异常向上抛出（见 NC-002） | `magic-history.vue:63` |
| diff editor 容器不可见 | `isVisible()` 守卫跳过 layout | `magic-history.vue:87` |

### 6.4 性能考虑

| 关注点 | 现状 | 风险等级 |
|---|---|---|
| diff editor 实例复用 | `mounted` 创建一次，后续仅更新 model | 低 |
| model 泄漏 | `originalModel` 每次 `open()` 重新创建但未 dispose | 中（NC-002） |
| 布局重算 | 双层 `$nextTick` + `isVisible()` 守卫 | 低 |
| 列表渲染 | `v-for` 直接渲染，无虚拟滚动 | 低（历史版本数量通常有限） |

---

## 7. 测试考虑

### 7.1 可测试场景

| 场景 | 测试类型 | 验证点 |
|---|---|---|
| `load()` 初始化 | 单元测试 | timestampes 映射正确、scriptModel 创建、自动打开第一个版本 |
| `open()` 切换版本 | 集成测试 | HTTP 请求参数正确、model 更新、diff 视图渲染 |
| `reset()` 回滚 | 集成测试 | scriptEditor 内容被替换为 originalModel 内容 |
| `layout()` 布局 | 单元测试 | 仅在 diff editor 可见时调用 layout |
| 窗口尺寸变化 | 集成测试 | `update-window-size` 事件触发后 layout 被调用 |

### 7.2 边界情况

| 场景 | 预期行为 | 源码证据 |
|---|---|---|
| timestampes 为空数组 | 不调用 `open()`，面板显示空列表 | `magic-history.vue:81-83` |
| `createBy` 为空字符串 | 显示 `guest` | `magic-history.vue:6, 10` |
| `info.content` 不是合法 JSON | 抛出 SyntaxError（未处理） | `magic-history.vue:63` |
| diff editor 容器被隐藏 | layout 跳过执行 | `magic-history.vue:87` |

---

## 8. 文件清单

| 文件 | 用途 | 行数 |
|---|---|---|
| `src/components/editor/magic-history.vue` | 模块主文件（template + script + style） | 158 |
| `src/components/editor/magic-script-editor.vue` | 父组件（调用 `load()`/`reset()`） | 1050 |
| `src/api/request.js` | HTTP 请求封装 | 194 |
| `src/scripts/bus.js` | EventBus 实现 | 57 |
| `src/scripts/contants.js` | 全局常量（字体配置） | 36 |
| `src/scripts/utils.js` | 工具函数（formatDate/isVisible） | 182 |

---

## 9. 与 spec.md 的 FR 映射

| spec FR | plan 章节 | 实现状态 |
|---|---|---|
| FR-002-001 ~ 002-003 | §4.1 数据模型 + §6.1 架构模式 | ✅ 已实现 |
| FR-002-010 ~ 002-014 | §3.1 Diff Editor 策略 + §6.2 关键算法 | ✅ 已实现 |
| FR-002-020 ~ 002-023 | §3.3 HTTP 路径选择 + §5.2 消费接口 | ✅ 已实现 |
| FR-002-030 | §3.5 回滚策略 + §6.2.2 Diff Model 更新 | ✅ 已实现 |
| FR-002-040 ~ 002-043 | §3.2 Model 生命周期 + §4.3 组件状态 | ✅ 已实现 |
| NFR-002-001 ~ 002-003 | §3.4 布局策略 + §6.4 性能 | ✅ 已实现 |
