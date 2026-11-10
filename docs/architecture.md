# 系统架构（Architecture）

本文档基于 `@local/dsh-xingheng` `3.0.0` 的实际源码（[`src/`](../src/)、[`client.js`](../client.js)、[`cordis.patch.yml`](../cordis.patch.yml)），说明星衡如何在不侵入 DSH 核心循环的前提下，提供按角色持久化的子代理配置、受限执行单元策略以及原生智能体团队（Agent Teams）的无冲突共存。

[中文 README](../README.md) · [English README](../README.en.md) · [详细使用指南](usage.md) · [English Usage Guide](usage.en.md) · [迁移说明](migration.md) · [验收记录](acceptance.md)

---

## 1. 模块组成与职责边界

| 文件 / 模块 | 导出标识 / 插件名 | 核心职责 |
| :--- | :--- | :--- |
| [`src/roles.js`](../src/roles.js) | 内部纯函数库 | 定义 `ROLES`（`iterate` / `implement` / `analyze`）、`DEFAULT_WORKERS`、`parseWorkers`、`validateWorkers`、`revisionOf`、`childOptions` 与 `saveWorkers`（双阶段 CAS 保存） |
| [`src/host.js`](../src/host.js) | `.`（服务名 `xingheng`） | 注册 Cordis `Service`，暴露单一入口 `operate(request, signal)`，统一驱动 `/api/xingheng/v3` HTTP 端点、`xingheng_config` 工具与 `/xingheng` 命令 |
| [`src/role-agent.js`](../src/role-agent.js) | `./role-agent`（`xingheng-delegation`） | 封装 `@deepseek-ai/dsh-tool-subagent`，挂载 `subagent_iterate`、`subagent_implement`、`subagent_analyze`，在调用瞬间通过 getter 动态注入角色路由 |
| [`src/controls.js`](../src/controls.js) | `./controls`（`xingheng-subagent-controls`） | 封装 `@deepseek-ai/dsh-tool-subagent-control`，将主控的普通子任务控制工具重命名为 `subagent_message`、`subagent_list`、`subagent_interrupt` |
| [`src/team-controls.js`](../src/team-controls.js) | `./team-controls`（`xingheng-team-controls`） | 在拥有团队成员身份（`agentTeams.tryMembership(agent)`）的 Agent 作用域内，为原生团队控制工具注册 `team_roster`、`team_message`、`team_interrupt` 兼容别名 |
| [`src/policy.js`](../src/policy.js) | `./policy`（`xingheng-worker-policy`） | 通过 `tools.restrict({ allow })` 为 `xingheng-worker` 子代理施加工具白名单掩码，移除浏览器、网络搜索、IM 与再次委派工具 |
| [`client.js`](../client.js) | `./client`（`@local/dsh-xingheng`） | 在 Web 客户端 `settings.section` 插槽（`order: 22`）渲染原生 React 设置面板，支持中英切换、深浅色主题变量与脏状态保护 |
| [`cordis.patch.yml`](../cordis.patch.yml) | Bundle Patch | 向当前 Profile 注入 Host 服务、两个便携预设（`xingheng`、`xingheng-worker`）以及 Profile 级默认策略 |

---

## 2. 单一配置所有者与双阶段 CAS 持久化

### 2.1 Volatile Config 引用与 ConfigEditor 持久化

`xingheng` 服务（[`src/host.js`](../src/host.js)）声明了一个带有 `.volatile()` 标记的 `workers` 配置项：

- **Volatile 的真实含义**：在 Cordis Loader 中，`volatile()` 表示配置更新时原地更新引用（`this.config.workers.get()` 立即反映最新值），而不会销毁并重建整个 `xingheng` 服务实例；**它不代表配置仅存在于内存或重启丢失**。
- **原子落盘**：所有写操作均通过 DSH 原生 `ConfigEditor`（`editor.edit(entry, callback)`）写入当前 Profile 的配置文件。`ConfigEditor` 负责串行化锁、候选配置校验、原子文件替换以及重载失败回滚，同时完整保留 `cordis.patch.yml` / Profile 配置中的其他条目、注释与 `!!js` 表达式。插件不使用任何正则表达式拼接 YAML，也不依赖绝对路径读写本地预设文件。

