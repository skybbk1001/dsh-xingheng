# 安全策略 / Security Policy

## 支持版本 / Supported Versions

| 版本 (Version) | 支持状态 (Supported) | 适配 DSH 基线 (Target DSH Version) |
| :--- | :--- | :--- |
| `3.x` | 当前维护 (Current) | `0.2.2-rc.1`（见 [验收记录](docs/acceptance.md#300-底层角色重命名验收--2026-11-10)） |
| `< 2.0.0`（旧实验草稿 / `economy` 拆分包） | 不再支持 (No) | 已废弃并清理（见 [迁移说明](docs/migration.md)） |

---

## 安全边界说明（中文）

1. **宿主信任模型（Host Code Execution）**：
   - `@local/dsh-xingheng` 作为 DSH 插件包运行在 DSH Host 进程与 Web 客户端内。安装本包即代表信任本仓库的本地代码。
   - 通过 `plugin_manager` 安装或移除插件需要会话具备 `danger-full-access` 权限或经用户明确审批；该操作会影响当前 Profile 下的所有会话。
2. **连接鉴权与无凭据传输（Authenticated Transport）**：
   - 配置端点 `/api/xingheng/v3` 通过 DSH 原生 `connection.fetch.register` 注册，由 DSH `Connection` 统一强制校验 Host/Origin 信任、同源签名 Cookie 与 Owner 权限。本插件不启动任何独立的未鉴权 HTTP 服务。
   - 配置读取与保存请求仅包含提供商 ID、模型 ID、推理强度档位与 CAS 修订号字符串，**不传输、不读取也不存储任何模型 API 密钥或会话凭据**。
3. **严格目录校验与禁止静默覆盖（Fail-Closed Route Validation）**：
   - 保存配置时严格校验 `iterate`、`implement`、`analyze` 三路角色，拒绝未知字段、空 ID 或首尾空白字符，并通过 `llm` 服务核实提供商、模型与推理档位均已注册且受支持。
   - 普通子代理委派固定设置 `modelSelection: false`，禁止主控在调用 `subagent_iterate/implement/analyze` 时通过参数覆写用户配置的模型路由。
   - `xingheng_config` 对主控可见；“仅按用户要求修改”是提示词约定，不是插件另加的权限检查。读取配置可以用于正常诊断。
4. **子代理工具掩码与沙箱边界（Tool Mask vs. OS Sandbox）**：
   - [`src/worker-policy.js`](src/worker-policy.js) 对 `xingheng-worker` 子代理施加工具白名单限制（移除浏览器、网络搜索、IM 及再次委派工具），但这仅裁剪 DSH 工具调用面，**不等于阻止 `bash` / `pwsh` 命令发起操作系统级网络请求**。
   - 预设提示词中的写入范围（`write_scopes`）、验证权限（`Validation = NONE`）与 12 步/10 分钟软检查点属于模型协作规约，**不是操作系统沙箱、配额管理器或计费上限（Billing Cap）**。文件读写与命令执行的最终强制隔离仍由 DSH 原生文件沙箱策略（Sandbox Mode）控制；宿主深度/容量限制（`maxDepth: 1`、`maxActiveSubagents: 2`）只管理委派资源，不隔离文件或网络访问。
5. **团队控制别名权限隔离（Team Alias Authority）**：
   - [`src/team-controls.js`](src/team-controls.js) 仅对通过 `agentTeams.tryMembership(agent)` 验证的团队成员挂载 `team_roster`、`team_message`、`team_interrupt`，完全保留原生执行器的调用者身份校验（例如仅 Team Lead 可执行中断），不会向非团队成员（如普通 Worker）泄露团队控制权。

### 3.1 分析单元的能力边界

`xingheng-analyst` 显式不注册文件写入与 Shell 工具。Host 生命周期策略监听创建、空白会话预设选择和销毁，并为分析/执行预设安装允许表掩码；更近层本地注册可能免于 Schema 隐藏，因此 guard 还拒绝非允许调用。分析仍可读取获准文件、向父级发送消息，不是对所有副作用或数据泄露的数学保证。受信 Host 插件不受此模型工具策略隔离。

原生 Team 顶层成员可能获得近层工具；策略 guard 不允许其在内部分析预设中执行非允许操作。普通分析子任务的实际目录以验收日志为准。代码通过 Host 服务解析实际 Agent，避免不同模块实例的 scope 身份混用。

### 漏洞与安全问题报告

- 本项目当前托管于 [GitHub 私有仓库](https://github.com/skybbk1001/dsh-xingheng)，在仓库公开前未配置公共漏洞接收邮箱。
- 请通过私有仓库所有者渠道私下报告安全问题，并提供受影响版本、最小复现步骤与影响范围。
- **严禁在任何 Issue、Pull Request 或提交记录中粘贴真实的 API 密钥、Cookie、带启动 Token 的 URL 或用户会话日志。**

---

## Security Boundaries & Reporting (English)

1. **Host Trust & Profile Scope**:
   - `@local/dsh-xingheng` executes trusted code inside the DSH Host process and Web client, and persists configuration into the active DSH profile.
   - Installing or removing bundles via `plugin_manager` requires `danger-full-access` permission or explicit user approval for that call, and changes affect every session in the profile.
2. **Authenticated Endpoint & Credential Isolation**:
   - `/api/xingheng/v3` is registered through DSH `connection.fetch.register`, which enforces Host/Origin validation, signed-cookie authentication, and owner authorization before invoking the handler. No standalone unauthenticated HTTP server is created.
   - Configuration payloads contain only provider IDs, model IDs, reasoning effort IDs, and CAS revision strings—never API keys or user credentials.
3. **Fail-Closed Validation & Fixed Delegation Routes**:
   - Saves fail closed on unknown keys, whitespace-padded IDs, unadvertised models, unsupported reasoning efforts, or stale CAS revisions (`expectedRevision`).
   - Ordinary role tools (`subagent_iterate`, `subagent_implement`, `subagent_analyze`) enforce `modelSelection: false` so the Lead cannot override user-configured routes per invocation.
   - The preset instructs agents to change routes only when requested by the user. This is a prompt convention, not an additional authorization check in the plugin; reads can support routine diagnostics.
4. **Worker Capability Mask vs. Sandbox Authority**:
   - [`src/worker-policy.js`](src/worker-policy.js) restricts the DSH tool catalog visible to `xingheng-worker` (removing browser, search, IM, and delegation tools), which limits the tool surface but **does not block OS-level network access inside `bash` or `pwsh`**.
   - Prompt-level write scopes, validation rules (`Validation = NONE`), and soft checkpoints (12 calls / 10 minutes) are behavioral conventions, **not a security sandbox, quota manager, or billing cap**. Native DSH file sandbox permissions and subagent limits (`maxDepth: 1`, `maxActiveSubagents: 2`) remain authoritative.
5. **Team Alias Authority Preservation**:
   - [`src/team-controls.js`](src/team-controls.js) installs `team_roster`, `team_message`, and `team_interrupt` only on agents with verified `agentTeams.tryMembership(agent)`, preserving native caller checks (e.g., Lead-only interrupts) and never granting Team membership to ordinary workers.

### Reporting a Vulnerability

- Current maintenance target: `3.x` on the exact DSH baseline (`0.2.2-rc.1`) documented in the [Acceptance Record](docs/acceptance.md#300-底层角色重命名验收--2026-11-10).
- Contact the [private repository](https://github.com/skybbk1001/dsh-xingheng) owner privately with the affected version, minimal reproduction steps, and impact assessment. No public reporting address is configured while the repository remains private.
- **Never post API keys, cookies, session logs, or launch tokens in issues, pull requests, or commits.**


## 3.1 capability policy (English)

The analyst preset explicitly omits filesystem mutation and shell registrations. A Host-owned lifecycle policy masks inherited tools on creation and blank-session preset changes, releases its effects on teardown, and guards non-allowlisted invocations including nearer own-scope registrations. Reads and parent messages remain possible; this is not a blanket side-effect or data-loss guarantee, nor an OS sandbox against trusted Host plugins. Runtime code asks the Host registry to resolve the Agent instead of mixing module-private scope identities across installations.
