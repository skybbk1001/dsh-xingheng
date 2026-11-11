# 星衡（Xingheng）使用与故障排查

面向 `@local/dsh-xingheng` `3.1.0`：安装与激活、三路普通子任务配置、原生 Agent Teams 与普通子代理的分工、工具别名与寻址方式、权限与修订号机制，以及常见故障。

[返回中文首页](../README.md) · [English Usage Guide](usage.en.md) · [系统架构](architecture.md) · [迁移与清理](migration.md) · [验收记录](acceptance.md)

---

## 1. 安装与激活

### 1.1 前置条件

- **Node.js**：`>=22`
- **Profile 前置组件**：需要已启用 DSH 官方的 `dsh-base`、`dsh-web-app` 和 `dsh-experimental-agent-team-profile` 组合包。星衡复用这些包提供的服务，缺少 Team 服务时不会另起一套实现。
- **DeepSeek Harness (DSH)**：`>=0.2.2-rc.1 <0.3`。当前版本直接复用 `0.2.2-rc.1` 的 `@deepseek-ai/dsh-tool-subagent` 与 `@deepseek-ai/dsh-tool-subagent-control`。
- **会话权限**：调用 `plugin_manager` 需要当前会话具备 `danger-full-access`，或在弹窗里明确批准那一次调用。

### 1.2 用 `plugin_manager` 安装

在 DSH 会话里对助手说：

> 请调用 `plugin_manager` 工具（`action: "install_bundle"`，target 为 `/absolute/path/dsh-xingheng`）安装星衡插件。

`plugin_manager` 是助手工具，不是 Shell 命令。正确做法是由助手在回合里发起 `plugin_manager({ action: "install_bundle", target: "/absolute/path/dsh-xingheng" })`；在终端或 `bash` 工具里敲 `plugin_manager ...` 找不到这个命令，手工改 Profile 的 YAML/JSON 也不是安装方式。

看返回里的 `application` 和 `warnings`：

- `application: "applied"`：Host 服务与预设已经热加载进当前进程，刷新浏览器页面即可。
- `application: "restart-required"`（有时伴随 `unmanaged-plugin` 提示）：已加载的底层模块需要在新进程里重新初始化。这时必须重启正在运行的 DSH Host 进程，重启完再刷新页面。

刷新网页（F5）只重新加载前端资源，不会重启后端。另外起一个其他端口的 DSH 服务，也不会更新当前浏览器连着的那个 GUI。

---

## 2. 配置三路普通子代理

三路配置共用同一套后端校验和 `ConfigEditor` 原子持久化，入口有三个：Web 设置界面、`xingheng_config` 助手工具、`/xingheng` 斜杠命令。

### 2.1 角色定义与初始组合

| 角色 | 英文名 | 典型任务 | 初始组合 |
| :--- | :--- | :--- | :--- |
| 快速迭代 | Quick iteration | 局部修复、小改进、单点检查 | `zero` / `deepseek-v4.1-flash-1017` / `high` |
| 特性实现 | Feature implementation | 功能开发、接口实现、测试编写 | `zero` / `gpt-6.1-sol` / `medium` |
| 分析规划 | Analysis and planning | 代码审查、架构分析、复杂问题诊断 | `zero` / `gpt-6.1-terra` / `high` |

显示名、配置键和委派工具 ID 都按任务职责命名。下面这三个标识是唯一受支持的，没有旧角色键，也没有旧工具名的兼容解析。

| 角色 | 配置键 | 委派工具 ID | 绑定的预设 |
| :--- | :--- | :--- | :--- |
| 快速迭代 | `iterate` | `subagent_iterate` | `xingheng-worker`，受控读写 + Shell |
| 特性实现 | `implement` | `subagent_implement` | `xingheng-worker`，受控读写 + Shell |
| 分析规划 | `analyze` | `subagent_analyze` | `xingheng-analyst`，只读 |

在界面里或用自然语言提任务时，用角色名就行。写 JSON、调工具、读源码时必须用上表的实际标识，别把中文角色名当 JSON 键。

上表的 `DEFAULT_WORKERS` 只是初始值，也是「填入初始组合」按钮的草稿模板。它不构成对模型质量、速度或价格的排名建议。如果当前模型目录里没有这些提供商或模型，保存会被拒绝，得改成目录里实际存在的。

### 2.2 方式一：Web 设置界面

1. 打开 DSH Web 界面的**设置**。
2. 左侧选**星衡 · 子代理配置**（英文界面为 Xingheng · Subagent configuration）。
3. 给 **01 快速迭代**、**02 特性实现**、**03 分析规划**分别选：
   - **提供商**：来自 `llm.listProviders()`。换提供商会清空该角色的模型和推理强度草稿，避免跨提供商残留无效 ID。
   - **模型**：来自 `llm.listModels(provider)`。换模型会重置该角色的推理强度草稿。
   - **推理强度**：来自 `llm.resolveModelInfo(provider, model)` 声明支持的档位，或者选「原生默认（同模型可继承主控）」，即空字符串 `""`。
