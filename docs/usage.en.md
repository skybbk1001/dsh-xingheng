# Xingheng: usage and troubleshooting

For `@local/dsh-xingheng` `3.1.0`: installation and activation, the three-role ordinary subagent configuration, how native Agent Teams and ordinary subagents divide work, tool aliases and addressing, permissions and revisions, and fixes for the usual failures.

[Back to English README](../README.en.md) · [中文详细使用指南](usage.md) · [Architecture](architecture.md) · [Migration](migration.md) · [Acceptance](acceptance.md)

---

## 1. Installation and activation

### 1.1 Prerequisites

- **Node.js**: `>=22`
- **Profile prerequisites**: the shipped `dsh-base`, `dsh-web-app` and `dsh-experimental-agent-team-profile` bundles must be enabled. Xingheng consumes their services and will not build a second Team implementation when they are missing.
- **DeepSeek Harness (DSH)**: `>=0.2.2-rc.1 <0.3`. This build reuses the `@deepseek-ai/dsh-tool-subagent` and `@deepseek-ai/dsh-tool-subagent-control` executors from `0.2.2-rc.1`.
- **Session permission**: calling `plugin_manager` needs `danger-full-access` in the session, or explicit approval for that one call.

### 1.2 Installing with `plugin_manager`

Ask the assistant in a DSH session:

> Please call the `plugin_manager` tool (`action: "install_bundle"`, target `/absolute/path/dsh-xingheng`) to install Xingheng.

`plugin_manager` is an assistant tool, not a shell command. The assistant issues `plugin_manager({ action: "install_bundle", target: "/absolute/path/dsh-xingheng" })` in a turn; typing `plugin_manager ...` in a terminal or the `bash` tool finds no such binary, and hand-editing the Profile YAML/JSON is not an install either.

Read `application` and `warnings` from the result:

- `application: "applied"`: the Host service and presets are hot-loaded into the running process. Refresh the browser tab.
- `application: "restart-required"` (sometimes with an `unmanaged-plugin` notice): the loaded modules need to initialize in a new process. Restart the DSH Host process, then refresh the tab.

Refreshing the page (F5) reloads client assets only, never the backend. Starting a second DSH server on another port will not update the GUI your browser is connected to.

---

## 2. Configuring the three ordinary subagents

All three entry points share the same validation and atomic `ConfigEditor` persistence: the Web settings page, the `xingheng_config` assistant tool, and the `/xingheng` slash command.

### 2.1 Roles and the starting combination

| Role | Chinese label | Typical work | Starting combination |
| :--- | :--- | :--- | :--- |
| Quick iteration | 快速迭代 | Local fixes, small improvements, spot checks | `zero` / `deepseek-v4.1-flash-1017` / `high` |
| Feature implementation | 特性实现 | Features, API work, test suites | `zero` / `gpt-6.1-sol` / `medium` |
| Analysis and planning | 分析规划 | Code review, architecture, hard diagnosis | `zero` / `gpt-6.1-terra` / `high` |

Display names, configuration keys and delegation tool IDs all follow the task responsibility. Only the three identifiers below are supported; there is no legacy role key and no fallback parser for old tool names.

| Role | Configuration key | Delegation tool | Bound preset |
| :--- | :--- | :--- | :--- |
| Quick iteration | `iterate` | `subagent_iterate` | `xingheng-worker`, scoped read/write + shell |
| Feature implementation | `implement` | `subagent_implement` | `xingheng-worker`, scoped read/write + shell |
| Analysis and planning | `analyze` | `subagent_analyze` | `xingheng-analyst`, read-only |

Use the role labels in the UI and in natural-language requests. In JSON, tool calls and source references, use the identifiers above; do not put the Chinese label in a JSON key.

`DEFAULT_WORKERS` is a starting value and the template behind the "Fill initial combination" button. It is not a ranking of model quality, speed or price. If the active catalog lacks one of those providers or models, saving fails closed and you pick something that is actually there.

### 2.2 Method 1: the Web settings page

1. Open **Settings** in the DSH Web GUI.
2. Choose **Xingheng · Subagent configuration** (**星衡 · 子代理配置** in Chinese).
3. For **01 Quick iteration**, **02 Feature implementation** and **03 Analysis and planning**, pick:
   - **Provider**: from `llm.listProviders()`. Changing it clears that role's model and effort draft so no stale cross-provider ID survives.
   - **Model**: from `llm.listModels(provider)`. Changing it resets the role's effort draft.
   - **Reasoning effort**: from what `llm.resolveModelInfo(provider, model)` advertises, or "Native default (may inherit lead effort)", stored as `""`.
