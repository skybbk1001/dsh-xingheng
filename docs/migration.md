# 迁移、旧版清理与升级说明（Migration & Cleanup）

本文档说明从旧版实验性星衡包（`economy` 路由、旧 UI 草稿、旧独立 Web 策略包）迁移到 `@local/dsh-xingheng` `2.0.0` / `2.1.0` 的行为变化、Profile 级策略接管边界、历史会话的 Preset Revision 规则以及安全卸载步骤。

[中文 README](../README.md) · [English README](../README.en.md) · [详细使用指南](usage.md) · [English Usage Guide](usage.en.md) · [系统架构](architecture.md) · [验收记录](acceptance.md)

---

## 1. 当前版本（`2.1.0`）接管的预设与 Profile 级策略

新版统一由单一 Bundle 包 `@local/dsh-xingheng` 提供服务，通过 [`cordis.patch.yml`](../cordis.patch.yml) 注册两个便携预设并接管原先分散在独立旧策略包中的 Profile 级配置：

### 1.1 新增便携预设

- **`xingheng`（星衡 · 协作）**：主控与原生团队队友使用的协作预设，排序 `order: 0`。包含原生规划模式（Plan Mode）、目标管理（Goal）、定时任务（Schedule）、网页搜索/抓取（Web）、文件呈现（Present）、插件管理（Plugin Manager），以及命名空间隔离后的三路普通子任务委派（`subagent_fast` / `subagent_text` / `subagent_long`）与普通子任务控制别名（`subagent_message` / `subagent_list` / `subagent_interrupt`）。
- **`xingheng-worker`（星衡 · 执行单元）**：三路普通子任务共用的受限执行单元预设，排序 `order: 91`。由 [`src/policy.js`](../src/policy.js) 施加工具白名单限制，无浏览器、网络搜索、IM 或再次委派能力。

### 1.2 Profile 级全局策略接管（影响当前 Profile 的所有预设）

在 [`cordis.patch.yml`](../cordis.patch.yml) 末尾声明的以下条目属于 **Profile 级默认配置**，作用于当前 Profile 下的**全部预设**（不仅限于 `xingheng`）：

1. **默认预设切换**：`agent-preset-registry` 的 `default` 与 `selectedDefault` 设为 `'xingheng'`。
2. **子代理深度与并发上限**：`subagent` 设为 `maxDepth: 1`（禁止子代理再创建子代理）、`maxActiveSubagents: 2`（同一时刻最多运行 2 个活动子代理）。
3. **启用原生智能体团队（`2.1.0` 起）**：`tool-agent-team` 设为 `disabled: false`（`2.0.0` 清理旧版时曾保持禁用，`2.1.0` 正式开启原生团队协作并挂载 `team_roster` / `team_message` / `team_interrupt` 兼容别名）。
4. **子代理可选模型池**：`subagent-model-selection-settings` 保持 `enabled: true`，保留原有 4 个允许模型：
   - `zero / gpt-6-astra`
   - `zero / deepseek-v4.1-flash-1017`
   - `zero / gpt-6.1-sol`
   - `zero / gpt-6.1-terra`

> **优先级边界**：上述配置仅作为 Bundle 层默认值，用户在 DSH 设置界面中手动保存的覆盖项始终优先于 Bundle 默认值。本包**不修改**主控会话模型、API 密钥凭据、文件沙箱权限模式、搜索引擎偏好、MCP 服务器或 IM 连接。

---

## 2. 旧版星衡组件的移除规范

在从早期草稿或旧版拆分包迁移时，应遵循**先通过插件管理器解绑，再清理磁盘残留**的顺序：

1. **通过 `plugin_manager` 卸载旧包**：
   - 使用 DSH 助手工具 `plugin_manager`（`action: "remove_bundle"`）依次移除已废弃的旧包：
     - `@local/dsh-xingheng-preset`（早期未实装的 UI 草稿）
     - `@local/dsh-economy-routing`（旧版 `economy` 路由包）
     - `@local/dsh-starbalance-web-policy`（旧版独立 Web 策略包）
   - **严禁直接删除仍挂载在当前 Profile 依赖列表中的本地链接目录**，否则会导致 DSH 冷组合或重启时因找不到已注册模块而报错。
