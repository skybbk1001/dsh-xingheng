# 贡献指南 / Contributing

感谢对 `@local/dsh-xingheng` 的关注与贡献。本仓库托管于 [GitHub 私有仓库](https://github.com/skybbk1001/dsh-xingheng)，需授权协作账号访问；未发布到公共 npm。

---

## 中文指南

### 1. 环境与安装

- 使用 **Node.js `>=22`**，目标宿主为 **DeepSeek Harness (DSH) `0.2.2-rc.1`**（`>=0.2.2-rc.1 <0.3`）。
- 安装依赖时必须禁用外部构建脚本：
  ```sh
  npm ci --ignore-scripts
  ```

### 2. 架构与代码边界

- **单一配置与校验路径**：所有 Host 端逻辑集中在 [`src/`](src/)。Web UI（`POST /api/xingheng/v2`）、Agent 工具（`xingheng_config`）与斜杠命令（`/xingheng`）必须共用同一个 `operate()` 校验与 `ConfigEditor` 双重 CAS 持久化路径。
- **复用原生执行器与权限**：
  - 普通子任务委派（[`src/delegation.js`](src/delegation.js)）与控制别名（[`src/controls.js`](src/controls.js)）必须直接委托给固定版本的 `@deepseek-ai/dsh-tool-subagent` 和 `@deepseek-ai/dsh-tool-subagent-control`，禁止自行重写子会话生命周期或血缘权限校验。
  - 原生智能体团队兼容别名（[`src/team-controls.js`](src/team-controls.js)）仅在 `agentTeams.tryMembership(agent)` 成立的成员作用域内注册 `team_roster`、`team_message`、`team_interrupt`，保持原生执行器、参数 Schema 与调用者身份不变，禁止给普通 `xingheng-worker` 授予团队权限。
- **便携性与客户端约束**：
  - [`cordis.patch.yml`](cordis.patch.yml) 中禁止出现任何本地绝对路径（如 `/home/...`）。
  - [`client.js`](client.js) 必须使用宿主提供的原生 React 与 `--dsw-alias-*` 主题变量，禁止引入 Vue、iframe、外部 `@deepseek-ai/*` 客户端包或旧版 `--color-*` 变量。

### 3. 质量门槛与测试要求

提交前必须在仓库根目录运行并通过全部静态检查、单元测试与打包预览：

```sh
npm run verify
npm run pack:check
```

- 任何涉及配置校验、CAS 修订号冲突、AbortSignal 取消、下一子代理路由快照、普通控制别名（`subagent_*`）或团队控制别名（`team_*`）的改动，都必须在 [`test/`](test/) 下补充对应的回归测试。
- 实装验证必须通过 DSH 助手工具 `plugin_manager` 安装到现有 Web Profile，并在原有 GUI 上测试，不要启动替代端口服务。
- 严格区分 **Mock / 单元测试** 与 **真实浏览器 / 真实模型调用验收**，在 [`docs/acceptance.md`](docs/acceptance.md) 与 [`docs/migration.md`](docs/migration.md) 中如实记录已验证项与未验证边界。
- **严禁提交**：任何 API 密钥、Cookie、会话日志、启动 Token，或未经实证的模型价格、速度、能力排名声明。

---

## English Guidelines

### 1. Environment & Setup

- Requires **Node.js `>=22`** and targets **DeepSeek Harness (DSH) `0.2.2-rc.1`** (`>=0.2.2-rc.1 <0.3`).
- Install dependencies with lifecycle scripts disabled:
  ```sh
  npm ci --ignore-scripts
  ```

### 2. Architectural Invariants

- **Single Validation & Persistence Path**: Keep Host operations in [`src/`](src/). The Web UI (`POST /api/xingheng/v2`), agent tool (`xingheng_config`), and slash command (`/xingheng`) must share the exact same `operate()` validation and serialized `ConfigEditor` double-CAS persistence path.
- **Native Executor & Authority Reuse**:
  - Ordinary role delegation ([`src/delegation.js`](src/delegation.js)) and ordinary control aliases ([`src/controls.js`](src/controls.js)) must wrap the pinned native `@deepseek-ai/dsh-tool-subagent` and `@deepseek-ai/dsh-tool-subagent-control` packages without reimplementing child lifecycle or lineage checks.
  - Team control aliases ([`src/team-controls.js`](src/team-controls.js): `team_roster`, `team_message`, `team_interrupt`) must install only on agents with verified `agentTeams.tryMembership(agent)`, preserving native executors, schemas, and caller authority while never granting Team tools to ordinary `xingheng-worker` subagents.
- **Portability & Client Constraints**:
  - Never hardcode local absolute paths (such as `/home/...`) in [`cordis.patch.yml`](cordis.patch.yml).
  - Keep [`client.js`](client.js) in plain JavaScript using the host React runtime and `--dsw-alias-*` CSS tokens; do not use Vue, iframes, `@deepseek-ai/*` client imports, or legacy `--color-*` tokens.

### 3. Quality Gates & Pull Requests

Run all checks before submitting a change:

```sh
npm run verify
npm run pack:check
```

- Add regression tests in [`test/`](test/) for rejected routes, stale CAS revisions, cancellation, next-child delegation parameters, ordinary control aliases (`subagent_*`), and Team control aliases (`team_*`).
- Install and verify using the assistant's `plugin_manager` tool against the existing DSH Web GUI rather than spawning replacement servers.
- Clearly distinguish unit/mock coverage from real browser and live model acceptance in [`docs/acceptance.md`](docs/acceptance.md) and [`docs/migration.md`](docs/migration.md).
- Authorized collaborators may open pull requests against the [private repository](https://github.com/skybbk1001/dsh-xingheng). Never include API keys, cookies, session logs, launch tokens, or fabricated model price/performance rankings in commits, issues, or pull requests.
