# Update PRD and implementation plan for launcher/sidebar v2

Type: task
Status: resolved
Blocked by: 08, 09
Parent: ../map.md

## Question

How should the existing PRD/map/implementation plan be revised to make Herdr/tmux launch + sidebar the new MVP shape?

## Requirements

- Keep the same effort path: `.scratch/pi-subagent-search-switching/`.
- Update the PRD to make multiplexer launch and sidebar P0.
- Update or supersede earlier overlay-first decisions without losing useful work.
- Preserve search-capable subagents, explicit tool allowlists, and safety/persistence requirements.
- Provide a new phased implementation plan.

## Exit criteria

- Resolve this ticket with concrete PRD/map edit recommendations.
- Provide exact sections that should change.
- Provide a `## Map pointer` one-liner.

## Answer

Scope v2 should be treated as a product shape change, not just a UI enhancement:

- The supported Pi entrypoint should launch into **Herdr first**, **tmux second**, and **plain Pi degraded mode only when neither is available**.
- The persistent multiplexer sidebar is the primary P0 subagent surface.
- `/agents` / `/agent` overlay work from issue 03 is still valuable, but now it is a details inspector, command mirror, and no-multiplexer fallback rather than the primary MVP.
- Search-capable agents, explicit allowlists, source-labeled approvals, private persistence, reload reconstruction, and honest resume/detached semantics stay in scope.

### Exact PRD changes made

Updated `../PRD.md` in these sections:

- **Title/status/TL;DR** — renamed the product shape to "multiplexer-backed switchable subagents", marked scope v2, and made Herdr/tmux launch + sidebar the first P0 statement.
- **Background** — added scope-v2 notes from issues 08 and 09, including launcher detection/env responsibilities and sidebar-as-primary UX.
- **Current local baseline** — added that no Herdr/tmux launcher or tmux sidebar renderer exists yet.
- **Problem** — added the gap that overlay-first `/agents` does not satisfy the revised always-visible sidebar requirement.
- **Goals / P0 MVP** — inserted launcher, already-inside detection, stable env vars, Herdr/tmux sidebar, Herdr metadata, tmux sidebar renderer, and degraded no-mux mode before the subagent executor goals.
- **P1/P2** — kept background/resume/stats/worktree/MCP ideas and added detached/supervisor and Herdr-polish as later work.
- **Non-goals** — clarified that Herdr is preferred but tmux/no-mux modes remain supported, and that old overlay-first `/agents` is not the primary P0 UX.
- **User stories** — added launch-to-multiplexer, sidebar glanceability, and multiplexer focus/attach stories.
- **Functional requirements** — added new `FR0 — Launcher and multiplexer workspace`; rewrote `FR4` as `Sidebar visibility, switching, and details UI`; expanded `FR7` for Herdr/tmux bridge behavior while preserving visualizer compatibility.
- **Acceptance criteria** — added Herdr launch, tmux fallback, no-mux warning, visible sidebar, and multiplexer focus/attach criteria while preserving search, parallelism, follow-up/stop, reload, read-only, and project-trust criteria.
- **Likely implementation direction** — replaced the old overlay/RPC-first plan with launcher + sidebar first, then agent policy/search, RPC execution, controls/details, hardening/docs.
- **Risks** — added Herdr bootstrap, tmux semantic-sidebar, wrapper shadowing, and compact-sidebar UX risks while retaining RPC/persistence/web-search risks.

### Exact map changes made

Updated `../map.md` in these sections:

- **Notes** — replaced the standing product requirement with scope v2: launch with Herdr/tmux and make the sidebar primary P0; issue-03 overlay is degraded/details fallback.
- **Current local baseline** — added that no launcher or tmux sidebar renderer exists yet.
- **Decisions so far**:
  - Issue 03 now explicitly says **superseded as primary UX by issue 09** while retained for degraded/details mode.
  - Issue 06 now explicitly says **pre-v2 implementation order, superseded by issue 10** while retaining useful extension/RPC details.
  - Added issue 08 launcher decision.
  - Added issue 09 sidebar decision.
  - Added issue 10 scope-v2 PRD/map/plan decision.
- **Fog** — added unresolved Herdr bootstrap, tmux renderer, wrapper rollout, Pi command concurrency, and child-runner pane ownership questions; retained P2/future-supervisor fog.

### Phased implementation plan v2

#### Phase 0 — Launcher and install/resync compatibility

Goal: make the new product entrypoint real before investing in child-agent internals.

- Add a repo-owned wrapper/entrypoint, initially as a separate command such as `pi-subagents` or `pi-herdr` before deciding whether to shadow `pi`.
- Detect in order: already inside Herdr, already inside tmux, launch Herdr if installed, launch tmux if installed, otherwise degraded plain Pi.
- Add recursion guard and real-binary escape hatch: `PI_SUBAGENTS_LAUNCHER_ACTIVE=1`, `PI_REAL_BIN`.
- Export `PI_SUBAGENTS_MULTIPLEXER`, `PI_SUBAGENTS_SESSION`, `PI_SUBAGENTS_PARENT_CWD`, plus Herdr/tmux IDs when known.
- Update install/resync docs/scripts only for repo-owned files; do not silently install Herdr-generated integration files or overwrite Herdr/tmux user config.

Verification gates:

- Launch outside any multiplexer with Herdr present.
- Launch outside any multiplexer with only tmux present.
- Launch inside Herdr and inside tmux without nesting.
- Launch with neither installed and see one clear degraded-mode warning.

#### Phase 1 — Shared state model and fake sidebar

Goal: prove the sidebar surface before real model-running subagents.

