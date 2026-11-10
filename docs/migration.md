# 3.1 分工升级

3.1 保留 3.0 的 `iterate / implement / analyze` 配置键、已保存模型、推理档位和 `/api/xingheng/v3`。不需要重新录入路线。

- `subagent_analyze` 现在使用新增 `xingheng-analyst`，不能修改文件、运行命令或测试。原先让分析角色“顺手修复”的任务必须拆分给迭代或实现角色。
- `iterate` 与 `implement` 继续共享读写 `xingheng-worker`，但按最小补丁与内聚模块交付区分行为。
- 新 Host 策略为分析/执行预设管理创建、空白会话选择和销毁时的工具掩码，并用 guard 拒绝超出允许表的执行；主控及其他预设不受这项角色掩码影响。
- 内部导出更新为 `./role-routing`、`./worker-policy`、`./analyst-controls`；自定义 bundle 若直接引用旧内部子路径，需要跟随当前清单更新。不保留旧实现文件来绕过 Node 模块缓存。
- 用插件管理器应用新 bundle；如返回 restart-required，完整重启原 Host。不要将旧 Agent 已持有的内存 revision 当作新版。新建星衡会话核对分析目录仍有 read，且无写入/Shell/浏览器能力后再用于工作。
- 并行只读不提供工作树快照：固定审查版本或冻结写入，避免版本漂移。

## 从 2.x 迁移到 3.0 角色接口

3.0 将显示名称、配置键和委派工具统一到任务职责。这是破坏性变更，没有旧键解析、旧工具别名或旧模块导出。

| 职责 | 配置键 | 委派工具 |
|---|---|---|
| 快速迭代 | `iterate` | `subagent_iterate` |
| 特性实现 | `implement` | `subagent_implement` |
| 分析规划 | `analyze` | `subagent_analyze` |

配置服务端点为 `/api/xingheng/v3`。旧 `/api/xingheng/v2` 不再注册。普通子任务的通信工具仍为 `subagent_message`、`subagent_list`、`subagent_interrupt`；原生团队工具没有因角色改名而改动。

## 已保存配置如何迁移

升级前先用当前版本的配置读取接口保留每路 `provider`、`model`、`effort`，然后明确地把这些值写到新键。旧 JSON 不会自动转换，也不能把旧键和新键混在一个请求中。

1. 读取并记录原有三路模型与推理强度。
2. 通过 DSH 官方 Settings / ConfigEditor 接口移除旧 `workers` 覆盖，不直接重写 Profile 文件。本次环境原有保存值与默认值完全一致，因此移除覆盖时有效路由不变；其他环境应先保存自己的值。
3. 更新 bundle，检查插件管理器的 `application`、`warnings` 与激活诊断。若要求重启，重启原 Host 再刷新页面。
4. 用新版设置页、`xingheng_config` 或 `/api/xingheng/v3`，将原有三路值分别保存到上表中的新键。
5. 重新读取配置，确认值和键都正确，再新建「星衡 · 协作」会话。

本次环境迁移后仍为：快速迭代 `zero / deepseek-v4.1-flash-1017 / high`，特性实现 `zero / gpt-6.1-sol / medium`，分析规划 `zero / gpt-6.1-terra / high`。主控模型、凭据、团队状态和权限模式不变。

## 旧会话与旧调用方

运行中的 Agent 可能保留旧的内存预设 revision。改名不会改写历史日志，也不能把已经持有的旧工具从这些 Agent 的历史中删除；它们不是新版兼容接口。请使用新建会话验收和调用新工具。

会话日志保留预设 ID，进程重启后恢复会话按该 ID 解析当前定义，不永久保存旧版实现。被删除的预设可能无法续跑。2.x 的[历史验收记录](acceptance.md)保留当时的命名；当前接口与新命名验收以 3.0 章节为准。

## Profile 级影响

本包仍设置默认预设 `xingheng`、委派深度 1、每棵 activation 树容量 2，启用原生团队工具并保留允许模型池。这些 bundle 默认影响当前 Profile 的所有预设，用户配置层优先。团队默认累计名额 8 与活动容量 2 是两个独立限制。

## 停用或卸载

先将默认预设切换为一个仍存在的其他预设，再通过 DSH 插件管理器停用或移除 `@local/dsh-xingheng`。按结果要求重启。不要删除 DSH home、模型凭据或会话记录，也不要直接删除仍被 Profile 链接的源码目录。

源码托管于 [GitHub 私有仓库](https://github.com/skybbk1001/dsh-xingheng)。未发布 npm；公开发布须另行确认。
