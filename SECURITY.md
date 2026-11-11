# 安全策略 / Security Policy

## 支持版本 / Supported Versions

| 版本 (Version) | 支持状态 (Supported) | 适配 DSH 基线 (Target DSH Version) |
| :--- | :--- | :--- |
| `3.x` | 当前维护 (Current) | `0.2.2-rc.1`（见 [验收记录](docs/acceptance.md#300-底层角色重命名验收--2026-11-10)） |
| `< 2.0.0`（旧实验草稿 / `economy` 拆分包） | 不再支持 (No) | 已废弃并清理（见 [迁移说明](docs/migration.md)） |

---

## 中文

### 信任模型

`@local/dsh-xingheng` 是插件，运行在 DSH Host 进程和 Web 客户端里。装这个包，就等于信任这个仓库的本地代码。

通过 `plugin_manager` 安装或移除插件，需要会话具备 `danger-full-access`，或者用户对那次调用明确审批；这类操作影响当前 Profile 下的所有会话。

### 传输与凭据

配置端点 `/api/xingheng/v3` 通过 DSH 原生的 `connection.fetch.register` 注册。Host/Origin 信任、同源签名 Cookie 和 Owner 权限都由 DSH `Connection` 统一校验，插件本身不启动任何独立 HTTP 服务。

请求和响应里只有提供商 ID、模型 ID、推理强度档位和 CAS 修订号字符串。模型 API 密钥和会话凭据既不传输，也不读取、不存储。

### 配置校验

保存时严格校验 `iterate`、`implement`、`analyze` 三路角色：拒绝未知字段、空 ID 和首尾空白，并通过 `llm` 服务核实提供商、模型和推理档位都已注册且受支持。修订号对不上就整体拒绝，不做部分写入。

普通子代理委派固定 `modelSelection: false`。`subagent_iterate`、`subagent_implement`、`subagent_analyze` 都不接受 `provider` 或 `model` 参数，主控无法在调用参数里覆盖用户配置的模型路由。

`xingheng_config` 对主控可见。「只在用户要求时修改」是提示词约定，不是插件另加的权限检查；读配置用于正常诊断，随时可以调。

### 工具掩码与沙箱的区别

[`src/worker-policy.js`](src/worker-policy.js) 会给 `xingheng-worker` 施加工具白名单（移除浏览器、网络搜索、IM 和再委派工具）。这裁剪的是 DSH 的工具调用面，**拦不住 `bash` / `pwsh` 里发起的操作系统级网络请求**。

预设提示词里的写入范围、验证权限（`Validation = NONE`）和 12 步 / 10 分钟软检查点，都是模型协作约定，不是操作系统沙箱、配额管理器或计费上限。文件读写和命令执行的最终隔离仍由 DSH 原生文件沙箱策略把关。宿主侧的 `maxDepth: 1` 和 `maxActiveSubagents: 2` 只管委派资源，不隔离文件或网络。

### 团队别名的权限

[`src/team-controls.js`](src/team-controls.js) 只对通过 `agentTeams.tryMembership(agent)` 验证过的团队成员挂载 `team_roster`、`team_message`、`team_interrupt`，原生执行器的调用者身份校验完全保留（例如只有 Team Lead 能中断）。非团队成员如普通 Worker 拿不到团队控制权。

### 3.1 分析单元的能力边界

`xingheng-analyst` 显式不注册文件写入和 Shell 工具。Host 生命周期策略监听创建、空白会话预设选择和销毁，给分析/执行预设安装允许表掩码；更近层的本地注册可能躲过 Schema 隐藏，所以还有 guard 拒绝非允许调用。

分析单元仍可读取获准文件、向父级发送消息。这里给出的是工具层面的约束，不是对所有副作用或数据泄露的数学保证，也不隔离受信任的 Host 插件。

原生 Team 的顶层成员可能获得近层工具；策略 guard 不会允许它们在内部分析预设里执行非允许操作。运行时通过 Host 服务解析实际 Agent，避免不同模块实例间混用 scope 身份。

### 报告安全问题

- 仓库目前是[私有仓库](https://github.com/skybbk1001/dsh-xingheng)，公开之前没有配置公共漏洞接收邮箱。
- 请通过仓库所有者的私下渠道报告，附上受影响版本、最小复现步骤和影响范围。
- 不要在 Issue、Pull Request 或提交记录里粘贴真实的 API 密钥、Cookie、带启动 Token 的 URL 或用户会话日志。

---

## English

### Trust model

`@local/dsh-xingheng` is a plugin that runs inside the DSH Host process and the Web client. Installing it means trusting this repository's local code.

Installing or removing bundles through `plugin_manager` requires `danger-full-access` in the session, or explicit user approval for that call, and affects every session in the profile.

### Transport and credentials

The configuration endpoint `/api/xingheng/v3` registers through DSH `connection.fetch.register`. Host/Origin validation, signed-cookie authentication and owner authorization are all enforced by the DSH `Connection`; the plugin starts no standalone HTTP server.

Requests and responses carry only provider IDs, model IDs, reasoning effort IDs and CAS revision strings. Model API keys and session credentials are never transmitted, read or stored.

### Configuration validation

Saves validate all three roles — `iterate`, `implement`, `analyze` — rejecting unknown fields, empty IDs and surrounding whitespace, then confirm through the `llm` service that the provider, model and effort are registered and supported. A stale revision rejects the whole write rather than persisting part of it.

Ordinary delegation pins `modelSelection: false`. `subagent_iterate`, `subagent_implement` and `subagent_analyze` accept no `provider` or `model` argument, so the Lead cannot override the user's configured routes through call arguments.

`xingheng_config` is visible to the Lead. "Change routes only when the user asks" is a prompt convention, not an extra permission check inside the plugin; reading configuration for routine diagnostics is always allowed.

### Tool masking is not a sandbox

[`src/worker-policy.js`](src/worker-policy.js) applies a tool allowlist to `xingheng-worker` (removing browser, web search, IM and delegation tools). That trims the DSH tool surface; **it does not block OS-level network access from inside `bash` or `pwsh`**.

Prompt-level write scopes, validation rules (`Validation = NONE`) and the 12-call / 10-minute soft checkpoint are collaboration conventions, not an OS sandbox, a quota manager or a billing cap. The DSH file sandbox policy remains the authority on file and process access. `maxDepth: 1` and `maxActiveSubagents: 2` govern delegation resources only; they do not isolate files or network.

### Team alias authority

[`src/team-controls.js`](src/team-controls.js) installs `team_roster`, `team_message` and `team_interrupt` only on agents where `agentTeams.tryMembership(agent)` holds, preserving the native caller checks (Lead-only interrupts, for example). Non-members such as ordinary workers get no team control.

### 3.1 analyst capability boundary

`xingheng-analyst` registers no filesystem mutation or shell tools. A Host-owned lifecycle policy listens for creation, blank-session preset selection and teardown, and installs allowlist masks on the analyst and worker presets; nearer agent-local registrations can escape schema hiding, so a guard rejects disallowed calls as well.

The analyst can still read authorized files and message its parent. What this provides is a tool-level constraint, not a mathematical guarantee against every side effect or data leak, and it does not isolate trusted Host plugins.

Top-level native Team members may pick up nearer-scope tools; the guard still refuses disallowed execution inside the analyst preset. Runtime code resolves the actual agent through Host services, so scope identity is never mixed across module instances.

### Reporting a vulnerability

- The repository is [private](https://github.com/skybbk1001/dsh-xingheng); no public reporting address exists until it is published.
- Report privately to the repository owner with the affected version, minimal reproduction steps and impact.
- Never post API keys, cookies, session logs or launch tokens in issues, pull requests or commits.