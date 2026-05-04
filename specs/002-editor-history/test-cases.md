# 002-editor-history 测试用例

> 模块编号：002-editor-history
> 关联规范：[spec.md](./spec.md)
> 对应源码：`src/components/editor/magic-history.vue`
> 用例编号格式：`TC-002-NNN`
> 优先级：P0 = 阻断主流程，P1 = 关键功能，P2 = 增强/边界

---

## 1. 测试范围

**纳入**：历史版本列表渲染、版本选中高亮、当前版本信息条、点击拉取历史内容、monaco diff 视图渲染、版本回滚 (`reset`)、布局重算、面板初始化 (`load`)。

**排除**：
- 历史列表的拉取（由 001 父组件完成，见 TC-001-070~073）
- 后端备份创建 / 删除（后端职责）
- diff 算法本身（monaco-editor 内置）

## 2. 环境前置

| 项 | 期望 |
|---|---|
| 父组件 | `magic-script-editor.vue` 已就绪并持有 `$refs.history` |
| 后端 | `backup/get`、`function/backup/get` 可访问，返回 `{content: JSON_STRING}` |
| 数据 | 父组件已成功调用 `backups` 拉取到 timestamps 列表 |
| 依赖 | monaco-editor 可创建 diffEditor；`contants.EDITOR_FONT_FAMILY/SIZE` 已配置 |

---

## 3. 功能测试用例

### US-001 查看历史版本列表

#### TC-002-001 历史面板首次打开渲染版本列表
- **关联**：FR-002-001、FR-002-040、FR-002-042、FR-002-043、US-001
- **优先级**：P0
- **前置**：脚本含 3 个历史版本
- **步骤**：父组件触发 viewHistory 后调用 `$refs.history.load(timestampes, info, editor, true)`
- **预期**：
  - 左侧列表渲染 3 项，每项显示 `YYYY-MM-DD HH:mm:ss` 时间 + createBy（缺省为 `guest`）
  - 第一个版本被自动打开（触发 `open` 流程）
  - 顶部信息条显示选中版本的时间 + 创建者 + "当前版本"标签

#### TC-002-002 createBy 缺失时回退为 guest
- **关联**：FR-002-001
- **优先级**：P1
- **前置**：某历史项 `createBy` 字段为空
- **步骤**：渲染列表
- **预期**：该项显示 `guest`，无报错

#### TC-002-003 选中项应用 selected 高亮
- **关联**：FR-002-002
- **优先级**：P1
- **步骤**：点击列表第二项
- **预期**：第二项 DOM 添加 `selected` class；第一项移除该 class

#### TC-002-004 时间戳秒级转毫秒
- **关联**：AS-002、FR-002-042
- **优先级**：P1
- **前置**：某项 `createDate=1700000000`（秒级）
- **步骤**：观察显示时间
- **预期**：使用 `formatDate(createDate*1000)` 渲染为 2023-11-15 ... 而非 1970 年

---

### US-002 对比版本差异

#### TC-002-010 点击列表项发起后端请求（API 类型）
- **关联**：FR-002-020、FR-002-021、FR-002-022、US-002
- **优先级**：P0
- **前置**：`isApi=true`
- **步骤**：点击某历史版本
- **预期**：发出 `POST backup/get`，请求体含 `id` 与 `timestamp`

#### TC-002-011 Function 类型走 function/backup/get
- **关联**：FR-002-021
- **优先级**：P0
- **前置**：`load(..., isApi=false)`
- **步骤**：点击历史版本
- **预期**：请求路径为 `function/backup/get`

#### TC-002-012 响应内容解析为 monaco model
- **关联**：FR-002-023、FR-002-013
- **优先级**：P0
- **前置**：响应 `{content: '{"script":"return 1;"}'}`
- **步骤**：等待请求完成
- **预期**：
  - `originalModel` 通过 `monaco.editor.createModel('return 1;', 'magicscript')` 创建
  - diffEditor 的 model 被设置为 `{original: originalModel, modified: scriptModel}`

