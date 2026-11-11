# 架构与协作边界（3.1）

[首页](../README.md) · [使用指南](usage.md) · [迁移](migration.md) · [验收](acceptance.md)

## 组成

| 模块 | 职责 |
|---|---|
| [roles.js](../src/roles.js) | 三路配置解析、目录校验、修订号、双阶段 CAS 保存 |
| [host.js](../src/host.js) | `xingheng` 服务；UI、`xingheng_config` 工具和 `/xingheng` 命令共用同一个 `operate()` |
| [role-routing.js](../src/role-routing.js) | 复用原生委派执行器，按角色选 worker/analyst 预设并写入下一子代理的路由 |
| [worker-policy.js](../src/worker-policy.js) | Host 侧生命周期所有者，对特定预设安装能力掩码和执行 guard |
| [analyst-controls.js](../src/analyst-controls.js) | 复用原生父子通信，只注册 `send_message` / `list_agents`，不注册中断 |
| [controls.js](../src/controls.js) | 主控侧的普通子任务控制，统一 `subagent_*` 前缀 |
| [team-controls.js](../src/team-controls.js) | 原生团队成员的 `team_*` 通信别名 |
| [client.js](../client.js) | Host React、locale、主题和 `settings.section` 设置页 |
| [cordis.patch.yml](../cordis.patch.yml) | Host 行、三个预设、Profile 级默认策略 |

## 三路配置与委派

`iterate`、`implement`、`analyze` 是唯一支持的角色键，沿用 3.0 的契约。对应原生工具 `subagent_iterate`、`subagent_implement`、`subagent_analyze`，三者都不接受调用时覆盖模型。

`iterate` 和 `implement` 走 `xingheng-worker`，`analyze` 走 `xingheng-analyst`。三者都是 fresh spawn、深度 1；队友那套 fresh/fork 属于原生 Team 接口，与此无关。

`agentOptions` 在原生执行器进入异步 preflight 之前就被同步读成一个普通对象。所以保存只影响下一次调用，不会影响正在 preflight 或正在跑的子代理。生命周期、取消、深度、容量和结果交付仍然由 DSH 原生执行器负责。

## 能力是怎么被限制住的

限制分三层，从上到下逐层兜底。

**第一层：预设本身少注册工具。** 分析预设的文件工具显式设成 `write:false`、`edit:false`、`applyPatch:false`，并且不挂 bash、pwsh 或 jobs，只注册原生的父子消息与列表控制。读写预设保留编辑、Shell 和 jobs。外部网页证据由主控收集后传进去。

**第二层：Host 管生命周期。** `xingheng-scoped-policy` 挂在 Host 上，而不是挂在可能已经错过创建事件的预设内 hook 里。它只认两个预设：`xingheng-analyst` 只读，`xingheng-worker` 可执行；`xingheng` 主控和其他预设不受影响。策略在 `agent/created` 时安装，在空白会话触发 `agent-preset/selected` 时释放旧限制再重装，Agent 销毁或插件卸载时释放，激活时也会处理已存在的 Agent。它通过宿主的 `tools.definitions(agent)` 枚举实际可见的工具，再在该 Agent 的上下文里注册 `tools.restrict({allow})`。

**第三层：防御更近层的注册。** 原生掩码只作用于继承来的能力，藏不住 Agent 自己那层注册的工具。所以另有一个全局 guard，按调用 Agent 的当前组成核对允许表，拒绝这类额外调用。guard 不包装执行器，也不新增权限；原生沙箱和调用者身份检查照常生效。

允许表本身：只读侧为 `read`、`read_image`、`glob`、`grep`、`working_directory`、`send_message`、`list_agents`、`skill`，没挂载的可选工具不会因此凭空获得实现；执行侧在此基础上加文件编辑、Shell、jobs 和原生子任务中断。

注意：**插件里不能用自带的 scope 库去推宿主的父链。** scope 库把身份存在模块私有的 Symbol/WeakMap 里，同版本的两个模块实例之间不共享，跨实例读取会退化成全局工具视图，连预设里的 `read` 也被过滤掉。所以运行时代码只向宿主服务查询；测试则在同一个库实例里建真实注册表和作用域。

## 角色 SOP 与交接

主控先判断值不值得拆。复杂任务让分析角色先建立事实、问题和方案；紧耦合的文件交给同一个实现者，公共接口先串行稳定，外围独立切片再并行。重大实现完成后可以用全新的分析子代理审查固定的 diff。

交接要给出状态、关键证据、变更文件与版本、实际跑过和没跑的检查、风险与下一步。只读审查跑不了测试，可运行的验证由主控或明确授权的迭代角色承担。任务账本、软预算、写入范围和冻结都属于 prompt 协议，没有新增硬性预算控制器、文件锁或自动完成闸门。

## 配置怎么落盘

`workers` 是 volatile Config 引用：Loader 可以原地更新它的值，但 ConfigEditor 仍会把它写进 Profile。插件不用正则改写用户的 YAML。

保存在异步目录校验之前比对一次 revision，进入 ConfigEditor 的串行写回调后再比对一次，避免并发覆盖。`/api/xingheng/v3`、工具和命令走的是同一套操作。目录与推理档位校验不产生模型输出，也不证明远端网关可用。Connection 负责信任与认证；415、413 提前返回，409 表示修订号冲突，其余校验错误返回 400。413 按 JSON 再序列化后的 JavaScript 字符单元计，不是 UTF-8 字节。

## 原生团队的兼容边界

Team 的成员名、任务依赖、CAS、收件箱、等待和中断都直接复用，没有第二套实现。成员创建时继承主控的模型与预设；三路设置只管普通子任务。普通控制按 `agent_id` 寻址，团队控制按 `target` 寻址。成员 `inactive` 只说明当前没有回合在跑。

运行中的 Agent 保留内存里的组成 revision；进程重启后恢复会话时，按日志里的预设 ID 解析当前定义。热加载不等于所有旧组成和模块缓存都已更新，必要时按插件管理器的要求重启。

## 参考

设计上借鉴了 [Aider 的 Architect/Editor 分离](https://aider.chat/2024/09/26/architect.html)、[MetaGPT 的 SOP 协作思路](https://github.com/FoundationAgents/MetaGPT) 和 [Claude Code 的子代理文档](https://code.claude.com/docs/en/sub-agents)。这些只是思路来源，不能当作星衡的性能证据，也不代表成本或成功率。本包没有复制它们的运行时，也不依赖这些框架。