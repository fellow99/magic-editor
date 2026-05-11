# 规格文档索引

**项目名称：** magic-editor  
**版本：** 5.5.3  
**技术栈：** Vue 3.4 + TypeScript + Monaco Editor 0.29.1 + Vite 5  
**文档生成时间：** 2026-05-04  
**最后更新：** 2026-05-05

---

## 一、文档总览

| 层级 | 分类 | 文档数量 | 说明 |
|------|------|---------|------|
| 整体 | 项目级顶层文档 | 10 | 架构、技术、宪法等全局文档 |
| 整体 | 整体规格文档 | 5 | overall-* 系列文档 |
| 模块 | 编辑器核心模块 | 2 | 001~002 共 2 个功能模块 |
| 模块 | 资源管理模块 | 4 | 003~006 共 4 个功能模块 |
| 模块 | 布局与面板模块 | 4 | 007~010 共 4 个功能模块 |
| 模块 | 脚本引擎模块 | 3 | 011~013 共 3 个功能模块 |
| 模块 | 基础设施模块 | 2 | 014~015 共 2 个功能模块 |
| 模块 | 通用 UI 模块 | 1 | 016 通用组件 |
| 特殊 | magic-api 集成 | 1 | 101 magic-api 2.2.2 集成规格 |
| 特殊 | 库模式验证 | 1 | 102 库模式测试页验证 |
| **合计** | **18 目录 / 55+ 文件** | | |

---

## 二、项目级顶层文档

全局性的架构、技术、宪法等文档，定义项目基线和开发准则。

| 文档 | 路径 | 说明 |
|------|------|------|
| **架构总纲** | [ARCHITECTURE.md](./ARCHITECTURE.md) | 系统整体架构设计：5 层架构、数据流、交付形态 |
| **技术选型** | [TECH.md](./TECH.md) | 核心技术栈选型理由、版本、依赖说明 |
| **宪法原则** | [constitution.md](./constitution.md) | 项目开发原则、编码规范、治理规则 |
| **项目结构** | [STRUCTURE.md](./STRUCTURE.md) | 源码目录结构、组件清单、脚本清单 |
| **API 清单** | [overall-api.md](./overall-api.md) | 全量 API 接口清单、请求参数与响应格式 |
| **检查清单** | [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md) | 规格文档完成度追踪，50+ 份文档的完成状态 |

---

## 三、整体规格文档

描述跨模块的全局规格、方案和数据模型。

| 文档 | 路径 | 说明 |
|------|------|------|
| **整体规格** | [overall-spec.md](./overall-spec.md) | 系统级功能规格：核心特性、用户故事、非功能需求 |
| **整体方案** | [overall-plan.md](./overall-plan.md) | 系统级技术方案：选型理由、架构决策、关键技术实现 |
| **数据模型** | [overall-data-model.md](./overall-data-model.md) | 全局数据实体定义：核心类型、枚举、实体关系 |
| **接口模型** | [overall-api.md](./overall-api.md) | 全局 API 规范：请求/响应格式、认证机制、错误码 |
| **测试用例索引** | [overall-test-cases.md](./overall-test-cases.md) | 全模块测试用例索引总览 |

---

## 四、编辑器核心模块（001 ~ 002）

### 001 — 编辑器核心 (Editor Core)

> Monaco 编辑器集成：代码编辑、语法高亮、补全、调试 UI 集成。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [001-editor-core/spec.md](./001-editor-core/spec.md) | 编辑器核心功能规格 |
| 技术方案 | [001-editor-core/plan.md](./001-editor-core/plan.md) | 编辑器核心技术实现方案 |
| 测试用例 | [001-editor-core/test-cases.md](./001-editor-core/test-cases.md) | 编辑器核心 UI 功能测试用例 |

---

### 002 — 编辑器历史 (Editor History)

> 脚本历史版本管理：历史版本浏览、对比、恢复。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [002-editor-history/spec.md](./002-editor-history/spec.md) | 编辑器历史功能规格 |
| 技术方案 | [002-editor-history/plan.md](./002-editor-history/plan.md) | 编辑器历史技术实现方案 |
| 测试用例 | [002-editor-history/test-cases.md](./002-editor-history/test-cases.md) | 编辑器历史 UI 功能测试用例 |

---

## 五、资源管理模块（003 ~ 006）

### 003 — API 资源管理 (Resources API)

> API 接口资源管理：接口列表、树形展示、分组、创建/编辑/删除。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [003-resources-api/spec.md](./003-resources-api/spec.md) | API 资源管理功能规格 |
| 技术方案 | [003-resources-api/plan.md](./003-resources-api/plan.md) | API 资源管理技术实现方案 |
| 测试用例 | [003-resources-api/test-cases.md](./003-resources-api/test-cases.md) | API 资源管理 UI 功能测试用例 |

