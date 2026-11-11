# 验收记录

日期：2026-11-10（Asia/Shanghai）。环境：DSH 0.2.2-rc.1，Node v24.21.0，当前 Web profile。测试对象是原有的 3080 GUI，没有另起替代服务器。

## 2.0.0 历史结果

| 层级 | 检查 | 结果与边界 |
|---|---|---|
| 静态 | Manifest、语法、便携预设、语言元数据、图标 | 通过；预设无绝对本地文件依赖 |
| 自动化 | `npm run verify` | 11/11 通过，无跳过；含校验、并发冲突、取消、保存失败、原生执行器和 Host API |
| 原生执行器（mock backend） | 三角色、深度 1、worker 预设、配置更新、禁止模型覆盖 | 通过；捕获实际原生 execute 传给 backend 的参数，不产生模型请求 |
| 原生执行器（mock backend） | preflight 期间改配置 | 已受理的调用保持原参数，下一次调用读取新配置 |
| 实装 | plugin_manager 安装 | `application: applied`、`warnings: []`；Host 和两个预设已激活 |
| UI 注册 | 当前已登录客户端 `settings.section` | `xingheng` 入口 active，顺序 22 |
| 工具调用 | `xingheng_config` 读、保存、冲突 | 真实运行；fast high→medium→high，过期 revision 明确拒绝 |
| 磁盘持久化 | 保存 medium 后独立 `dsh --profile web --dump-config` | 冷组合读到 medium，不只是浏览器状态。未为测试重启用户 Host |
| 认证 | 未登录请求配置端点 | HTTP 401；未另建绕过鉴权的 HTTP 服务 |
| 真实 UI | 三角色提供商/模型/推理下拉框 | 共 9 个控件，均能操作 |
| 真实 UI | 保存、刷新、回读 | fast 改 medium 保存成功，页面刷新后仍为 medium，随后恢复 high |
| 真实 UI | 同时更换提供商、模型和推理 | 保存 `a6/gpt-6.1-sol/low` 后回读一致，随后恢复初始组合；未对该临时路线发起模型请求 |
| 真实 API | 不支持的推理 / stale revision | HTTP 400 / 409，保存配置未改变 |
| 真实 UI | 中英切换 | 标题、角色、控件与保存按钮正常；测试后恢复中文 |
| 真实 UI | 浅色/深色 | 实际打开并截图；控件无水平溢出；测试后恢复跟随系统 |
| 显示资源 | 插件详情元数据、原创 SVG、README 截图 | 标题与说明正确，SVG naturalWidth=64，README 截图加载成功 |
| 真实委派 | 新建 `xingheng` 会话并要求一次 fast 委派 | 主控创建 1 个 `xingheng-worker`；子回复 `XINGHENG_CHILD_OK`，主回复 `XINGHENG_ACCEPTANCE_OK`。这是实际模型调用，非 mock |
| 分发 | `npm pack --dry-run` | 含运行文件、配置、元数据、图标、文档与截图；不含凭据、session 或 node_modules |

## 已知边界

- 未对 text/long 两路逐一发起真实模型调用；三路参数由原生执行器回归测试覆盖，真实模型验收用的是 fast 一路。
- 未验证移动设备、屏幕阅读器和所有第三方模型网关；不作性能、成本或模型质量排名承诺。
- 浏览器控制台里的 400/409 来自刻意的负向测试。另观察到 DSH 文件管理器图标 404，与本插件无关；未发现 `slot entry crashed` 或插件 JavaScript 异常。
- 没有重启用户运行中的 DSH 进程；持久化验证靠落盘后独立冷组合加页面刷新。完整进程重启可按下方清单复核。
- `xingheng` 是新预设，旧 `economy` 会话不会静默迁移。已停用未实装 UI 草稿 `@local/dsh-xingheng-preset`，旧实际预设保留。

## 测试后状态