### 2.2 严格输入解析与零生成能力校验

在保存配置前，[`src/roles.js`](../src/roles.js) 依次执行两层校验：

1. **结构与格式校验（`parseWorkers`）**：
   - 输入必须是仅包含 `iterate`、`implement`、`analyze` 三个键的对象。
   - 每个角色对象仅允许包含 `provider`、`model`、`effort` 三个字段；出现未知字段（如 `maxTokens`）、数组或 `null` 时立即拒绝（Fail Closed）。
   - `provider` 与 `model` 必须是非空且首尾无多余空白字符的精确字符串 ID（长度 `<= 200`）；`effort` 必须是首尾无空白的字符串（长度 `<= 100`，允许空字符串 `""` 表示使用适配器默认/原生继承行为）。
2. **目录能力校验（`validateWorkers`）**：
   - 检查 `llm.listProviders()` 是否已注册目标 `provider`。
   - 检查 `llm.listModels(route.provider)` 是否公开声明（Advertise）了目标 `model`。
   - 调用 `llm.resolveModelInfo(route.provider, route.model, signal)`；若 `route.effort` 非空，验证其是否存在于 `info.reasoning?.efforts` 列表中。
   - 调用 `llm.resolveCallConfig(...)` 验证完整调用配置合法性。不会生成模型输出；元数据读取是否涉及网络由适配器决定。取消信号会传给元数据/配置解析，并在角色循环边界和进入保存前检查。目录支持不等于网关可用性保证。

### 2.3 双阶段修订号比对（Double CAS）

修订号由 `revisionOf(workers)` 计算（按 `iterate`、`implement`、`analyze` 固定顺序序列化为 JSON 字符串）。`saveWorkers` 执行两次比对：

1. **前置快速检查**：在执行异步 `validateWorkers` 前，先比对请求传入的 `expectedRevision` 与当前内存配置 `revisionOf(read())`；若不匹配，立即抛出 `Configuration conflict: reload before saving`。
2. **串行化临界区二次检查**：在 `await editor.edit(entry, current => ...)` 的串行化写回调内部，再次解析当前生效配置并比对 `revisionOf(effective) !== expectedRevision`；若在异步校验期间已有另一个写入者抢先提交，立即抛出 `Configuration conflict: another writer saved first` 并中止落盘。

HTTP 端点、Agent 工具 `xingheng_config` 与斜杠命令 `/xingheng` 全部调用同一个 `this.operate(request, signal)` 方法，保证校验规则与持久化路径完全一致。

---

## 3. 普通子代理委派与路由快照隔离

在 [`src/role-agent.js`](../src/role-agent.js) 中，星衡完全复用固定版本的 `@deepseek-ai/dsh-tool-subagent`（`0.2.2-rc.1`）：

```js
export function nativeRouteConfig(role, service) {
  const config = NativeConfig({
    provider: 'spawn',
    toolName: `subagent_${role}`,
    modelSelection: false,
    modelDiscovery: false,
    agentPreset: 'xingheng-worker',
    maxDepth: 1,
  });
  Object.defineProperty(config, 'agentOptions', {
    enumerable: true,
    configurable: false,
    get: () => childOptions(service.route(role)),
  });
  return config;
}
```

关键设计机制：

1. **调用瞬间动态取值（Next-Child Semantics）**：`config.agentOptions` 被定义为只读 getter。每当主控调用 `subagent_iterate`、`subagent_implement` 或 `subagent_analyze` 时，原生执行器在进入第一个异步 `preflight`（`resolveCallConfig`）之前，会同步读取 `config.agentOptions` 并将其解构保存为标量快照。因此：
   - 修改并保存星衡配置后，**下一次**子代理调用立即读取新路由。
   - 即使在异步 preflight 等待期间或子代理运行中途修改了配置，**已受理或正在运行的子代理所持有的 `agentOptions` 快照也不会被篡改**（由 [`test/delegation.test.js`](../test/delegation.test.js) 验证）。