4. 看底部状态栏：
   - 改动后显示「有未保存的更改」。
   - 点「保存配置」，请求发到 `./api/xingheng/v3`。成功后界面用服务端回读的快照更新，并提示「已保存并回读确认；下一个子代理将使用新配置。」
   - 想放弃草稿就点「重新读取」，确认弹窗即可。

### 2.3 方式二：`xingheng_config` 助手工具

只有在用户明确要求读改星衡子代理配置时，助手才调用 `xingheng_config`。没有用户要求，主控不得自己改路由。

**读取当前配置与可用目录**：

```json
{
  "action": "read"
}
```

返回里有 `version`（`"3.1.0"`）、`workers`（三路当前生效配置）、`revision`（CAS 修订号字符串）、`providers`（每个提供商下的 `models`、`efforts`、`defaultEffort`）、`preset`（`xingheng` 预设摘要）和 `applies`（`"next-child"`）。

**保存完整配置**，必须带上最新 `expectedRevision` 和三路完整的 `workers`：

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

### 2.4 方式三：`/xingheng` 斜杠命令

- **读**：`/xingheng` 不带参数，打印当前快照 JSON。
- **写**：`/xingheng {"action":"save","expectedRevision":"...","workers":{...}}`，走同一套 CAS 校验的完整保存。

---

## 3. 普通角色子任务

当任务是边界清楚的局部改动、独立功能，或者单点审查，并且不需要多代理之间互发消息、也不需要共享任务看板时，用普通角色子任务。

### 3.1 启动与路由规则

主控调用 `subagent_iterate`、`subagent_implement` 或 `subagent_analyze`，参数是：

- `description`：3–5 个词的短标签，用于界面展示。
- `prompt`：完整、自包含的任务说明。普通子任务走 `spawn`，是全新上下文，看不到主控的历史，所以下面三项必须在 prompt 里写清楚：
  1. **写入范围**：允许修改的具体文件路径，没列出的路径一律只读。
  2. **验收标准**：什么情况算完成。
  3. **验证权限**：`xingheng-worker` 默认 `Validation = NONE`，即不许自行编译、跑测试、下载依赖或写临时测试跑起来。要让子代理跑特定命令，主控必须在 prompt 里明确授权那一条命令。
- `cwd`（可选）：子代理的初始工作目录。

三个工具都锁定了 `modelSelection: false`，不接受 `provider` 或 `model` 参数，模型按已保存的配置取。迭代和实现路由到 `xingheng-worker`，分析路由到 `xingheng-analyst`。

### 3.2 控制普通子任务

在 `xingheng` 主控预设里，控制普通子任务的工具统一成了 `subagent_*`。消息和中断用子会话 ID（`agent_id`），列表工具只收 `scope`，没有目标参数：

- `subagent_list`：列出当前主控启动的普通子代理（`scope` 取 `"children"` 或 `"descendants"`），给出 `id`、`label` 和 `status`（`running` 或 `inactive`）。
- `subagent_message`：向指定 `agent_id` 的直接子代理补发指令，或继续它已完成的对话，参数为 `{ agent_id: "<child-session-id>", message: "..." }`。
- `subagent_interrupt`：请求指定 `agent_id` 的子代理停下当前回合，参数为 `{ agent_id: "<child-session-id>" }`。

### 3.3 分工与交接

- **分析规划**：只有代码读取、检索和父子通信。没有 write/edit/Shell/jobs、浏览器、网络搜索、IM、配置修改或再委派工具。跑不了测试是设计如此，不要试图用别的工具绕过去。
- **特性实现**：按高内聚模块写实现和测试，不按文件数机械分摊。默认不做未授权的验证。
- **快速迭代**：已知问题的最小补丁，或执行主控明确授权的有限检查。别从角色名去推断实际快慢。
- 迭代和实现共用一个读写 Worker，并不代表它们有不同的 OS 权限。两者的差别是任务契约和提示词，不是两套沙箱。
- 复杂任务按「只读探路 → 稳定公共接口 → 独立模块实现 → 全新上下文审查固定版本 → 主控统一验证」推进。不要把全部实现历史转给审查者，给需求、diff、目标版本、约束和已知风险就够了。
- 并行分析读的是同一棵工作树，没有自动快照隔离，需要冻结写入或自己核对版本漂移。
- READY、检查点、冻结都是模型侧的约定，不是硬性超时，也不是自动验证闸门。交付要说明证据、改动范围、跑过和没跑的检查以及风险，主控核对过才算完成。

