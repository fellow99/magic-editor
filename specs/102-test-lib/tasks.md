# 102-test-lib 任务分解

> 模块编号：102-test-lib
> 状态：待实现
> 最后更新：2026-05-11

---

## 任务列表

### T-001：创建 test.html 入口页面

- **优先级**：P0
- **依赖**：无
- **描述**：在项目根目录创建 `test.html`，作为 Vite 多页应用的第二个入口。参照 index.html 简化版，去除 JAR 模式的 config-js 脚本和 loading 动画，入口脚本指向 `src/test.js`。
- **验收标准**：文件存在，HTML 结构正确，`<script type="module" src="/src/test.js">` 正确引用。

### T-002：创建 src/test.js 应用入口

- **优先级**：P0
- **依赖**：T-001
- **描述**：创建 `src/test.js`，使用 `createApp` 创建 Vue 应用，从编译产物导入 `install` 函数并注册插件，挂载 Test.vue 到 `#app`。
- **验收标准**：文件存在，使用 `import { install } from 'magic-editor'` 导入插件，`app.use({ install })` 注册，`app.mount('#app')` 挂载。

### T-003：创建 src/Test.vue 测试组件

- **优先级**：P0
- **依赖**：T-002
- **描述**：创建 `src/Test.vue`，严格遵循 README "以 Vue 组件的方式引入" 模式：`import MagicEditor from 'magic-editor'` + `import 'magic-editor/dist/magic-editor.css'`。通过 components 注册，提供 config 数据（baseURL、serverURL、inJar）。
- **验收标准**：文件存在，不引用任何 `src/` 源码，使用编译产物导入，config 配置正确。

### T-004：修改 vite.config.js 添加多页入口和 alias

- **优先级**：P0
- **依赖**：T-003
- **描述**：在 vite.config.js 的非 lib 模式配置中：(1) 将 `rollupOptions.input` 改为数组包含 index.html 和 test.html；(2) 在 resolve.alias 中添加 `'magic-editor'` → `resolve('dist/magic-editor.es.js')`；(3) 确保 CSS 文件 `magic-editor/dist/magic-editor.css` 能被 Vite 正确解析（需添加对应 alias 或调整路径）。
- **验收标准**：`npm run serve` 启动后访问 `/test.html` 不报 404，`import from 'magic-editor'` 解析到 dist/。

### T-005：编译组件库并验证

- **优先级**：P0
- **依赖**：T-004
- **描述**：执行 `npm run build:lib` 确保编译产物是最新的，然后启动 Vite 开发服务器，访问 `http://localhost:5173/test.html`，验证：(1) 页面无白屏；(2) 组件渲染完整；(3) 样式加载正确；(4) 资源树能连接后端。
- **验收标准**：test.html 页面功能与 index.html 基本一致，控制台无关键错误。

### T-006：按 overall-test-cases.md 执行完整测试

- **优先级**：P1
- **依赖**：T-005
- **描述**：在 test.html 页面上，按 `specs/overall-test-cases.md` 中 P0 优先级用例执行手动验证，确认组件库编译产物的完整功能可用性。
- **验收标准**：P0 用例全部通过，记录测试结果。
