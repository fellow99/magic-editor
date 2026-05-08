# magic-editor 测试用例总索引

> 本文档汇总 specs 目录下 17 个模块的 `test-cases.md`，按模块编号排序。
> 用例编号统一采用 `TC-<模块号>-NNN` 格式；优先级 P0（核心阻断）> P1（重要） > P2（次要） > 边界（待澄清/异常分支）。
> 真相来源：各模块 `spec.md` 的 FR/US/AC 与 `src/` 源码事实；与 [STRUCTURE.md](./STRUCTURE.md) 同步。

---

## 1. 模块用例清单

| 模块 | 文档 | 用例数 | 主要范围 |
|---|---|---:|---|
| 001 编辑器内核 | [001-editor-core/test-cases.md](./001-editor-core/test-cases.md) | 64 | Tab 容器、面板分屏、命令注册、扩展点 |
| 002 编辑历史 | [002-editor-history/test-cases.md](./002-editor-history/test-cases.md) | 23 | 撤销/重做、修改标记、自动恢复 |
| 003 API 资源 | [003-resources-api/test-cases.md](./003-resources-api/test-cases.md) | 68 | API 列表/编辑/保存/参数/headers/分组 + E2E 持久化 + 脚本持久化 |
| 004 函数资源 | [004-resources-function/test-cases.md](./004-resources-function/test-cases.md) | 50 | 函数列表/编辑/保存/参数定义 + 跨模块隔离 |
| 005 数据源资源 | [005-resources-datasource/test-cases.md](./005-resources-datasource/test-cases.md) | 43 | 数据源 CRUD/连接测试/驱动选择 + E2E 持久化 |
| 006 最近打开 | [006-resources-recent/test-cases.md](./006-resources-recent/test-cases.md) | 42 | 最近文件、打开历史、清理策略 |
| 007 顶部布局 | [007-layout-header/test-cases.md](./007-layout-header/test-cases.md) | 50 | Header 工具栏、菜单、登录态 |
| 008 请求面板 | [008-layout-request/test-cases.md](./008-layout-request/test-cases.md) | 94 | 请求/响应区、参数表、headers、Body、运行 + E2E 运行链路 + 脚本恢复 |
| 009 调试面板 | [009-layout-debug/test-cases.md](./009-layout-debug/test-cases.md) | 53 | 断点、单步、变量观察、WebSocket 调试 |
| 010 选项面板 | [010-layout-options/test-cases.md](./010-layout-options/test-cases.md) | 74 | 选项/配置、缓存、安全、跨域 |
| 011 脚本解析 | [011-script-parser/test-cases.md](./011-script-parser/test-cases.md) | 70 | Magic Script 语法分析、AST、Token |
| 012 语言服务 | [012-script-language/test-cases.md](./012-script-language/test-cases.md) | 70 | Monaco 集成、补全、悬浮、诊断 |
| 013 MyBatis 适配 | [013-script-mybatis/test-cases.md](./013-script-mybatis/test-cases.md) | 41 | XML 解析、参数映射、SQL 渲染 |
| 014 传输层 | [014-infra-transport/test-cases.md](./014-infra-transport/test-cases.md) | 58 | HTTP 客户端、WebSocket、拦截器 |
| 015 总线/状态 | [015-infra-bus-store/test-cases.md](./015-infra-bus-store/test-cases.md) | 79 | EventBus、Pinia store、订阅 |
| 016 通用 UI | [016-common-ui/test-cases.md](./016-common-ui/test-cases.md) | 95 | Dialog/Alert/Confirm/Contextmenu/Tree 等 |
| 101 后端 2.2.2 适配 | [101-magic-api-2.2.2/test-cases.md](./101-magic-api-2.2.2/test-cases.md) | 113 | URL 改造、ROT13、资源树合并、27 调用点矩阵 |
| **合计** | | **1087** | |

---

## 2. 优先级分布

| 模块 | P0 | P1 | P2 | 边界 | 合计 |
|---|---:|---:|---:|---:|---:|
| 001 | 38 | 16 |  6 |  4 |  64 |
| 002 | 14 |  5 |  2 |  2 |  23 |
| 003 | 42 | 14 |  6 |  6 |  68 |
| 004 | 30 | 12 |  4 |  4 |  50 |
| 005 | 27 | 10 |  3 |  3 |  43 |
| 006 | 22 | 12 |  4 |  4 |  42 |
| 007 | 30 | 12 |  4 |  4 |  50 |
| 008 | 58 | 23 |  6 |  7 |  94 |
| 009 | 32 | 12 |  5 |  4 |  53 |
| 010 | 44 | 18 |  6 |  6 |  74 |
| 011 | 44 | 16 |  4 |  6 |  70 |
| 012 | 44 | 16 |  4 |  6 |  70 |
| 013 | 24 |  9 |  4 |  4 |  41 |
| 014 | 36 | 12 |  4 |  6 |  58 |
| 015 | 48 | 18 |  6 |  7 |  79 |
| 016 | 56 | 22 |  6 | 11 |  95 |
| 101 | 84 | 14 |  4 | 11 | 113 |
| **合计** | **676** | **244** | **78** | **91** | **1087** |