配置已恢复：fast 为 zero / deepseek-v4.1-flash-1017 / high，text 为 zero / gpt-6.1-sol / medium，long 为 zero / gpt-6.1-terra / high。中文和跟随系统主题已恢复。验收会话保留为证据，未删除用户会话。授权 URL、cookie 和 API 密钥未写入仓库或文档。

## 可复核步骤

1. `npm ci --ignore-scripts && npm run verify && npm run pack:check`。
2. 用 DSH 插件管理器安装当前仓库，检查 applied / warnings。
3. 新会话选「星衡 · 协作」；在设置页改任一角色，保存并刷新检查。
4. 用过期 revision 保存，应返回冲突；发送无效模型或推理，应返回拒绝且原配置不变。
5. 在允许的维护窗口重启原 Host，重新打开设置核对保存值。
6. 最小委派只要求子代理返回固定短文本，不读写文件、不跑命令；最后恢复路由与主题。

截图来自真实 DSH 页面：[浅色](xingheng-light.png) / [深色](xingheng-dark.png)。

## 旧版清理 — 2026-11-10

按用户确认，同时清理旧版星衡和失效的 Git 代理。

- 用 DSH 插件管理器卸载旧 UI 草稿、旧 economy 路由和旧 Web 策略；依赖安装操作退出码均为 0、无警告。运行时返回 restart-required，需要重启当前 Host 释放已加载的旧模块。
- 新包接管默认预设 xingheng、深度 1、最多两个活动子代理，并保留原模型池与团队工具禁用设置。
- 删除 5 个已核实的旧源码目录、4 个遗留链接、旧切换入口和相关临时脚本；新版仓库和普通配置备份保留。
- 301 个压缩会话记录文件逐一核对，仍然存在；未改写历史预设日志。旧 economy 预设卸载后，相关会话不保证能重启续跑。
- 精确移除 GitHub 的 `http://127.0.0.1:3067` 失效代理，未清空其他 Git 配置。
- 删除后重新冷组合：无 stderr，无旧版运行路径，预设只剩内置项及 xingheng / xingheng-worker；本地 @local 插件链接只剩 dsh-xingheng。
- `npm run verify` 11/11 通过；新版配置工具回读 high / medium / high。

## 2.1 原生 Agent Teams 验收 — 2026-11-10

- 团队后台、UI 和原生模型工具均已启用；冷组合验证 `tool-agent-team.disabled=false`。默认预设仍是 xingheng，普通执行单元保持限制，深度 1、并发 2 不变。
- 原生团队支持 fresh/fork；本次真实验收用 fresh，fork 参数由原生执行器集成测试核对，未额外发起 fork 模型请求。
- 原始 `list_agents` / `send_message` 名称曾被模型报告不可调用，但请求日志里确实有该工具，也没有 `UNKNOWN_TOOL`。记录该失败后，增加了保留原生执行器、参数和调用者的 `team_roster` / `team_message` / `team_interrupt` 兼容入口，随后真实调用成功。
- 当前 Lead 创建命名队友；队友确认 teammate 身份、向 lead 发消息、领取并完成 task-1。依赖 task-1 的 task-2 从 `ready=false` 变为 true，Lead 领取并完成。
- 两个真实队友之间完成消息往返，收到 `XINGHENG_PEER_ACK` 和 `XINGHENG_PEER_ROUNDTRIP_OK`。验收结束时队友均为 inactive。
- 另建 xingheng 新会话跑完整流程，最终返回 `XINGHENG_TEAM_ACCEPTANCE_OK`；原生面板显示 2 名成员（含 Lead）和 2 项已完成任务，截图为 xingheng-team.png。
- 对 inactive 队友的原生中断返回 `previousStatus=inactive`；无活动成员时 `wait_agent` 立即返回 `noProgress`。没有为验收刻意中断正在写文件的任务。
- 当前原生 `spawn_teammate` 不提供独立模型参数，沿用主控模型与预设；UI 三路模型只控制普通子任务。独立队友模型未作已实现声明。
- `npm run verify` 16/16 通过，覆盖全部原生 Team 工具与兼容别名共存、caller/CAS/context 传递、清理生命周期、普通控制别名和原有配置回归。
- 配置管理器返回 restart-required / unmanaged-plugin；当前进程已实际热加载并通过上述团队功能验收，完整服务重启验收尚未进行。现有会话不会自动更新 preset revision，最终使用应在重启后新建星衡会话。
- 2.1 普通子任务共存真实验收同时通过：新会话实际调用一次 `subagent_fast` 和 `subagent_list`，子任务按配置执行，最终返回 `XINGHENG_COEXISTENCE_OK`。未创建团队队友，未改配置或文件。

