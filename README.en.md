# Xingheng

A DeepSeek Harness (DSH) bundle for **read-only analysis, cohesive implementation and targeted iteration**, with persistent per-role model routing and native Agent Teams.

**3.1.0** · [中文](README.md) · [Usage](docs/usage.en.md) · [Architecture](docs/architecture.md) · [Migration](docs/migration.md) · [Acceptance](docs/acceptance.md) · [Changelog](CHANGELOG.md)

[Private GitHub repository](https://github.com/skybbk1001/dsh-xingheng); authorized access required, no npm publication. Node 22+. Declared DSH range: `>=0.2.2-rc.1 <0.3`; actual acceptance and pinned native executors target **0.2.2-rc.1**, not every version in that range.

## Roles and capability boundaries

| Role | Key / tool | Preset | Deliverable |
|---|---|---|---|
| Quick iteration | `iterate` / `subagent_iterate` | `xingheng-worker`, read/write and commands | Minimal targeted patch or explicitly authorized verification |
| Feature implementation | `implement` / `subagent_implement` | `xingheng-worker`, read/write and commands | Cohesive feature/module slice, interfaces and tests |
| Analysis and planning | `analyze` / `subagent_analyze` | `xingheng-analyst`, code-reading tools | Exploration, diagnosis, architecture plan or fresh-context review with file/line evidence |

The analyst preset does not register write, edit, shell or job tools. A Host-owned policy masks inherited browser, web, IM, configuration and delegation capabilities and guards any non-allowlisted invocation. This is a DSH tool boundary, **not an OS sandbox**. Reading authorized files and sending parent messages remain possible. A trusted plugin's nearer agent-local registration can remain visible, but disallowed execution is guarded.

Worker path scopes, validation permissions, soft checkpoints (12 calls / 10 minutes) and freeze handoffs are prompt conventions, not filesystem locks or billing caps. Native DSH permissions remain authoritative.

## Coordination

Handle trivial tasks directly. For unfamiliar or cross-module work: analyze first, stabilize shared interfaces sequentially, then delegate independent cohesive slices. Do not split tightly coupled files between workers. Review substantial changes in a fresh analyst context with requirements, changed files/diff, relevant constraints and known risks rather than the author's full conversation. Freeze writes and have the Lead validate the settled revision.

Read-only analysis does not provide snapshot isolation; concurrent changes still require version checks or a write freeze. Review findings do not replace tests. Report checks not run.

## UI and model routing

Start a session with **星衡 · 协作** (`xingheng`). Open **Settings → Xingheng · Subagent configuration** for three provider/model/effort selectors. The session-header **Agent Teams** panel shows native members and tasks.

Configuration uses the DSH model catalog, validates complete routes, saves through ConfigEditor with revision conflict checks, then reads back. Routes apply to the **next child**, not an admitted or running call. Empty effort follows native inheritance/defaults (the same model may inherit Lead effort; changing models uses adapter defaults), not `off`. Advertised capability does not guarantee gateway availability. No model quality, price or speed hierarchy is implied.

![Settings](docs/xingheng-light.png)

[Dark theme](docs/xingheng-dark.png) · [Native Team panel](docs/xingheng-team.png). These are historical real GUI captures; version/help text may predate 3.1. Use current code and dated acceptance for the latest behavior.

## Ordinary children vs. native teams

Ordinary roles start fresh contexts and use their configured model. Lead controls are `subagent_message`, `subagent_list`, `subagent_interrupt`: message/interrupt use child `agent_id`, list uses `scope`.

Named teammates use native `spawn_teammate`, fresh/fork context, peer messaging and a shared dependency-aware task board. At creation they inherit the Lead model/preset; the current native request has no separate teammate model parameter. Three-role UI settings do not control them. Team aliases `team_roster`, `team_message`, `team_interrupt` preserve native executors and use member `target` names. Task updates require the current revision; assigning/unblocking a task does not wake an inactive member—send a message. Inactive is not proof of completion.

The bundle affects Profile-wide defaults: preset `xingheng`, depth 1, native teams enabled, retained model pool and **2 activation-capacity slots per tree**. Live/materializing children and some waiting/stopping states count, not only running turns. The native **8 lifetime teammate-name slots**, including failed/inactive entries, are separate. User overrides win.

## Install and upgrade

Enable the shipped `dsh-base`, `dsh-web-app`, `dsh-experimental-agent-team-profile` bundles first. Clone the private repository, then ask the DSH assistant to use **`plugin_manager`**, `action: install_bundle`, with the absolute local directory. This is an assistant tool, **not a shell command**. Do not hand-edit the Profile manifest or run package management there.

Inspect `application`, `warnings` and activation diagnostics. If restart is required, restart the original Host, refresh the GUI and create a new session; browser refresh is not a Host restart. Existing Agents retain their composition revision. Version 3.1 retains the 3.0 keys and `/api/xingheng/v3`, so model settings need no migration, but analysis no longer permits writes or commands.

## Development and evidence

```sh
npm ci --ignore-scripts
npm run verify
npm run pack:check
```

**23 tests** cover validation/CAS, native delegation and controls, Team coexistence, actual DSH registry rebinding, preserved reads, forbidden invocation guards and cleanup. [Acceptance](docs/acceptance.md) separates mocks, native registry tests and real model runs; historical results are not automatically current-version evidence.

For 400/409, verify complete roles/catalog values or reload the revision. An analyst cannot execute tests by design; assign an explicitly authorized command to an execution worker. A 504 is a gateway timeout, not a reason for endless role switching; see [troubleshooting](docs/usage.en.md#model-gateway-timeouts).

Lead model, credentials, filesystem permission mode, search preference and MCP/IM configuration are not changed. MIT, including the original icon. [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md).