---

## 4. 原生 Agent Teams

当任务包含多个互相依赖的模块、需要共享任务看板协调进度，或者需要队友之间直接点对点通信时，用 DSH 原生智能体团队。

### 4.1 创建队友与模型继承

只有 Team Lead（`lead`）能调用 `spawn_teammate`：

- `name`：唯一的 `lower-kebab-case` 队友名，比如 `"api-impl"`、`"reviewer"`。
- `description`：职责简述。
- `prompt`：初始任务说明。
- `context`：可选 `"fresh"`（默认，全新上下文，不带主控历史）或 `"fork"`（继承主控已完成的回合历史，只在确实需要完整前文时才用）。

队友在创建时继承主控的有效模型和当前预设。当前 DSH 原生 `spawn_teammate` 不支持给单个队友指定模型，所以「设置 → 星衡 · 子代理配置」里的三路配置管不到团队队友。

### 4.2 团队通信与兼容别名

验收时遇到过模型声称原生通信工具不可用的情况（确切原因没确认）。为了让团队入口更明确，星衡在所有团队成员（Lead 和 Teammate）的作用域内额外注册了一组 `team_*` 别名。两者底层执行器、参数和权限完全相同，推荐优先用 `team_*`：

| 推荐别名 | 等价的原生工具 | 寻址参数 | 行为 |
| :--- | :--- | :--- | :--- |
| `team_roster` | `list_agents` | `{}` | 列出 Lead 和所有命名队友的名称（`target`）、角色与状态（`running` / `inactive` / `provisioning` / `failed`） |
| `team_message` | `send_message` | `target`（成员名，如 `"lead"` 或 `"reviewer"`）、`message` | 给目标队友或 `"lead"` 发消息。目标在跑就在最近的步骤边界收到；目标是 `inactive` 时会唤醒并开始新回合 |
| `team_interrupt` | `interrupt_agent` | `target`（队友名） | 仅 Team Lead 可调用。中断指定队友当前回合，同时保留它的待处理收件箱 |
| `wait_agent` | `wait_agent` | `timeout_ms`（`10000`–`3600000`，默认 `30000`） | 等这一次调用开始之后的下一次队友状态变更、新消息或共享任务变更。不会唤醒 `inactive` 成员；没有成员处于 `running` 或 `provisioning` 时立即返回 `noProgress` |

容易搞错的地方：

- 团队工具的参数是 `target`（填成员名），普通子任务工具（`subagent_message` / `subagent_interrupt`）的参数是 `agent_id`（填子会话 ID）。这两个别混。
- `inactive` 只表示当前没有回合在跑，不代表任务完成。
- 调 `wait_agent` 之前先用 `team_roster` 确认至少有一个必需的队友处于 `running` 或 `provisioning`。如果它在 `inactive`，得先用 `team_message` 唤醒，否则 `wait_agent` 会立刻返回 `noProgress`。

### 4.3 共享任务看板与修订号

团队成员用四个原生工具管理共享任务，状态存在原生 Session 日志里。不要另建 Markdown/JSON 文件来代替原生看板。

1. `team_task_create`：建一个待办任务，参数有 `subject`、`description`（写清验收标准）、`blocked_by`（前置任务 ID 数组）、`write_scopes`（建议的相对路径前缀数组）。
2. `team_task_list`：按 `status`（`pending` / `in_progress` / `completed`）、`ready`（前置是否都已完成）或 `owner` 筛选，返回每个任务的 `revision` 和写入范围重叠警告。
3. `team_task_get`：改或做某个任务之前，先读该 `task_id` 的最新详情和当前 `revision`。
4. `team_task_update`：带最新 `expected_revision` 做原子 CAS 流转。`action` 支持 `claim`、`release`、`edit`、`set_dependencies`、`complete`、`reopen`、`reassign`、`delete`。

标准顺序是 `team_task_list` → `team_task_get` 拿最新 `revision` → `claim` → 在约定好的 `write_scopes` 内改 → 带上新 `revision` 执行 `complete`。如果因为别人并发修改导致修订号冲突，重新 `team_task_get` 拿最新 revision 再试。

`write_scopes` 是协调提示，不是文件锁。团队成员共用一棵工作树，改动对所有人即时可见。写入要拆成互不重叠的路径前缀；编辑返回 `FS_STALE_VERSION` 时，先重新 `read` 最新内容，把改动重放到新内容上再试。最后由 Lead 冻结写入、审查 diff、跑最终验证。

任务就绪不会自动启动 Owner。不管是 `reassign` 指派，还是前置任务 `complete` 让后续任务变成 `ready: true`，处于 `inactive` 的队友都不会自己动起来。Lead 或完成前置的那个队友得用 `team_message` 通知它。

### 4.4 两种容量上限

