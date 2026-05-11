# 102-test-lib 技术方案

> 模块编号：102-test-lib
> 状态：待实现
> 最后更新：2026-05-11

---

## 1. 方案概述

通过 Vite 多页应用（MPA）机制，新增 `test.html` 入口，使其通过 `import MagicEditor from 'magic-editor'` 引用编译产物 `dist/magic-editor.es.js`，而非源码。通过 `vite.config.js` 的 resolve alias 将 `'magic-editor'` 映射到本地 dist 目录。

---

## 2. 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| 多页入口 | Vite `rollupOptions.input` | 项目已有 index.html 入口，MPA 是 Vite 原生支持的模式 |
| 组件引用 | ES Module (dist/magic-editor.es.js) | Vite 原生支持 ESM，开发时 HMR 可用 |
| 样式引用 | 直接 import CSS | 与 README 示例一致 |
| 别名映射 | `resolve.alias` | 将 `magic-editor` 包名解析到本地 dist/ |

---

## 3. 文件结构

```
magic-editor/
├── test.html                  # 新增：测试页入口 HTML
├── src/
│   ├── test.js                # 新增：测试页应用入口
│   ├── Test.vue               # 新增：测试页根组件
│   ├── main.js                # 已有：主应用入口（不修改）
│   └── App.vue                # 已有：主应用组件（不修改）
├── vite.config.js             # 修改：添加多页入口 + alias
└── dist/                      # 已有：build:lib 编译产物
    ├── magic-editor.es.js
    ├── magic-editor.umd.js
    ├── magic-editor.css
    └── index-PSwJyFDJ.mjs     # 主 chunk
```

---

## 4. 各文件详细设计

### 4.1 test.html

基于 `index.html` 简化，去除 JAR 模式的 `/magic/web/config-js` 脚本引用：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <link rel="icon" href="/favicon.png" />
  <title>magic-editor lib test</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/test.js"></script>
</body>
</html>
```

关键差异：
- 无 loading 动画（简化）
- 无 `/magic/web/config-js` 脚本（非 JAR 模式）
- `src="/src/test.js"` 而非 `src="/src/main.js"`

### 4.2 src/test.js

参照 `src/main.js`，但通过编译产物导入：

```js
import { createApp } from 'vue'
import Test from './Test.vue'

// 从编译产物导入插件
import { install } from 'magic-editor'

const app = createApp(Test)
app.use({ install })
app.mount('#app')
```

**设计决策**：`install` 函数来自 `dist/magic-editor.es.js`，它会注册 MagicEditor 组件、MagicContextMenu 插件和 Modal 插件，等价于 main.js 中分别导入三个模块的效果。

### 4.3 src/Test.vue

严格遵循 README "以 Vue 组件的方式引入"：

```vue
<template>
  <div id="app">
    <magic-editor :config="config"/>
  </div>
</template>

<script>
import MagicEditor from 'magic-editor'
import 'magic-editor/dist/magic-editor.css'

export default {
  name: 'Test',
  components: {
    MagicEditor
  },
  data() {
    return {
      config: {
        baseURL: '/magic/web',
        serverURL: 'http://localhost:9999/',
        inJar: true
      }
    }
  }
}
</script>

<style>
html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
```

**关键约束**：
- 不使用 `@/components/magic-editor.vue`（源码引用）
- 使用 `import MagicEditor from 'magic-editor'`（编译产物引用）
- 使用 `import 'magic-editor/dist/magic-editor.css'`（编译产物样式）

### 4.4 vite.config.js 修改

在非 lib 模式的返回值中：

1. **添加多页入口**：将 `rollupOptions.input` 从单个 `index.html` 改为数组 `[index.html, test.html]`

2. **添加 resolve alias**：将 `'magic-editor'` 映射到 `resolve('dist/magic-editor.es.js')`

3. **CSS 处理**：`magic-editor.css` 通过 import 引入，Vite 会自动处理；由于别名指向 ES 文件，CSS 需要通过 `import 'magic-editor/dist/magic-editor.css'` 单独引入

修改后的关键部分：

```js
return {
  ...baseConfig,
  base: './',
  resolve: {
    ...baseConfig.resolve,
    alias: {
      ...baseConfig.resolve.alias,
      'magic-editor': resolve('dist/magic-editor.es.js'),
    }
  },
  build: {
    outDir: 'dist-app',
    sourcemap: false,
    rollupOptions: {
      input: [
        path.resolve(__dirname, 'index.html'),
        path.resolve(__dirname, 'test.html'),
      ],
      output: { /* 同现有 */ }
    }
  },
  server: { /* 同现有 */ }
}
```

---

## 5. 数据流

```
test.html
  └→ src/test.js (createApp + app.use({install}))
       └→ src/Test.vue
            ├→ import MagicEditor from 'magic-editor' → dist/magic-editor.es.js → index-PSwJyFDJ.mjs
            └→ import 'magic-editor/dist/magic-editor.css' → dist/magic-editor.css
```

请求流向：
```
浏览器 → /magic/web/* → Vite proxy → http://localhost:9999/magic/web/*
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| dist/ 中 ES 模块 re-export 主 chunk，Vite 开发模式可能不兼容 | 页面白屏 | 若 ESM 不可用，回退到 UMD + script 标签方式 |
| magic-editor.css 中引用的字体/图标路径在开发模式下可能不正确 | 样式缺失 | 检查 CSS 中相对路径是否需要调整 |
| install 函数依赖 Vue 实例，可能需要调整注册方式 | 插件不生效 | 确认 install 函数签名兼容 app.use() |
| Monaco Editor 的 Worker 文件路径在 lib 模式下可能不正确 | 编辑器无法初始化 | 检查 Worker 加载路径，必要时配置 |
