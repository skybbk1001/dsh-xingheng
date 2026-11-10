# Changelog

All notable changes are recorded here. Versions use semantic versioning.

## 3.1.0 — 2026-11-10

### Role-specialized execution
- Route analysis to the dedicated `xingheng-analyst` preset, with filesystem mutation flags disabled and no shell/job registration. Iteration and implementation retain `xingheng-worker`.
- Add Host-owned `worker-policy.js`: refresh masks on creation and blank-session preset selection, release on disposal, and guard non-allowlisted invocations. Resolve capabilities through the Host Agent registry instead of a separate copy of the scope library.
- Add read/list/message-only native analyst controls and role-specific handoff guidance. Update Lead SOP for facts/planning, cohesive partitioning and independent fresh-context review.
- Preserve 3.0 role keys, model routes and `/api/xingheng/v3`. Internal exports move to `./role-routing` and `./worker-policy`; update bundle declarations together.
- Add actual DSH scoped-registry regression tests; 23 automated checks. Real acceptance is recorded separately in `docs/acceptance.md`.

## 3.0.0 — 2026-11-10

### Breaking role contract
- Replace role keys with `iterate`, `implement`, `analyze` and delegation tools with `subagent_iterate`, `subagent_implement`, `subagent_analyze`.
- Rename the role implementation modules to `roles.js` and `role-agent.js`; no legacy parser fallback, tool alias or old module export is retained.
- Move the authenticated configuration endpoint to `/api/xingheng/v3`; `/v2` is no longer registered.
- Update UI dictionaries, presets, prompt guidance, JSON examples and rejection tests together. Saved role routes must be explicitly rewritten using the new keys before upgrade.

## 2.1.0 — 2026-11-10

### Agent Teams
- Enable native named teammates, messages, shared tasks/dependencies, waits and interrupts.
- Namespace ordinary child controls to coexist with member-target Team tools.
- Clarify inherited teammate model versus independently configured ordinary worker roles.
- Add native control-alias regression coverage and updated UI guidance.
- Add member-scoped Team control aliases preserving the original native executors and authority.

### Legacy cleanup
- Migrate the retired Host policy into the new bundle: default preset `xingheng`, depth 1, active-child limit 2, existing model pool and disabled team tool.
- Document Profile-wide effects and the difference between retaining historical logs and resuming a removed preset.

## 2.0.0 — 2026-11-10

Rebuilt as a standalone, portable DSH bundle. This is the first implemented release of this repository; previous draft files were not a working UI release.

### Added
- React settings section with live provider/model/effort catalog.
- Revision-checked persistent configuration through native ConfigEditor.
- Native executor-based role delegation, with next-child route changes.
- Authenticated Connection endpoint, matching configuration tool and command.
- Standalone `xingheng` and `xingheng-worker` presets, test suite, CI and bilingual documentation.

### Corrected
- Removed fabricated price, capability and speed rankings.
- Distinguished browser refresh, Host restart and preset revision boundaries.
- Retained stable legacy tool names for interoperability, with role labels matching actual task purpose.

### Migration
- No automatic deletion of earlier drafts or legacy session records.
- New sessions explicitly choose `xingheng`; old `economy` sessions keep their composition.
