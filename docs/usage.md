# 星衡（Xingheng）详细使用与故障排查指南

本指南详细介绍 `@local/dsh-xingheng` `3.0.0` 的安装流程、三路普通子任务配置接口、原生智能体团队（Agent Teams）与普通执行单元（Worker）的协作规范、工具别名与寻址区分、权限与修订号（Revision）机制，以及常见故障排查方法。

[返回中文首页](../README.md) · [English Usage Guide](usage.en.md) · [系统架构](architecture.md) · [迁移与清理](migration.md) · [验收记录](acceptance.md)

---

## 1. 安装与激活完整流程

### 1.1 前置条件

- **Node.js**：`>=22`
- **Profile 前置组件**：需已启用 DSH 的 `dsh-base`、`dsh-web-app` 与 `dsh-experimental-agent-team-profile` 官方组合包。星衡复用这些包提供的服务，不会在缺少 Team 服务时自行创建另一套实现。
- **DeepSeek Harness (DSH)**：`>=0.2.2-rc.1 <0.3`（当前版本直接复用 `0.2.2-rc.1` 的 `@deepseek-ai/dsh-tool-subagent` 与 `@deepseek-ai/dsh-tool-subagent-control` 原生执行器）
- **会话权限**：执行 `plugin_manager` 工具需要当前会话具备 `danger-full-access` 权限，或在弹窗审批中明确批准该次工具调用。

### 1.2 使用 `plugin_manager` 助手工具安装

在 DSH 会话中向助手发送指令：

> 请调用 `plugin_manager` 工具（`action: "install_bundle"`，target 为 `/absolute/path/dsh-xingheng`）安装星衡插件。

**必须区分的概念**：

1. **`plugin_manager` 是助手工具（Agent Tool），不是 Shell 命令**：
   - 正确做法：由 AI 助手在回合中发起 `plugin_manager({ action: "install_bundle", target: "/absolute/path/dsh-xingheng" })` 工具调用。
   - 错误做法：在 `bash` 工具或系统终端中输入 `plugin_manager ...`（终端中不存在该二进制命令），或手动修改 DSH Profile 的 YAML/JSON 配置文件。
2. **查看返回状态（`application` 与 `warnings`）**：
   - 当返回包含 `application: "applied"` 时，说明 Host 服务与预设已热加载到当前进程。此时刷新浏览器页面即可。
   - 当返回包含 `application: "restart-required"`（或伴随 `unmanaged-plugin` 提示）时，说明已加载的底层模块需要在新进程中重新初始化。此时必须**重启当前正在运行的 DSH Host 服务进程**，待进程重启后再刷新浏览器页面。
   - **切勿混淆**：刷新浏览器网页（F5）只会重新加载前端资源，不会重启后端的 DSH Host 进程；在终端里另起一个新端口的 DSH 服务也不会更新当前浏览器所连接的 GUI 实例。

---

## 2. 配置普通子代理三路模型路由

星衡通过同一套后端校验与 `ConfigEditor` 原子持久化逻辑，提供三种等价的配置方式：**Web 设置界面**、**`xingheng_config` 助手工具**、**`/xingheng` 斜杠命令**。

### 2.1 三路角色定义与默认初始组合

| 角色名称 | 英文名称 | 典型任务场景 | 初始组合 |
| :--- | :--- | :--- | :--- |
| **快速迭代** | Quick iteration | 局部修复、小改进、单点检查 | `zero` / `deepseek-v4.1-flash-1017` / `high` |
| **特性实现** | Feature implementation | 功能开发、接口实现、测试编写 | `zero` / `gpt-6.1-sol` / `medium` |
| **分析规划** | Analysis and planning | 代码审查、架构分析、复杂问题诊断 | `zero` / `gpt-6.1-terra` / `high` |

#### 角色接口标识

显示名称、配置键、委派工具 ID 已统一到任务职责。以下是唯一受支持的标识，不提供旧角色键或旧工具名兼容。

| 角色名称 | 配置键 | 委派工具 ID |
| :--- | :--- | :--- |
| 快速迭代 | `iterate` | `subagent_iterate` |
| 特性实现 | `implement` | `subagent_implement` |
| 分析规划 | `analyze` | `subagent_analyze` |

使用界面或向助手描述任务时，使用角色名称即可。编写 JSON、调用工具或阅读源码时，必须使用上表中的实际标识，不要把中文角色名直接写成 JSON 键。

