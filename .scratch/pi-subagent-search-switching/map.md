## Notes

Effort: improve Pi subagents to support Codex/Claude-style search and live switchable visibility, using local markdown issue tracking for now.

Scope v2 product requirement from the user: **Pi should launch with Herdr when available, otherwise tmux when available, and the primary subagent UX should be a persistent sidebar.** If neither multiplexer exists, Pi should run in degraded in-TUI mode with a clear warning. The earlier overlay-first `/agents` design remains useful as a details/degraded fallback, but it is no longer the primary P0 UX.

Useful skills/docs for future sessions:

- `/wayfinder` for this map.
- `/orchestrate-subagents` for multi-workstream implementation.
- `/codebase-design` for interface seams.
- `/prototype` for transcript-switching UI experiments.
- `/research` for official Codex/Claude/Pi API facts.
- Pi docs to consult: `docs/extensions.md`, `docs/tui.md`, `docs/json.md`, `docs/rpc.md`, `docs/session-format.md`, `docs/packages.md`.
- Existing Pi example: `examples/extensions/subagent/` in the installed Pi package.
- Current local repo target: `/Users/rachitgandhi/workspace/github.com/Rachit-Gandhi/pi-configs`.
- Current local baseline: `agent/extensions/subagent-visualizer.ts` exists; no real `subagent` executor is installed yet; no Herdr/tmux Pi launcher or tmux sidebar renderer exists yet; `agent/settings.json` includes `npm:pi-web-access`.

## Decisions so far

- [Compare Codex and Claude subagent parity targets](issues/01-compare-codex-claude-parity.md) — MVP should prioritize a real Pi subagent executor with opt-in Pi web tools plus live transcript visibility/steering as P0; background defaults, resume, stats, richer policies, nesting, worktrees, MCP/memory, and batch workflows are P1/P2.
- [Map current Pi subagent and extension baseline](issues/02-map-current-pi-subagent-baseline.md) — Pi has enough extension/RPC/session/TUI APIs to build switchable subagents as a local hybrid extension: reuse the example subagent executor, run children as persisted RPC sessions, and feed the existing visualizer plus a transcript/steering UI.
- [Design the switchable subagent transcript UX](issues/03-design-agent-transcript-switching-ux.md) — **Superseded as the primary UX by issue 09.** Keep the hybrid `subagent_status` widget plus `/agents` (`/agent` alias) overlay inspector as the no-multiplexer degraded mode and as a details/transcript fallback; do not make overlay switching the default P0 experience when Herdr/tmux is available.
- [Design subagent search tool surface and default agents](issues/04-design-search-tool-surface.md) — Default Pi subagents should use explicit frontmatter `tools` allowlists with canonical Pi web tool names (`web_search`, `fetch_content`, `get_search_content`), ship read-only `docs-researcher`/`code-explorer`/`reviewer` plus non-web `worker`, and enforce opt-in visible network access with cited summaries and raw search output kept in child transcripts.
- [Design permissions, persistence, and resume semantics](issues/05-design-permissions-persistence-and-resume.md) — Store each child as a persisted RPC Pi session under a private per-parent subagent state dir, index it with parent `subagent-record` custom entries, proxy child RPC UI requests with source labels, cancel live children cleanly on shutdown, and distinguish live/same-session resume from summary-seeded continuations.
- [Create the MVP implementation plan](issues/06-create-mvp-implementation-plan.md) — **Pre-v2 implementation order, now superseded by issue 10 for launch/sidebar sequencing.** Keep its extension/RPC/default-agent/test details as implementation material, but insert launcher + multiplexer sidebar work before the executor becomes the user-facing MVP.
- [Decide packaging and rollout path](issues/07-decide-packaging-and-rollout.md) — Ship the MVP first as local `pi-configs` global resources under `agent/extensions/subagent/` and `agent/agents/`, update install/resync scripts to round-trip `agent/agents/`, keep runtime child state out of git under `~/.pi/agent/subagents/`, then extract a reusable Pi package/upstream example only after the local RPC/sidebar design proves stable.
- [Redesign launcher around Herdr/tmux](issues/08-design-herdr-tmux-launcher.md) — Use Herdr as the preferred launcher/sidebar via a `pi-configs` wrapper plus Pi extension state reports, fall back to tmux with a Pi-owned status pane, and retain degraded in-TUI visibility when neither multiplexer exists.
- [Design multiplexer sidebar for subagents](issues/09-design-multiplexer-sidebar.md) — Make Herdr/tmux the primary P0 surface by launching Pi in a multiplexer-backed workspace with a persistent right sidebar; use Herdr agent/pane metadata when available, a tmux renderer pane as fallback, and the old `/agents` overlay only as degraded/details mode while preserving parent Pi draft/context.
- [Update PRD and implementation plan for launcher/sidebar v2](issues/10-update-scope-and-implementation-plan-v2.md) — PRD and map now make Herdr/tmux launcher + sidebar the P0 MVP shape, preserve search/safety/persistence requirements, and define the new phased implementation order: launcher, shared sidebar state, agent policy/search, RPC executor, controls/details fallback, hardening/docs.

## Fog

- Exact Herdr bootstrap mechanics need a spike: CLI output may be sufficient for session/workspace/pane IDs, but a tiny socket/API client may be needed for robust machine-readable orchestration.
- The tmux sidebar renderer needs sizing: choose whether it is a Node/TypeScript TUI, a Pi extension command rendered in a pane, or a simpler state-file watcher first.
- Wrapper rollout needs care: decide whether to install a separate command (`pi-subagents`, `pi-herdr`) before shadowing/wrapping `pi`, and keep a reliable `PI_REAL_BIN` escape hatch.
- Confirm whether Pi extension commands can run while a model-callable `subagent` tool is still executing. If not, background spawning with immediate IDs must become the default P0 path.
- Decide whether child Pi RPC runners live in visible Herdr/tmux panes by default or whether panes attach to transcripts owned by a parent-managed runner.
- Worktree isolation, nested agents, MCP-per-agent, memory, and batch CSV fan-out are promising P2 areas but not sized for MVP.
- Package extraction and upstream example contribution should be revisited after the local Herdr/tmux + RPC subagents MVP proves stable.
- A future branch-safe detached background supervisor may be needed if subagents should survive parent session replacement instead of cancelling/marking detached.
