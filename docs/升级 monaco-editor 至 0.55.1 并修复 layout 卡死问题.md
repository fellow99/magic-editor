# 升级 monaco-editor 至 0.55.1 并修复 layout 卡死问题

## 背景

`magic-editor` 是基于 Vue 3 + Vite 5 的前端工程，原使用 `monaco-editor@0.29.1`（2021 年 9 月发布）。在 Vue 3 环境下，调用编辑器实例的 `layout()` 方法时浏览器会卡死，部分交互（如点击接口节点打开编辑器）也会触发同类卡死。

目标：将 `monaco-editor` 升级至 `0.55.1`，并彻底修复 `layout()` 卡死问题，确保 `pnpm build` 通过、前端页面所有编辑器交互正常。

## 根因分析

### 1. monaco-editor 跨版本破坏性变更

从 0.29 到 0.55 跨越约 4 年，存在多处不兼容：

- **私有键绑定 API 移除**：旧代码通过 `editor._standaloneKeybindingService` / `_register` 等私有字段注册快捷键，新版无法访问。
- **NLS 本地化模块结构变化**：`vs/nls.js` 由原本的简单 `localize` 导出改为 `function localize(...) {} export { localize, ... }` 形式。原有 `monacoEditorLocalesPlugin` 的字符串替换逻辑会产生重复声明，导致 Rollup `Identifier 'localize' has already been declared` 报错。
- **Tokenization API 移除**：`monaco.editor.tokenize` 与 `TokenizationRegistry`、`tokenizeToString` 等已被删除/重构，依赖它们做搜索结果着色的代码无法编译。
- **KeyCode 枚举改动**：部分键名（例如 `KEY_L` / `US_SLASH`）改为 `KeyL` / `Slash`。
- **Worker 引入方式简化**：旧版需要按 `vs/...` 路径分别引入子模块，新版直接 ESM `import 'monaco-editor/esm/vs/editor/editor.worker'` 即可。

### 2. Vue 3 reactivity 与 monaco 的冲突（卡死根因）

monaco 内部维护大量带循环引用的对象（model、view、disposables 等）。当编辑器实例存放在组件实例的响应式属性上（`this.editor = monaco.editor.create(...)`），Vue 3 会用 `Proxy` 深度代理，触发 `layout()` 等内部方法时，monaco 在自身对象图上的递归遍历会被 Proxy 不停"扩散"，最终导致主线程卡死。

**修复策略**：所有 monaco 实例（编辑器、`createDiffEditor`、`createModel`）都用 `markRaw()` 包装，明确告诉 Vue 3 跳过响应式代理。

## 修改清单

### 依赖与构建

| 文件 | 变更 |
| --- | --- |
| `package.json` | `monaco-editor`: `^0.29.1` → `^0.55.1` |
| `pnpm-lock.yaml` | 新增（首次提交锁文件） |
| `vite.config.js` | 重写 `monacoEditorLocalesPlugin` 适配 0.55 nls.js（处理 `function localize` 与 `export { localize }`，移除导出列表中的同名标识符）；`baseConfig` 增加 `optimizeDeps.include: ['monaco-editor']` |
| `src/scripts/workers/editor.worker.js` | 简化为 `import 'monaco-editor/esm/vs/editor/editor.worker'` |
| `src/scripts/workers/json.worker.js` | 简化为 `import 'monaco-editor/esm/vs/language/json/json.worker'` |

### 编辑器主组件 `src/components/editor/magic-script-editor.vue`

- 引入 `markRaw`，编辑器实例存放于 `this._editor`（非响应式字段）+ `markRaw()` 双重保险。
- `KeyCode.US_SLASH` → `KeyCode.Slash`，`KeyCode.KEY_L` → `KeyCode.KeyL`。
- 删除对 `_standaloneKeybindingService._getResolver()._defaultKeybindings` 等私有字段的访问，改用公共 API `monaco.editor.addKeybindingRule()` + `editor.addCommand()` 注册快捷键。
- 重新启用 `layout()` 调用（之前因卡死被注释）。

### 搜索组件 `src/components/layout/magic-search.vue`

- 移除对 `monaco.editor.colorize` / `TokenizationRegistry` / `tokenizeToString` 的依赖（API 已删除）。
- `getHighlight()` 改为返回纯文本，由 `replaceKeywords()` 做关键词高亮。
- 编辑器实例 `markRaw(monaco.editor.create(...))`，并修复闭合括号。

