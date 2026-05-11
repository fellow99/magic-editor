# STRUCTURE.md — magic-editor 工程目录结构

> 本文件由 opus-specs-as-built 流程基于源代码反向生成，作为后续规范文档撰写的事实基准。
> 扫描时已忽略所有以 `.` 开头的目录（`.git`、`.idea` 等）。

## 1. 顶层目录

```
magic-editor/
├── README.md                       项目说明（中文，简要功能与集成方式）
├── LICENSE
├── package.json                    Vue 3.4 + Vite 5 + monaco-editor 0.29.1
├── package-lock.json
├── vite.config.js                  Vite 配置 + 自定义 monacoEditorLocalesPlugin
├── babel.config.js
├── jsconfig.json
├── index.html                      Vite SPA 入口模板
├── test.html                       Vite MPA 入口模板（库模式测试页）
├── public/                         静态资源（favicon 等）
├── plugins/                        Vite 自定义插件 + monaco i18n 资源
├── src/                            前端主源码
├── dist/                           Vite 构建产物（库模式 build:lib）
├── dist-app/                       Vite 构建产物（应用模式 build）
└── specs/                          ← 本规范文档目录
```

### 1.1 plugins/

```
plugins/
├── MonacoEditorLocalesPlugin.js    替换 monaco 内置 localize() 实现，注入语言包
├── editor.main.nls.zh-cn.js        中文语言包（monaco 全量 key）
└── editor.main.nls.en.js           英文语言包
```

### 1.2 public/

```
public/
└── favicon.png
```

## 2. src/ 源码目录

```
src/
├── App.vue                         开发壳组件，注入 MAGIC_EDITOR_CONFIG
├── main.js                         开发模式入口（createApp）
├── test.js                         库模式测试页入口（createApp + app.use(install)）
├── Test.vue                        库模式测试页组件（import MagicEditor from 'magic-editor'）
├── index.js                        NPM 库模式入口（install() 注册 magic-editor）
├── api/                            HTTP 层
├── assets/                         图标字体与图片
├── components/                     全部 Vue 组件
├── plugins/                        （空目录占位）
└── scripts/                        非组件 JS 模块（脚本/解析器/编辑器服务/工具/通信）
```

### 2.1 src/api/

```
api/
├── request.js                      axios + qs 封装，HttpResponse 链式 success/error/end
└── web.js                          [NEEDS CLARIFICATION] 当前为空文件
```

### 2.2 src/assets/

```
assets/
├── iconfont/                       自定义图标字体（iconfont.css/.eot/.svg/.ttf/.woff）
└── images/                         位图资源（logo、占位图等）
```

### 2.3 src/components/

#### 2.3.1 components/（根组件）

```
components/
├── magic-editor.vue                主组件（448 行）：toolbar + middle + options + status-bar + login overlay
├── common/                         通用 UI 组件
├── editor/                         代码编辑器组件
├── layout/                         布局/功能面板组件
└── resources/                      资源列表组件（API/Function/Datasource/Recent）
```

#### 2.3.2 components/common/

```
common/
├── magic-bottom-panel.vue          底部面板容器
├── magic-checkbox.vue              复选框
├── magic-file.vue                  文件选择
├── magic-input.vue                 输入框
├── magic-json.vue                  JSON 视图
├── magic-json-tree.vue             JSON 树
├── magic-json-tree-format.vue      JSON 树（格式化）
├── magic-loading.vue               全局加载遮罩
├── magic-select.vue                下拉选择
├── magic-structure.vue             结构编辑
├── magic-structure-array.vue       结构（数组）
├── magic-structure-object.vue      结构（对象）
├── magic-textarea.vue              多行输入
├── magic-text-icon.vue             图标 + 文本
├── magic-tree.vue                  树
├── magic-tree-item.vue             树节点
├── magic-contextmenu/              右键菜单子组件包
│   ├── Contextmenu.vue
│   ├── Submenu.vue
│   └── util.js
└── modal/                          模态框子组件包
    ├── alert.vue
    ├── confirm.vue
    └── dialog.vue
```

#### 2.3.3 components/editor/

```
editor/
├── magic-script-editor.vue         monaco 编辑器封装（含语法/补全/调试集成，约 37 KB）
└── magic-history.vue               脚本历史版本浏览
```

#### 2.3.4 components/layout/

```
layout/
├── magic-header.vue                顶部导航/菜单/帐号
├── magic-status-bar.vue            底部状态栏
├── magic-options.vue               底部选项卡容器（包裹 option 子页）
├── magic-option.vue                单个底部选项卡
├── magic-request.vue               请求配置面板（参数/Header/Body/路径）
├── magic-run.vue                   运行结果面板
├── magic-debug.vue                 调试面板（断点/变量/步进）
├── magic-log.vue                   日志面板
├── magic-search.vue                全局搜索面板
├── magic-settings.vue              编辑器/系统设置面板
├── magic-todo.vue                  TODO 列表
├── magic-event.vue                 事件
├── magic-group.vue                 分组管理
├── magic-function.vue              函数定义编辑
└── magic-login.vue                 登录覆盖层
```

#### 2.3.5 components/resources/

```
resources/
├── magic-api-list.vue              API 资源树
├── magic-function-list.vue         函数资源树
├── magic-datasource-list.vue       数据源资源树
├── magic-group-choose.vue          分组选择对话框
├── magic-resource-choose.vue       资源选择对话框
├── magic-recent-opened.vue         最近打开列表
└── magic-resource.css              资源面板共用样式
```

