# PRD: Pi switchable subagents with search parity

Status: Draft / Wayfinder charted
Owner: Rachit
Repo: `Rachit-Gandhi/pi-configs` for local config/package work; upstream Pi may be a later target.

## TL;DR

Build a Pi subagent experience that keeps Pi's minimal core philosophy while matching the best practical affordances from Codex and Claude Code:

- Specialized subagents with isolated context windows.
- Web/search-capable agents for docs, current facts, and codebase exploration.
- Parallel/background work without flooding the main conversation.
- A switchable live agent-thread UI where the user can watch, steer, stop, resume, and inspect each subagent's transcript.

The user's added requirement is a P0 product requirement, not a nice-to-have: **being able to switch to a subagent and see its work is a big part of the value.**

## Background

Pi intentionally ships as a minimal terminal coding harness and does not include subagents by default. Pi docs and examples show that this can be built as an extension using custom tools, commands, TUI widgets, JSON/RPC modes, and session APIs.

Current local config baseline:

- `agent/extensions/subagent-visualizer.ts` exists and provides `subagent_status` for visual progress tracking.
- No real `subagent` executor is currently installed in `~/.pi/agent/extensions`.
- Pi ships an example `examples/extensions/subagent/` that can spawn separate `pi --mode json` processes and supports single, parallel, and chain workflows, but it is not yet installed locally and does not provide a durable, switchable transcript UX.
- `agent/settings.json` already installs `npm:pi-web-access`, which likely makes web tools such as `web_search`, `fetch_content`, and `get_search_content` available to normal Pi sessions and should be usable by child Pi sessions when allowlisted.

Competitive reference points from official docs:

- Codex supports subagent workflows, built-in `default`/`worker`/`explorer` agents, custom TOML agents under `~/.codex/agents/` or `.codex/agents/`, subagent activity in CLI/app, `/agent` switching between active agent threads, source-labeled approval overlays, and first-party web search with cached/live/disabled modes.
- Claude Code supports custom subagents with frontmatter `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `background`, `isolation`, `mcpServers`, `skills`, and more. Its tool reference includes `WebSearch` and `WebFetch`. It supports background subagents, @-mention invocation, `SendMessage` resume/steering, persisted subagent transcripts, nested subagents, worktree isolation, and a panel for observing and steering forks/subagents.

## Problem

Pi users currently have to choose between:

1. Doing all exploration/search in the main context, which pollutes the conversation with logs, search results, and file contents.
2. Manually simulating subagents with status rows, which gives visibility but no isolated context or live child transcript.
3. Running separate Pi sessions/tmux panes manually, which works but has poor orchestration and handoff ergonomics.

We want Pi-native subagents that can do research/search and implementation in isolated contexts while the user and parent agent retain live control.

## Goals

### P0 MVP

- Add a real `subagent` tool/extension to local Pi config.
- Support user-level and project-level agent definitions.
- Support read-only/search-focused agents and full worker agents.
- Allow subagents to use local code search (`grep`, `find`, `ls`, `read`) and web/search tools (`web_search`, `fetch_content`, `get_search_content`) when allowed.
- Run one or more subagents without dumping all intermediate output into the main context.
- Show a live agent panel/status row with active, queued, blocked, succeeded, failed, and cancelled states.
- Provide `/agent` or `/agents` UI to switch into an active or completed subagent and inspect its transcript while it works.
- Let the user steer or stop a running subagent from the UI.
- Return concise final summaries to the parent conversation, with full transcript available on demand.
- Persist enough child state that a Pi reload/resume can reconstruct active/completed subagent records.

### P1

- Background execution by default with foreground option when the parent needs results before continuing.
- Parallel, chain, and batch fan-out workflows with concurrency limits.
- Resume stopped/completed subagents with follow-up instructions.
- Usage/cost/context statistics per subagent.
- Permission prompts clearly labeled with the requesting subagent.
- Configurable max threads, max depth, max turns, timeout, and output caps.

### P2

- Worktree isolation for editing subagents.
- Per-agent MCP server configuration.
- Per-agent memory directory.
- Nested subagents with strict depth limits.
- Packaged reusable extension + agents + prompts suitable for sharing or upstreaming.

## Non-goals

- Do not modify Pi core until extension limits are proven.
- Do not clone Claude Agent Teams or Codex Cloud.
- Do not make web/network access default for every agent; search must be explicit via tool allowlists/config.
- Do not hide permission prompts or approvals from the user.
- Do not require project-local agents unless the project is trusted.

## User stories

1. As a user, I can ask Pi to "spawn three search agents: one for Codex docs, one for Claude docs, one for Pi internals" and keep working while they run.
2. As a user, I can press/open `/agent`, select a running subagent, and watch its tool calls and output live.
3. As a user, I can send a follow-up to a subagent without polluting the main conversation.
4. As a user, I can stop a runaway subagent and dismiss a completed one.
5. As the parent agent, Pi can delegate high-volume docs/web/code search to a subagent and receive a concise summary with links to full transcript/details.
6. As a maintainer, I can define `docs-researcher`, `code-explorer`, `reviewer`, and `worker` agents with different models and tool allowlists.

## Functional requirements

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
  - usage stats if available
  - final result or failure reason
- Child agents run with isolated model context.
- Parent-visible result is capped/summarized; full result is preserved in transcript/details.

### FR3 — Search support

- Search-capable agents can allowlist:
  - `web_search`
  - `fetch_content`
  - `get_search_content`
  - local search tools (`grep`, `find`, `ls`, `read`, optionally `bash` read-only)
- Web/search tools should be opt-in per agent or inherited from parent only when allowed.
- Search results should be treated as untrusted and summarized/cited.
- A first-party `docs-researcher` example should demonstrate web search + fetch + citation workflow.

### FR4 — Live visibility and switching

- Add an agent panel/widget showing active threads and statuses.
- Add `/agent` or `/agents` command to:
  - list active/completed subagents
  - switch/open selected transcript
  - send follow-up text to a running/resumable subagent
  - stop/cancel a running subagent
  - dismiss completed threads from the panel
- The transcript view should show at least:
  - task prompt
  - assistant text
  - tool calls
  - tool results/output previews
  - final result
  - errors
  - usage stats
- Switching must not lose the main session draft or current context.

### FR5 — Permissions and safety

- Subagents inherit parent-level safety defaults unless their agent definition is more restrictive.
- Project-local agents require project trust or explicit confirmation.
- Background permission prompts must identify the subagent requesting permission.
- Read-only/search agents must not be able to write/edit by default.
- Network/search access should be explicit and visible.
- Cancellation should terminate child processes cleanly, then force-kill if needed.

### FR6 — Persistence and resume

- Subagent records survive `/reload` and parent session resume.
- Completed subagent transcripts remain inspectable.
- A stopped/completed subagent can be resumed only if the chosen execution architecture supports it; otherwise the UI must clearly say it will spawn a new continuation agent with prior transcript summarized.

### FR7 — Integration with existing visualizer

- Either extend `subagent-visualizer.ts` into the full subagent panel or have the executor emit `subagent:status` events so the existing widget stays useful.
- Avoid duplicate/conflicting status UIs.

## Acceptance criteria

- A `docs-researcher` subagent can use `web_search` and `fetch_content` to answer a current-docs question without adding raw search output to the main conversation.
- Two subagents can run in parallel and stream visible status updates.
- `/agent` lets the user open a running subagent and see its recent tool calls/output.
- The user can send a follow-up to a running subagent or stop it from the UI.
- The final parent result includes concise per-agent summaries and points to full transcripts.
- Reloading Pi reconstructs completed subagent records for the current session.
- Read-only agents cannot edit files under their default config.
- Project-local agents prompt for trust/confirmation before use.

## Likely implementation direction

Start from Pi's `examples/extensions/subagent/` because it already solves:

- child Pi process spawning
- JSON event parsing
- single/parallel/chain modes
- custom agent discovery
- tool allowlists
- streaming render of child tool calls/results

Then add the missing product layer:

- persistent child sessions/transcripts instead of `--no-session` only
- `/agent` switcher/inspector UI
- child follow-up/stop/resume control path
- search-enabled default agents
- integration with `subagent_status`
- docs and local package structure in `pi-configs`

Open architecture question: whether to continue with JSON subprocesses or move to RPC child sessions for true follow-up/steering. This is captured as a Wayfinder ticket.

## Risks

- Child process lifecycle and interactive steering may require RPC rather than JSON mode.
- Persisted transcripts can leak sensitive tool output if stored carelessly.
- Web search creates prompt-injection and network-permission risks.
- Multiple child agents can burn tokens quickly.
- UI complexity can fight Pi's minimalist ergonomics.
- Extension API may not expose enough hooks to label permission prompts from child processes without wrapping tools.

## Open questions

See the Wayfinder map and issues under `.scratch/pi-subagent-search-switching/`.