---

### 004 — 函数资源管理 (Resources Function)

> 全局函数资源管理：函数列表、树形展示、分组、创建/编辑/删除。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [004-resources-function/spec.md](./004-resources-function/spec.md) | 函数资源管理功能规格 |
| 技术方案 | [004-resources-function/plan.md](./004-resources-function/plan.md) | 函数资源管理技术实现方案 |
| 测试用例 | [004-resources-function/test-cases.md](./004-resources-function/test-cases.md) | 函数资源管理 UI 功能测试用例 |

---

### 005 — 数据源管理 (Resources Datasource)

> 数据源连接管理：数据源列表、树形展示、创建/编辑/删除、连接测试。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [005-resources-datasource/spec.md](./005-resources-datasource/spec.md) | 数据源管理功能规格 |
| 技术方案 | [005-resources-datasource/plan.md](./005-resources-datasource/plan.md) | 数据源管理技术实现方案 |
| 测试用例 | [005-resources-datasource/test-cases.md](./005-resources-datasource/test-cases.md) | 数据源管理 UI 功能测试用例 |

---

### 006 — 最近打开管理 (Resources Recent)

> 最近打开资源管理：最近打开列表、资源选择对话框、分组选择对话框。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [006-resources-recent/spec.md](./006-resources-recent/spec.md) | 最近打开管理功能规格 |
| 技术方案 | [006-resources-recent/plan.md](./006-resources-recent/plan.md) | 最近打开管理技术实现方案 |
| 测试用例 | [006-resources-recent/test-cases.md](./006-resources-recent/test-cases.md) | 最近打开管理 UI 功能测试用例 |

---

## 六、布局与面板模块（007 ~ 010）

### 007 — 头部布局 (Layout Header)

> 顶部导航栏：菜单导航、状态栏、帐号登录、登录覆盖层。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [007-layout-header/spec.md](./007-layout-header/spec.md) | 头部布局功能规格 |
| 技术方案 | [007-layout-header/plan.md](./007-layout-header/plan.md) | 头部布局技术实现方案 |
| 测试用例 | [007-layout-header/test-cases.md](./007-layout-header/test-cases.md) | 头部布局 UI 功能测试用例 |

---

### 008 — 请求配置面板 (Layout Request)

> 请求配置与运行：参数配置、Header 配置、Body 配置、路径配置、运行结果展示。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [008-layout-request/spec.md](./008-layout-request/spec.md) | 请求配置面板功能规格 |
| 技术方案 | [008-layout-request/plan.md](./008-layout-request/plan.md) | 请求配置面板技术实现方案 |
| 测试用例 | [008-layout-request/test-cases.md](./008-layout-request/test-cases.md) | 请求配置面板 UI 功能测试用例 |

---

### 009 — 调试面板 (Layout Debug)

> 脚本调试功能：断点设置、变量查看、步进调试、日志面板。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [009-layout-debug/spec.md](./009-layout-debug/spec.md) | 调试面板功能规格 |
| 技术方案 | [009-layout-debug/plan.md](./009-layout-debug/plan.md) | 调试面板技术实现方案 |
| 测试用例 | [009-layout-debug/test-cases.md](./009-layout-debug/test-cases.md) | 调试面板 UI 功能测试用例 |

---

### 010 — 选项面板 (Layout Options)

> 底部选项卡容器：选项卡管理、全局搜索、系统设置、TODO 列表。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [010-layout-options/spec.md](./010-layout-options/spec.md) | 选项面板功能规格 |
| 技术方案 | [010-layout-options/plan.md](./010-layout-options/plan.md) | 选项面板技术实现方案 |
| 测试用例 | [010-layout-options/test-cases.md](./010-layout-options/test-cases.md) | 选项面板 UI 功能测试用例 |

---

## 七、脚本引擎模块（011 ~ 013）

### 011 — 脚本解析器 (Script Parser)

> magic-script 自研解析器：词法分析、语法分析、AST 节点定义。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [011-script-parser/spec.md](./011-script-parser/spec.md) | 脚本解析器功能规格 |
| 技术方案 | [011-script-parser/plan.md](./011-script-parser/plan.md) | 脚本解析器技术实现方案 |
| 测试用例 | [011-script-parser/test-cases.md](./011-script-parser/test-cases.md) | 脚本解析器功能测试用例 |

---

### 012 — 脚本语言服务 (Script Language)