4. Watch the status bar:
   - After editing it reads **Unsaved changes**.
   - **Save configuration** posts to `./api/xingheng/v3`. On success the UI updates from the server read-back and shows: *"Saved and read back. The next child will use these routes."*
   - To drop the draft, click **Reload** and confirm.

### 2.3 Method 2: the `xingheng_config` tool

The assistant calls `xingheng_config` only when the user explicitly asks to read or change the role routes. Without that request the Lead must not change routes on its own.

**Read the active routes and catalog**:

```json
{
  "action": "read"
}
```

The response contains `version` (`"3.1.0"`), `workers` (the three active routes), `revision` (the CAS revision string), `providers` (with `models`, `efforts` and `defaultEffort` each), `preset` (a summary of `xingheng`) and `applies` (`"next-child"`).

**Save a complete configuration**: it needs the latest `expectedRevision` and all three `workers`:

```json
{
  "action": "save",
  "expectedRevision": "[{\"provider\":\"zero\",\"model\":\"deepseek-v4.1-flash-1017\",\"effort\":\"high\"},{\"provider\":\"zero\",\"model\":\"gpt-6.1-sol\",\"effort\":\"medium\"},{\"provider\":\"zero\",\"model\":\"gpt-6.1-terra\",\"effort\":\"high\"}]",
  "workers": {
    "iterate": { "provider": "zero", "model": "deepseek-v4.1-flash-1017", "effort": "medium" },
    "implement": { "provider": "zero", "model": "gpt-6.1-sol", "effort": "medium" },
    "analyze": { "provider": "zero", "model": "gpt-6.1-terra", "effort": "high" }
  }
}
```

### 2.4 Method 3: the `/xingheng` slash command

- **Read**: `/xingheng` with no argument prints the current snapshot JSON.
- **Write**: `/xingheng {"action":"save","expectedRevision":"...","workers":{...}}` runs the same revision-checked save.

---

## 3. Ordinary role subagents

Use an ordinary role subagent for a bounded fix, a self-contained feature, or a single review that needs no peer messaging and no shared task board.

### 3.1 Spawning and route isolation

The Lead calls `subagent_iterate`, `subagent_implement` or `subagent_analyze` with:

- `description`: a 3–5 word label for the UI.
- `prompt`: complete, self-contained instructions. Ordinary subagents spawn with a fresh context and cannot see the Lead's history, so the prompt must state all three:
  1. **Write scope**: the exact paths it may modify; everything else stays read-only.
  2. **Acceptance criteria**: what counts as done.
  3. **Validation permission**: `xingheng-worker` defaults to `Validation = NONE` — no compiling, no test runs, no dependency downloads, no ad-hoc runner. To have it run a specific command, the Lead must authorize that exact command in the prompt.
- `cwd` (optional): the child's initial working directory.

All three tools pin `modelSelection: false` and reject `provider` or `model` arguments; the model comes from saved configuration. Iteration and implementation route to `xingheng-worker`, analysis to `xingheng-analyst`.

### 3.2 Controlling ordinary subagents

On the `xingheng` Lead preset the ordinary subagent controls are namespaced under `subagent_*`. Message and interrupt take a child session ID (`agent_id`); the list tool takes only `scope` and no target.

- `subagent_list`: lists the ordinary subagents the caller started (`scope` of `"children"` or `"descendants"`) with `id`, `label` and `status` (`running` or `inactive`).
- `subagent_message`: sends a follow-up to a direct child, or continues its finished conversation: `{ agent_id: "<child-session-id>", message: "..." }`.
- `subagent_interrupt`: asks that child to stop its current turn: `{ agent_id: "<child-session-id>" }`.

### 3.3 Division of work and handoff

- **Analysis**: code reading, search and parent/child messaging only. No write/edit/shell/jobs, browser, web search, IM, configuration or delegation tools. It cannot run tests by design; do not route around that with other tools.
- **Feature implementation**: cohesive module slices with their tests, not a mechanical split by file count. No unauthorized validation.
- **Quick iteration**: a minimal patch for a known defect, or a bounded check the Lead explicitly authorized. Do not infer real speed from the role name.
- Iteration and implementation share one read/write worker, so they do not have different OS permissions. What separates them is the task contract and the prompt, not two sandboxes.
- Complex work goes explore → stabilize shared interfaces → implement independent modules → fresh-context review of a frozen revision → Lead validation. Give the reviewer requirements, diff, target revision, constraints and known risks; the full implementation history is noise.
- Parallel analysis reads the same working tree with no automatic snapshot isolation. Freeze writes, or check for drift yourself.
- READY, checkpoints and the freeze are model-side conventions, not hard timeouts or an automatic verification gate. A handoff states the evidence, the changed scope, the checks run and not run, and the risks; the Lead confirms it before calling it done.

