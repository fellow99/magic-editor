# ARCHITECTURE.md — magic-editor 系统架构

> 反向归纳自源代码（Vue 3 SPA / 单一根组件 / 双交付形态）。所有架构论断附路径行号。

## 1. 系统定位

magic-editor 是 **magic-api 后端的控制面 SPA**：
- 浏览器中渲染编辑器（基于 monaco）
- 通过 HTTP 操作后端的脚本资源、函数、数据源
- 通过 WebSocket 接收调试日志/断点事件

**不持有业务数据**，所有真相在后端 magic-api。

## 2. 架构层（自顶向下）

```
┌────────────────────────────────────────────────────────────┐
│  Layer 5：交付层（Delivery）                                 │
│   - 应用模式 (dist-app/)：jar 内嵌 → /magic/web 访问         │
│   - 库模式 (dist/)：NPM 包 magic-editor → 宿主 Vue3 工程     │
├────────────────────────────────────────────────────────────┤
│  Layer 4：根组件 + 配置注入                                  │
│   - App.vue → <MagicEditor :config="...">                  │
│   - 配置源：parent.MAGIC_EDITOR_CONFIG / window.* / 默认值   │
├────────────────────────────────────────────────────────────┤
│  Layer 3：UI 组件层                                          │
│   - layout/  顶部 + 底部 + 状态条 + 登录覆盖层                │
│   - resources/  接口/函数/数据源/最近打开（左侧资源栏）       │
│   - editor/  monaco 编辑器宿主 + 调试 UI                     │
│   - common/  通用 UI（modal/contextmenu/loading/tree/...）   │
├────────────────────────────────────────────────────────────┤
│  Layer 2：领域脚本层（scripts/）                              │
│   - parsing/  magic-script lexer + parser + AST              │
│   - editor/   monaco 语言服务（completion/hover/.../mybatis）│
│   - workers/  monaco web worker (editor / json)              │
│   - beautifier/  格式化器                                    │
├────────────────────────────────────────────────────────────┤
│  Layer 1：基础设施层                                         │
│   - api/request.js   HTTP（axios + Qs + 自定义 Header）      │
│   - scripts/websocket.js  WS 事件分发（ReconnectingWebSocket）│
│   - scripts/bus.js   全局 EventBus                           │
│   - scripts/store.js localStorage 偏好存储                   │
│   - scripts/contants.js  全局可变常量（运行期注入）          │
│   - scripts/hotkey.js  全局快捷键                            │
│   - scripts/utils.js  通用工具                               │
└────────────────────────────────────────────────────────────┘
```

## 3. 关键架构决策

### 3.1 单一组件 + 配置注入（Layer 4）

**位置**：`src/components/magic-editor.vue:64-189`

- `props.config` 是**唯一**入口；`beforeMount` 钩子将 config 灌入全局 `contants` 对象（`magic-editor.vue:106-155`）
- 通过 `request.getAxios().interceptors` 注入用户自定义请求/响应钩子（`magic-editor.vue:156-183`）
- 主题通过 `defineTheme(...)` 注册（`magic-editor.vue:184-188`）

**含义**：所有跨模块配置都通过 `contants` 模块单例共享，相当于一个"全局只读配置中心"。

### 3.2 双通信通道（Layer 1）

| 通道 | 职责 | 实现 | 触发点 |
|---|---|---|---|
| HTTP | CRUD + 运行 + 编译 | axios + qs，form-urlencoded 编码 | 各 `magic-*-list.vue` |
| WebSocket | 调试 + 日志 + 在线状态 | ReconnectingWebSocket，自定义文本协议 `msgType,content` | `magic-editor.vue:117` |

**WS 协议**：
- 客户端发送：`bus.$emit('message', msgType[, content])` → `socket.send('msgType,content')`（`websocket.js:7-13`）
- 服务端返回：`msgType,arg1,arg2,...,jsonPayload` → 解析后 `bus.$emit('ws_'+msgType, args)`（`websocket.js:24-39`）

