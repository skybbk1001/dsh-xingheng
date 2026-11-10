# 架构与协作边界（3.1）

[首页](../README.md) · [Usage](usage.en.md) · [迁移](migration.md) · [验收](acceptance.md)

## 组件

| 模块 | 职责 |
|---|---|
| [roles.js](../src/roles.js) | 三路配置解析、目录校验、修订号、双阶段 CAS 保存 |
| [host.js](../src/host.js) | `xingheng` 服务；UI/API、`xingheng_config` 和 `/xingheng` 共用 `operate()` |
| [role-routing.js](../src/role-routing.js) | 复用原生委派执行器，按职责选择 worker/analyst 预设与下一子代理的路由 |
| [worker-policy.js](../src/worker-policy.js) | Host 生命周期所有者：对特定预设安装能力掩码和执行 guard |
| [analyst-controls.js](../src/analyst-controls.js) | 复用原生父子通信，仅注册 `send_message` / `list_agents`，不注册中断控制 |
| [controls.js](../src/controls.js) | 主控的普通子任务控制使用 `subagent_*` 前缀 |
| [team-controls.js](../src/team-controls.js) | 原生团队成员的 `team_*` 通信兼容入口 |
| [client.js](../client.js) | Host React、locale、theme 与 `settings.section` 设置页 |
| [cordis.patch.yml](../cordis.patch.yml) | Host 行、三个预设、Profile 级默认策略 |

## 三路配置与委派

`iterate`、`implement`、`analyze` 是唯一支持的角色键，保持 3.0 契约。原生工具分别为 `subagent_iterate`、`subagent_implement`、`subagent_analyze`，禁止调用时覆盖模型。

- `iterate` 和 `implement` → `xingheng-worker`。
- `analyze` → `xingheng-analyst`。
- 三者使用 fresh spawn，深度 1；队友的 fresh/fork 是另外一套原生 Team 接口。

`agentOptions` 在原生执行器进入异步 preflight 前同步读取为一次调用的普通对象。保存改变下一次调用，不改变正在 preflight 或运行的子代理。生命周期、取消、深度、容量和结果交付仍由 DSH 原生执行器负责。

## 能力策略：注册、掩码、执行 guard

### 1. 预设本身少注册工具

分析预设的文件工具显式设置 `write:false`、`edit:false`、`applyPatch:false`，不挂载 bash、pwsh 或 jobs；只注册原生的父子消息/列表控制。读写预设保留编辑、Shell 和 jobs。外部网页证据由主控收集后传入。

### 2. Host 负责生命周期

`xingheng-scoped-policy` 挂在 Host，而不是等待一个可能已错过创建事件的预设内 hook。它只识别两类预设：`xingheng-analyst` 为只读，`xingheng-worker` 为执行；`xingheng` 主控及其他预设不受这项掩码影响。

策略在 `agent/created` 安装，在空白会话 `agent-preset/selected` 时释放旧限制并重装，在 Agent 销毁或插件卸载时释放；激活时也处理既有 Agent。通过宿主的 `tools.definitions(agent)` 枚举实际可见工具，并通过该 Agent 的上下文注册 `tools.restrict({allow})`。

**不能在插件内用另一份 scope 库推测宿主作用域父链。** 当前 scope 库以模块私有 Symbol/WeakMap 存储身份，同版本的两个物理模块实例也不共享这些状态。本次真实验收发现，跨实例读取会退化为全局工具视图，错误地把预设内的 read 也过滤掉。运行时代码因此只经宿主服务查询；测试在单一库实例里创建真实注册表和作用域。

只读允许表上限为 `read`、`read_image`、`glob`、`grep`、`working_directory`、`send_message`、`list_agents`、`skill`；未挂载的可选工具不会因此获得实现。执行允许表额外包含文件编辑、Shell、jobs 和原生子任务中断。

### 3. 防御更近层注册

原生掩码只作用于继承能力，不会隐藏 Agent 自己所在层的工具注册。全局 guard 根据调用 Agent 的**当前组成**检查允许表，拒绝这类额外非允许调用。它不包装执行器、不新增权限；原生沙箱和调用者身份检查照常执行。

因此，普通分析子代理实际模型目录可以严格只读；若把内部分析预设当顶层会话使用，原生 Team 等插件可能在更近层显示额外工具，但 guard 仍拒绝非允许执行。不能仅凭“模型看不到某个工具”推断所有间接副作用都被消除。

## 角色 SOP 和交接

主控先判断是否值得拆分。复杂任务先由分析角色建立事实、问题及方案；紧耦合文件由同一实现者负责，公共接口先串行稳定，外围独立切片再并行。重大实现完成后可使用 fresh 分析子代理审查固定 diff/版本。

交接应给出状态、关键证据、变更文件/版本、实际检查和未运行检查、风险与下一步。只读审查不能执行测试，最终可运行验证由主控或显式授权的迭代角色承担。任务账本、软预算、写入范围和冻结是 prompt 协议；没有新增硬性预算控制器、文件锁或自动完成闸门。

## 配置持久化与传输

`workers` 是 volatile Config 引用：Loader 可原地更新其值，但 ConfigEditor 仍把它保存到 Profile。插件不通过正则改写用户 YAML。保存在异步目录校验前比对 revision，并在 ConfigEditor 串行写回调内部再次比对，避免并发覆盖。

`/api/xingheng/v3`、工具和命令走相同操作。目录与推理档位校验不生成模型输出，也不证明远端网关可用。Connection 承担信任和认证；415、413 提前返回，409 为修订号冲突，其他校验错误返回400。413 依据 JSON 再序列化的 JavaScript 字符单元长度，不是严格 UTF-8 字节限制。

## 原生团队与兼容边界

Team 的成员名、任务依赖、CAS、收件箱、等待和中断不重复实现。成员创建时继承主控模型/预设，三路设置只控制普通子任务。普通控制按 `agent_id`，团队控制按 `target`；成员状态 inactive 不证明共享任务完成。

Live Agent 保留内存组成 revision，重启恢复则按日志预设 ID 解析当前定义。热加载不等于所有旧组成与模块缓存已更新；必须读取工具请求日志和激活结果，必要时按要求重启。

## 参考及适用限制

借鉴 [Aider 的 Architect/Editor 分离](https://aider.chat/2024/09/26/architect.html)、[MetaGPT 的 SOP 协作理念](https://github.com/FoundationAgents/MetaGPT)、[Claude Code 的角色工具配置文档](https://code.claude.com/docs/en/sub-agents)。这些参考不等同于对星衡的性能验证，也不据此承诺成本或成功率改善。当前实施只包含上文具体机制，没有复制对方运行时或安装这些框架。