> 数字按各 test-cases.md 内 "索引摘要" 表估算；具体以源文档为准。

---

## 3. 用例编号区间速查

| 模块 | 编号区间 | 备注 |
|---|---|---|
| 001 | TC-001-001 ~ 064 | 全 P0/P1/P2 + 边界 |
| 002 | TC-002-001 ~ 023 | |
| 003 | TC-003-001 ~ 068 | 含 E2E 持久化（150~155） |
| 004 | TC-004-001 ~ 050 | 含跨模块隔离（120~121） |
| 005 | TC-005-001 ~ 043 | 含 E2E 持久化（045~047） |
| 006 | TC-006-001 ~ 042 | |
| 007 | TC-007-001 ~ 050 | |
| 008 | TC-008-001 ~ 094 | 用例量最大单模块；含 E2E 运行链路（220~222） |
| 009 | TC-009-001 ~ 053 | |
| 010 | TC-010-001 ~ 074 | |
| 011 | TC-011-001 ~ 070 | |
| 012 | TC-012-001 ~ 070 | |
| 013 | TC-013-001 ~ 041 | |
| 014 | TC-014-001 ~ 058 | |
| 015 | TC-015-001 ~ 079 | |
| 016 | TC-016-001 ~ 095 | 18 章节分组（Dialog/Alert/Confirm/...） |
| 101 | TC-101-001 ~ 313 | 分章节非连续；含 27 处调用点矩阵 + 系统级 AC |

---

## 4. 关键覆盖说明

### 4.1 用户故事与功能需求覆盖
- 每条用例首字段 **关联** 指向 spec.md 中的 FR-NNN 或 US-NNN，反向可追溯。
- 系统级验收（AC-NNN-NN）独立成节，对应跨模块端到端流程。

### 4.2 跨模块联动
| 流程 | 主导模块 | 配合模块 |
|---|---|---|
| 编辑→保存→刷新树 | 003 | 001、015、101 |
| 调试运行链路 | 009 | 014（WebSocket）、008、011 |
| 登录鉴权 | 007、101 | 014（拦截器） |
| 资源树合并 | 101 | 003、004、005 |
| 命令注册 → UI 调用 | 001 | 016（菜单/对话框） |

### 4.3 边界与待澄清
- 各模块 "边界与待澄清" 表登记 spec 中 `[NEEDS CLARIFICATION]` 与源码无法判定的语义；用例标注 P-边界，不计入主回归门禁。
- 后端依赖差异（如 magic-token 与 Bearer 共存策略）记录在 101 的边界表。

---

## 5. 执行建议

### 5.1 回归门禁（CI）
- **必过**：所有 P0 用例（676 条）。
- **建议过**：所有 P1（244 条）。
- **抽样**：P2 与边界按风险评估。

### 5.2 分层执行
1. **单元/集成**：001、011、012、013、014、015 的 API 契约层用例（基于 jsdom + jest/vitest）。
2. **组件**：003-010、016 的 UI 用例（Vue Test Utils + Playwright Component Test）。
3. **端到端**：101 系统级 AC（TC-101-260~269）+ 跨模块联动场景，使用 Playwright + 真实 magic-api 2.2.2 后端。

### 5.3 数据准备
- 后端：magic-api-spring-boot-starter:2.2.2，`magic-api.web=/magic/web`，启用 ROT13。
- 鉴权：宿主 axios 拦截器注入 `Authorization: Bearer <sa-token>`。
- 测试夹具：每模块 test-cases.md 第 2 章 "环境前置" 列明。

---

## 6. 文档维护

- 用例新增/修改：直接编辑对应模块的 `test-cases.md`，并同步更新本索引第 1、2、3 节。
- spec.md 变更：先更新 spec，再回到 test-cases.md 调整用例的 **关联** 字段。
- 模块新增：在 specs 下新建 `NNN-xxx/` 目录，产出 spec.md 与 test-cases.md 后追加到本索引。

> 真相基准：本索引与各 test-cases.md 一致；如有冲突，以 spec.md + 源码为准。
