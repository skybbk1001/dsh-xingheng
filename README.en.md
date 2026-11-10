# Xingheng

Role-based subagent model configuration and dual-track multi-agent collaboration bundle for **DeepSeek Harness (DSH)**, integrating persistent **Ordinary Role Subagents (Workers)** with **Native Agent Teams**.

> **Release & Distribution Status**: Current version `2.1.0`, targeting DSH `>=0.2.2-rc.1 <0.3` (validated against `0.2.2-rc.1`) and Node.js `>=22`. Source code is hosted in a [private GitHub repository](https://github.com/skybbk1001/dsh-xingheng) requiring authorized access; it is not published to the public npm registry. For exact test coverage and real-environment verification boundaries, see the [Acceptance Record](docs/acceptance.md).

[中文文档](README.md) · [English Usage Guide](docs/usage.en.md) · [中文使用指南](docs/usage.md) · [Architecture](docs/architecture.md) · [Migration & Cleanup](docs/migration.md) · [Changelog](CHANGELOG.md)

---

## Overview & Non-Goals

Xingheng is a Host service, Web client plugin, and agent preset bundle running inside DeepSeek Harness. **It is not a standalone chat application**:

- **Persistent Three-Role Worker Routing**: Configure provider, model, and reasoning effort across three ordinary subagent roles—**Quick iteration (`fast`)**, **Feature implementation (`text`)**, and **Analysis and planning (`long`)**—in **Settings → Xingheng · Subagent configuration**.
- **Native Agent Teams Coexistence**: Enables DSH native Agent Teams for durable named teammates (`fresh` or `fork` context), peer-to-peer messaging, a shared task board with Compare-And-Swap (CAS) revisions and blocker dependencies, state-change waits, and Lead-only interrupts.
- **Collision-Free Control Namespaces**: Namespaces ordinary child controls on the Lead preset as `subagent_message`, `subagent_list`, and `subagent_interrupt` (addressed by child session `agent_id`), cleanly separating them from native Team tools (addressed by member name `target`), while also installing `team_roster`, `team_message`, and `team_interrupt` compatibility aliases in Team member scopes.
- **Preserves Lead & Host Authority**: Does not modify the Lead session model selector, API credentials, file sandbox permission mode, search engines, MCP servers, or IM integrations.
- **No Fabricated Price or Capability Claims**: Role labels and initial draft combinations represent workflow division only. **They do not imply model quality rankings, inference speed guarantees, or billing tiers.** The plugin performs no automatic benchmarking, cost routing, or silent fallback.

---

## UI Entry Points & Previews

Xingheng provides two primary entry points in the DSH Web GUI:

1. **Configuration Entry**: Open **Settings → Xingheng · Subagent configuration** to view and save persistent routes for `subagent_fast`, `subagent_text`, and `subagent_long`.
2. **Team Collaboration Entry**: In a session using the **Xingheng collaboration** (`xingheng`) preset, open the **Agent Teams** panel in the session header to inspect active/inactive members and the shared task board.

All screenshots below are captured from an actual installed DSH Web GUI:

### Settings Page (Light Theme)

![Xingheng Settings Page (Light Theme)](docs/xingheng-light.png)

- Dark theme screenshot: [docs/xingheng-dark.png](docs/xingheng-dark.png)

### Native Agent Teams Panel

![Native Agent Teams Panel: Members and Shared Tasks](docs/xingheng-team.png)

---

## Agent Teams vs. Ordinary Subagents

Within the `xingheng` preset, both **Ordinary Role Subagents (Workers)** and **Native Agent Teams** are available. They differ fundamentally in lifecycle, model routing, addressing protocol, and capacity limits:

| Dimension | Ordinary Role Subagents (Workers) | Native Agent Teams |
| :--- | :--- | :--- |
| **Primary Use Case** | Scoped local fixes, self-contained feature slices, read-only code review or debugging | Multi-step collaboration requiring a shared task board, task dependencies, and peer messaging |
| **Creation Tool** | `subagent_fast` / `subagent_text` / `subagent_long` | `spawn_teammate` (Team Lead only) |
| **Agent Preset** | **Xingheng · Worker** (`xingheng-worker`) | Inherits the Lead's active preset (`xingheng`) |
| **Model & Reasoning Effort** | **Controlled per role in Settings → Xingheng · Subagent configuration**; per-call model overrides by the Lead are disabled (`modelSelection: false`) | **Inherits the Lead model and preset at creation**; the current native DSH spawn request does not expose a separate teammate model parameter, and the three UI routes **do not** control teammates |
| **Context Mode** | Fresh independent child session (`spawn`); requires a self-contained `prompt` | Defaults to `fresh` (clean context); supports `fork` (inherits completed Lead turns) |
| **Control Tools & Aliases** | Lead uses `subagent_message`, `subagent_list`, `subagent_interrupt`; worker uses native `send_message` to report back | Native `list_agents`, `send_message`, `interrupt_agent`, `wait_agent`, `team_task_*`, plus member-scoped aliases **`team_roster`**, **`team_message`**, **`team_interrupt`** |
| **Addressing Identifier** | **`agent_id`** (child session ID) | **`target`** (member name in `lower-kebab-case`, e.g., `'lead'` or `'reviewer'`) |
| **Tool Surface** | Restricted by `xingheng-worker-policy` to file read/write/search, shell (`bash`/`pwsh`), background jobs (`job_*`), parent messaging, and `skill`; **no browser, web search, IM, or nested delegation tools** | Full collaboration preset tools plus Team task and messaging tools; only the Team Lead can spawn or interrupt teammates |

### Concurrency Limit (2) vs. Team Roster Limit (8)

- **Active Subagent Concurrency (`maxActiveSubagents: 2`)**: Enforced by the profile-wide `subagent` setting. Capacity is **2** live or materializing children per activation tree, excluding its root. Waiting, pending inbox work and stopping cleanup may still occupy slots; `running` row count alone does not determine free capacity, with delegation depth capped at `maxDepth: 1` (no nested child delegation).
- **Lifetime Team Roster Capacity (Default 8)**: Enforced by native DSH Agent Teams. A team session allows up to **8** named teammate slots across its lifetime. This count includes `inactive` and `failed` members, and teammate names cannot be reused within the same session.
- **Important**: An `inactive` status means no turn is currently executing for that member—it does **not** prove task completion. Assigning or unblocking a shared task never starts an `inactive` teammate automatically; send a message via `team_message` / `send_message` to wake it.

---

## Installation

### Requirements

- **Node.js**: `>=22`
- **Profile prerequisites**: enable the shipped `dsh-base`, `dsh-web-app` and `dsh-experimental-agent-team-profile` bundles. Xingheng consumes their services rather than creating a second Team implementation.
- **DeepSeek Harness (DSH)**: `>=0.2.2-rc.1 <0.3` (pinned and verified against `0.2.2-rc.1`)

### Install via Assistant Tool (Recommended)

In a DSH session with `danger-full-access` permission (or tool approval enabled), ask the assistant to invoke the `plugin_manager` tool:

> Please use the `plugin_manager` tool with `action: "install_bundle"` to install `/absolute/path/dsh-xingheng`.

**Critical Rules**:

1. **`plugin_manager` is an assistant tool call, NOT a shell command.** Never run `plugin_manager` inside a `bash` terminal.
2. Let `plugin_manager` manage the profile manifest and package installation. **Do not manually edit DSH profile runtime manifests.**
3. **Inspect `application` and `warnings` in the tool result**:
   - `applied`: The bundle is active in the live Host process. Refresh the browser page to load the UI slot.
   - `restart-required` (or `unmanaged-plugin` reload notice): You must **restart the original DSH Host process** first, and then refresh the browser tab. **Refreshing the browser alone does not restart the Host service, and starting a separate server on another port will not update your active Web GUI.**

---

## Quick Start & Configuration

1. **Select the Preset**: Start a new session in the DSH Web GUI and select **星衡 · 协作** (`xingheng`).
2. **Open Settings**: Navigate to **Settings → Xingheng · Subagent configuration**.
3. **Configure the Three Worker Roles**:
   - **01 Quick iteration (`fast`)**: Local fixes, small improvements, and spot checks (`subagent_fast`).
   - **02 Feature implementation (`text`)**: Features, API implementation, and test writing (`subagent_text`).
   - **03 Analysis and planning (`long`)**: Code review, architecture analysis, and complex debugging (`subagent_long`).
4. **Reasoning Effort Behavior**:
   - Only reasoning efforts advertised by the selected provider and model are listed.
   - Choosing **"Native default (may inherit lead effort)"** (stored as empty string `""`) preserves native DSH delegation behavior: if the child uses the same model as the Lead, it may inherit the Lead's reasoning effort; if it uses a different model, the adapter default is used. **An empty effort string does not mean reasoning is turned `off`.**
5. **Save & Activation**:
   - Click **Save configuration**. The Host service validates all three routes against the live `llm` catalog without generating model output, then writes atomically through `ConfigEditor` with double CAS revision checks.
   - The UI reads back the saved state automatically. **Saved routes apply to the next spawned ordinary child**; already admitted or running children keep their initial route.
   - Clicking **Fill initial combination** only populates the unsaved form draft; if any default model is absent from your catalog, you must choose an available option before saving.

In addition to the Web UI, Xingheng exposes the **`xingheng_config` agent tool** and the **`/xingheng` slash command**, which share the exact same validation and persistence pipeline. See the **[English Usage Guide](docs/usage.en.md)** for full request schemas, team workflows, and troubleshooting.

---

## Profile-Wide Policy, Restarts & Legacy Session Revisions

Following the retirement of legacy standalone policy packages, `@local/dsh-xingheng` declares profile-wide defaults in [`cordis.patch.yml`](cordis.patch.yml). **These defaults apply across all presets in the current profile, not only `xingheng`**:

- **Default Preset**: Sets `agent-preset-registry` `default` and `selectedDefault` to `xingheng`.
- **Subagent Depth & Concurrency**: Sets `subagent` to `maxDepth: 1` and `maxActiveSubagents: 2`.
- **Native Agent Teams**: Sets `tool-agent-team` `disabled: false`.
- **Allowed Model Pool**: Preserves `subagent-model-selection-settings` (`zero/gpt-6-astra`, `zero/deepseek-v4.1-flash-1017`, `zero/gpt-6.1-sol`, `zero/gpt-6.1-terra`). User overrides in DSH Settings remain authoritative over bundle defaults.

### Session Preset Revisions & Historical Logs

- **Existing sessions do not upgrade in place**: Live Agents retain their mounted in-memory revision. Logs retain the preset ID, not a permanent copy of its implementation; recovery after restart resolves the current definition of that ID and may fail if it was removed. **Do not assume a running older Agent has acquired a changed preset tool set**. Create a new session with the `xingheng` preset after restarting (if required).
- **Historical logs vs. resuming removed presets**: Uninstalling legacy bundles (such as `economy`) leaves historical session log files untouched for inspection, and never silently rewrites `economy` into `xingheng`. However, once a legacy preset is removed, sessions created under that preset may not be resumable after a Host restart. See [Migration & Cleanup](docs/migration.md).

---

## Troubleshooting Summary

| Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| UI warns *"A saved choice is no longer in the catalog"* or save fails with `HTTP 400` | A configured `provider`, `model`, or `effort` is not registered in the current DSH `llm` catalog or is unsupported by the model | Select an available provider, advertised model, and supported reasoning effort in the dropdowns, then save |
| Save fails with `HTTP 409` (`Configuration conflict`) | Another client, tool call, or command saved a newer configuration after your snapshot was read (`expectedRevision` mismatch) | Click **Reload** (or run `action: "read"` to fetch the latest `revision`), reapply your changes, and save again |
| UI warns *"The Xingheng preset is unavailable"* | The bundle is not fully activated yet or its preset entry is disabled in the plugin manager | Check `plugin_manager` status; if installation returned `restart-required`, restart the original DSH Host process and reload the browser |
| `spawn_teammate`, `team_message`, or `subagent_list` is missing in the current session | The session was created before the `2.1.0` upgrade (bound to an older preset revision) or uses another preset | Restart the DSH Host if pending, then **create a new session** with the `xingheng` preset |
| Model claims `list_agents` or `send_message` cannot be called in a Team session | Acceptance observed model claims that native names were unavailable despite their presence in request logs; the specific client cause is unconfirmed | Instruct the Lead or teammate to call the member-scoped aliases **`team_roster`**, **`team_message`**, and **`team_interrupt`** |
| `team_task_update` fails with a revision conflict | Shared tasks enforce optimistic CAS concurrency (`expected_revision`) and another member updated the task first | Call `team_task_get` or `team_task_list` to read the latest `revision`, then retry `team_task_update` with the updated revision |
| A teammate stays `inactive` after a task is created, reassigned, or unblocked | Task board mutations never auto-start an `inactive` teammate's turn | Call `team_message` (or `send_message`) targeting the teammate's name (`target`) to start or resume its turn |

For detailed operational steps, see the [English Usage Guide](docs/usage.en.md).

---

## Development & Quality Gates

From `/absolute/path/dsh-xingheng`:

```sh
npm ci --ignore-scripts
npm run verify
npm run pack:check
```

- `npm run check` ([`scripts/check.mjs`](scripts/check.mjs)): Validates required package files, JavaScript syntax across `src/` and `client.js`, portable `cordis.patch.yml` structure (no hardcoded `/home/` paths), localized metadata (`locale/zh.json`, `locale/en.json`), original SVG icon, and client constraints (no Vue, no `@deepseek-ai/*` client imports, no legacy `--color-*` tokens).
- `npm test` (`node --test test/*.test.js`): Runs 6 test suites (16 test cases) covering:
  - [`test/config.test.js`](test/config.test.js): Strict schema parsing, whitespace/unknown-key rejection, capability validation against a mocked `llm` catalog, `AbortSignal` cancellation before writes, serialized `ConfigEditor` CAS conflict rejection, and write-failure propagation.
  - [`test/host.test.js`](test/host.test.js): Shared `operate()` execution across `/api/xingheng/v2`, `xingheng_config`, and `/xingheng`, HTTP status codes (`200`, `400`, `409`, `415`), and clean effect disposal.
  - [`test/delegation.test.js`](test/delegation.test.js): Native `@deepseek-ai/dsh-tool-subagent` mounting, synchronous next-child route lookup, preflight snapshot isolation during concurrent saves, and rejection of per-call model overrides (`modelSelection: false`).
  - [`test/controls.test.js`](test/controls.test.js): Ordinary control aliasing (`subagent_message`, `subagent_list`, `subagent_interrupt`) with native schema and lineage preservation.
  - [`test/team-controls.test.js`](test/team-controls.test.js) & [`test/native-team.test.js`](test/native-team.test.js): Coexistence of native Team tools and `team_roster` / `team_message` / `team_interrupt` aliases, member-only installation, CAS / caller / `fresh` & `fork` context preservation, and disposal cleanup.

---

## Verified vs. Unverified Boundaries

We strictly distinguish **unit/mock integration tests** from **real end-to-end runtime verification**. Full evidence is recorded in [docs/acceptance.md](docs/acceptance.md):

### Verified in Real Environment

- **Static Checks & 16/16 Automated Tests**: All configuration CAS, Host API/tool/command, native subagent delegation, ordinary control aliases, and native Team alias tests pass.
- **Live Bundle Installation & Disk Persistence**: Installed via `plugin_manager` into the active Web profile; verified UI dropdowns, save/reload cycles, HTTP 400/409 negative checks, `xingheng_config` tool round-trips, and independent cold config dumps (`dsh --profile web --dump-config`).
- **Real Model Delegation (Ordinary Subagent & Coexistence)**: Spawned a real `subagent_fast` (`xingheng-worker`) child and queried `subagent_list` in a fresh `xingheng` session, confirming real model execution and handoff.
- **Real Model Collaboration (Native Agent Teams)**: Spawned real named teammates via `spawn_teammate` (`fresh` context), verified peer-to-peer message round-trips, called `team_roster` / `team_message` / `team_interrupt` aliases, verified `task-1` → `task-2` dependency unblocking and CAS claims/completions, verified immediate `noProgress` from `wait_agent` when peers are inactive, and captured real GUI screenshots of the Team panel.

### Not Yet Verified (Known Boundaries)

- **No separate live model billing calls for `text` / `long` roles or `fork` teammates**: Route wiring for `text` and `long` and `fork` provider parameters are covered by native executor integration tests; live model calls were executed with `fast` and `fresh`.
- **The full Team workflow was not rerun after restart**: the user restarted the Host at 13:42. Subsequent read-only checks confirmed version 2.1.0, retained routes and a clean cold composition; earlier full Team and ordinary-worker acceptance remains a pre-restart result. See [the dated record](docs/acceptance.md).
- **No destructive mid-write interrupt test**: `team_interrupt` was verified against an `inactive` teammate (`previousStatus: inactive`) without forcefully interrupting a teammate in the middle of file writes.
- **Not verified on physical mobile devices, screen readers, or all third-party LLM gateways**.

---

## Security & License

- Licensed under the MIT License (including the original `icon.svg`).
- Please review [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes and [SECURITY.md](SECURITY.md) for security boundaries and private reporting guidelines.