2. **核实并清理已解绑源码与脚本**：
   - 在确认 `plugin_manager` 卸载成功且冷组合（`dsh --profile web --dump-config`）不再引用旧路径后，方可删除已核实的旧源码目录、遗留符号链接和旧切换脚本。
   - 旧的未加载副本和切换脚本不再是配置源，切勿再用旧脚本覆盖当前 Profile 配置。普通的 DSH 配置备份文件不在源码清理范围内。

---

## 3. 历史会话日志、Preset Revision 与重启边界

理解 DSH 会话日志的不可变性与预设版本（Preset Revision）机制，是避免升级后出现工具缺失或恢复失败的关键：

### 3.1 历史会话日志保留 vs. 旧预设重启续跑

- **不篡改历史会话记录**：迁移与清理过程**不会删除任何历史会话文件**，也不会在后台将历史日志中的旧预设 ID（如 `economy`）静默改写为 `xingheng`（实测验收中逐一核对了全部既有压缩会话记录文件完好无损）。
- **移除旧预设后的续跑限制**：历史日志保留供查阅，是否能在 GUI 中打开还取决于宿主兼容性；但一旦通过 `plugin_manager` 卸载了旧 `economy` 预设并重启 DSH Host，依赖该已卸载预设的旧会话将**无法保证在重启后原样恢复续跑**。请在新建会话中选择 **星衡 · 协作（`xingheng`）** 继续后续工作。

### 3.2 `2.0.0` → `2.1.0` 升级后的旧会话 Preset Revision

- **已有会话不会原地升级预设**：运行中的 Agent 保留已挂载的内存 revision；日志记录预设 ID，并不永久存储旧版插件实现。进程重启后恢复按 ID 解析当前定义。
- 当从 `2.0.0` 升级到 `2.1.0`（或修改了 [`cordis.patch.yml`](../cordis.patch.yml) 中的插件挂载）后，**仍在运行的旧 `xingheng` Agent 保留其已挂载的内存 revision**，不会自动原地获得 `2.1.0` 新启用的原生团队工具（`spawn_teammate`、`team_task_*`）、成员兼容别名（`team_roster` / `team_message` / `team_interrupt`）或重命名后的普通子任务控制工具（`subagent_message` / `subagent_list` / `subagent_interrupt`）。
- **正确升级步骤**：
  1. 通过 `plugin_manager` 安装/更新 `@local/dsh-xingheng`。
  2. 若返回 `application: "restart-required"`（或提示 `unmanaged-plugin`），先**重启原有的 DSH Host 服务进程**，再刷新浏览器页面（注意：仅刷新浏览器页面不会重启 Host 进程）。
  3. **新建一个选择 `xingheng` 预设的会话**。切勿在升级前的旧会话中混用 `target`（团队成员名）与 `agent_id`（普通子任务会话 ID）。

---

## 4. 如何安全停用或卸载新版 `@local/dsh-xingheng`

如果未来需要停用或移除本插件包，请按以下顺序操作，以确保当前 Profile 平滑回退：

1. **先切换默认预设**：在 DSH 设置或预设管理中，将当前 Profile 的默认预设（Default Preset）从 `xingheng` 改为一个仍然存在的内置预设（例如默认内置编码预设），避免卸载后新建会话找不到默认预设。
2. **通过 `plugin_manager` 停用或移除**：在会话中调用助手工具 `plugin_manager`，使用 `set_bundle`（`enabled: false`）停用，或使用 `remove_bundle` 移除 `@local/dsh-xingheng`。
3. **按提示重启 Host**：若 `plugin_manager` 返回 `restart-required`，重启原 DSH Host 进程并刷新浏览器。
4. **保留用户数据**：卸载插件只需解绑该 Bundle，无需也不应删除整个 DSH Home 目录、用户模型凭据或历史会话记录。

---

## 5. 仓库可见性与发布说明

- 当前仓库托管于 GitHub 私有仓库 [`https://github.com/skybbk1001/dsh-xingheng`](https://github.com/skybbk1001/dsh-xingheng)，仅限授权账号访问，**未发布到公共 npm**。
- 未来若计划转为公开仓库或发布到 npm，必须由仓库所有者另行确认：仓库可见性、代码中无内部环境标识或敏感信息、公开安全报告联系方式（[`SECURITY.md`](../SECURITY.md)），以及目标 DSH 版本的完整 CI 与真实环境验收记录（[`docs/acceptance.md`](acceptance.md)）。