2. **禁止主控覆盖模型（`modelSelection: false`）**：工具参数 Schema 中不暴露 `provider` 或 `model` 字段；若调用方强行传入模型覆盖参数，原生执行器会直接拒绝（`selection is disabled`）。需要更换模型时，必须由用户在设置页或明确授权通过 `xingheng_config` 修改，杜绝主控静默降级模型。
3. **固定目标预设与深度**：所有普通角色子任务固定使用 `agentPreset: 'xingheng-worker'` 与 `maxDepth: 1`，生命周期、取消信号、上下文投影（`sessionProjections`）与并发上限均由原生 DSH `subagents` 服务托管。

---

## 4. 受限执行单元策略（Worker Policy）

普通角色子任务运行在 `xingheng-worker` 预设（[`cordis.patch.yml`](../cordis.patch.yml)）中，同时受到两层约束：

1. **运行时工具白名单掩码（[`src/policy.js`](../src/policy.js)）**：
   - `xingheng-worker-policy` 监听子代理 `agent/created` 事件，在子代理上下文中调用 `tools.restrict({ allow })`。
   - 仅允许以下工具名称保留可见：`bash`、`pwsh`、`read`、`read_image`、`write`、`edit`、`glob`、`grep`、`working_directory`、`job_list`、`job_output`、`job_kill`、`send_message`、`list_agents`、`interrupt_agent`、`skill`。
   - 浏览器自动化（Playwright MCP）、网络搜索/抓取（`web_search` / `web_fetch` / `research`）、IM 群聊投递、计划模式、定时任务与再次委派工具在 `xingheng-worker` 中均不可用。
   - **安全边界说明**：`tools.restrict` 裁剪的是模型可调用的 DSH 工具目录，DSH 原生文件沙箱与权限审批仍是最终权威边界；这不等于在操作系统层面封锁了 `bash`/`pwsh` 的全部网络访问能力。
2. **执行单元行为规约（Persona Prefix）**：
   - 预设提示词要求执行单元仅修改明确分配的写入路径（Write Scope），未获明确命令授权时默认 `Validation = NONE`（不擅自运行全量构建、测试或下载依赖），并在达到 **12 次工具调用或 10 分钟**（软检查点，Soft Checkpoint）或连续两步无进展时主动汇报 `CHECKPOINT` 并结束回合；完成验收范围后返回 `READY` 并冻结写入（`FREEZE`）。

---

## 5. 原生智能体团队（Agent Teams）共存与双轨控制别名（2.1）

在 `3.0.0` 中，[`cordis.patch.yml`](../cordis.patch.yml) 将 `tool-agent-team` 设为 `disabled: false`，启用 DSH 原生 `@deepseek-ai/dsh-experimental-tool-agent-team`。为了在同一 `xingheng` 会话中同时使用**普通角色子任务**和**原生智能体团队**而不产生工具名冲突或客户端拦截，星衡设计了双轨控制别名机制：

### 5.1 为什么需要双轨别名？

1. **普通子任务控制 vs. 团队控制的名称冲突**：
   - 原生 `@deepseek-ai/dsh-tool-subagent-control` 与原生 `@deepseek-ai/dsh-experimental-tool-agent-team` 默认都会注册 `send_message`、`list_agents`、`interrupt_agent` 三个工具名。
   - 但两者的参数协议完全不同：普通子任务控制使用 **`agent_id`**（子会话 ID），而原生团队工具使用 **`target`**（成员名称，如 `'lead'`、`'reviewer'`）。
   - 解决方案（[`src/controls.js`](../src/controls.js)）：在 `xingheng` 主控预设中，不直接挂载原始名称的 `dsh-tool-subagent-control`，而是通过 `xingheng-subagent-controls` 将普通子任务控制工具重命名为 **`subagent_message`**、**`subagent_list`**、**`subagent_interrupt`**，并同步替换工具描述中的引用名称，底层执行器、参数 Schema（`agent_id`）、血缘权限校验与取消逻辑完全复用原生实现。而在 `xingheng-worker` 子代理预设内部，由于子代理不是团队成员，继续保留原生的 `dsh-tool-subagent-control` 供其向父级通信。
