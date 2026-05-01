# magic-editor 规范文档（specs/）

## 概述

本目录包含 **magic-editor** 工程的反向规范文档（as-built specifications），由 `opus-specs-as-built` 工作流基于源代码反推生成，遵循 [GitHub Spec Kit](https://github.com/github/spec-kit) 的文档结构与术语约定。

> 文档以源代码为唯一真相来源；任何源码中无法证实的设计意图均以 `[NEEDS CLARIFICATION]` 显式标记，留待后续向项目方确认。

## 文档树

```
specs/
├── README.md                     ← 本文件，导航
├── SPECS_CHECKLIST.md            完成进度清单
├── STRUCTURE.md                  工程目录结构（事实基准）
├── TECH.md                       技术栈与版本基准
├── ARCHITECTURE.md               架构总览（含分层、数据流、依赖图）
├── constitution.md               项目宪法（不可破坏的工程原则）
├── overall-spec.md               工程级功能规范（What / Why）
├── overall-plan.md               工程级实现计划（How）
├── overall-data-model.md         工程级数据模型（前端域 / 通信契约）
├── overall-api.md                工程级 API 契约（HTTP + WebSocket）
└── 001-editor-core/ … 016-common-ui/   各功能模块的 spec.md / plan.md
```

## 阅读顺序（推荐）

1. `STRUCTURE.md` — 先了解工程目录全貌
2. `TECH.md` — 技术栈与依赖版本
3. `constitution.md` — 工程不可妥协原则
4. `ARCHITECTURE.md` — 全局视角下的架构与数据流
5. `overall-spec.md` → `overall-plan.md` → `overall-data-model.md` → `overall-api.md`
6. 按 `SPECS_CHECKLIST.md` 进入各功能模块文档

## 范围与免责声明

- 仅覆盖 `magic-editor` 前端工程；**不**包含 `magic-api` 后端实现细节，但记录两端契约。
- 自定义 monaco i18n 资源（`plugins/editor.main.nls.*`）属第三方语言包，仅作引用说明，不展开规范。
- 第三方库 `reconnecting-websocket`、`beautifier/` 视为外部依赖，仅描述用法不展开实现。

## 维护约定

- 模块目录命名：`XXX-<一级模块>-<二级模块>/`，编号 `XXX` 自 `001` 顺序分配，不复用。
- 每个模块至少包含 `spec.md`（What/Why）与 `plan.md`（How）。
- 文档完成度统一在 `SPECS_CHECKLIST.md` 中跟踪。
