# PRD: Pi multiplexer-backed switchable subagents with search parity

Status: Draft / Wayfinder charted / Scope v2
Owner: Rachit
Repo: `Rachit-Gandhi/pi-configs` for local config/package work; upstream Pi may be a later target.

## TL;DR

Build a Pi subagent experience that keeps Pi's minimal core philosophy while matching the best practical affordances from Codex, Claude Code, and a terminal multiplexer workspace:

- The supported Pi entrypoint should launch Pi inside **Herdr when available**, otherwise **tmux when available**, and only run plain Pi with a clear degraded-mode warning when neither exists.
- A persistent right **Subagents sidebar** is the primary P0 surface for watching, switching/focusing, steering, stopping, and dismissing subagents.
- Specialized subagents run with isolated context windows and explicit tool policies.
- Web/search-capable agents can do docs/current-facts/codebase research without dumping raw output into the main conversation.
- Parallel/background work is visible in the sidebar and summarized concisely back to the parent conversation.
- `/agents` and `/agent` remain important as details/fallback commands, but the overlay-first design is no longer the primary MVP UX.

The user's revised requirement is P0 product scope: **launch Pi with Herdr or tmux whenever one is available, then give the user a sidebar with subagents.** Switching into a subagent should normally be a multiplexer focus/attach action, not a Pi session switch that risks losing the parent draft/context.

## Background

Pi intentionally ships as a minimal terminal coding harness and does not include subagents by default. Pi docs and examples show that subagents can be built as an extension using custom tools, commands, TUI widgets, JSON/RPC modes, and session APIs.

Scope v2 adds a launcher/sidebar layer in front of the earlier overlay design:

- Issue 08 decided that a thin `pi-configs` launcher should prefer Herdr, fall back to tmux, avoid nesting when already inside either multiplexer, and expose stable environment variables such as `PI_SUBAGENTS_MULTIPLEXER`, `PI_SUBAGENTS_SESSION`, and `PI_SUBAGENTS_PARENT_CWD`.
- Issue 09 decided that the multiplexer sidebar is the primary P0 visibility/switching surface. Herdr should use native agent/pane metadata where possible; tmux should use a Pi-owned sidebar pane; no-multiplexer mode should fall back to the existing in-TUI widget plus `/agents` overlay/details mode.

Current local config baseline:

- `agent/extensions/subagent-visualizer.ts` exists and provides `subagent_status` for visual progress tracking.
- No real `subagent` executor is currently installed in `~/.pi/agent/extensions`.
- No Herdr/tmux launcher wrapper for Pi exists yet in this repo.
- No persistent sidebar renderer exists yet for tmux mode.
- Pi ships an example `examples/extensions/subagent/` that can spawn separate `pi --mode json` processes and supports single, parallel, and chain workflows, but it is not yet installed locally and does not provide durable, switchable transcript UX.
- `agent/settings.json` already installs `npm:pi-web-access`, which likely makes web tools such as `web_search`, `fetch_content`, and `get_search_content` available to normal Pi sessions and should be usable by child Pi sessions when allowlisted.

Competitive reference points from official docs:

- Codex supports subagent workflows, built-in `default`/`worker`/`explorer` agents, custom TOML agents under `~/.codex/agents/` or `.codex/agents/`, subagent activity in CLI/app, `/agent` switching between active agent threads, source-labeled approval overlays, and first-party web search with cached/live/disabled modes.
- Claude Code supports custom subagents with frontmatter `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `background`, `isolation`, `mcpServers`, `skills`, and more. Its tool reference includes `WebSearch` and `WebFetch`. It supports background subagents, @-mention invocation, `SendMessage` resume/steering, persisted subagent transcripts, nested subagents, worktree isolation, and a panel for observing and steering forks/subagents.
- Herdr provides the preferred local workspace/sidebar substrate: sessions, workspaces, panes, `agent start/list/read/send/focus/attach`, and `pane report-agent` / metadata commands.
- tmux provides the fallback substrate: named sessions, panes/windows, splits, pane focus/selection, `send-keys`, `capture-pane`, and kill/resize commands, but Pi must own the semantic subagent sidebar.

## Problem

Pi users currently have to choose between:

1. Doing all exploration/search in the main context, which pollutes the conversation with logs, search results, and file contents.
2. Manually simulating subagents with status rows, which gives visibility but no isolated context or live child transcript.
3. Running separate Pi sessions/tmux panes manually, which works but has poor orchestration, handoff, and persistence ergonomics.
4. Opening an in-TUI `/agents` overlay as the main switcher, which is useful but does not satisfy the revised desire for an always-visible multiplexer sidebar.

We want a Pi-native subagent workflow where the normal launch path creates or reuses a multiplexer-backed workspace, shows subagents in a sidebar, and lets the parent agent/user retain live control while child agents do isolated research or implementation work.

## Goals

### P0 MVP

- Add a launch wrapper/entrypoint in `pi-configs` that runs Pi inside Herdr when available, tmux when Herdr is unavailable, and plain Pi with a warning when neither multiplexer exists.
- Detect already-inside-Herdr/tmux sessions and avoid nesting; run Pi in the current pane while still enabling sidebar/state integration.
- Set stable launch environment for the extension/sidebar: `PI_SUBAGENTS_MULTIPLEXER=herdr|tmux|none`, `PI_SUBAGENTS_SESSION`, `PI_SUBAGENTS_PARENT_CWD`, and multiplexer-specific workspace/pane/session identifiers when known.
- Provide a persistent right Subagents sidebar in Herdr/tmux modes.
- In Herdr mode, use Herdr panes/agents and report status through Herdr agent/pane metadata where possible.
- In tmux mode, create or reuse a Pi-owned sidebar pane that watches the shared subagent state store.
- Preserve degraded no-multiplexer behavior with the existing in-TUI status widget and `/agents` overlay/details inspector.
- Add a real `subagent` tool/extension to local Pi config.
- Support user-level and project-level agent definitions.
- Support read-only/search-focused agents and full worker agents.
- Allow subagents to use local code search (`grep`, `find`, `ls`, `read`) and web/search tools (`web_search`, `fetch_content`, `get_search_content`) when explicitly allowed.
- Run one or more subagents without dumping all intermediate output into the main context.
- Show live subagent states: active, queued, blocked, succeeded, failed, cancelled, and detached.
- Let the user focus/attach to a subagent transcript/pane, steer or follow up, stop/cancel, and dismiss completed records from the sidebar.
- Return concise final summaries to the parent conversation, with full transcript available on demand.
- Persist enough child state that a Pi reload/resume can reconstruct active/completed subagent records honestly.

### P1

- Background execution by default with foreground/wait option when the parent needs results before continuing.
- Parallel, chain, and batch fan-out workflows with concurrency limits.
- Resume stopped/completed subagents with follow-up instructions when the execution architecture supports it; otherwise create honest continuation agents.
- Usage/cost/context statistics per subagent.
- Permission prompts clearly labeled with the requesting subagent and visible in the sidebar as `blocked`.
- Configurable max threads, max depth, max turns, timeout, and output caps.
- Better detached/supervisor behavior for long-running agents that should survive parent reload/session replacement.

### P2

- Worktree isolation for editing subagents.
- Per-agent MCP server configuration.
- Per-agent memory directory.
- Nested subagents with strict depth limits.
- Packaged reusable extension + agents + prompts suitable for sharing or upstreaming.
- Optional Herdr-specific polish such as notifications, richer workspace layouts, or integration install helpers once the local wrapper/extension seam proves stable.

## Non-goals

- Do not modify Pi core until extension/wrapper limits are proven.
- Do not clone Claude Agent Teams or Codex Cloud.
- Do not make web/network access default for every agent; search must be explicit via tool allowlists/config.
- Do not hide permission prompts or approvals from the user.
- Do not require project-local agents unless the project is trusted.
- Do not require Herdr specifically; Herdr is preferred, tmux is the supported fallback, and no-multiplexer degraded mode remains usable.
- Do not make the old `/agents` overlay the primary P0 UX; it is a details/fallback/degraded surface.

## User stories

1. As a user, I can launch Pi and automatically land in a Herdr workspace, or a tmux session if Herdr is unavailable, with a Subagents sidebar ready.
2. As a user, I can ask Pi to "spawn three search agents: one for Codex docs, one for Claude docs, one for Pi internals" and keep working while they run.
3. As a user, I can glance at the sidebar to see which subagents are running, blocked, failed, or done.
4. As a user, I can focus/attach to a running subagent's pane/transcript without losing my parent Pi draft.
5. As a user, I can send a follow-up to a subagent without polluting the main conversation.
6. As a user, I can stop a runaway subagent and dismiss a completed one.
7. As the parent agent, Pi can delegate high-volume docs/web/code search to a subagent and receive a concise summary with links to full transcript/details.
8. As a maintainer, I can define `docs-researcher`, `code-explorer`, `reviewer`, and `worker` agents with different models and tool allowlists.

## Functional requirements

### FR0 — Launcher and multiplexer workspace

- Provide a supported Pi entrypoint/wrapper in `pi-configs`.
- Detection order: already inside Herdr, already inside tmux, launch Herdr if available, launch tmux if available, otherwise run plain Pi degraded.
- Prefer Herdr over tmux when neither is currently active and both are installed.
- Avoid recursive wrapper launches with `PI_SUBAGENTS_LAUNCHER_ACTIVE=1` or equivalent.
- Preserve access to the real Pi binary through `PI_REAL_BIN` or another explicit escape hatch.
- Set stable environment variables for the parent Pi, child runners, and sidebar.
- Use a stable project/session name derived from cwd/repo where possible.
- Herdr launch should create/reuse a named session/workspace, start/focus the parent Pi pane, create/reuse the sidebar, and attach the Herdr client.
- tmux launch should create/reuse a named session, run parent Pi in the main pane, create/reuse a right sidebar pane, and attach the session.
- If neither Herdr nor tmux exists, print a clear warning once and run normal Pi with in-TUI degraded visibility.
- Install/resync scripts must not silently overwrite user Herdr config or generated Herdr integration files.

### FR1 — Agent definitions

- Discover user agents from `~/.pi/agent/agents/*.md`.
- Discover project agents from `.pi/agents/*.md` only for trusted projects / explicit scope.
- Support frontmatter fields at minimum:
  - `name`
  - `description`
  - `tools`
  - `excludeTools` or `disallowedTools`
  - `model`
  - `thinking`
  - `maxTurns`
  - `background`
  - `cwd`
  - optional `color` / display label
- Project agents override user agents with the same name only when project scope is enabled.

### FR2 — Subagent execution

- The parent gets a `subagent` tool with modes:
  - single: `{ agent, task }`
  - parallel: `{ tasks: [...] }`
  - chain: `{ chain: [...] }`
- Each subagent gets:
  - stable ID
  - display name
  - status
  - current task
  - transcript/session reference
  - multiplexer pane/agent target when available
  - usage stats if available
  - final result or failure reason
- Child agents run with isolated model context.
- Parent-visible result is capped/summarized; full result is preserved in transcript/details.
- JSON subprocess mode may exist as a scaffold/debug fallback, but persisted RPC child sessions are the target MVP transport for live steering and transcript inspection.

### FR3 — Search support

- Search-capable agents can allowlist:
  - `web_search`
  - `fetch_content`
  - `get_search_content`
  - local search tools (`grep`, `find`, `ls`, `read`, optionally `bash` read-only)
- Web/search tools should be opt-in per agent or inherited from parent only when allowed.
- Search results should be treated as untrusted and summarized/cited.
- A first-party `docs-researcher` example should demonstrate web search + fetch + citation workflow.

### FR4 — Sidebar visibility, switching, and details UI

- In Herdr/tmux modes, show a persistent right sidebar as the primary P0 subagent UI.
- Sidebar rows show at least: status icon and text, stable id, display name, progress if known, elapsed/duration, badges (`web`, `read-only`, `writes`, `project-agent`, `blocked`, `detached`), and current activity/final/error preview.
- Sidebar sort order should prioritize `blocked`, `running`, `queued`, `failed`, `cancelled`, `succeeded`, then recently updated.
- Sidebar controls should support:
  - focus/watch selected subagent
  - attach/take over only after confirmation
  - send steer/follow-up/continuation message
  - stop/cancel running or blocked subagent
  - dismiss terminal records non-destructively
  - filter/search and show help
- Switching/focusing must preserve the parent Pi pane, draft, session, and model context.
- `/agents` and `/agent` commands mirror sidebar controls and provide:
  - full list including completed/dismissed records
  - transcript/details inspector
  - degraded no-multiplexer overlay mode
  - non-TUI text/select fallback
- The transcript/details view should show at least:
  - task prompt
  - assistant text
  - tool calls
  - tool results/output previews
  - final result
  - errors
  - permission requests
  - usage stats

### FR5 — Permissions and safety

- Subagents inherit parent-level safety defaults unless their agent definition is more restrictive.
- Project-local agents require project trust or explicit confirmation.
- Background permission prompts must identify the subagent requesting permission.
- Sidebar rows should mark permission waits as `blocked` with the requesting tool/action.
- Read-only/search agents must not be able to write/edit by default.
- Network/search access should be explicit and visible.
- Cancellation should terminate child processes cleanly, then force-kill if needed.
- Manual attach/takeover of a child pane is an escape hatch and should warn that structured `msg`/follow-up controls preserve policy and transcript semantics better.

### FR6 — Persistence and resume

- Subagent records survive `/reload` and parent session resume.
- Completed subagent transcripts remain inspectable.
- Canonical child transcripts are persisted child Pi sessions/events; parent records store only capped previews/index data.
- A stopped/completed subagent can be resumed only if the chosen execution architecture supports it; otherwise the UI must clearly say it will spawn a new continuation agent with prior transcript summarized.
- If the multiplexer disconnects or a live child cannot be reattached after reload, show `detached`/`cancelled` honestly rather than stale `running`.

### FR7 — Integration with existing visualizer and multiplexer bridges

- Either extend `subagent-visualizer.ts` into the degraded/no-mux view or have the executor emit `subagent:status` events so the existing widget stays useful.
- Avoid duplicate/conflicting status UIs.
- Herdr mode should report state through Herdr agent/pane metadata (`pane report-agent`, `report-agent-session`, or equivalent) when possible.
- tmux mode should render the same state via a sidebar process watching the shared state dir or local socket.
- All modes should consume the same reduced `SubagentRecord` / transcript event model.

## Acceptance criteria

- Launching through the supported entrypoint opens or attaches a Herdr-backed Pi workspace when Herdr is available.
- If Herdr is unavailable but tmux is available, launching opens or attaches a tmux-backed Pi session with the same parent/sidebar/subagent semantics.
- If neither Herdr nor tmux is available, Pi prints a clear degraded-mode warning and still exposes the in-TUI widget plus `/agents` overlay/details mode.
- The sidebar is visible in Herdr/tmux modes and lists running, queued, blocked, failed, cancelled, succeeded, and detached subagents with stable ids and activity previews.
- A `docs-researcher` subagent can use `web_search` and `fetch_content` to answer a current-docs question without adding raw search output to the main conversation.
- Two subagents can run in parallel and stream visible status updates to the sidebar/status layer.
- The user can focus/attach to a running subagent and see recent tool calls/output without losing the parent Pi draft/context.
- The user can send a follow-up to a running subagent or stop it from the sidebar or mirrored `/agent` command.
- The final parent result includes concise per-agent summaries and points to full transcripts.
- Reloading Pi reconstructs completed subagent records for the current session and marks unreconnected live children honestly.
- Read-only agents cannot edit files under their default config.
- Project-local agents prompt for trust/confirmation before use.

## Likely implementation direction

Ship the MVP in `pi-configs` first as a wrapper plus global Pi extension. Keep Pi core unchanged until the wrapper/extension seam proves insufficient.

Implementation should proceed in this order:

1. **Launcher/multiplexer bootstrap:** add the supported Pi wrapper, Herdr/tmux detection, recursion guard, environment variables, install/resync compatibility, and degraded warning path.
2. **Shared state + sidebar shell:** define `SubagentRecord` and transcript event storage, then prove Herdr status reporting and tmux sidebar rendering with fake records before adding real model children.
3. **Agent definitions and policies:** add default `docs-researcher`, `code-explorer`, `reviewer`, and `worker` agents; implement discovery, trust, allowlists, and read-only/search policy enforcement.
4. **Subagent execution:** start from Pi's `examples/extensions/subagent/` for JSON subprocess scaffolding where useful, but move the default MVP to persisted RPC child sessions for live transcript, steer/follow-up, stop, and reload reconstruction.
5. **Controls/details:** wire sidebar focus/attach/message/stop/dismiss and mirrored `/agents` overlay/details/degraded commands.
6. **Hardening/docs:** source-label approvals, cap parent-visible output, enforce private state file modes, test reload/shutdown/detached semantics, and document local usage.

Start from Pi's `examples/extensions/subagent/` because it already solves:

- child Pi process spawning
- JSON event parsing
- single/parallel/chain modes
- custom agent discovery
- tool allowlists
- streaming render of child tool calls/results

Then add the missing product layer:

- Herdr/tmux launch wrapper and always-visible sidebar
- persistent child sessions/transcripts instead of `--no-session` only
- RPC control path for child follow-up/stop/resume
- search-enabled default agents
- integration with `subagent_status`
- source-labeled approval proxying
- docs and local package structure in `pi-configs`

Open architecture question: whether Herdr child panes should directly host child Pi RPC runners or whether the parent extension should own all child processes and use Herdr/tmux only for visibility/focus. Either way, the user-facing P0 is launcher + sidebar first, with `/agents` as details/fallback.

## Risks

- Herdr bootstrap may require socket/API calls if CLI output is not stable enough for workspace/pane IDs.
- tmux has no semantic agent registry, so Pi must own sidebar state, rendering, and recovery.
- Child process lifecycle and interactive steering may require RPC rather than JSON mode.
- Persisted transcripts can leak sensitive tool output if stored carelessly.
- Web search creates prompt-injection and network-permission risks.
- Multiple child agents can burn tokens quickly.
- UI complexity can fight Pi's minimalist ergonomics; the sidebar must stay compact and keyboard-first.
- Extension API may not expose enough hooks to label permission prompts from child processes without wrapping tools.
- Wrapper installation must avoid surprising users by shadowing `pi` without a clear escape hatch.

## Open questions

See the Wayfinder map and issues under `.scratch/pi-subagent-search-switching/`.