---

## 4. Native Agent Teams

Use native Agent Teams when work spans several interdependent modules, needs a shared board to coordinate progress, or needs teammates talking to each other directly.

### 4.1 Creating teammates and model inheritance

Only the Team Lead (`lead`) calls `spawn_teammate`:

- `name`: a unique `lower-kebab-case` teammate name such as `"api-impl"` or `"reviewer"`.
- `description`: a short statement of responsibility.
- `prompt`: the initial task.
- `context`: `"fresh"` (default; clean context with no Lead history) or `"fork"` (inherits the Lead's completed turns; only when that history is genuinely needed).

A teammate inherits the Lead's effective model and current preset at creation. The native `spawn_teammate` has no per-teammate model parameter, so the three routes under **Settings → Xingheng · Subagent configuration** do not reach teammates.

### 4.2 Team messaging and the compatibility aliases

Acceptance ran into a model claiming the native messaging tools were unavailable; the exact cause was never confirmed. To give the team an unambiguous entry point, Xingheng also registers a set of `team_*` aliases in every team member's scope (Lead and teammates alike). Both sets run the same executors, take the same parameters and carry the same authority; prefer `team_*`:

| Alias | Native equivalent | Addressing | Behavior |
| :--- | :--- | :--- | :--- |
| `team_roster` | `list_agents` | `{}` | Lists the Lead and every named teammate with `target` name, role and availability (`running`, `inactive`, `provisioning`, `failed`) |
| `team_message` | `send_message` | `target` (member name, e.g. `"lead"` or `"reviewer"`) and `message` | Messages a teammate or `"lead"`. A running target receives it at the nearest step boundary; an `inactive` target starts or resumes a turn |
| `team_interrupt` | `interrupt_agent` | `target` (teammate name) | Team Lead only. Stops that teammate's current turn and keeps its pending inbox |
| `wait_agent` | `wait_agent` | `timeout_ms` (`10000`–`3600000`, default `30000`) | Waits for the next teammate status change, message or shared-task change after the call starts. Never wakes an `inactive` member, and returns `noProgress` right away when nothing is `running` or `provisioning` |

Things that are easy to get wrong:

- Team tools take `target` (a member name); ordinary subagent tools (`subagent_message` / `subagent_interrupt`) take `agent_id` (a child session ID). Do not mix them.
- `inactive` means no turn is executing. It is not a completion signal.
- Before `wait_agent`, check with `team_roster` that at least one required teammate is `running` or `provisioning`. If it is `inactive`, wake it with `team_message` first, or `wait_agent` returns `noProgress` immediately.

### 4.3 The shared board and revisions

Team members manage shared work through four native tools; state lives in the native session log. Do not create Markdown or JSON files to stand in for the board.

1. `team_task_create` creates a pending task with `subject`, `description` (write the acceptance criteria here), `blocked_by` (prerequisite task IDs) and `write_scopes` (advisory relative path prefixes).
2. `team_task_list` filters by `status` (`pending`, `in_progress`, `completed`), `ready` (all blockers done) or `owner`, returning each task's `revision` and any write-scope overlap warning.
3. `team_task_get` reads a task's latest details and `revision` before you change or execute it.
4. `team_task_update` applies an atomic CAS transition with the latest `expected_revision`; `action` is one of `claim`, `release`, `edit`, `set_dependencies`, `complete`, `reopen`, `reassign`, `delete`.

The usual order is `team_task_list` → `team_task_get` for the current `revision` → `claim` → edit within the agreed `write_scopes` → `complete` with the new `revision`. If a concurrent edit causes a revision conflict, re-read with `team_task_get` and retry.

`write_scopes` are coordination hints, not file locks. Everyone shares one working tree and every edit is immediately visible. Split writes into non-overlapping prefixes; when an edit returns `FS_STALE_VERSION`, re-read the file, replay your change onto the new content and retry. The Lead then freezes writes, reviews the diff and runs final validation.

A ready task does not start its owner. Whether a Lead used `reassign` or a blocker just completed and flipped a task to `ready: true`, an `inactive` teammate will not move. The Lead, or whoever completed the blocker, must send a `team_message`.

### 4.4 Two separate capacity limits

- **Active concurrency 2** (`maxActiveSubagents: 2`): 2 live or materializing children per activation tree, root excluded. Waiting work, pending inbox items and stopping cleanup can also hold a slot. Maximum depth is 1, so neither a teammate nor a worker can nest further.
- **Lifetime roster 8**: at most 8 named teammates created via `spawn_teammate` per session. `inactive` and `failed` entries still occupy slots, and a name cannot be reused in the same session. Reuse existing teammates with `team_message` instead of spawning one per small step.

---

## 5. Troubleshooting

### 5.1 Installation and activation

**Running `plugin_manager` in a terminal returns `command not found`**
It is a DSH assistant tool, not an OS shell command. Ask the assistant to call it inside a DSH session.

**The settings section is missing after install, or the UI warns the Xingheng preset is unavailable**
Usually the install returned `application: "restart-required"`, or the tab has not been refreshed. Restart the original DSH Host process if required, then refresh. Do not stand up a server on another port as a substitute.

**After upgrading to `3.1.0`, an old session has no `team_roster`, `spawn_teammate` or `subagent_message`**
A running agent keeps its in-memory preset revision, and the mounted list is not replaced. Confirm the Host loaded `3.1.0`, then click **New session** and pick the **星衡 · 协作** (`xingheng`) preset.

### 5.2 Saving and validation

**The save button is disabled, or a yellow warning says the saved choice is no longer in the catalog**
The saved configuration or draft (say, a model inserted by "Fill initial combination") is not advertised by the registered DSH catalog, or model metadata failed to load (`model.error`). Pick an available, error-free option in each of the three dropdowns; the button returns once all three routes are valid and differ from the saved snapshot (`dirty`).

**Saving returns `HTTP 409` / `Configuration conflict`**
The two-phase CAS found that `expectedRevision` no longer matches the latest server state, typically because another tab or a command saved first. Click **Reload**, or call `action: "read"` first to get the current `revision`, then reapply your changes to that snapshot and save.

**`POST /api/xingheng/v3` returns `HTTP 400` / `413` / `415`**

- `400`: a missing role among `iterate`/`implement`/`analyze`, an unknown field, whitespace around an ID, or a provider/model/effort the `llm` service does not support.
- `413`: the parsed JSON reserializes beyond `12000` JavaScript character units. This is not a strict UTF-8 byte limit.
- `415`: the POST has no `Content-Type: application/json`.

Check the header and the complete three-route structure, and match every ID against the `providers` catalog from `action: "read"`.

### 5.3 Delegation and team collaboration

**Passing `model` to `subagent_iterate/implement/analyze` is rejected with `selection is disabled`**
`modelSelection: false` is deliberate: it stops the Lead from overriding the user's role routing through call arguments. Drop `provider`/`model`. If the user really wants a different model for a role, save the new route through the settings page or `xingheng_config` first, then call the tool.

**A child hits 401/403, an exhausted quota or a sandbox denial, and the Lead wants to retry with another role**
Authentication, quota and sandbox denials are infrastructure or policy blockers, not model capability failures. Report the error to the user as it is; do not escalate it into a model failure or switch roles to route around it.

Also: if a restarted session still lacks the `team_*` aliases while the native `list_agents`, `send_message` and `interrupt_agent` are present, use the native interfaces and record the host version, plugin activation state and tool catalog for diagnosis. A model saying "the tool is missing" does not establish a registration failure, and recreating the session is not a guaranteed fix for every activation-order problem.

---

## Model gateway timeouts

The sustained 504s in the real logs came from the `zero / gemini-4-argon / high` upstream, with Cloudflare reporting `origin_gateway_timeout` — the origin did not respond within its deadline. This is neither the GitHub 7890 proxy port nor a local test failure. The error does not prove model inference time was the sole root cause; origin load, internal queuing, forwarding and timeout settings all belong to gateway operations.

Record the provider/model, time, HTTP status and request identifier (no credentials, no full session logs), and follow the backoff hints in the response rather than clicking "continue" repeatedly or retrying automatically without limit. If the user approves a different route, choose an available provider/model explicitly; do not silently rewrite Xingheng's three saved routes. Raising the client timeout alone does not get you past a server-side origin or proxy limit.