**触发流程**：`onLogin` → `bus.$emit('login')` → 创建 WS（`magic-editor.vue:116-118`） → `ws_open` 触发 `bus.$emit('message', 'login', token)`（`magic-editor.vue:119`）

### 3.3 EventBus 即应用骨架（Layer 1）

**位置**：`src/scripts/bus.js`

- 自实现极简 EventBus，**不引入** Vuex/Pinia
- 所有跨组件消息走 bus：登录/登出、状态条更新、文件保存、调试控制、定位资源等
- WebSocket 透明转发：`ws_<msgType>` 命名空间约定（`websocket.js:39`）

**关键事件清单**（来自 `magic-editor.vue`）：
- `showLogin` / `logout` / `login` — 鉴权流转
- `doSave` / `doTest` / `doContinue` / `doStepInto` — 快捷键命令
- `position-api` / `position-function` — 资源跳转
- `search-open` — 全局搜索打开
- `update-window-size` — 布局变化
- `status` — 状态条日志（`bus.js:49-54` 还会持久化到 statusLog 数组）
- `report` — 第三方埋点（cnzz）

### 3.4 monaco 集成（Layer 2/3）

**集成方式**：
- `MonacoEnvironment.getWorker` 通过 Vite `?worker` 加载（`magic-editor.vue:56-63`）
- 自定义语言：`magic-script`（`scripts/editor/magic-script.js`）+ MyBatis 支持（`scripts/editor/mybatis.js` 1419 行）
- 语言服务模块化：completion / hover / signature / folding / high-light / theme

**自研解析器**（`scripts/parsing/`）：
- `tokenizer.js` (365 行) — lexer
- `parser.js` (954 行) — 语法解析
- `ast.js` (735 行) — AST 节点定义
- `index.js` (552 行) — 入口/工具

### 3.5 双构建产物（Layer 5）

**位置**：`vite.config.js:118-207`

```
mode === 'lib'（npm run build:lib）：
  dist/{magic-editor.umd.js, magic-editor.es.js, magic-editor.css}
  external: ['vue']
  formats: ['umd', 'es']

mode 默认（npm run build）：
  dist-app/  # jar 内嵌静态资源
  完整 SPA bundle（含 vue 运行时）
```

**自定义 Vite 插件**：`monacoEditorLocalesPlugin`（`vite.config.js:7-116`）
- 在构建期改写 monaco 的 `esm/vs/nls.js`，将 `localize(data, message, ...args)` 改为索引化查找
- 支持 `zh-cn` / `en`（来自 `plugins/editor.main.nls.{zh-cn,en}.js`）

## 4. 数据流（典型场景）

### 4.1 启动 → 登录 → 加载资源

```
1. App.vue 挂载 → 解析配置 → <MagicEditor :config>
2. MagicEditor.beforeMount → contants 灌入
3. MagicEditor.mounted →
   a. JavaClass.initClasses() / initImportClass()
   b. loadConfig() → GET /config.json
   c. login() → GET /login → success → onLogin()
   d. checkUpdate() → fetch maven-metadata
4. onLogin() →
   a. apiList.initData() / functionList.initData() / datasourceList.initData()  并行
   b. bus.$emit('login') → 创建 MagicWebSocket
5. WS open → bus.$emit('message', 'login', token)
```

### 4.2 编辑 → 保存 → 测试

```
1. monaco 编辑 → magic-script 解析 → 实时诊断
2. Ctrl+S → bus.$emit('doSave') → magic-script-editor 监听 → POST /save
3. Ctrl+Q → bus.$emit('doTest') → 拼装 RequestConfig → POST /run
4. 命中断点 → WS ws_breakpoint → magic-script-editor 显示
5. F8 / F6 → bus.$emit('doContinue' / 'doStepInto') → bus.$emit('message', '继续/单步')
```

