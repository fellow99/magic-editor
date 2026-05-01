# TECH.md — 技术栈与版本基准

> 本文为事实基线，所有版本号源自 `package.json` 与源代码导入语句。

## 1. 运行时与语言

| 维度 | 选择 | 来源 |
| --- | --- | --- |
| 前端框架 | Vue 3.4.x（Composition + Options 混用） | `package.json:dependencies.vue` |
| 模块格式 | ES Modules（构建产物提供 UMD + ES） | `vite.config.js:lib.formats` |
| 语言 | JavaScript（无 TypeScript） | 源码 `.js`/`.vue`，无 `.ts` |
| Node 端 | 由开发者自行管理（无 `engines` 约束） | `package.json` |

## 2. 构建工具链

| 工具 | 版本 | 用途 |
| --- | --- | --- |
| Vite | ^5.4.21 | 开发服务器 + 生产构建 |
| @vitejs/plugin-vue | ^5.2.4 | `.vue` SFC 处理 |
| 自定义插件 `monacoEditorLocalesPlugin` | inline | 替换 `esm/vs/nls.js` 中的 `localize`，将索引化的中文/英文语言包注入 monaco |
| Babel | 由 `babel.config.js` 控制 | ESLint 解析回退（`@babel/eslint-parser`） |
| ESLint | ^8.56.0 | 代码风格（`plugin:vue/vue3-essential`、`eslint:recommended`） |
| eslint-plugin-vue | ^9.21.0 | Vue 规则 |
| vue-eslint-parser | ^9.4.0 | `.vue` 文件 ESLint 解析 |

### 2.1 构建模式

| 模式 | 命令 | 入口 | 产物 | 备注 |
| --- | --- | --- | --- | --- |
| 开发 | `npm run serve` | `index.html` → `src/main.js` | dev server | `server.host=true`、`server.open=false` |
| 应用 | `npm run build` | `index.html` → `src/main.js` | `dist-app/` | 资源拆分到 `js/` `css/` `assets/`，含 hash |
| 库 | `npm run build:lib` | `src/index.js` | `dist/` | UMD + ES，外部化 `vue`，CSS 强制命名 `magic-editor.css` |

## 3. 运行时依赖

| 包 | 版本 | 用途 | 注意 |
| --- | --- | --- | --- |
| `vue` | ^3.4.0 | 视图层 | 库模式下作为 `external` |
| `monaco-editor` | ^0.29.1 | 代码编辑器内核 | 通过 `editor.worker.js`/`json.worker.js` 启用 web worker；自定义 i18n 注入 |
| `axios` | ^0.21.0 | HTTP 客户端 | ⚠️ 版本陈旧，存在已知 CVE（C-003） |
| `qs` | ^6.9.4 | `application/x-www-form-urlencoded` 序列化 | request.js 默认 transformRequest |

## 4. 内置（in-tree）非 npm 依赖

| 模块 | 路径 | 说明 |
| --- | --- | --- |
| ReconnectingWebSocket | `src/scripts/reconnecting-websocket.js` | 第三方实现，提供自动重连 |
| js-beautify (节选) | `src/scripts/beautifier/{core,javascript}` | 用于 `utils.js:Beautifier`，格式化输出 |
| monaco i18n 包 | `plugins/editor.main.nls.{zh-cn,en}.js` | monaco 全量语言包字面量 |

## 5. 后端契约（前端视角）

| 维度 | 默认值 | 说明 |
| --- | --- | --- |
| baseURL | `/magic/web`（jar 模式） / `http://localhost:9999/magic/web`（库模式） | HTTP 接口前缀 |
| serverURL | 同上去掉 `/magic/web` 部分 | 调试运行时的"实际接口路径" |
| WebSocket | `${baseURL}/console`（推断自源码 `WEBSOCKET_SERVER`） | 调试/日志通道 |
| 鉴权 Header | `magic-token` | `HEADER_MAGIC_TOKEN` |
| 会话 Header | `Magic-Request-Session` | 调试会话绑定 |
| 断点 Header | `Magic-Request-Breakpoints` | 调试断点列表 |
| 响应 Content-Type | `Magic-Api-Response` 头：`ma-content-type` | 区分 JSON / debug / 二进制 |

## 6. 关键运行时常量

来源：`src/scripts/contants.js`

| 常量 | 默认 | 含义 |
| --- | --- | --- |
| `BASE_URL` | `/magic/web` | HTTP 接口前缀 |
| `SERVER_URL` | `http://localhost:9999/` | "实际运行后端"地址 |
| `WEBSOCKET_SERVER` | `ws://localhost:9999/magic/web/console` | WS 调试通道 |
| `EDITOR_FONT_FAMILY` | `Consolas, 'Courier New', monospace` | 编辑器字体 |
| `EDITOR_FONT_SIZE` | `14` | 编辑器字号 |
| `AUTO_SAVE` | `true` | 自动保存开关 |
| `RESPONSE_CODE_DEBUG` | `1000` | 调试响应码 |
| `RESPONSE_NO_PERMISSION` | `-10` | 无权限码（触发 401 流程） |

## 7. 浏览器目标

未配置 `browserslist`，按 Vite 5 默认值：现代浏览器（ES2020 起）。monaco-editor 0.29 自身要求支持 Web Workers、WASM 与 ES2017+。

## 8. 已知技术债务

- **axios 0.21.x**：存在 CVE-2021-3749 等问题，建议升级至 1.x（C-003）。
- **第三方统计上报**：`bus.js` 含写死的 cnzz 统计脚本注入，应评估是否仍合规（C-002）。
- **`src/api/web.js` 空文件**：未确定意图（C-001）。
- **monaco i18n 自实现**：依赖 monaco 内部 `esm/vs/nls.js` 的具体实现，升级 monaco 主版本可能破坏自定义 plugin。
