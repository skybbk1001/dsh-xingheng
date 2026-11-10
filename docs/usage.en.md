# Xingheng Detailed Usage & Troubleshooting Guide

This guide covers the complete installation workflow, three-role ordinary subagent configuration interfaces, operational boundaries between **Native Agent Teams** and **Ordinary Role Subagents (Workers)**, control tool aliases and addressing protocols, CAS revision rules, and troubleshooting for `@local/dsh-xingheng` `2.1.0`.

[Back to English README](../README.en.md) · [中文详细使用指南](usage.md) · [Architecture](architecture.md) · [Migration & Cleanup](migration.md) · [Acceptance Record](acceptance.md)

---

## 1. Installation & Activation Workflow

### 1.1 Prerequisites

- **Node.js**: `>=22`
- **Profile prerequisites**: enable the shipped `dsh-base`, `dsh-web-app` and `dsh-experimental-agent-team-profile` bundles. Xingheng consumes their services rather than creating a second Team implementation.
- **DeepSeek Harness (DSH)**: `>=0.2.2-rc.1 <0.3` (directly reuses the native `@deepseek-ai/dsh-tool-subagent` and `@deepseek-ai/dsh-tool-subagent-control` executors pinned at `0.2.2-rc.1`)
- **Session Permission**: Invoking `plugin_manager` requires `danger-full-access` permission in the current session, or explicit user approval for the tool call.

### 1.2 Install via the `plugin_manager` Assistant Tool

In an active DSH conversation, ask the assistant:

> Please call the `plugin_manager` tool (`action: "install_bundle"`, `target: "/absolute/path/dsh-xingheng"`) to install the Xingheng bundle.

**Important Distinctions**:

1. **`plugin_manager` is an assistant tool call, NOT a shell command**:
   - **Correct**: The assistant calls `plugin_manager({ action: "install_bundle", target: "/absolute/path/dsh-xingheng" })`.
   - **Incorrect**: Running `plugin_manager ...` inside a `bash` shell (no such shell binary exists) or hand-editing DSH profile manifest files.
2. **Inspect `application` and `warnings` in the response**:
   - `application: "applied"`: The Host service, client slot, and presets are live in the current process. Refresh your browser tab to load the UI.
   - `application: "restart-required"` (or an `unmanaged-plugin` notice): Already-loaded modules require a process restart to re-initialize cleanly. You must **restart the original DSH Host process** first, then refresh your browser tab.
   - **Do not confuse browser reload with Host restart**: Reloading the browser tab only reloads client assets; it does not restart the DSH Node.js process. Starting a second server on another port will not update your active Web GUI.

---

## 2. Configuring the Three Ordinary Subagent Roles

Xingheng provides three interfaces backed by the exact same validation and `ConfigEditor` persistence pipeline: the **Web Settings UI**, the **`xingheng_config` agent tool**, and the **`/xingheng` slash command**.

### 2.1 Role Definitions & Initial Draft Combination

