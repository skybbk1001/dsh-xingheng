# 贡献指南 / Contributing

`@local/dsh-xingheng` 的仓库是 [GitHub 私有仓库](https://github.com/skybbk1001/dsh-xingheng)，需要授权账号才能访问；没有发布到 npm。

---

## 中文

### 1. 环境

- Node.js `>=22`，目标宿主 DeepSeek Harness (DSH) `>=0.2.2-rc.1 <0.3`，实际基线是 `0.2.2-rc.1`。
- 装依赖时禁用外部构建脚本：

  ```sh
  npm ci --ignore-scripts
  ```

### 2. 代码边界

- **配置与校验只走一条路径**。Host 端逻辑都放在 [`src/`](src/)。Web UI（`POST /api/xingheng/v3`）、助手工具（`xingheng_config`）和斜杠命令（`/xingheng`）必须共用同一个 `operate()` 校验，以及同一个 `ConfigEditor` 双 CAS 持久化路径。
- **复用原生执行器和权限**：
  - 普通子任务委派（[`src/role-routing.js`](src/role-routing.js)）和控制别名（[`src/controls.js`](src/controls.js)）直接委托给固定版本的 `@deepseek-ai/dsh-tool-subagent` 和 `@deepseek-ai/dsh-tool-subagent-control`，不要自己重写子会话生命周期或血缘权限校验。
  - 团队别名（[`src/team-controls.js`](src/team-controls.js)）只在 `agentTeams.tryMembership(agent)` 成立的成员作用域里注册 `team_roster`、`team_message`、`team_interrupt`，原生执行器、参数 Schema 和调用者身份都保持不变。不要给普通 `xingheng-worker` 授予团队权限。
- **便携性与客户端**：
  - [`cordis.patch.yml`](cordis.patch.yml) 里不能出现本地绝对路径（比如 `/home/...`）。
  - [`client.js`](client.js) 用宿主提供的原生 React 和 `--dsw-alias-*` 主题变量。不要引入 Vue、iframe、外部 `@deepseek-ai/*` 客户端包或旧版 `--color-*` 变量。

### 3. 提交前

在仓库根目录跑通全部静态检查、单元测试和打包预览：

```sh
npm run verify
npm run pack:check
```

- 改动涉及配置校验、CAS 修订号冲突、AbortSignal 取消、下一子代理路由快照、普通控制别名（`subagent_*`）或团队别名（`team_*`）的，都要在 [`test/`](test/) 补上对应的回归测试。
- 实装验证用 DSH 助手工具 `plugin_manager` 装进现有的 Web Profile，在原有 GUI 上测，不要另起端口的服务。
- 严格区分 Mock / 单元测试和真实浏览器 / 真实模型调用验收，在 [`docs/acceptance.md`](docs/acceptance.md) 和 [`docs/migration.md`](docs/migration.md) 里如实写下验证过的和没验证的。
- 不要提交 API 密钥、Cookie、会话日志、启动 Token，也不要提交未经实证的模型价格、速度或能力排名。

### 4. 3.1 的隔离回归要求

- 策略必须经 Host 服务按实际 Agent 查询，不能从插件私有的 scope 库反解宿主身份。
- 用真实的 DSH Tools/Scope 注册表测试：保留 read、遮蔽继承的 mutation 和 browser 工具、切换到其他预设后解除掩码、guard 拒绝近层逃逸、卸载后无残留。只用 mock 检查 allow 数组不足以证明隔离。

---

## English

### 1. Environment

- Node.js `>=22`, targeting DeepSeek Harness (DSH) `>=0.2.2-rc.1 <0.3`, with `0.2.2-rc.1` as the actual baseline.
- Install with lifecycle scripts disabled:

  ```sh
  npm ci --ignore-scripts
  ```

### 2. Code boundaries

- **One validation and persistence path.** Keep Host logic in [`src/`](src/). The Web UI (`POST /api/xingheng/v3`), the `xingheng_config` tool and the `/xingheng` command must share the same `operate()` validation and the same serialized `ConfigEditor` double-CAS persistence.
- **Reuse native executors and authority.**
  - Ordinary delegation ([`src/role-routing.js`](src/role-routing.js)) and the ordinary control aliases ([`src/controls.js`](src/controls.js)) delegate to the pinned `@deepseek-ai/dsh-tool-subagent` and `@deepseek-ai/dsh-tool-subagent-control` packages. Do not reimplement child lifecycle or lineage checks.
  - Team aliases ([`src/team-controls.js`](src/team-controls.js)) install `team_roster`, `team_message` and `team_interrupt` only where `agentTeams.tryMembership(agent)` holds, keeping the native executors, schemas and caller authority intact. Never grant team tools to an ordinary `xingheng-worker`.
- **Portability and the client.**
  - No local absolute paths (such as `/home/...`) in [`cordis.patch.yml`](cordis.patch.yml).
  - Keep [`client.js`](client.js) in plain JavaScript on the host React runtime with `--dsw-alias-*` tokens. No Vue, no iframes, no `@deepseek-ai/*` client imports, no legacy `--color-*` tokens.

### 3. Before you submit

Run every static check, unit test and the pack preview from the repository root:

```sh
npm run verify
npm run pack:check
```

- Add regression tests in [`test/`](test/) for anything touching validation, CAS revision conflicts, AbortSignal cancellation, next-child route snapshots, ordinary control aliases (`subagent_*`) or team aliases (`team_*`).
- Verify the implementation by installing through `plugin_manager` into the existing Web profile and testing on the original GUI, not on a replacement server.
- Keep mock and unit coverage clearly separate from real browser and live-model acceptance, and record what was and was not verified in [`docs/acceptance.md`](docs/acceptance.md) and [`docs/migration.md`](docs/migration.md).
- Never commit API keys, cookies, session logs or launch tokens, and never claim model price, speed or capability rankings you have not measured.
- Authorized collaborators open pull requests against the [private repository](https://github.com/skybbk1001/dsh-xingheng).

### 4. 3.1 isolation regressions

- The policy resolves the real agent through Host services; it never derives host identity from a plugin-private scope library.
- Test against the real DSH Tools/Scope registry: preserved reads, masked inherited mutation and browser tools, mask release on preset switch, guard denial of nearer-scope escape, and clean teardown. An allowlist-array mock does not prove isolation.