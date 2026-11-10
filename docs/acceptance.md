# 验收记录 — 2.0.0

日期：2026-11-10（Asia/Shanghai）。环境：DSH 0.2.2-rc.1，Node v24.21.0，当前 Web profile。测试目标是原有 3080 GUI，没有另起替代服务器。

## 结果

| 层级 | 检查 | 结果与边界 |
|---|---|---|
| 静态 | Manifest、语法、便携预设、语言元数据、图标 | 通过；预设无绝对本地文件依赖 |
| 自动化 | `npm run verify` | 11/11 通过，无跳过；包含校验、并发冲突、取消、保存失败、原生执行器和 Host API |
| 原生执行器（mock backend） | 三角色、深度 1、worker 预设、配置更新、禁止模型覆盖 | 通过；捕获实际原生 execute 传给 backend 的参数，不产生模型请求 |
| 原生执行器（mock backend） | preflight 期间改配置 | 已受理的调用保持原参数，下一次调用读取新配置 |
| 实装 | plugin_manager 安装 | `application: applied`、`warnings: []`；Host 和两个预设已激活 |
| UI 注册 | 当前已登录客户端 `settings.section` | `xingheng` 入口 active，顺序 22 |
| 工具调用 | `xingheng_config` 读、保存、冲突 | 真实运行；fast high→medium→high，过期 revision 明确拒绝 |
| 磁盘持久化 | 保存 medium 后独立 `dsh --profile web --dump-config` | 冷组合读到 medium；不是仅检查浏览器状态。未为测试重启用户 Host |
| 认证 | 未登录请求配置端点 | HTTP 401；未另建绕过鉴权的 HTTP 服务 |
| 真实 UI | 三角色提供商/模型/推理下拉框 | 共 9 个控件，均能操作 |
| 真实 UI | 保存、刷新、回读 | fast 改 medium 保存成功，页面刷新后仍为 medium，随后恢复 high |
| 真实 UI | 同时更换提供商、模型和推理 | 保存 `a6/gpt-6.1-sol/low` 后回读一致，随后恢复初始组合；未对该临时路线发起模型请求 |
| 真实 API | 不支持的推理 / stale revision | HTTP 400 / 409，保存配置未改变 |
| 真实 UI | 中英切换 | 标题、角色、控件与保存按钮正常；测试后恢复中文 |
| 真实 UI | 浅色/深色 | 实际打开并截图；控件无水平溢出；测试后恢复跟随系统 |
| 显示资源 | 插件详情元数据、原创 SVG、README 截图 | 标题与说明正确，SVG naturalWidth=64，README 截图成功加载 |
| 真实委派 | 新建 `xingheng` 会话并要求一次 fast 委派 | 主控创建 1 个 `xingheng-worker`；子回复 `XINGHENG_CHILD_OK`，主回复 `XINGHENG_ACCEPTANCE_OK`。这是实际模型调用，不是 mock |
| 分发 | `npm pack --dry-run` | 包含运行文件、配置、元数据、图标、文档与截图；不含凭据、session 或 node_modules |

## 已知边界

- 未逐一对 text/long 发起真实模型调用，三路参数由原生执行器回归测试覆盖；真实模型验收使用 fast 一路。
- 未验证移动设备、屏幕阅读器和所有第三方模型网关；不作性能、成本、模型质量排名承诺。
- 浏览器控制台的 400/409 来自刻意的负向测试。另观察到 DSH 文件管理器图标 404，与本插件无关；没有发现 `slot entry crashed` 或插件 JavaScript 异常。
- 没有重启用户运行中的 DSH 进程；持久化验证为落盘后独立冷组合及页面刷新。完整进程重启可按下方清单复核。
- `xingheng` 是新预设；旧 `economy` 会话不会静默迁移。已停用未实装 UI 草稿 `@local/dsh-xingheng-preset`，旧实际预设保留。

## 测试后状态

配置已恢复：

- fast：zero / deepseek-v4.1-flash-1017 / high
- text：zero / gpt-6.1-sol / medium
- long：zero / gpt-6.1-terra / high

中文、跟随系统主题已恢复。验收会话保留为证据，未删除用户会话。授权 URL、cookie 和 API 密钥未写入仓库或文档。

## 可复核步骤

1. `npm ci --ignore-scripts && npm run verify && npm run pack:check`。
2. 用 DSH 插件管理器安装当前仓库，检查 applied / warnings。
3. 新会话选「星衡 · 协作」；设置页更改任一角色，保存并刷新检查。
4. 用过期 revision 保存，应返回冲突；发送无效模型或推理，应返回拒绝，原配置不变。
5. 在允许维护窗口重启原 Host，重新打开设置，核对保存值。
6. 最小委派仅要求子代理返回固定短文本，不读写文件、不运行命令；最后恢复路由与主题。