#### TC-002-013 diff 视图左侧历史 / 右侧当前
- **关联**：FR-002-010
- **优先级**：P0
- **步骤**：观察 diff 渲染
- **预期**：左侧为历史版本文本，右侧为当前编辑器内容

#### TC-002-014 diff editor 禁用 minimap / 折叠 / 空白
- **关联**：FR-002-011
- **优先级**：P2
- **步骤**：审查 diff editor 配置
- **预期**：`minimap.enabled=false`、`folding=false`、`renderWhitespace='none'`

#### TC-002-015 diff editor 字体与主编辑器一致
- **关联**：FR-002-012、NFR-002-002
- **优先级**：P2
- **步骤**：检查 diff editor 配置
- **预期**：fontFamily 与 fontSize 取值等于 `contants.EDITOR_FONT_FAMILY` / `contants.EDITOR_FONT_SIZE`

#### TC-002-016 切换历史版本仅更新 original 侧
- **关联**：FR-002-010
- **优先级**：P1
- **前置**：已选第一项
- **步骤**：点击第二项
- **预期**：左侧文本更新；右侧（当前编辑器内容）不变

---

### US-003 回滚到历史版本

#### TC-002-020 reset 将编辑器内容替换为选中版本
- **关联**：FR-002-030、US-003
- **优先级**：P0
- **前置**：选中某历史版本，其内容为 `"return 2;"`
- **步骤**：调用 `$refs.history.reset()`
- **预期**：父编辑器 `getValue()` 返回 `"return 2;"`

#### TC-002-021 回滚后未自动保存
- **关联**：NC-001
- **优先级**：P1
- **步骤**：reset 后观察 Network
- **预期**：无 save 请求；Tab 标签出现 `*` 未保存标记（由 001 实现）

---

### 布局响应

#### TC-002-030 update-window-size 触发 layout
- **关联**：FR-002-014、NFR-002-001
- **优先级**：P1
- **前置**：历史面板可见
- **步骤**：触发 `bus.$emit('update-window-size')`
- **预期**：diffEditor.layout() 被调用，无报错

#### TC-002-031 面板隐藏时跳过 layout
- **关联**：NFR-002-001
- **优先级**：P2
- **前置**：历史面板未挂载到可见区域（`isVisible` 返回 false）
- **步骤**：触发 update-window-size
- **预期**：layout 不被调用

#### TC-002-032 面板高度与列表宽度固定
- **关联**：NFR-002-003
- **优先级**：P2
- **步骤**：审查样式
- **预期**：面板高度 485px，列表宽度 210px

---

## 4. 边界与异常

| 编号 | 场景 | 预期 |
|---|---|---|
| TC-002-100 | timestampes 为空数组 | 列表为空，不自动 open，无报错 |
| TC-002-101 | 后端 content 字段非合法 JSON | `JSON.parse` 抛错；建议捕获并提示（[NEEDS CLARIFICATION] 当前实现未捕获） |
| TC-002-102 | content JSON 缺少 script 字段 | originalModel 内容为 `undefined` 字面量；diff 异常 |
| TC-002-103 | 频繁切换历史版本（10+ 次） | 旧 originalModel 未 dispose（NC-002 已记录），观察内存增长 |
| TC-002-104 | 父组件未传入 scriptEditor | load 报错；前置由父组件保证（AS-003） |
| TC-002-105 | 请求 5xx 或网络失败 | success 回调不触发；diff 不更新；无未捕获异常 |
| TC-002-106 | 同时选中两项（极速点击） | 后到响应覆盖先到（与请求顺序一致） |

---

## 5. 用例索引摘要

| 用户故事 | 用例区间 | 数量 |
|---|---|---|
| US-001 列表渲染 | TC-002-001 ~ 004 | 4 |
| US-002 Diff 对比 | TC-002-010 ~ 016 | 7 |
| US-003 回滚 | TC-002-020 ~ 021 | 2 |
| 布局响应 | TC-002-030 ~ 032 | 3 |
| 边界与异常 | TC-002-100 ~ 106 | 7 |
| **合计** | | **23** |

> 优先级分布：P0 ≈ 7，P1 ≈ 7，P2 ≈ 9