## 用户重启后的读取复核 — 2026-11-10

- 用户报告已重启；只读进程检查确认当前 DSH Web 进程启动时间为 13:42:04（Asia/Shanghai）。
- 在该进程提供的 3080 GUI 中请求 `/api/xingheng/v2`，回读版本 2.1.0、预设 `xingheng`；三路配置仍为 Flash/high、Sol/medium、Terra/high。
- 独立冷组合退出 0，stderr 为空，无旧版路径诊断。
- 重启后新建的文档会话，请求记录里包含原生团队创建、任务板和等待工具，以及三类普通委派和带前缀的普通控制工具。本次只是读取复核，没有重新执行完整团队、fork 或模型能力验收，上述历史结果保持原日期与范围。

## 3.0.0 底层角色重命名验收 — 2026-11-10

当前角色契约只有 `iterate / implement / analyze`，委派工具只有 `subagent_iterate / subagent_implement / subagent_analyze`。上文 2.x 内容是历史证据，保留原命名，不代表当前兼容接口。

- 源码、Host Config schema、客户端字典、preset 条目与 persona、配置工具描述、API JSON、模块导出和当前文档均使用新命名。核心模块已改为 `roles.js`、`role-agent.js`，旧模块文件和旧导出已移除。
- 单元与原生执行器集成回归 19/19 通过：旧角色对象、新旧键混用、旧角色插件配置都被拒绝；只注册三个新委派工具；Host 只注册 v3 配置端点。
- 当前保存值通过官方 Settings/ConfigEditor 清理旧键覆盖并重新保存为新键。模型与推理强度保持 Flash/high、Sol/medium、Terra/high，独立冷组合确认落盘新键且 stderr 为空。
- 真实 API：GET `/api/xingheng/v3` 回读版本 3.0.0 与三个新键；新键保存返回 200，旧键保存返回 400 且配置未改变；旧 `/api/xingheng/v2` 返回 404。
- 真实 UI：三角色、9 个下拉框正常。页脚只显示三个新工具名；特性实现推理 medium→high 保存后重新打开设置仍为 high，随后恢复 medium。
- 真实新建 `xingheng` 会话中，每个新工具只调用一次；子代理均运行 `xingheng-worker`，分别使用原定三路模型与推理，返回 `ROLE_OK`。三个子代理均未调用其他工具，主控最终返回 `XINGHENG_V3_ALL_ROLES_OK`。
- 请求头里的角色委派工具集合精确为三个新名，不含任何旧角色工具名。旧的运行中 Agent 仍可能持有旧 revision；未改写历史会话。
- 首轮主控 Gemini 网关 503 在任何委派之前就失败了；仅验收会话的主控改用 a6/Sol 后完成流程，保存的角色路线未作替换。
- 热加载曾因旧模块缓存导致 schema/default 和 role 枚举混用，已通过新的职责模块路径解决，随后确认预设无 broken 诊断且新会话实际创建、调用成功。插件管理器仍报 restart-required / unmanaged-plugin：当前进程功能已验收，但不记为 applied；建议收工后完整重启，清掉旧内存 revision。

## 3.1.0 分工隔离验收 — 2026-11-11（Asia/Shanghai）

### 发现的问题与修复

