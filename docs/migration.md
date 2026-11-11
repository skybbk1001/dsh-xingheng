# 3.1 分工升级

3.1 保留 3.0 的 `iterate / implement / analyze` 配置键、已保存的模型、推理档位和 `/api/xingheng/v3`，不需要重新录入路线。

- `subagent_analyze` 改用新增的 `xingheng-analyst`，不能再改文件、跑命令或跑测试。原先让分析角色「顺手修一下」的任务，现在要拆给迭代或实现角色。
- `iterate` 与 `implement` 继续共用读写预设 `xingheng-worker`，区别在任务契约：一个是最小补丁，一个是内聚模块。
- 新增的 Host 策略负责在创建、空白会话选择和销毁三个时机给分析/执行预设切换工具掩码，并用 guard 拒绝允许表之外的执行。主控和其他预设不受这套角色掩码影响。
- 内部导出改名为 `./role-routing`、`./worker-policy`、`./analyst-controls`。自定义 bundle 如果直接引用了旧内部子路径，要跟着清单一起改；这里不保留旧实现文件去绕过 Node 模块缓存。
- 用插件管理器应用新 bundle。返回 restart-required 就完整重启原来的 Host。旧 Agent 内存里的 revision 不算新版，别拿它当验收依据。新建一个星衡会话，确认分析目录仍有 `read`、并且没有写入/Shell/浏览器能力之后再开工。
- 并行只读不提供工作树快照。要审某一版就固定版本或先冻结写入。

## 从 2.x 迁到 3.0 的角色接口

3.0 把显示名、配置键和委派工具统一到任务职责上。这是破坏性变更：不解析旧键，不提供旧工具别名，也不保留旧模块导出。

| 职责 | 配置键 | 委派工具 |
|---|---|---|
| 快速迭代 | `iterate` | `subagent_iterate` |
| 特性实现 | `implement` | `subagent_implement` |
| 分析规划 | `analyze` | `subagent_analyze` |

配置端点是 `/api/xingheng/v3`，旧的 `/api/xingheng/v2` 不再注册。普通子任务的通信工具仍是 `subagent_message`、`subagent_list`、`subagent_interrupt`；原生团队工具没有因为角色改名而动过。

## 已保存配置怎么迁

升级前先用当前版本的配置读取接口，把每一路的 `provider`、`model`、`effort` 记下来，然后显式写到新键上。旧 JSON 不会自动转换，旧键和新键也不能混在同一个请求里。

1. 读取并记录原有三路模型与推理强度。
2. 通过 DSH 官方的 Settings / ConfigEditor 接口移除旧的 `workers` 覆盖，不要直接重写 Profile 文件。当前环境原有的保存值和默认值完全一致，所以移除覆盖时有效路由不变；其他环境应该先把自己的值存好。
3. 更新 bundle，检查插件管理器的 `application`、`warnings` 和激活诊断。要求重启就重启原 Host，再刷新页面。
4. 用新版设置页、`xingheng_config` 或 `/api/xingheng/v3`，把原来的三路值分别存到上表的新键。
5. 重新读取配置，确认键和值都对，再新建「星衡 · 协作」会话。

本次迁移后仍是：快速迭代 `zero / deepseek-v4.1-flash-1017 / high`，特性实现 `zero / gpt-6.1-sol / medium`，分析规划 `zero / gpt-6.1-terra / high`。主控模型、凭据、团队状态和权限模式都没变。

## 旧会话与旧调用方

运行中的 Agent 可能还持有旧的内存预设 revision。改名不会改写历史日志，也无法把已经拿到的旧工具从它的历史里删掉；那些不属于新版兼容接口。验收和调用新工具请开新会话。

会话日志保留预设 ID，进程重启后按这个 ID 解析当前定义，不会把旧版实现永久存下来。被删掉的预设可能起不回来。2.x 的[历史验收记录](acceptance.md)保留当时的命名；当前接口以 3.0 之后的章节为准。

## 对 Profile 的影响

本包仍然设置默认预设 `xingheng`、委派深度 1、每棵 activation 树容量 2，开启原生团队工具并保留允许的模型池。这些 bundle 默认会影响当前 Profile 下的所有预设，用户配置层优先。团队累计名额 8 和活动容量 2 是两个互不相干的限制。

## 停用或卸载

先把默认预设切到另一个仍然存在的预设，再通过 DSH 插件管理器停用或移除 `@local/dsh-xingheng`，然后按结果要求重启。不要删 DSH home、模型凭据或会话记录，也不要直接删掉仍被 Profile 链接的源码目录。

源码在 [GitHub 私有仓库](https://github.com/skybbk1001/dsh-xingheng)。未发布 npm，公开发布需要另行确认。