- **活动并发 2**（`maxActiveSubagents: 2`）：每棵 activation 树里在线和正在物化的子级容量是 2，根主控不算。等待中的、收件箱有活的和正在停止清理的可能也占位。最大深度 1，即队友或 Worker 不能再往下嵌套。
- **团队累计名额 8**：单个会话里通过 `spawn_teammate` 创建的命名队友总数默认 8 个。`inactive` 的和创建失败（`failed`）的照样占名额，同一个会话里也不能重复使用已经注册过的名字。所以应该复用现有队友、用 `team_message` 派新活，而不是每来一点活就新建一个。

---

## 5. 故障排查

### 5.1 安装与激活

**终端里跑 `plugin_manager` 报 `command not found`**
`plugin_manager` 是 DSH 提供给助手的内置工具，不是操作系统的 Shell 命令。在 DSH 会话里让助手调用它。

**装完设置页没有「星衡 · 子代理配置」，或顶部警告「星衡预设未激活」**
多半是安装结果返回了 `application: "restart-required"`，或者页面还没刷新。先重启原来的 DSH Host 进程（如果需要），再刷新当前页面。不要另起一个端口的服务来代替。

**升到 `3.1.0` 后旧会话里看不到 `team_roster`、`spawn_teammate` 或 `subagent_message`**
运行中的 Agent 保留着内存里的预设 revision，挂载列表不会自动替换。确认 Host 已加载 `3.1.0` 后，点**新建会话**并选**星衡 · 协作**（`xingheng`）预设。

### 5.2 配置保存与校验

**保存按钮是灰的，或卡片下出现黄色警告「当前配置中的项目不在目录中；请重新选择后保存」**
当前保存的配置或草稿（比如点了「填入初始组合」填进去的模型）不在 DSH 已注册的提供商/模型目录里，也可能该模型加载元数据失败（`model.error`）。依次在三个下拉框里选当前可用且不报错的选项；三路都有效且与已保存状态不同（`dirty`）时，保存按钮会恢复。

**保存返回 `HTTP 409` / `Configuration conflict`**
双阶段 CAS 发现提交的 `expectedRevision` 和服务器最新的不一致，常见于同时在另一个标签页或用命令改过配置。在界面里点「重新读取」，或在工具里先 `action: "read"` 拿最新 `revision`，然后在最新快照上重做修改再保存。

**`POST /api/xingheng/v3` 返回 `HTTP 400` / `413` / `415`**

- `400`：缺 `iterate`/`implement`/`analyze` 中任一角色、带了未知字段、ID 首尾有空格，或所选提供商/模型/推理强度不被当前 `llm` 服务支持。
- `413`：解析后的 JSON 再序列化超过 `12000` 个 JavaScript 字符单元。这不是严格的 UTF-8 字节限制。
- `415`：POST 没设 `Content-Type: application/json`。

按请求头和三路完整结构逐项核对，所有 ID 都要和 `action: "read"` 返回的 `providers` 目录严格一致。

### 5.3 委派与团队协作

**调用 `subagent_iterate/implement/analyze` 时传 `model` 被拒（`selection is disabled`）**
星衡故意锁了 `modelSelection: false`，防止主控在调用参数里绕过用户在界面设定的角色路由。把 `provider`/`model` 去掉；如果用户确实要换某个角色的模型，先通过设置页或 `xingheng_config` 保存新路由，再调用。

**子代理遇到 API 401/403、配额耗尽或沙箱权限拒绝，主控想换个角色重试**
鉴权、配额和沙箱权限属于基础设施或策略阻断，不是模型能力不足。按协作规范，如实把这个错误报告给用户，不要当成模型失败去升级或换角色重试。

另外，如果重启后的新会话仍然缺 `team_*` 别名，但原生的 `list_agents` / `send_message` / `interrupt_agent` 都在，可以直接用原生接口，同时记下宿主版本、插件激活状态和工具目录供诊断。单凭模型说「没有工具」判断不了注册是否失败，重建会话也不保证解决所有启动顺序问题。

---

## 模型网关超时

实际日志里持续出现的 504 发生在 `zero / gemini-4-argon / high` 的上游，Cloudflare 返回 `origin_gateway_timeout`，意思是源站没在期限内响应。这既不是 GitHub 7890 代理端口的问题，也不是本地测试失败。报错本身没有证明唯一根因是模型推理耗时；源站负载、内部排队、转发和超时配置都应该由网关侧检查。

先记下提供商/模型、时间、HTTP 状态和请求标识（不要上传凭据或完整会话日志），按响应里的退避提示来，别连续点「继续」或无限自动重试。用户同意换路线时，显式选一个可用的提供商/模型；不要静默改写星衡的三路保存配置。单纯调大客户端超时，也不保证能越过源站或代理的服务端上限。