- Define durable `SubagentRecord`, transcript event, control command, and reduced-status model shared by Herdr, tmux, visualizer, and `/agents`.
- Add private state root under `~/.pi/agent/subagents/<parent-session-id>/` or equivalent.
- Emit fake/demo records through the existing `subagent:status` path.
- In Herdr mode, report fake statuses via Herdr pane/agent metadata when available.
- In tmux mode, create/reuse a right sidebar pane running a small renderer/watcher over the shared state.
- Keep no-mux fallback on the existing visualizer plus `/agents` placeholder/details UI.

Verification gates:

- Sidebar shows queued/running/blocked/succeeded/failed/cancelled/detached fake rows.
- Status updates appear without duplicate/conflicting UIs.
- Parent Pi pane and typed draft survive focusing/closing sidebar/details views.

#### Phase 2 — Agent definitions, search allowlists, and safety policy

Goal: preserve the original search-parity requirements before executing children.

- Add `agent/agents/docs-researcher.md`, `code-explorer.md`, `reviewer.md`, and `worker.md`.
- Update install/resync to round-trip `agent/agents/` if not already done.
- Implement user/project agent discovery with trust/explicit-scope rules.
- Parse frontmatter for `tools`, `disallowedTools`/`excludeTools`, `model`, `thinking`, `maxTurns`, `background`, `cwd`, display fields.
- Compute effective tool policy mechanically; read-only/search agents must not receive write/edit tools by default.
- Validate web/search tools are available before launching a web-capable agent.

Verification gates:

- Unknown/unavailable tools fail fast.
- `docs-researcher` can opt into `web_search`, `fetch_content`, `get_search_content`.
- `code-explorer`/read-only agents cannot edit/write by policy, not just by prompt.
- Project-local agents prompt for trust/confirmation.

#### Phase 3 — Subagent runner: JSON scaffold, then RPC default

Goal: connect real subagents to the sidebar while keeping a fallback path.

- Start from Pi's example subagent executor for JSON subprocess scaffolding where useful: child spawning, JSONL parsing, single/parallel/chain shapes, result caps.
- Keep JSON as an explicit debug/fallback transport only.
- Implement persisted RPC child sessions as the MVP default so live transcript, steer/follow-up, stop, usage stats, and reload reconstruction are possible.
- Decide during the spike whether child Pi RPC runners live directly in Herdr/tmux panes or are parent-managed processes whose transcript panes attach/read from state.
- Translate child RPC events into transcript events and `SubagentRecord` updates.
- Return concise parent summaries and point to full transcript/sidebar details.

Verification gates:

- One `code-explorer` child can read local files and produce a concise summary.
- One `docs-researcher` child can search/fetch current docs with citations.
- Two children run in parallel and stream status to the sidebar.
- Raw search/tool output is capped in the parent conversation and kept in child transcript/state.

#### Phase 4 — Controls: focus/attach, message, stop, dismiss, details fallback

Goal: make the sidebar actually switchable/controllable.

- Implement sidebar actions: focus/watch, attach/takeover with confirmation, steer/follow-up/continuation message, stop/cancel, dismiss terminal records, filter/help.
- Mirror controls through `/agents` and `/agent` commands for details mode, no-mux fallback, narrow terminals, and non-TUI contexts.
- Use RPC `steer`/`follow_up`/`prompt` for structured messages; manual pane attach is only an escape hatch.
- Stop should cancel pending UI requests, RPC abort first, then SIGTERM/SIGKILL or pane kill as fallback.
- Dismiss should hide terminal rows non-destructively; `/agents all` shows them again.

Verification gates:

- Focus/attach does not lose parent Pi draft/context.
- A running child can be steered without copying the message into the parent conversation.
- A runaway child can be stopped and remains inspectable as `cancelled`.
- Completed/failed/cancelled rows can be dismissed and recovered via `/agents all`.

#### Phase 5 — Persistence, approvals, reload, and detached semantics

Goal: make the MVP safe enough to dogfood.

- Persist child sessions/events as canonical transcripts with private file modes.
- Append capped parent `subagent-record` custom entries for reload reconstruction.
- Proxy child permission/UI requests with source labels and mark rows `blocked` while waiting.
- On shutdown/reload, cancel or mark live children honestly; do not show stale `running`.
- For completed/stopped agents, offer true same-session resume only when technically valid; otherwise start a continuation seeded by summary.

Verification gates:

- `/reload` reconstructs completed records and transcript pointers.
- A blocked approval is visibly labeled with subagent id/name/tool.
- Read-only agents cannot escalate through child prompts.
- Detached/cancelled records are honest after parent reload or multiplexer disconnect.

#### Phase 6 — Docs, dogfood, and rollout decision

Goal: ship locally without locking into an upstream/package shape too early.

- Document launcher usage, fallback behavior, default agents, sidebar controls, `/agents` details mode, safety policies, and cleanup locations.
- Dogfood acceptance scenarios from the PRD.
- Keep runtime state out of git and avoid copying user Herdr/tmux config.
- Decide only after dogfooding whether to wrap the default `pi` command, keep a separate launcher command, or extract a reusable package/upstream example.

Verification gates:

- Fresh install instructions are executable from `pi-configs`.
- All P0 PRD acceptance criteria pass on at least Herdr mode and either tmux or no-mux degraded mode.
- Rollback is clear: remove the wrapper/extension/default agents without deleting runtime transcripts automatically.

## Map pointer

Scope v2: launch Pi through Herdr first or tmux fallback and make the multiplexer sidebar the P0 subagent surface; issue 03's overlay is now details/degraded fallback while search, explicit tool allowlists, safety, persistence, and RPC child-session work remain core.