> **重要声明**：上述 `DEFAULT_WORKERS` 仅作为初始默认值或「填入初始组合」按钮的草稿模板，**不代表官方对模型质量、推理速度或调用价格的排名建议**。如果当前环境的模型目录中未注册上述提供商或模型，保存会被拒绝，必须改选当前目录中实际存在的模型。

### 2.2 方式一：通过 Web 设置界面配置

1. 打开 DSH Web 界面左下角或顶部的 **设置（Settings）**。
2. 选择左侧导航栏中的 **「星衡 · 子代理配置」**（英文界面为 **Xingheng · Subagent configuration**）。
3. 为 **01 快速迭代**、**02 特性实现**、**03 分析规划** 分别选择：
   - **提供商（Provider）**：来自当前 `llm.listProviders()` 的已注册提供商。切换提供商会自动清空该角色的模型与推理强度草稿，防止跨提供商残留非法 ID。
   - **模型（Model）**：来自所选提供商 `llm.listModels(provider)` 的公开模型列表。切换模型会自动重置该角色的推理强度草稿。
   - **推理强度（Reasoning effort）**：来自 `llm.resolveModelInfo(provider, model)` 声明支持的推理档位，或选择 **「原生默认（同模型可继承主控）」**（空字符串 `""`）。
4. 观察底部状态栏：
   - 修改后状态显示为 **「有未保存的更改」**。
   - 点击 **「保存配置」**，请求发送至 `./api/xingheng/v3`。保存成功后，界面使用服务端回读的最新快照更新状态，并提示 **「已保存并回读确认；下一个子代理将使用新配置。」**
   - 若要放弃草稿修改，点击 **「重新读取」** 并确认弹窗。

### 2.3 方式二：通过 `xingheng_config` 助手工具配置

在会话中，如果用户明确要求助手读取或修改星衡子代理模型配置，助手可调用 `xingheng_config` 工具（**未经用户要求，主控不得擅自调用该工具更改路由**）：

- **读取当前配置与可用模型目录**：
  ```json
  {
    "action": "read"
  }
  ```
  返回结构包含 `version`（`"3.0.0"`）、`workers`（三路当前生效配置）、`revision`（当前 CAS 修订号字符串）、`providers`（含每个提供商下的 `models`、`efforts`、`defaultEffort`）、`preset`（`xingheng` 预设摘要）以及 `applies`（`"next-child"`）。

- **保存完整配置（必须传入最新 `expectedRevision` 与完整的三路 `workers`）**：
  ```json
  {
    "action": "save",
    "expectedRevision": "[{\"provider\":\"zero\",\"model\":\"deepseek-v4.1-flash-1017\",\"effort\":\"high\"},{\"provider\":\"zero\",\"model\":\"gpt-6.1-sol\",\"effort\":\"medium\"},{\"provider\":\"zero\",\"model\":\"gpt-6.1-terra\",\"effort\":\"high\"}]",
    "workers": {
      "iterate": { "provider": "zero", "model": "deepseek-v4.1-flash-1017", "effort": "medium" },
      "implement": { "provider": "zero", "model": "gpt-6.1-sol", "effort": "medium" },
      "analyze": { "provider": "zero", "model": "gpt-6.1-terra", "effort": "high" }
    }
  }
  ```

### 2.4 方式三：通过 `/xingheng` 斜杠命令配置

- **读取配置**：输入 `/xingheng`（不带参数），返回当前快照 JSON。
- **保存配置**：输入 `/xingheng {"action":"save","expectedRevision":"...","workers":{...}}`，执行带 CAS 校验的完整保存。

---

## 3. 普通角色子任务（Worker）工作流

当任务属于边界清晰的局部修改、独立功能编写或单点审查，且**不需要多代理之间互相发消息或共享任务依赖看板**时，主控应使用普通角色子任务：

### 3.1 启动与模型路由规则

- 主控调用 `subagent_iterate`、`subagent_implement` 或 `subagent_analyze`，传入：
  - `description`：3–5 个词的简短任务标签（用于界面展示）。
  - `prompt`：**完整、自包含的任务说明**。因为普通子任务使用 `spawn`（全新上下文），子代理看不到主控的历史对话，必须在 `prompt` 中明确给出：
    1. **写入范围（Write Scope）**：允许修改的具体文件路径（未列出的路径一律只读）。
    2. **验收标准（Acceptance Criteria）**：完成的明确定义。
    3. **验证权限（Validation Permission）**：`xingheng-worker` 默认 `Validation = NONE`（禁止擅自编译、运行测试、下载依赖或编写临时测试运行器）。若需要子代理运行特定验证命令，主控必须在 `prompt` 中明确授权该精确命令。
  - `cwd`（可选）：子代理初始工作目录。