> Monaco 语言服务：语法高亮、代码补全、悬停提示、方法签名、代码折叠。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [012-script-language/spec.md](./012-script-language/spec.md) | 脚本语言服务功能规格 |
| 技术方案 | [012-script-language/plan.md](./012-script-language/plan.md) | 脚本语言服务技术实现方案 |
| 测试用例 | [012-script-language/test-cases.md](./012-script-language/test-cases.md) | 脚本语言服务功能测试用例 |

---

### 013 — MyBatis 语法支持 (Script MyBatis)

> MyBatis XML 语法支持：MyBatis 标签补全、语法高亮、错误提示。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [013-script-mybatis/spec.md](./013-script-mybatis/spec.md) | MyBatis 语法支持功能规格 |
| 技术方案 | [013-script-mybatis/plan.md](./013-script-mybatis/plan.md) | MyBatis 语法支持技术实现方案 |
| 测试用例 | [013-script-mybatis/test-cases.md](./013-script-mybatis/test-cases.md) | MyBatis 语法支持功能测试用例 |

---

## 八、基础设施模块（014 ~ 015）

### 014 — 通信传输 (Infra Transport)

> HTTP + WebSocket 通信：axios 封装、WebSocket 封装、自动重连、事件分发。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [014-infra-transport/spec.md](./014-infra-transport/spec.md) | 通信传输功能规格 |
| 技术方案 | [014-infra-transport/plan.md](./014-infra-transport/plan.md) | 通信传输技术实现方案 |
| 测试用例 | [014-infra-transport/test-cases.md](./014-infra-transport/test-cases.md) | 通信传输功能测试用例 |

---

### 015 — 总线与存储 (Infra Bus Store)

> 基础设施工具：EventBus、localStorage 存储、全局常量、快捷键、工具函数、代码美化器。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [015-infra-bus-store/spec.md](./015-infra-bus-store/spec.md) | 总线与存储功能规格 |
| 技术方案 | [015-infra-bus-store/plan.md](./015-infra-bus-store/plan.md) | 总线与存储技术实现方案 |
| 测试用例 | [015-infra-bus-store/test-cases.md](./015-infra-bus-store/test-cases.md) | 总线与存储功能测试用例 |

---

## 九、通用 UI 模块（016）

### 016 — 通用 UI 组件 (Common UI)

> 通用 UI 组件库：输入框、下拉框、树形组件、模态框、右键菜单、JSON 视图、底部面板等。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [016-common-ui/spec.md](./016-common-ui/spec.md) | 通用 UI 组件功能规格 |
| 技术方案 | [016-common-ui/plan.md](./016-common-ui/plan.md) | 通用 UI 组件技术实现方案 |
| 测试用例 | [016-common-ui/test-cases.md](./016-common-ui/test-cases.md) | 通用 UI 组件功能测试用例 |

---

## 十、magic-api 集成模块（101）

### 101 — magic-api 2.2.2 集成

> magic-api 后端集成规格：API 接口契约、WebSocket 事件契约、版本兼容性。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [101-magic-api-2.2.2/spec.md](./101-magic-api-2.2.2/spec.md) | magic-api 集成规格 |
| 技术方案 | [101-magic-api-2.2.2/plan.md](./101-magic-api-2.2.2/plan.md) | magic-api 集成技术方案 |
| 任务分解 | [101-magic-api-2.2.2/tasks.md](./101-magic-api-2.2.2/tasks.md) | 开发任务分解与依赖关系 |
| API 文档 | [101-magic-api-2.2.2/api.md](./101-magic-api-2.2.2/api.md) | magic-api 接口定义 |
| 测试用例 | [101-magic-api-2.2.2/test-cases.md](./101-magic-api-2.2.2/test-cases.md) | magic-api 集成测试用例 |

---

## 十一、库模式验证模块（102）

### 102 — 库模式测试页（Test Lib）

> 以 Vue 组件方式引入编译后的 NPM 库产物，验证 `import MagicEditor from 'magic-editor'` + `app.use(install)` 的完整集成链路。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [102-test-lib/spec.md](./102-test-lib/spec.md) | 库模式测试页功能规格 |
| 技术方案 | [102-test-lib/plan.md](./102-test-lib/plan.md) | 库模式测试页技术方案 |
| 任务分解 | [102-test-lib/tasks.md](./102-test-lib/tasks.md) | 开发任务分解与依赖关系 |
| 测试用例 | [102-test-lib/test-cases.md](./102-test-lib/test-cases.md) | 库模式测试页测试用例 |

---

## 十二、模块编号一览