| Role Key | English UI Label | Chinese UI Label | Delegation Tool | Typical Task Scope | Built-in Initial Draft (`DEFAULT_WORKERS`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`fast`** | Quick iteration | 快速迭代 | `subagent_fast` | Local fixes, small improvements, and spot checks | `zero` / `deepseek-v4.1-flash-1017` / `high` |
| **`text`** | Feature implementation | 特性实现 | `subagent_text` | Features, API implementation, and test writing | `zero` / `gpt-6.1-sol` / `medium` |
| **`long`** | Analysis and planning | 分析规划 | `subagent_long` | Code review, architecture analysis, and complex debugging | `zero` / `gpt-6.1-terra` / `high` |

> **Important Note**: `DEFAULT_WORKERS` serves only as the initial default and the template for the **"Fill initial combination"** button. **It implies no price, speed, or capability ranking.** If any default provider or model is not registered in your active DSH catalog, saving will fail closed until you select an advertised option.

### 2.2 Method 1: Web Settings UI

1. Open **Settings** in the DSH Web GUI.
2. Select **Xingheng · Subagent configuration** (**星衡 · 子代理配置** in Chinese).
3. For **01 Quick iteration**, **02 Feature implementation**, and **03 Analysis and planning**, select:
   - **Provider**: Populated from `llm.listProviders()`. Changing the provider clears the role's model and reasoning effort draft to prevent stale cross-provider IDs.
   - **Model**: Populated from `llm.listModels(provider)`. Changing the model resets the role's reasoning effort draft.
   - **Reasoning effort**: Populated from `llm.resolveModelInfo(provider, model)`, plus **"Native default (may inherit lead effort)"** (stored as `""`).
4. Review status and save:
   - When modified, the status badge shows **Unsaved changes**.
   - Click **Save configuration** (`POST ./api/xingheng/v2`). Once validated and persisted, the UI updates from the server read-back snapshot and displays: *"Saved and read back. The next child will use these routes."*
   - To discard unsaved edits, click **Reload** and confirm the prompt.

### 2.3 Method 2: `xingheng_config` Agent Tool

When explicitly requested by the user, the assistant can read or save role routes using `xingheng_config` (**the Lead must never change routes autonomously without a user request**):

- **Read active routes and catalog snapshot**:
  ```json
  {
    "action": "read"
  }
  ```
  Returns `version` (`"2.1.0"`), `workers`, `revision` (the CAS revision string), `providers` (with advertised `models`, `efforts`, and `defaultEffort`), `preset`, and `applies` (`"next-child"`).

- **Save a complete configuration (requires `expectedRevision` and all three roles)**:
  ```json
  {
    "action": "save",
    "expectedRevision": "[{\"provider\":\"zero\",\"model\":\"deepseek-v4.1-flash-1017\",\"effort\":\"high\"},{\"provider\":\"zero\",\"model\":\"gpt-6.1-sol\",\"effort\":\"medium\"},{\"provider\":\"zero\",\"model\":\"gpt-6.1-terra\",\"effort\":\"high\"}]",
    "workers": {
      "fast": { "provider": "zero", "model": "deepseek-v4.1-flash-1017", "effort": "medium" },
      "text": { "provider": "zero", "model": "gpt-6.1-sol", "effort": "medium" },
      "long": { "provider": "zero", "model": "gpt-6.1-terra", "effort": "high" }
    }
  }
  ```

### 2.4 Method 3: `/xingheng` Slash Command

- **Read**: Run `/xingheng` with no arguments to print the current snapshot JSON.
- **Save**: Run `/xingheng {"action":"save","expectedRevision":"...","workers":{...}}` to perform a revision-checked save.

---

## 3. Ordinary Role Subagents (Workers) Workflow

Use ordinary role subagents when delegating a bounded fix, self-contained feature slice, or read-only analysis that **does not require peer-to-peer messaging or a shared task board**:

### 3.1 Spawning & Route Isolation

- The Lead calls `subagent_fast`, `subagent_text`, or `subagent_long` with:
  - `description`: Short (3–5 words) task label for UI display.
  - `prompt`: **Complete, self-contained instructions**. Because workers run in a fresh context (`spawn`), they do not share the Lead's conversation history. The prompt must explicitly state:
    1. **Write Scope**: Exact file paths the worker is allowed to modify (all other paths must remain read-only).
    2. **Acceptance Criteria**: Concrete conditions for completion.
    3. **Validation Permission**: `xingheng-worker` defaults to `Validation = NONE` (no compilation, test execution, dependency downloads, or ad-hoc runners unless the Lead explicitly authorizes the exact command or a bounded equivalent).
  - `cwd` (optional): Initial child working directory.
- **No Per-Call Model Overrides**: `modelSelection: false` is enforced on all three tools. Passing `provider` or `model` in tool arguments is rejected (`selection is disabled`).

### 3.2 Controlling Ordinary Subagents (Addressed by `agent_id`)

On the `xingheng` Lead preset, ordinary subagent controls are namespaced under `subagent_*` and message and interrupt controls **address children by session ID (`agent_id`)**; the list control takes only `scope`:

- **`subagent_list`**: Lists ordinary subagents started by the caller (`scope: "children"` or `"descendants"`), returning `id`, `label`, and `status` (`running` or `inactive`).
- **`subagent_message`**: Sends a follow-up message to a direct continuable child (`{ agent_id: "<child-session-id>", message: "..." }`).
- **`subagent_interrupt`**: Requests a running child or descendant to stop its current work (`{ agent_id: "<child-session-id>" }`).

### 3.3 Worker Capability Mask & Soft Checkpoints

- **No Browser, Search, or IM Tools**: `xingheng-worker` has no `web_search`, `web_fetch`, `research`, Playwright browser, or IM tools. If external documentation or browser inspection is required, **the Lead must gather that evidence first** and include it in the worker's prompt.
- **12-Call / 10-Minute Soft Checkpoint**: At **12 tool calls or 10 minutes** (whichever is observed first), or after two consecutive steps without progress, the preset prompt asks the worker to complete its current safe action, reports `CHECKPOINT` with partial work, unresolved items, and the next proposed slice, and ends its turn.
- **Completion & Freeze (`READY` / `FREEZE`)**: Once acceptance criteria are met, the worker reports `READY` (listing modified files, checks actually run, and checks NOT run) and freezes all writes. Upon receiving a `FREEZE` message from the Lead, the worker immediately stops all edits, builds, and tests and reports current findings.

---

## 4. Native Agent Teams Workflow

Use **Native Agent Teams** when work spans multiple interdependent tasks, requires a shared task board with blocker tracking, or benefits from durable named teammates communicating directly with each other.

### 4.1 Spawning Named Teammates & Model Inheritance

- **Only the Team Lead (`lead`) may call `spawn_teammate`**:
  - `name`: Unique `lower-kebab-case` teammate identifier (e.g., `"api-worker"`, `"reviewer"`).
  - `description`: Short summary of delegated responsibility.
  - `prompt`: Complete initial task instructions.
  - `context`: `"fresh"` (default; clean context without Lead history) or `"fork"` (inherits completed Lead turns; use only when prior Lead history is genuinely needed).
- **Teammates Inherit the Lead Model**: Native teammates **inherit the Lead's effective model and preset at creation**. The current native DSH `spawn_teammate` API has no parameter for an independent teammate model; the three role routes in **Settings → Xingheng · Subagent configuration** apply only to ordinary subagents (`subagent_fast/text/long`).

### 4.2 Team Controls & Compatibility Aliases (Addressed by `target` Member Name)

Acceptance observed model claims that native communication names were unavailable, although request logs contained them; the specific cause is unconfirmed. As an explicit Team entry point, Xingheng registers **member-scoped `team_*` aliases** alongside the native names for every Team member (Lead and Teammates). Both sets invoke the exact same native executors and authority checks; **prefer the `team_*` aliases**:

| Recommended Team Alias | Equivalent Native Tool | Addressing Parameter | Authority & Behavior |
| :--- | :--- | :--- | :--- |
| **`team_roster`** | `list_agents` | `{}` (no args) | Lists the Lead and all durable teammates with their addressable `target` name, role, and availability (`running`, `inactive`, `provisioning`, `failed`) |
| **`team_message`** | `send_message` | **`target`** (member name, e.g., `"lead"` or `"reviewer"`), `message` | Sends a message to another Team member. Running targets receive it at the nearest step boundary; **`inactive` targets start or resume a turn** |
| **`team_interrupt`** | `interrupt_agent` | **`target`** (teammate name) | **Team Lead only**. Interrupts one teammate's current turn while preserving its pending inbox |
| `wait_agent` | `wait_agent` | `timeout_ms` (`10000`–`3600000`, default `30000`) | Waits for the next teammate status, message, or shared-task change after the call starts. **Never wakes `inactive` members** and returns `noProgress` immediately when no other member is `running` or `provisioning` |

> **Critical Rules**:
> - Team tools take **`target`** (a member name such as `"reviewer"`), whereas ordinary subagent tools (`subagent_message` / `subagent_interrupt`) take **`agent_id`** (a child session ID). Never mix them!
> - **`inactive` is NOT proof of task completion**: `inactive` simply means no turn is currently executing for that member.
> - **Always check `team_roster` before `wait_agent`**: Before calling `wait_agent`, verify via `team_roster` that at least one required peer is `running` or `provisioning`. If a required teammate is `inactive`, wake it with `team_message` first.

### 4.3 Shared Task Board & CAS Revision Workflow

Team members coordinate shared work through four native tools backed by the session log (do not create ad-hoc tracking files to replace the native board):

1. **`team_task_create`**: Creates an unowned pending task with `subject`, `description` (acceptance criteria), `blocked_by` (prerequisite task IDs), and `write_scopes` (advisory workspace-relative file/directory prefixes).
2. **`team_task_list`**: Lists tasks with readiness (`ready`), owner, `revision`, blockers, and write-scope overlap warnings.
3. **`team_task_get`**: Reads the complete latest state and `revision` of a single `task_id` before changing or executing it.
4. **`team_task_update`**: Applies a Compare-And-Swap (CAS) transition using `expected_revision` (`claim`, `release`, `edit`, `set_dependencies`, `complete`, `reopen`, `reassign`, `delete`):
   - **Standard Sequence**: `team_task_list` → `team_task_get` (read current `revision`) → `team_task_update({ task_id, expected_revision, action: "claim" })` → perform edits within disjoint `write_scopes` → `team_task_update({ task_id, expected_revision: <latest_revision>, action: "complete" })`.
   - **Resolving Stale Revisions**: If `team_task_update` fails due to a concurrent update, re-read the task via `team_task_get` to obtain the latest `revision` and retry.
   - **Advisory Write Scopes & Filesystem Guards**: All Team members share the same working tree. `write_scopes` are advisory warnings, not locks. Split write work into disjoint scopes; if an edit returns `FS_STALE_VERSION`, re-read the file, rebase your change onto the new content, and retry. Have the Lead freeze writes, review the final diff, and run validation on the settled revision.
   - **Task Readiness Never Starts an Owner**: Assigning a task or completing its blockers (`ready: true`) does **not** wake an `inactive` teammate. Send a `team_message` to start its turn.

### 4.4 Capacity Limits: Active Concurrency (2) vs. Team Roster (8)

- **Active Concurrency Limit `2` (`maxActiveSubagents: 2`)**: Capacity is **2** live or materializing children per activation tree (root excluded). Waiting, pending inbox work and stopping cleanup can still occupy slots, with delegation depth capped at **1** (no nested teams or grandchildren).
- **Lifetime Team Roster Limit `8`**: A team session allows at most **8** named teammate entries across its lifetime, including `inactive` and `failed` entries, and names cannot be reused. Reuse existing named teammates via `team_message` rather than spawning disposable teammates for every small step.

---

## 5. Detailed Troubleshooting

### 5.1 Installation & Activation Issues

- **Symptom: Running `plugin_manager` in a terminal returns `command not found`**
  - **Cause**: `plugin_manager` is an assistant tool inside DSH, not a shell executable.
  - **Fix**: Ask the assistant in a DSH chat session to call the `plugin_manager` tool.
- **Symptom: Settings section is missing after install, or UI warns *"The Xingheng preset is unavailable"***
  - **Cause**: `plugin_manager` returned `application: "restart-required"`, or the browser tab has not been refreshed.
  - **Fix**: Restart the original DSH Host process (if required), then refresh your browser tab. Do not start a second server on a different port.
- **Symptom: After upgrading to `2.1.0`, `spawn_teammate`, `team_roster`, or `subagent_message` is missing in an existing conversation**
  - **Cause**: Live Agents retain their mounted in-memory revision. Logs retain the preset ID, and recovery after restart resolves its current definition rather than restoring an old implementation.
  - **Fix**: Start a **new session** with the **星衡 · 协作 (`xingheng`)** preset.

### 5.2 Configuration & Save Errors

- **Symptom: Save button is disabled, or a warning states *"A saved choice is no longer in the catalog; select an available option."***
  - **Cause**: A saved or draft `provider`, `model`, or `effort` (for example, after clicking **Fill initial combination**) is not advertised by your current DSH `llm` catalog, or model info resolution returned an error.
  - **Fix**: Select an available provider, model, and reasoning effort for all three roles. Once all three routes are valid and differ from the saved snapshot (`dirty`), the **Save configuration** button becomes enabled.
- **Symptom: Saving returns `HTTP 409` (`Configuration conflict`)**
  - **Cause**: The double CAS check detected that `expectedRevision` no longer matches the latest saved configuration (another tab, tool call, or command saved first).
  - **Fix**: Click **Reload** in the UI (or call `action: "read"` first), reapply your desired changes to the fresh snapshot, and save.
- **Symptom: `POST /api/xingheng/v2` returns `HTTP 400`, `413`, or `415`**
  - **Cause**:
    - `400`: Malformed `workers` map, missing/extra role keys, leading/trailing whitespace in IDs, or an unregistered provider/model/effort.
    - `413`: Parsed JSON reserialized with `JSON.stringify` exceeds 12000 JavaScript character units; this is not a strict UTF-8 byte limit.
    - `415`: Missing `Content-Type: application/json` header on POST.
  - **Fix**: Ensure the request header is `application/json` and all three role objects match exact IDs from the `action: "read"` catalog.

### 5.3 Delegation & Team Collaboration Issues

- **Symptom: Passing `provider` or `model` to `subagent_fast/text/long` fails with `selection is disabled`**
  - **Cause**: Xingheng sets `modelSelection: false` so the Lead cannot override user-configured role routes per call.
  - **Fix**: Omit model arguments when calling `subagent_fast/text/long`. Change routes only via Settings or `xingheng_config` when requested by the user.
- **Symptom: A child agent hits an authentication (401/403), quota, or sandbox permission failure, and the Lead tries to switch roles/models**
  - **Cause**: Authentication, quota, and sandbox denials are infrastructure or policy blockers, not model capability failures.
  - **Fix**: Report the exact blocker to the user; do **not** escalate or retry across other subagent roles to bypass infrastructure or permission errors.

> **Alias availability**: if a fresh session after restart lacks `team_*` aliases but has native `list_agents`, `send_message` and `interrupt_agent`, use the native Team interfaces and report the Host version, plugin activation state and tool catalog. A model claim alone does not establish registration failure; a new session is not a guaranteed fix for every activation-order issue.