截图来自真实 DSH 页面：[浅色](xingheng-light.png) / [深色](xingheng-dark.png)。

## 后续旧版清理 — 2026-11-10

按用户确认同时清理旧版星衡及失效 Git 代理：

- 通过 DSH 插件管理器卸载旧 UI 草稿、旧 economy 路由及旧 Web 策略，依赖安装操作均退出 0、无警告；运行时返回 restart-required，需重启当前 Host 释放已加载旧模块。
- 新包接管默认预设 xingheng、深度 1、最多两个活动子代理，并保留原模型池与团队工具禁用设置。
- 删除 5 个已核实旧源码目录、4 个遗留链接、旧切换入口及相关临时脚本；新版仓库和普通配置备份保留。
- 301 个压缩会话记录文件逐一核对仍存在；未改写历史预设日志。旧 economy 预设卸载后，相关会话不保证能够重启续跑。
- 精确移除 GitHub 的 http://127.0.0.1:3067 失效代理；未清空其他 Git 配置。
- 删除后重新冷组合，无 stderr、无旧版运行路径，预设只剩内置项及 xingheng/xingheng-worker；本地 @local 插件链接仅保留 dsh-xingheng。
- npm run verify：11/11 通过；新版配置工具回读 high / medium / high。

## 2.1 原生 Agent Teams 验收 — 2026-11-10

- 团队后台、UI 和原生模型工具均启用；冷组合验证 tool-agent-team.disabled=false。默认预设仍为 xingheng，普通执行单元保持限制，深度1/并发2不变。
- 原生团队支持 fresh/fork；本次真实验收使用 fresh，fork 参数由原生执行器集成测试核对，没有额外发起 fork 模型请求。
- 原始 list_agents/send_message 名称曾被模型报告不可调用，但请求日志确有该工具且没有 UNKNOWN_TOOL。记录该失败后增加保留原生执行器/参数/调用者的 team_roster/team_message/team_interrupt 兼容入口，随后真实调用成功。
- 当前 Lead 创建命名队友；队友确认 teammate 身份、向lead发消息、领取并完成 task-1。依赖 task-1 的 task-2 从 ready=false 变为 true，Lead领取并完成。
- 两个真实队友之间消息往返：收到 XINGHENG_PEER_ACK 和 XINGHENG_PEER_ROUNDTRIP_OK。验收结束队友均 inactive。
- 另建 xingheng 新会话，完整流程最终返回 XINGHENG_TEAM_ACCEPTANCE_OK；原生面板显示2名成员（含Lead）及2项已完成任务，截图为 xingheng-team.png。
- 对 inactive 队友的原生中断返回 previousStatus=inactive；无活动成员时 wait_agent 立即返回 noProgress。没有为验收刻意中断正在写文件的任务。
- 当前原生 spawn_teammate 不提供独立模型参数，沿用主控模型/预设；UI三路模型仅控制普通子任务。独立队友模型不作已实现声明。
- npm run verify：16/16通过，包括全部原生Team工具与兼容别名共存、caller/CAS/context传递、清理生命周期、普通控制别名与原有配置回归。
- 配置管理器返回 restart-required/unmanaged-plugin；当前进程已实际热加载并通过上述团队功能验收，完整服务重启验收尚未进行。现有会话不会自动更新其preset revision；最终使用应重启后新建星衡会话。

- 2.1普通子任务共存真实验收通过：新会话实际调用一次 subagent_fast 和 subagent_list，子任务按配置执行，最终返回 XINGHENG_COEXISTENCE_OK。未创建团队队友，未改配置或文件。

## 用户重启后的读取复核 — 2026-11-10

- 用户报告已重启；只读进程检查确认当前 DSH Web 进程启动时间为 13:42:04（Asia/Shanghai）。
- 在该进程提供的现有 3080 GUI 中请求 `/api/xingheng/v2`，回读版本 2.1.0、预设 `xingheng`；三路配置仍为 Flash/high、Sol/medium、Terra/high。
- 独立冷组合退出 0，stderr 为空，无旧版路径诊断。
- 重启后新建的文档会话请求记录包含原生团队创建、任务板和等待工具，以及三类普通委派和带前缀的普通控制工具。本次为读取复核，没有重新执行完整团队、fork 或模型能力验收，前述历史结果保持原日期与范围。