### 2.4 src/scripts/

```
scripts/
├── contants.js                     全局常量与 baseURL/serverURL/header 名/响应码
├── bus.js                          mitt EventBus + report/status/cnzz 上报
├── store.js                        localStorage 封装（Storage 工厂）
├── hotkey.js                       全局快捷键注册/分发
├── utils.js                        formatJson / formatDate / download / requestGroup / Beautifier
├── websocket.js                    业务 WebSocket 封装（依赖 reconnecting-websocket）
├── reconnecting-websocket.js       第三方自动重连 WebSocket 实现
├── parsing/                        magic-script 自研解析器
│   ├── tokenizer.js                词法分析
│   ├── ast.js                      AST 节点定义
│   ├── parser.js                   语法分析
│   └── index.js                    入口、对外 API
├── editor/                         monaco 语言服务
│   ├── magic-script.js             magic-script monaco language 注册
│   ├── mybatis.js                  MyBatis 语法支持（约 1419 行）
│   ├── completion.js               补全
│   ├── hover.js                    悬停提示
│   ├── signature.js                方法签名
│   ├── high-light.js               同名高亮
│   ├── folding.js                  代码折叠
│   ├── java-class.js               Java 类元信息缓存
│   ├── request-parameter.js        请求参数补全
│   ├── default-theme.js            浅色主题
│   ├── dark-theme.js               深色主题
│   └── theme.js                    主题切换入口
├── workers/                        monaco WebWorker
│   ├── editor.worker.js
│   └── json.worker.js
└── beautifier/                     代码美化（fork 自 js-beautify）
    ├── core/
    └── javascript/
```

## 3. 路由 / 页面清单

magic-editor 是 **单页面无路由 SPA**：

- 未引入 `vue-router`、`vuex`、`pinia` 等任何路由/全局状态库（见 `package.json` dependencies）。
- 顶层只有一个组件 `magic-editor.vue`，所有"页面切换"通过：
  - **左侧 toolbar**（API / Function / Datasource）切换资源类型；
  - **底部 options 选项卡**（Request / Run / Debug / Log / Search / Settings / TODO …）切换功能面板；
  - **中部脚本编辑器**根据选中资源动态加载内容。
- 可通过注入 `window.MAGIC_EDITOR_CONFIG`（或 `parent.MAGIC_EDITOR_CONFIG`）覆盖：
  - `baseURL`：前端基址（默认 `/magic/web`）
  - `serverURL`：后端基址（默认 `http://localhost:9999/magic/web`）
  - `inJar`：是否以 jar 包嵌入运行模式

> 因此 STRUCTURE 不存在传统意义上的 "路由表 / 页面清单"，仅有上述视图区域的状态切换。

## 4. 集成模式

| 模式 | 入口文件 | 构建命令 | 产物目录 |
| --- | --- | --- | --- |
| 开发调试 | `src/main.js` | `npm run serve` | （开发服务器） |
| 应用打包 | `src/main.js` + `index.html` | `npm run build` | `dist-app/` |
| NPM 库 | `src/index.js` (`install()`) | `npm run build:lib` | `dist/` |
| 库模式测试 | `src/test.js` + `test.html` | `npm run serve`（alias `magic-editor` → `dist/`） | （开发服务器） |
| jar 内嵌 | 由 magic-api 后端直接托管 `dist-app/` | （后端构建） | jar 内静态资源 |

## 5. 后续模块文档划分

为便于规范文档维护，将工程划分为 16 个功能模块，目录命名 `XXX-<一级模块>-<二级模块>/`：

| 编号 | 目录 | 范围 |
| --- | --- | --- |
| 001 | `001-editor-core/` | `components/editor/magic-script-editor.vue` 主编辑器集成 |
| 002 | `002-editor-history/` | `components/editor/magic-history.vue` 脚本历史 |
| 003 | `003-resources-api/` | API 资源列表 |
| 004 | `004-resources-function/` | 函数资源列表 |
| 005 | `005-resources-datasource/` | 数据源资源列表 |
| 006 | `006-resources-recent/` | 最近打开 + 资源/分组选择对话框 |
| 007 | `007-layout-header/` | header / status-bar / login |
| 008 | `008-layout-request/` | request / run / 函数 / 事件 / 分组 |
| 009 | `009-layout-debug/` | debug / log |
| 010 | `010-layout-options/` | options / option / search / settings / todo |
| 011 | `011-script-parser/` | `scripts/parsing/*` 自研解析器 |
| 012 | `012-script-language/` | `scripts/editor/*` monaco 语言服务（除 mybatis） |
| 013 | `013-script-mybatis/` | `scripts/editor/mybatis.js` |
| 014 | `014-infra-transport/` | `api/request.js` + `scripts/websocket.js` + `reconnecting-websocket.js` |
| 015 | `015-infra-bus-store/` | `bus.js` / `store.js` / `contants.js` / `hotkey.js` / `utils.js` / `beautifier/` |
| 016 | `016-common-ui/` | `components/common/*` 通用 UI 组件库 |
| 101 | `101-magic-api-2.2.2/` | magic-api 后端 2.2.2 适配 |
| 102 | `102-test-lib/` | `test.html` + `src/test.js` + `src/Test.vue` 库模式测试页 |