## 5. 模块依赖图（粗粒度）

```
                ┌────────────────┐
                │  magic-editor  │  ← 根组件
                └─┬────┬────┬───┘
        ┌────────┘    │    └────────┐
        ▼             ▼             ▼
   ┌────────┐  ┌──────────┐  ┌──────────┐
   │ layout │  │ resources│  │  editor  │
   └───┬────┘  └────┬─────┘  └────┬─────┘
       │            │             │
       └────────┬───┴─────────────┘
                ▼
         ┌──────────────┐
         │   common/    │（modal / tree / contextmenu / ...）
         └──────┬───────┘
                ▼
         ┌──────────────────────────────────────┐
         │  scripts/                            │
         │  ├─ parsing/  ├─ editor/  ├─ workers/│
         │  ├─ bus.js   ├─ websocket.js         │
         │  ├─ contants.js  ├─ store.js         │
         │  ├─ hotkey.js   ├─ utils.js          │
         │  └─ beautifier/                      │
         └────────────┬─────────────────────────┘
                      ▼
                ┌──────────┐
                │ api/     │  request.js (axios)
                └──────────┘
```

依赖方向严格自上而下；下层模块**不得**反向依赖上层（但 `bus.js` 是全局单例，所有层都可访问）。

## 6. 跨切关注点

| 关注点 | 实现位置 | 说明 |
|---|---|---|
| **鉴权** | `request.js:151-153` + `bus.js` `showLogin` | 401 自动弹登录覆盖层 |
| **国际化** | `vite.config.js:monacoEditorLocalesPlugin` + `plugins/editor.main.nls.*.js` | 仅 monaco 文案；自有 UI 文案为中文硬编码 |
| **错误反馈** | `modal.magicAlert` + `magicConfirm` | 统一弹框 |
| **快捷键** | `scripts/hotkey.js` + `magic-editor.vue:247-257` | 全局绑定容器元素 |
| **状态日志** | `bus.js:49-54` `bus.$getStatusLog` | 内存数组，无后端持久化 |
| **埋点** | `bus.js:28-48` cnzz 异步 script | 见 C-002 待澄清 |
| **版本检测** | `magic-editor.vue:315-347` | 前后端版本比对 + maven-metadata 拉取 |
| **主题** | `scripts/editor/{default,dark}-theme.js` + `defineTheme` | 自定义主题通过 config.themes 注册 |

## 7. 已识别架构风险

| ID | 风险 | 影响 | 关联条款 |
|---|---|---|---|
| R-001 | axios 0.21 已知 CVE | 中 | C-003 |
| R-002 | bus.js 内置第三方统计上报 | 隐私/合规 | C-002 |
| R-003 | 双构建产物缺乏 CI 验证 | 发版可靠性 | constitution E-002 |
| R-004 | EventBus 全局事件无类型，命名冲突风险 | 维护性 | — |
| R-005 | monaco 0.29.x 与现代版本差距大，nls 注入方式与新版不兼容 | 升级阻塞 | constitution 第七条 |
| R-006 | WS 协议为自定义文本（无版本号），后端协议变更将无声破坏 | 协议演进 | — |

## 8. 部署形态

```
┌─────────────────────────────────────────────────────┐
│  浏览器 (SPA)                                        │
│  ┌──────────────┐    HTTP    ┌────────────────────┐ │
│  │ magic-editor │◄──────────►│ magic-api 后端     │ │
│  │ (Vue 3)      │            │ (Spring Boot Jar)  │ │
│  │              │    WS      │                    │ │
│  │              │◄──────────►│  /magic/web/console│ │
│  └──────────────┘            └────────────────────┘ │
└─────────────────────────────────────────────────────┘

应用模式：magic-editor 静态资源打入 magic-editor.jar 资源目录
            后端通过 /magic/web 路径返回 index.html
库模式：    宿主工程 `npm i magic-editor` → 自管 baseURL/serverURL
```
