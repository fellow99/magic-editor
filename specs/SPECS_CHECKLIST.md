# SPECS_CHECKLIST — 规范文档完成情况

> 状态约定：⬜ 未开始 / 🟨 进行中 / ✅ 已完成 / ⚠️ 待澄清

## 项目级文档

| 状态 | 文档 | 路径 |
| :-: | --- | --- |
| ✅ | 工程目录结构 | `STRUCTURE.md` |
| ✅ | 规范导航 | `README.md` |
| ✅ | 进度清单 | `SPECS_CHECKLIST.md` |
| ✅ | 技术栈 | `TECH.md` |
| ✅ | 架构总览 | `ARCHITECTURE.md` |
| ✅ | 项目宪法 | `constitution.md` |
| ✅ | 工程级功能规范 | `overall-spec.md` |
| ✅ | 工程级实现计划 | `overall-plan.md` |
| ✅ | 工程级数据模型 | `overall-data-model.md` |
| ✅ | 工程级 API 契约 | `overall-api.md` |

## 模块级文档

| 编号 | 模块 | 范围 | spec.md | plan.md |
| :-: | --- | --- | :-: | :-: |
| 001 | editor-core | `components/editor/magic-script-editor.vue` | ✅ | ✅ |
| 002 | editor-history | `components/editor/magic-history.vue` | ✅ | ✅ |
| 003 | resources-api | `components/resources/magic-api-list.vue` | ✅ | ✅ |
| 004 | resources-function | `components/resources/magic-function-list.vue` | ✅ | ✅ |
| 005 | resources-datasource | `components/resources/magic-datasource-list.vue` | ✅ | ✅ |
| 006 | resources-recent | recent-opened / resource-choose / group-choose | ✅ | ✅ |
| 007 | layout-header | header / status-bar / login | ✅ | ✅ |
| 008 | layout-request | request / run / function / event / group | ✅ | ✅ |
| 009 | layout-debug | debug / log | ✅ | ✅ |
| 010 | layout-options | options / option / search / settings / todo | ✅ | ✅ |
| 011 | script-parser | `scripts/parsing/*` 自研解析器 | ✅ | ✅ |
| 012 | script-language | `scripts/editor/*` monaco 语言服务（除 mybatis） | ✅ | ✅ |
| 013 | script-mybatis | `scripts/editor/mybatis.js` | ✅ | ✅ |
| 014 | infra-transport | `api/request.js` + WebSocket 体系 | ✅ | ✅ |
| 015 | infra-bus-store | bus / store / contants / hotkey / utils / beautifier | ✅ | ✅ |
| 016 | common-ui | `components/common/*` 通用 UI 组件 | ✅ | ✅ |

## 特殊模块文档

| 编号 | 模块 | 范围 | spec.md | plan.md | tasks.md | test-cases.md |
| :-: | --- | --- | :-: | :-: | :-: | :-: |
| 101 | magic-api 集成 | 后端 2.2.2 适配 | ✅ | ✅ | ✅ | ✅ |
| 102 | 库模式测试页 | `test.html` + `src/test.js` + `src/Test.vue` | ✅ | ✅ | ✅ | ✅ |

## 待澄清事项

| ID | 位置 | 描述 |
| --- | --- | --- |
| C-001 | `src/api/web.js` | 文件存在但内容为空，用途未知（已在历史中废弃 / 还是占位待开发？） |
| C-002 | `src/scripts/bus.js` | 包含 `s4.cnzz.com` 第三方统计上报，是否仍需保留 |
| C-003 | `package.json` 中 `axios@0.21.4` | 版本极旧且存在已知 CVE，是否计划升级 |