### 其余编辑器实例（共 4 个组件）

统一模式：`import { markRaw } from 'vue'` + `markRaw()` 包装。

| 文件 | 包装内容 |
| --- | --- |
| `src/components/layout/magic-request.vue` | `bodyEditor = markRaw(monaco.editor.create(...))` |
| `src/components/layout/magic-run.vue` | `resultEditor = markRaw(monaco.editor.create(...))` |
| `src/components/editor/magic-history.vue` | `diffEditor = markRaw(monaco.editor.createDiffEditor(...))` 与 2 处 `markRaw(monaco.editor.createModel(...))` |
| `src/components/resources/magic-datasource-list.vue` | `editor = markRaw(monaco.editor.create(...))` |

## 关键代码模式

### `markRaw` 包装

```js
import { markRaw } from 'vue'

// 在 mounted 中创建编辑器
this.bodyEditor = markRaw(monaco.editor.create(this.$refs.bodyEditor, {
  // ...options
}))
```

### 公共键绑定 API（替代私有 API）

```js
// 旧（已不可用）
editor._standaloneKeybindingService._getResolver()._defaultKeybindings...

// 新
monaco.editor.addKeybindingRule({
  keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
  command: 'my-save-cmd'
})
editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { /* ... */ })
```

### Worker（vite + ESM）

```js
// editor.worker.js
import 'monaco-editor/esm/vs/editor/editor.worker'

// json.worker.js
import 'monaco-editor/esm/vs/language/json/json.worker'
```

### `monacoEditorLocalesPlugin`（适配 0.55 nls.js）

核心思路：把 nls.js 中原有的 `function localize(...)` 重命名为 `_localize_origin`，再注入新的 `localize` 实现，并从 `export { localize, ... }` 列表中移除原始 `localize` 标识符以避免重复声明。

## 验证

| 检查项 | 结果 |
| --- | --- |
| `pnpm install` | ✅ 成功 |
| `pnpm build` | ✅ exit 0 (1m 11s) |
| `pnpm build:lib` | ✅ 成功 |
| `VITE_DEV_MODE=true npm run serve` | ✅ Vite 5 dev server ready on http://localhost:5173/ |
| 浏览器加载首页 (Playwright) | ✅ 页面正常渲染，"test(test)" 接口可见 |
| 点击接口节点打开编辑器 | ✅ 不卡死，编辑器正常挂载 |
| 浏览器 Console errors | ✅ 0 错误 |

后端通过 spring-boot-devtools + `application-docker.yml` 运行；环境本身即为 Docker 容器内部，故未走 Docker 启动方式。

## 提交记录

```
c8cabc9 feat(monaco): 升级 monaco-editor 至 0.55.1 并修复 layout 卡死问题
```

11 个文件变更（+1939 / −94）：
- `package.json`
- `pnpm-lock.yaml`（新增）
- `vite.config.js`
- `src/components/editor/magic-script-editor.vue`
- `src/components/editor/magic-history.vue`
- `src/components/layout/magic-request.vue`
- `src/components/layout/magic-run.vue`
- `src/components/layout/magic-search.vue`
- `src/components/resources/magic-datasource-list.vue`
- `src/scripts/workers/editor.worker.js`
- `src/scripts/workers/json.worker.js`

## 经验教训

1. **Vue 3 工程引入第三方"非响应式"对象**：凡是带有内部循环引用、复杂对象图、自管理状态的库（monaco、ECharts instance、CodeMirror、Three.js scene 等），必须用 `markRaw()` 包装或存放在非响应式字段（`this._x`、组件外的 ref/局部变量），否则随时可能因 Proxy 递归触发卡死或性能崩溃。
2. **跨大版本升级**：先调研 changelog（本次借助 `librarian` 子代理拉取 monaco 0.55 breaking changes），列出"删除/改名/重构"清单，再批量定位代码使用点。
3. **本地化插件升级**：当上游产物结构（如 nls.js）变化时，字符串替换型 vite/rollup 插件极易失效，需要根据新结构重写匹配规则，并避免重复声明导致的 Rollup 错误。
4. **并行委派加速整改**：4 个相同模式的 `markRaw` 修复通过并行 `Sisyphus-Junior` 子代理同时完成，大幅缩短串行编辑时间。