- **禁止调用时覆盖模型**：`subagent_iterate/implement/analyze` 已锁定 `modelSelection: false`，不接受 `provider` 或 `model` 参数，严格按当前已保存的星衡配置路由到 `xingheng-worker` 预设。

### 3.2 控制普通子任务（按 `agent_id` 寻址）

在 `xingheng` 主控预设中，控制普通子任务的三个工具已重命名为 `subagent_*`，**消息和中断使用子会话 ID（`agent_id`）；列表工具只接受 `scope`，没有目标参数**：

- **`subagent_list`**：列出当前主控启动的普通子代理（`scope: "children"` 或 `"descendants"`），查看其 `id`、`label` 与 `status`（`running` 或 `inactive`）。
- **`subagent_message`**：向指定 `agent_id` 的直接子代理发送补充指令或继续其已完成的对话（传入 `{ agent_id: "<child-session-id>", message: "..." }`）。
- **`subagent_interrupt`**：请求指定 `agent_id` 的子代理停止当前回合工作（传入 `{ agent_id: "<child-session-id>" }`）。

### 3.3 执行单元的工具限制与软检查点（Soft Checkpoint）

- **无外部网络搜索/浏览器/IM 工具**：`xingheng-worker` 没有 `web_search`、`web_fetch`、`research`、Playwright 浏览器或 IM 工具。如果任务需要外部网页资料或浏览器快照，**必须由主控先收集好证据**，再通过 `prompt` 传给执行单元。
- **12 步 / 10 分钟软检查点**：当执行单元累计达到 **12 次工具调用或运行满 10 分钟**（以先观察到者为准），或连续两步无实质进展时，预设提示词要求执行单元完成当前安全动作，返回 `CHECKPOINT`（附带已完成部分、未决事项与下一步切片建议）并结束回合。
- **完成与冻结（READY & FREEZE）**：满足验收条件后，执行单元返回 `READY`（列出修改的文件、实际运行的检查与未运行的检查），并立即冻结所有写入。若收到主控的 `FREEZE` 消息，执行单元必须停止一切编辑、编译与测试，仅汇报当前发现。

---

## 4. 原生智能体团队（Agent Teams）工作流

当任务涉及多个相互依赖的工作模块、需要共享任务看板协调进度，或需要不同角色队友之间直接点对点通信时，使用 DSH 原生智能体团队。

### 4.1 创建命名队友与模型继承边界

- **仅 Team Lead（`lead`）可调用 `spawn_teammate`**：
  - `name`：唯一的 `lower-kebab-case` 队友名称（如 `"api-impl"`、`"reviewer"`）。
  - `description`：队友职责简述。
  - `prompt`：队友的初始任务说明。
  - `context`：可选 `"fresh"`（默认，全新上下文，不携带主控历史）或 `"fork"`（继承主控已完成的回合历史；仅在队友确实需要完整前文背景时使用）。
- **队友模型继承自 Lead**：原生队友**创建时继承主控（Lead）的有效模型与当前预设**。当前 DSH 原生 `spawn_teammate` 接口不支持为单个队友指定独立模型，「设置 → 星衡 · 子代理配置」中的三路配置**不影响**团队队友。

### 4.2 团队通信、控制工具与兼容别名（按 `target` 成员名寻址）

验收曾遇到模型声称原生通信工具不可用（确切原因未确认）。为提供显式团队入口，星衡在所有团队成员（Lead 与 Teammate）作用域内同时注册了 **`team_*` 兼容别名**。两者底层执行器、参数与权限完全相同，**推荐优先使用 `team_*` 别名**：

| 推荐使用的团队别名 | 等价的原生团队工具名 | 寻址参数 | 权限与行为说明 |
| :--- | :--- | :--- | :--- |
| **`team_roster`** | `list_agents` | 无参数 `{}` | 列出 Lead 与所有命名队友的名称（`target`）、角色与当前状态（`running` / `inactive` / `provisioning` / `failed`） |
| **`team_message`** | `send_message` | **`target`**（成员名，如 `"lead"` 或 `"reviewer"`）、`message` | 向目标队友或 `"lead"` 发送消息。若目标正在运行，在最近的步骤边界接收；若目标处于 `inactive`，**该消息会唤醒并启动目标的新回合** |
| **`team_interrupt`** | `interrupt_agent` | **`target`**（队友成员名） | **仅 Team Lead 可调用**。中断指定队友当前正在执行的回合，同时保留其待处理收件箱 |
| `wait_agent` | `wait_agent` | `timeout_ms`（`10000`–`3600000`，默认 `30000`） | 等待此调用开始后的下一次队友状态变更、新消息或共享任务变更。**绝不会唤醒 `inactive` 成员**；当没有任何其他成员处于 `running` 或 `provisioning` 时，立即返回 `noProgress` |