2. **模型客户端适配器对旧控制名的识别问题**：
   - 在真实环境验收中发现，模型曾报告 `list_agents` / `send_message` 不可调用，但请求头中确有这些工具，且未取得 `UNKNOWN_TOOL`；具体原因没有确认。
   - 解决方案（[`src/team-controls.js`](../src/team-controls.js)）：`xingheng-team-controls` 监听所有已存在与新创建的 Agent，仅当 `ctx.agentTeams.tryMembership(agent)` 返回有效团队成员身份（Lead 或 Teammate）时，在该 Agent 的专属 `tools` 作用域内额外注册三个兼容别名：
     - `list_agents` → **`team_roster`**
     - `send_message` → **`team_message`**
     - `interrupt_agent` → **`team_interrupt`**
   - 原始名称（`list_agents`、`send_message`、`interrupt_agent`）依然保留在成员作用域中，兼容别名完全共享原函数的 `execute`、`parameters`、`output` 与调用者身份（`exec.agent`），不会向非团队成员（如普通 `xingheng-worker`）授予团队权限，并在 Agent 销毁或插件卸载时自动逆序释放。

### 5.2 队友模型继承与任务看板持久化的原生边界

- **队友模型来源**：原生 `spawn_teammate` 支持 `context: 'fresh'`（映射至 `freshProvider: 'spawn'`）与 `context: 'fork'`（映射至 `forkProvider: 'fork'`），队友创建时继承 Lead 的预设与有效模型。当前版本的 DSH 原生团队接口不接受按队友覆写模型的参数，因此星衡设置页的三路模型配置仅作用于普通子任务（`subagent_iterate/implement/analyze`）。
- **原生持久化与权威控制**：团队名册（默认上限 8 个生命周期成员名）、点对点收件箱、共享任务看板（`team_task_create/list/get/update` 的 `expected_revision` CAS 控制、`blocked_by` 依赖就绪计算、`write_scopes` 冲突提示）、`wait_agent` 状态监听及 Lead 专属 `interrupt_agent` / `team_interrupt` 均由 DSH 原生 Session 日志与 `agentTeams` 服务实现，星衡不重复造轮子，也不使用临时文件替代原生任务看板。

---

## 6. Web 客户端与受认证传输层

### 6.1 无构建依赖的原生 React 客户端（[`client.js`](../client.js)）

- 通过 `window.__ModuleLoader__.load({ id: '@local/dsh-xingheng', factory(require) { ... } })` 注册，直接使用宿主提供的 `react` 运行时与 `slots`、`locale` 服务。
- 将设置面板挂载到 `settings.section` 插槽（`id: 'xingheng'`, `order: 22`），使用 `useSyncExternalStore` 订阅宿主语言切换（内置 `zh` / `en` 字典），样式全部使用 `--dsw-alias-*` 宿主主题 CSS 变量，自适应浅色与深色模式及窄屏布局（`@media(max-width:620px)`）。
- 不引入 Vue、iframe、外部 CDN 或任何 `@deepseek-ai/*` 内部客户端包引用。

### 6.2 共享连接鉴权（`/api/xingheng/v3`）

- 后端通过 `ctx.connection.fetch.register` 注册 `/api/xingheng/v3`（支持 `GET` 与 `POST`）。
- 鉴权由 DSH `connection` 统一前置执行（校验 Host/Origin 信任、签名 Cookie 与 Owner 权限），插件不自建未鉴权的独立 HTTP 端口。
- 客户端使用相对路径 `./api/xingheng/v3` 与 `credentials: 'same-origin'` 发起请求，自动兼容反向代理路径前缀。
- 错误处理明确区分状态码：非 JSON 请求体返回 `415`，解析后的 JSON 再序列化后长度超过 `12000` 个 JavaScript 字符单元返回 `413`，CAS 修订号冲突返回 `409`，非法模型/推理档位或参数格式错误返回 `400`，正常操作响应及捕获异常的响应携带 `Cache-Control: no-store`（提前返回的 `413` / `415` 分支没有显式设置该头），绝不将保存失败伪装为成功。