- 首轮 allowlist mock 通过，证明不了真实隔离：热加载后分析调用仍进入旧 worker；空白会话切换不再触发 `agent/created`，导致外部和团队工具残留。文件写入还需要通过 tool-fs 的 `write/edit/applyPatch=false` 明确关掉。
- 初版预设作用域过滤和 Host 策略错误地去读插件自己的 scope 库父链。该库的身份以模块私有 Symbol/WeakMap 保存，跨安装实例不共享，结果实际分析目录只剩 `working_directory`。分析回复里虽然带了 marker，但没有读取，明确判为未通过。
- 最终运行时代码移除 scope 库依赖，直接通过宿主 `tools.definitions(agent)` 枚举实际能力，经 `agent.ctx` 安装 allowlist；创建、选择、销毁都有生命周期处理；guard 单调拒绝近层的非允许调用。scope 库只用于真实注册表测试夹具，不用于运行时推断身份。
- 用户重启后再次复核，发现仍缺 `read`，从而确认不是靠重启能解决的问题；上述代码修复后，插件管理器返回 `application=applied`、`warnings=[]`。

### 最终通过项

- `npm run verify` 23/23，跑的是原生 Tools/Scope 注册表测试，不是 allow 数组 mock。覆盖空白会话选择后保留 read、继承能力遮蔽、切走时解除限制、近层工具被 guard 拒绝、卸载清理，以及原有的路由/CAS/团队回归。
- 新建星衡会话实际调用 `subagent_analyze`，子预设为 `xingheng-analyst`，使用已保存的 Terra/high。它的 request/header 工具精确为 glob、grep、list_agents、read、read_image、send_message、working_directory，不含 write/edit/Shell/jobs/浏览器/搜索/IM/配置/Team 或再委派工具。
- 分析子代理实际只执行 read，读取 `roles.js` 前 6 行，返回 iterate/implement/analyze 及 `HOST_SCOPE_ANALYST_OK`；没有根据 marker 猜测读取成功。
- 随后实际调用 iterate，子预设为 `xingheng-worker`，工具目录仍含 read/write/edit/bash/jobs 和父子通信，不含外部浏览器/搜索/配置/团队。按只读验收指令实际 read 后，用原生 `send_message` 汇报 `HOST_SCOPE_WORKER_OK`。
- 主控最终回复 `XINGHENG_HOST_SCOPE_OK`。保存的三路路线、权限模式和模型配置未改动；验收只使用已有文件读取，没有制造写入。
- 真实 GUI：配置端点 HTTP 200、版本 3.1.0、三个预设无 broken；设置页显示分析「纯只读环境」帮助和 3.1.0 页脚。历史截图没有当作最新版本的 UI 截图。
- 补充真实空白会话选择验收：先建空白协作会话再选分析预设，只执行 read 就成功读到三角色值并返回 `PRESET_SWITCH_READ_OK`，证明不依赖再次触发 `agent/created` 也能保留读取能力。原生顶层 Team 的近层工具可能仍会显示，由 guard 拒绝非允许执行。

### 504 与未覆盖的部分

- 多次中断发生在 `zero / gemini-4-argon / high` 上游，错误正文为 Cloudflare `origin_gateway_timeout`，即源站未按时响应。没有据此宣称已定位具体内部队列或唯一根因，没有改用户的网关、全局重试策略或角色模型。
- 最终验收仅主控选择了 a6/Sol，角色仍用已保存的提供商与模型。没有用跨模型重试去绕过文件权限。
- 分析工具过滤不是 OS 沙箱：可读获准文件、可发消息；受信插件的近层注册可能仍会显示，但不在允许表里的调用会被 guard 拒绝。只读并行没有快照隔离。
- 本轮没有运行写入中断测试、没有重测所有网关，也没有多框架性能基准；不声称更低费用或更高成功率。implement 与 iterate 共用执行预设，新行为差别主要落在任务契约与 SOP 上；implement 的参数分流由原生执行器回归覆盖。