> **关键防错提醒**：
> - 团队工具的参数名是 **`target`**（填成员名，如 `"reviewer"`），而普通子任务工具（`subagent_message` / `subagent_interrupt`）的参数名是 **`agent_id`**（填子会话 ID）。切勿将两者混用！
> - **`inactive` 不等于任务完成**：`inactive` 仅代表该队友当前没有正在运行的回合。
> - **调用 `wait_agent` 前必须先检查名册**：在调用 `wait_agent` 前，先用 `team_roster` 确认至少有一个必需的队友正处于 `running` 或 `provisioning` 状态；如果目标队友处于 `inactive`，必须先调用 `team_message` 唤醒它，否则 `wait_agent` 会立即返回 `noProgress`。

### 4.3 共享任务看板与 CAS 修订号工作流

团队成员通过以下四个原生工具协作管理共享任务看板（状态持久化在原生 Session 日志中，请勿创建临时 Markdown/JSON 文件代替原生看板）：

1. **`team_task_create`**：创建待办任务，指定 `subject`、`description`（包含验收标准）、`blocked_by`（前置依赖任务 ID 数组）和 `write_scopes`（建议的相对文件或目录写入前缀数组）。
2. **`team_task_list`**：按 `status`（`pending` / `in_progress` / `completed`）、`ready`（是否所有 `blocked_by` 均已完成）或 `owner` 筛选任务列表，获取每个任务当前的 `revision` 和写入范围重叠警告。
3. **`team_task_get`**：在修改或执行单个任务前，读取该 `task_id` 的完整最新详情与当前 `revision`。
4. **`team_task_update`**：基于最新 `expected_revision` 执行原子 CAS 状态流转（`action` 支持 `claim`、`release`、`edit`、`set_dependencies`、`complete`、`reopen`、`reassign`、`delete`）：
   - **标准执行顺序**：`team_task_list` → `team_task_get`（获取最新 `revision`）→ `team_task_update({ task_id, expected_revision, action: "claim" })` → 在约定 `write_scopes` 内执行修改 → `team_task_update({ task_id, expected_revision: <新revision>, action: "complete" })`。
   - **处理修订号冲突**：如果 `team_task_update` 因并发修改返回修订号冲突（Stale Revision），重新调用 `team_task_get` 获取最新 `revision` 后再重试。
   - **`write_scopes` 是协调提示而非文件系统锁**：团队成员共享同一个工作树，编辑操作对所有人即时可见。应将写入工作拆分为互不重叠的路径前缀；若文件编辑返回 `FS_STALE_VERSION`，需先重新 `read` 最新文件内容，将改动基于新内容重放后再重试，最终由 Lead 统一冻结写入（Freeze）、审查 Diff 并运行最终验证。
   - **任务就绪不会自动启动 Owner**：即使通过 `reassign` 指派了任务，或前置依赖任务 `complete` 使后续任务变为 `ready: true`，处于 `inactive` 状态的队友也**不会自动启动**；Lead 或完成前置任务的队友必须通过 `team_message` 发消息通知目标队友。

### 4.4 容量上限对比：活动并发（2） vs. 团队名额（8）

- **活动并发上限 `2`（`maxActiveSubagents: 2`）**：无论创建的是普通子任务还是团队队友，每棵 activation 树中在线及正在物化的子级容量为 **2**（根主控不计）；等待、待处理收件箱及停止清理也可能占用容量，且最大深度为 **1**（队友或 Worker 不能再嵌套创建子团队或孙代理）。
- **团队累计名额 `8`**：单个会话中通过 `spawn_teammate` 创建的命名队友总数上限默认为 **8**。已处于 `inactive` 或创建失败（`failed`）的队友依然占用该名额，且同一会话内不能重复使用已注册过的队友名称。因此，应复用已有的命名队友（通过 `team_message` 发送新切片任务），而不是频繁创建一次性新队友。

