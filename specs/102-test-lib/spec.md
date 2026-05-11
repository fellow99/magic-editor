# 102-test-lib 模块规范

> 模块编号：102-test-lib
> 状态：待实现
> 最后更新：2026-05-11
> 对应源码：`test.html`、`src/test.js`、`src/Test.vue`、`vite.config.js`

---

## 1. 模块概述

### 1.1 目的

本模块创建一个**组件库测试页**，用于验证 `npm run build:lib` 编译产物（dist/）是否可被正常消费。与开发模式（App.vue 直接引用源码 `@/components/magic-editor.vue`）不同，测试页严格遵循 README 中"以 Vue 组件的方式引入"的方式，从编译产物导入 MagicEditor 组件和样式。

### 1.2 解决的问题

- 确认 `build:lib` 产物的 UMD/ES 模块格式可被 Vite 正确解析
- 确认组件注册、样式加载、Monaco Editor 初始化在编译产物场景下正常工作
- 确认 MagicEditor 组件通过 props 传入 config 后能正确连接后端服务
- 为后续发布提供发布前验证入口

### 1.3 范围

**包含**：
- `test.html` 多页入口
- `src/test.js` 应用创建与挂载
- `src/Test.vue` 组件引入与配置
- `vite.config.js` 多页入口配置与 alias 映射

**不包含**：
- 组件库源码修改
- 后端接口修改
- 自动化测试脚本（手动通过 Playwright 验证）

---

## 2. 用户场景与用例

### US-001：通过测试页验证组件库可用性

- **角色**：开发者
- **前置条件**：`npm run build:lib` 已执行，dist/ 目录存在编译产物
- **流程**：
  1. 开发者访问 `http://localhost:5173/test.html`
  2. 页面加载 MagicEditor 组件（从 dist/ 导入）
  3. 组件初始化，连接后端 `http://localhost:9999/magic/web`
  4. 资源树加载成功，编辑器界面完整渲染
- **后置条件**：测试页与主页面（index.html）功能表现一致

### US-002：验证样式正确加载

- **角色**：开发者
- **前置条件**：测试页已打开
- **流程**：
  1. 观察页面布局是否完整（左侧资源树、右侧编辑器、顶部工具栏）
  2. 检查 CSS 文件 `magic-editor.css` 是否被正确引入
  3. 对比主页面样式，确认无缺失或错乱
- **后置条件**：测试页样式与主页面一致

---

## 3. 功能需求

### FR-001：test.html 入口页面

- 创建 `test.html` 作为 Vite 多页应用的第二个入口
- 引用 `src/test.js` 作为入口脚本
- 包含与 `index.html` 一致的加载动画和 `#app` 挂载点
- 不引用 `/magic/web/config-js`（因为此页面不嵌入 JAR 模式）

### FR-002：src/test.js 应用入口

- 使用 `createApp` 创建 Vue 应用
- 注册 Test.vue 为根组件
- 注册 MagicContextMenu 和 Modal 插件（与 main.js 一致，但通过编译产物导入）
- 挂载到 `#app`

### FR-003：src/Test.vue 测试组件

- 按 README 示例方式引入编译产物：
  - `import MagicEditor from 'magic-editor'`
  - `import 'magic-editor/dist/magic-editor.css'`
- 通过 `components` 选项注册 MagicEditor
- 在 data 中提供 config 配置：
  - `baseURL: '/magic/web'`（开发模式通过 Vite 代理转发）
  - `serverURL: 'http://localhost:9999/'`
  - `inJar: true`
- 模板使用 `<magic-editor :config="config"/>`

### FR-004：vite.config.js 多页入口配置

- 在非 lib 模式的配置中添加 `test.html` 为多页入口
- 添加 resolve alias：`'magic-editor'` → `resolve('dist/magic-editor.es.js')`
- 确保 Vite 开发服务器正确代理 `/magic` 请求到后端 9999 端口
- 确保 test.html 页面与 index.html 共享相同的代理和 HMR 配置

---

## 4. 成功标准

| 编号 | 标准 | 验证方式 |
|------|------|----------|
| SC-001 | 访问 `http://localhost:5173/test.html` 页面正常加载 | 浏览器访问无白屏 |
| SC-002 | MagicEditor 组件渲染完整（资源树 + 编辑器 + 工具栏） | 目视确认布局完整 |
| SC-003 | 样式与主页面一致 | 对比 test.html 和 index.html |
| SC-004 | 资源树能加载后端数据 | 左侧树显示 API/函数/数据源 |
| SC-005 | 能创建、编辑、保存脚本 | 执行 CRUD 操作验证 |
| SC-006 | 控制台无关键错误 | 浏览器 DevTools 检查 |

---

## 5. 关键实体

### Config 对象

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| baseURL | string | `/magic/web` | 后端 API 基础路径 |
| serverURL | string | `http://localhost:9999/` | 接口实际运行路径 |
| inJar | boolean | `true` | 标记为 JAR 模式 |

---

## 6. 假设与约束

- 假设 `npm run build:lib` 已执行且 dist/ 目录包含完整编译产物
- 假设后端服务运行在 `http://localhost:9999`
- 假设 MySQL 数据库可用（host.docker.internal:3306）
- 约束：Test.vue 不得直接引用 `src/` 下的任何源码文件
- 约束：test.html 不依赖 JAR 模式的 `/magic/web/config-js` 脚本