| 编号 | 模块名 | 英文名 | 分类 |
|------|--------|--------|------|
| 001 | 编辑器核心 | Editor Core | 编辑器模块 |
| 002 | 编辑器历史 | Editor History | 编辑器模块 |
| 003 | API 资源管理 | Resources API | 资源管理模块 |
| 004 | 函数资源管理 | Resources Function | 资源管理模块 |
| 005 | 数据源管理 | Resources Datasource | 资源管理模块 |
| 006 | 最近打开管理 | Resources Recent | 资源管理模块 |
| 007 | 头部布局 | Layout Header | 布局与面板模块 |
| 008 | 请求配置面板 | Layout Request | 布局与面板模块 |
| 009 | 调试面板 | Layout Debug | 布局与面板模块 |
| 010 | 选项面板 | Layout Options | 布局与面板模块 |
| 011 | 脚本解析器 | Script Parser | 脚本引擎模块 |
| 012 | 脚本语言服务 | Script Language | 脚本引擎模块 |
| 013 | MyBatis 语法支持 | Script MyBatis | 脚本引擎模块 |
| 014 | 通信传输 | Infra Transport | 基础设施模块 |
| 015 | 总线与存储 | Infra Bus Store | 基础设施模块 |
| 016 | 通用 UI 组件 | Common UI | 通用 UI 模块 |
| 101 | magic-api 集成 | Magic API Integration | 特殊模块 |
| 102 | 库模式测试页 | Test Lib | 特殊模块 |

> 注：编号按功能模块分配，101 为特殊集成模块编号。

---

## 十三、模块文档结构规范

每个模块目录 `NNN-name/` 下包含以下标准文档：

| 文件 | 命名 | 说明 |
|------|------|------|
| 功能规格 | `spec.md` | 定义模块的功能需求、用户故事、验收标准 |
| 技术方案 | `plan.md` | 模块的技术实现方案、架构决策、组件设计 |
| 任务分解 | `tasks.md` | 开发任务拆解、依赖关系、里程碑（仅 101 模块） |
| API 文档 | `api.md` | 模块涉及的 API 接口定义、请求/响应格式（仅 101 模块） |
| 测试用例 | `test-cases.md` | 模块 UI 功能测试用例，覆盖正向/异常/边界场景 |

> 注：当前模块文档结构为最小可用集（spec + plan + test-cases），tasks.md 在 101 和 102 模块中提供。后续可根据需要扩展。

---

## 十四、快速导航

| 目标读者 | 推荐阅读顺序 |
|---------|-------------|
| **新加入开发者** | constitution.md → STRUCTURE.md → overall-spec.md → 对应模块 spec.md |
| **架构师 / Tech Lead** | ARCHITECTURE.md → TECH.md → overall-plan.md → overall-api.md |
| **前端开发** | STRUCTURE.md → 对应模块的 spec.md + plan.md + test-cases.md |
| **测试 / QA** | overall-test-cases.md → SPECS_CHECKLIST.md → 各模块 test-cases.md |
| **产品经理** | overall-spec.md → 对应模块 spec.md |

---

## 十五、阅读顺序（推荐）

1. `STRUCTURE.md` — 先了解工程目录全貌
2. `TECH.md` — 技术栈与依赖版本
3. `constitution.md` — 工程不可妥协原则
4. `ARCHITECTURE.md` — 全局视角下的架构与数据流
5. `overall-spec.md` → `overall-plan.md` → `overall-data-model.md` → `overall-api.md`
6. 按 `SPECS_CHECKLIST.md` 进入各功能模块文档

---

## 十六、范围与免责声明

- 仅覆盖 `magic-editor` 前端工程；**不**包含 `magic-api` 后端实现细节，但记录两端契约。
- 自定义 monaco i18n 资源（`plugins/editor.main.nls.*`）属第三方语言包，仅作引用说明，不展开规范。
- 第三方库 `reconnecting-websocket`、`beautifier/` 视为外部依赖，仅描述用法不展开实现。
- 文档以源代码为唯一真相来源；任何源码中无法证实的设计意图均以 `[NEEDS CLARIFICATION]` 显式标记，留待后续向项目方确认。

---

## 十七、维护约定

- 模块目录命名：`XXX-<一级模块>-<二级模块>/`，编号 `XXX` 自 `001` 顺序分配，不复用。
- 每个模块至少包含 `spec.md`（What/Why）与 `plan.md`（How）。
- 文档完成度统一在 `SPECS_CHECKLIST.md` 中跟踪。
- 新增模块时，需同步更新本 README.md 的模块章节和模块编号一览表。

---

**文档维护者：** magic-editor 开发团队  
**文档仓库：** `magic-editor/specs/`