---

## 5. 故障排查详解（Troubleshooting）

### 5.1 安装与激活类问题

- **问题：在终端运行 `plugin_manager` 提示 `command not found`**
  - **原因**：`plugin_manager` 是 DSH 提供给 AI 助手的内置工具（Tool），不是操作系统的 Shell 命令。
  - **解决**：在 DSH 聊天会话中让助手调用 `plugin_manager` 工具。
- **问题：安装后设置页没有「星衡 · 子代理配置」，或设置页顶部警告「星衡预设未激活」**
  - **原因**：`plugin_manager` 安装结果返回了 `application: "restart-required"`，或者浏览器页面尚未刷新。
  - **解决**：先重启原有的 DSH Host 服务进程（如果要求重启），然后刷新当前浏览器页面。不要启动另一个端口的替代服务。
- **问题：升级到 `3.0.0` 后，在旧会话里看不到 `team_roster`、`spawn_teammate` 或 `subagent_message`**
  - **原因**：仍运行的 Agent 保留内存预设 revision，不会自动替换挂载列表；重启恢复则按日志中的预设 ID 解析当前定义。
  - **解决**：确保 Host 已加载 `3.0.0`，然后点击 **新建会话** 并选择 **星衡 · 协作（`xingheng`）** 预设。

### 5.2 配置保存与校验类问题

- **问题：保存按钮呈禁用状态，或卡片下方出现黄色警告「当前配置中的项目不在目录中；请重新选择后保存」**
  - **原因**：当前已保存的配置或草稿（例如点击「填入初始组合」填入的模型）不在当前 DSH 已注册的提供商/模型目录中，或者该模型加载元数据失败（`model.error`）。
  - **解决**：依次在提供商、模型、推理强度下拉框中选择当前可用且无报错的选项，当三路角色均有效且与已保存状态不同（`dirty`）时，保存按钮即恢复可用。
- **问题：点击保存或调用 `xingheng_config` 返回 `HTTP 409` / `Configuration conflict`**
  - **原因**：双阶段 CAS 检测到当前提交的 `expectedRevision` 与服务器最新保存的配置不一致（例如同时在另一个标签页或通过命令修改了配置）。
  - **解决**：在 UI 中点击 **「重新读取」**（或在工具中先执行 `action: "read"` 获取最新 `revision`），在最新快照基础上重新修改并保存。
- **问题：POST `/api/xingheng/v3` 返回 `HTTP 400` / `413` / `415`**
  - **原因**：
    - `400`：缺少 `iterate`/`implement`/`analyze` 任一角色、包含未知字段、ID 含有首尾空格，或所选提供商/模型/推理强度不被当前 `llm` 服务支持。
    - `413`：解析后的 JSON 再序列化后超过 `12000` 个 JavaScript 字符单元；不是严格的 UTF-8 字节限制。
    - `415`：POST 请求未设置 `Content-Type: application/json`。
  - **解决**：核对请求头与三路完整结构，确保所有 ID 与 `action: "read"` 返回的 `providers` 目录严格一致。

### 5.3 委派与团队协作类问题

- **问题：调用 `subagent_iterate/implement/analyze` 时传入 `model` 参数被拒绝（`selection is disabled`）**
  - **原因**：星衡故意锁定了 `modelSelection: false`，防止主控在调用参数中绕过用户在 UI 中设定的角色模型路由。
  - **解决**：移除调用参数中的 `provider`/`model` 字段；若用户确实要求更换某角色的模型，先通过设置页或 `xingheng_config` 保存新路由，再调用 `subagent_iterate/implement/analyze`。
- **问题：模型遇到 API 401/403 鉴权失败、配额耗尽（Quota）或沙箱权限拒绝时，主控试图换用其他子代理角色重试**
  - **原因**：鉴权、配额与沙箱权限属于基础设施或策略阻断（Infrastructure / Policy Blocker），并非模型能力不足。
  - **解决**：遵循星衡协作规范，直接向用户如实报告该鉴权/配额/权限错误，**不要**将其当作模型失败而升级或切换到其他角色重试。

> **别名可见性排查**：若已重启的新会话仍缺少 `team_*` 别名，但原生 `list_agents` / `send_message` / `interrupt_agent` 存在，可使用原生团队接口，并记录宿主版本、插件激活状态与工具目录供诊断。单凭模型说“没有工具”不能判断注册失败，也不能保证重建会话即可解决所有启动顺序问题。
