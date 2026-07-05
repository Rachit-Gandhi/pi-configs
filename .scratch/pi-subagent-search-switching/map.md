## Notes

Effort: improve Pi subagents to support Codex/Claude-style search and live switchable visibility, using local markdown issue tracking for now.

Standing product requirement from the user: **switching into subagents and seeing their work is a big plus and should be treated as P0.**

Useful skills/docs for future sessions:

- `/wayfinder` for this map.
- `/orchestrate-subagents` for multi-workstream implementation.
- `/codebase-design` for interface seams.
- `/prototype` for transcript-switching UI experiments.
- `/research` for official Codex/Claude/Pi API facts.
- Pi docs to consult: `docs/extensions.md`, `docs/tui.md`, `docs/json.md`, `docs/rpc.md`, `docs/session-format.md`, `docs/packages.md`.
- Existing Pi example: `examples/extensions/subagent/` in the installed Pi package.
- Current local repo target: `/Users/rachitgandhi/workspace/github.com/Rachit-Gandhi/pi-configs`.
- Current local baseline: `agent/extensions/subagent-visualizer.ts` exists; no real `subagent` executor is installed yet; `agent/settings.json` includes `npm:pi-web-access`.

## Decisions so far

- [Compare Codex and Claude subagent parity targets](issues/01-compare-codex-claude-parity.md) — MVP should prioritize a real Pi subagent executor with opt-in Pi web tools plus Codex/Claude-style `/agent` live transcript switching/steering as P0; background defaults, resume, stats, richer policies, nesting, worktrees, MCP/memory, and batch workflows are P1/P2.
- [Map current Pi subagent and extension baseline](issues/02-map-current-pi-subagent-baseline.md) — Pi has enough extension/RPC/session/TUI APIs to build switchable subagents as a local hybrid extension: reuse the example subagent executor, run children as persisted RPC sessions, and feed the existing visualizer plus a new `/agents` transcript/steering UI.
- [Design the switchable subagent transcript UX](issues/03-design-agent-transcript-switching-ux.md) — MVP should use a hybrid `subagent_status` widget plus `/agents` (`/agent` alias) overlay inspector for live child transcripts, steering, stop, and dismiss; avoid default full session switching, preserve parent draft/context, and store child session files as canonical transcripts with parent-side indexed snapshots.
- [Design subagent search tool surface and default agents](issues/04-design-search-tool-surface.md) — Default Pi subagents should use explicit frontmatter `tools` allowlists with canonical Pi web tool names (`web_search`, `fetch_content`, `get_search_content`), ship read-only `docs-researcher`/`code-explorer`/`reviewer` plus non-web `worker`, and enforce opt-in visible network access with cited summaries and raw search output kept in child transcripts.
- [Design permissions, persistence, and resume semantics](issues/05-design-permissions-persistence-and-resume.md) — Store each child as a persisted RPC Pi session under a private per-parent subagent state dir, index it with parent `subagent-record` custom entries, proxy child RPC UI requests with source labels, cancel live children cleanly on shutdown, and distinguish live/same-session resume from summary-seeded continuations.
- [Create the MVP implementation plan](issues/06-create-mvp-implementation-plan.md) — Ship a local global extension in `agent/extensions/subagent/`, add default agents under `agent/agents/`, first validate discovery/status with a JSON fallback, then make persisted RPC child sessions plus `/agents` overlay controls the P0 implementation path, with hard gates for read-only tools, source-labeled approvals, reload reconstruction, and live stop/steer.
- [Decide packaging and rollout path](issues/07-decide-packaging-and-rollout.md) — Ship the MVP first as local `pi-configs` global resources under `agent/extensions/subagent/` and `agent/agents/`, update install/resync scripts to round-trip `agent/agents/`, keep runtime child state out of git under `~/.pi/agent/subagents/`, then extract a reusable Pi package/upstream example only after the local RPC `/agents` design proves stable.

## Fog

- Worktree isolation, nested agents, MCP-per-agent, memory, and batch CSV fan-out are promising P2 areas but not sized for MVP.
- Package extraction and upstream example contribution should be revisited after the local RPC `/agents` MVP proves stable.
- A future branch-safe detached background supervisor may be needed if subagents should survive parent session replacement instead of cancelling/marking detached.
