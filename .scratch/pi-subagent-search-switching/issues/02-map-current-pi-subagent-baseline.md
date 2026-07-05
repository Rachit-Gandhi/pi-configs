# Map current Pi subagent and extension baseline

Type: research
Status: resolved
Blocked by:
Parent: ../map.md

## Question

What does Pi already provide that can support switchable/search-capable subagents, and what gaps remain in the current local `pi-configs` setup?

## Starting points

- Pi docs: `docs/extensions.md`, `docs/tui.md`, `docs/json.md`, `docs/rpc.md`, `docs/session-format.md`, `docs/usage.md`.
- Pi example: `examples/extensions/subagent/`.
- Local extension: `agent/extensions/subagent-visualizer.ts`.
- Local settings: `agent/settings.json`.

## Exit criteria

- Inventory reusable code from Pi's example subagent extension.
- Identify whether child agents should use JSON mode, RPC mode, persisted sessions, or a hybrid.
- Identify exact extension APIs needed for status, transcript rendering, switching, follow-up messages, and cancellation.
- Resolve this ticket with a decision pointer in `../map.md`.

## Answer

### Baseline inventory

Inspected:

- Pi docs: `docs/extensions.md`, `docs/tui.md`, `docs/json.md`, `docs/rpc.md`, `docs/session-format.md`, `docs/usage.md`.
- Pi example: `examples/extensions/subagent/`.
- Local config: `agent/extensions/subagent-visualizer.ts`, `agent/settings.json`, and repo search for installed subagent executors.

Current local `pi-configs` state:

- `agent/settings.json` installs `npm:pi-web-access`, so normal Pi sessions should load `web_search`, `fetch_content`, and `get_search_content`; child Pi sessions should also get them unless launched with flags/settings that disable packages or exclude those tools.
- `agent/extensions/subagent-visualizer.ts` is installed locally and provides only logical/status visualization:
  - tool: `subagent_status`
  - command: `/subagents`
  - event listener: `pi.events.on("subagent:status", ...)`
  - UI: `ctx.ui.setStatus(...)` footer status and `ctx.ui.setWidget(...)` status panel
  - persistence: reconstructs from prior `subagent_status` tool-result `details` on `session_start` / `session_tree`
- There is no real `subagent` executor extension or `agent/agents/*.md` directory in this repo. The only local subagent behavior is the visualizer and the `orchestrate-subagents` skill guidance.

### Reusable Pi example code

`examples/extensions/subagent/` is a strong starting point and should be copied/adapted rather than rewritten.

Reusable as-is or with small edits:

- `agents.ts`
  - Discovers user agents from `~/.pi/agent/agents/*.md` and project agents from nearest `${CONFIG_DIR_NAME}/agents/*.md`.
  - Parses markdown frontmatter with `parseFrontmatter`.
  - Supports `name`, `description`, `tools`, `model`, prompt body, and user/project source.
  - Handles project-over-user override when `agentScope: "both"`.
- Agent definition shape in `agents/*.md`
  - Good minimum frontmatter and prompts for `scout`, `planner`, `reviewer`, `worker`.
  - Extend for search-capable agents by adding tools like `web_search, fetch_content, get_search_content, read, grep, find, ls`.
- Workflow prompt templates in `prompts/*.md`
  - `/scout-and-plan`, `/implement`, `/implement-and-review` demonstrate chain composition through `{previous}`.
- `index.ts` execution scaffolding
  - `registerTool({ name: "subagent" })` with single, parallel, and chain parameter modes.
  - `mapWithConcurrencyLimit` with max task/concurrency caps.
  - `getPiInvocation()` for robust child Pi spawning from the current runtime.
  - Per-agent `--model` and `--tools` CLI construction.
  - Temporary system prompt file handling via `--append-system-prompt`.
  - JSONL event parsing from child stdout.
  - Parent-visible output cap for parallel results with full result preserved in tool `details`.
  - Usage aggregation from assistant message usage.
  - `renderCall` / `renderResult` UI for compact and expanded tool views, including Markdown final output and formatted tool calls.
  - Abort propagation from the tool `AbortSignal` to child process termination.
  - Project-local agent confirmation with `ctx.ui.confirm`.

Important adaptation points:

- The example currently launches `pi --mode json -p --no-session`, so child sessions are isolated but ephemeral. That fails P0 persistence/switching/resume requirements.
- The example returns child output inside the parent tool result. For the target product, the parent-visible result should stay concise, while the full transcript is stored and inspectable through `/agent` / `/agents`.
- The event reducer should use current documented event types: `message_start`, `message_update`, `message_end`, `tool_execution_start`, `tool_execution_update`, `tool_execution_end`, `agent_end`, `queue_update`, etc.
- The example does not integrate with the local visualizer's `subagent:status` event bus; that integration is straightforward.

### Execution architecture comparison

#### JSON subprocess (`pi --mode json ...`)

Best for one-shot child agents.

Pros:

- Already proven by Pi's example.
- Simple process model: spawn, parse JSONL stdout, collect final output, kill on abort.
- Streams enough events to build a live transcript view: assistant deltas, tool calls, tool results, agent lifecycle, queue/compaction events.
- Easy to run in parallel with independent contexts.

Cons:

- The example uses `--no-session`, so transcripts disappear except what the parent tool stores.
- One-shot `-p` mode has no stdin control channel for live steering/follow-up.
- Cancellation is only process-level kill unless layered with a different protocol.
- Completed-agent follow-up means spawning a new child continuation and manually seeding/summarizing context unless sessions are persisted.

Verdict: good foundation for event parsing, renderers, and simple noninteractive fan-out; insufficient alone for P0 switching/steering/resume.

#### RPC child session (`pi --mode rpc ...`)

Best for live control.

Pros:

- Provides stdin commands for `prompt`, `steer`, `follow_up`, `abort`, `get_state`, `get_messages`, `get_entries`, `get_tree`, `get_last_assistant_text`, `get_session_stats`, `set_session_name`, `switch_session`, etc.
- Streams the same useful event family to stdout for live transcript rendering.
- Supports mid-run steering and queued follow-ups explicitly.
- `abort` can request graceful cancellation before falling back to process termination.
- RPC extension UI protocol can surface child extension prompts/notifications if the parent client handles or proxies them.

Cons:

- More implementation work: keep a long-lived process, implement a JSONL RPC client, correlate responses by id, handle extension UI requests, lifecycle, process death, and reload reconstruction.
- Direct TUI `custom()` does not work inside RPC child sessions, so any child extension UI must be represented through RPC `extension_ui_request`s.
- Background permission labels may still require explicit proxying/wrapping to make it obvious which child requested approval.

Verdict: needed for P0 steer/follow-up/cancel on active subagents.

#### Persisted session files / hybrid

Best for durable transcript and reload.

Pros:

- Pi sessions are JSONL v3 files with stable entries and tree structure.
- Session files preserve user, assistant, tool result, custom, compaction, branch, label, and session-info entries.
- `SessionManager` and RPC `get_entries` provide durable cursors for incremental transcript reconstruction.
- Child sessions can be named with `--name` / RPC `set_session_name` and linked with `parentSession` when using session APIs/RPC where available.
- A completed child can be continued by starting a new child against its saved session path (or keeping the RPC process alive).

Cons:

- Session files alone do not provide live control; they are storage, not a command channel.
- Full Pi `ctx.switchSession(sessionPath)` would replace the parent session. That is useful for an explicit handoff, but it is not the right default for P0 "inspect subagent without losing main draft/context".

Verdict: recommended MVP is a hybrid: RPC for running child control, persisted child session files for transcript/reload/continuation, and JSON-mode/example code reused for parsing/rendering concepts.

### Exact extension APIs needed

Status and visual overview:

- `pi.registerTool(...)` for parent-callable `subagent` and existing `subagent_status`-style updates.
- `pi.events.emit("subagent:status", payload)` from the executor so `subagent-visualizer.ts` can keep working.
- `pi.events.on("subagent:status", ...)` already exists in the visualizer.
- `ctx.ui.setStatus(key, text | undefined)` for compact footer counts.
- `ctx.ui.setWidget(key, lines/component | undefined, { placement? })` for active agent rows.
- `pi.appendEntry(customType, data)` or tool-result `details` for persisted extension state. Use `appendEntry` for executor-owned/background state because it does not require the model to call a status tool.
- `ctx.sessionManager.getEntries()` / `getBranch()` on `session_start` and `session_tree` to reconstruct state.

Transcript rendering and switching/inspection:

- `pi.registerCommand("agent" | "agents", ...)` for the user-facing switcher/inspector.
- `ctx.ui.custom(...)` with overlay or replacement UI for an interactive agent list + transcript view.
- TUI components from `@earendil-works/pi-tui`: `SelectList`, `Text`, `Markdown`, `Container`, `Spacer`, keyboard handling via `matchesKey` / `Key`, `truncateToWidth` / wrapping helpers.
- `ctx.ui.select`, `ctx.ui.input`, `ctx.ui.confirm`, `ctx.ui.editor`, `ctx.ui.notify` for simpler MVP command flows.
- `pi.registerMessageRenderer(customType, renderer)` if the executor stores/display custom transcript or status messages in the parent timeline.
- Tool `renderCall` / `renderResult` and the `onUpdate` callback from `execute(...)` to show live progress while the parent model is waiting on a `subagent` tool call.

Follow-up / steering:

- For child RPC processes: send RPC `prompt` with `streamingBehavior: "steer" | "followUp"`, or direct `steer` / `follow_up` commands.
- For parent-session messages only: `pi.sendUserMessage(...)` and `pi.sendMessage(...)` exist, but these target the parent Pi session, not a child process. Do not confuse them with child steering.
- Command context helpers `ctx.waitForIdle()` may be useful before modifying parent UI/session state from `/agents`.

Cancellation:

- Tool execution `signal: AbortSignal` in `execute(toolCallId, params, signal, onUpdate, ctx)` for parent abort propagation.
- RPC `abort` command for graceful child cancellation.
- Process-level fallback with `proc.kill("SIGTERM")` then `SIGKILL` after a timeout, as in the example.
- `ctx.abort()` only aborts the current parent agent operation; use it carefully and do not use it as the primary child cancellation path from `/agents`.

Child sessions and persistence:

- Child CLI flags: `--mode rpc`, `--session-dir`, `--name`, `--model`, `--tools`, `--no-builtin-tools` / `--exclude-tools` as needed.
- RPC commands: `get_state` for `sessionFile`/streaming state, `get_entries` for durable transcript cursor, `get_messages` for rendered branch messages, `get_session_stats` for usage, `set_session_name` for display labels.
- `SessionManager.list/open` can help inspect saved sessions from the parent extension if direct parsing is needed.

Safety/tool control:

- `pi.getAllTools()`, `pi.getActiveTools()`, `pi.setActiveTools(...)` for parent-side dynamic tool management if needed.
- Child process CLI `--tools` should enforce per-agent allowlists; read-only/search agents should omit `edit` and `write` and either omit `bash` or use strict prompt/tool wrapping.
- `ctx.isProjectTrusted()` before honoring project-local agent definitions beyond Pi's own trust flow.
- `project_trust` event is available for global/CLI extensions if the product later needs trust decisions before project resources load.

### Recommended MVP architecture

Build a local `agent/extensions/subagent/` executor derived from `examples/extensions/subagent/`, and keep `subagent-visualizer.ts` as the lightweight status panel.

MVP shape:

1. Agent definitions
   - Load `~/.pi/agent/agents/*.md` and trusted `.pi/agents/*.md` using the example `agents.ts` logic.
   - Add a `docs-researcher` sample with tools: `web_search, fetch_content, get_search_content, read, grep, find, ls`.
   - Pass explicit child `--tools` allowlists so web/search access is opt-in per agent.

2. Execution
   - Start each child as `pi --mode rpc` with a persisted child session, display name, selected model/thinking, and tool allowlist.
   - Maintain a parent-side `SubagentRecord` with id, name, task, status, process handle, RPC client, sessionFile, transcript cursor, usage, final summary/error.
   - Reuse the example's single/parallel/chain parameter schema, concurrency limits, usage aggregation, and result truncation.
   - Use the example's JSONL parsing approach for RPC events; RPC events are the live transcript source.

3. UI/visibility
   - Emit `pi.events.emit("subagent:status", ...)` on queued/running/blocked/succeeded/failed/cancelled updates so the current visualizer remains useful.
   - Add `/agents` (and alias `/agent`) with an overlay/list UI to choose a subagent and inspect transcript without switching the parent Pi session.
   - Transcript view should render task, assistant text, tool calls, tool results, errors, queue state, final output, and usage. Use TUI `Markdown`/`Text` and the example's tool-call formatting.

4. Control
   - From `/agents`, support:
     - follow-up/steer text: send child RPC `steer`, `follow_up`, or `prompt` with `streamingBehavior` depending on child state;
     - stop: send RPC `abort`, then SIGTERM/SIGKILL if the child does not exit;
     - dismiss: remove from visible panel while preserving session reference.

5. Persistence/reload
   - Store executor records with `pi.appendEntry("subagent-record", snapshot)` whenever important state changes.
   - On `session_start`, reconstruct records from parent custom entries, then use child `sessionFile` plus `get_entries`/session parsing to rebuild completed transcripts.
   - If a child process was running before reload, mark it `cancelled` or `detached/unknown` unless a future process supervisor can reconnect.

6. Parent model contract
   - The `subagent` tool returns concise summaries and stable ids/session references, not raw transcripts.
   - Full transcripts are available through `/agents` and persisted child session files.

This hybrid satisfies the P0 product requirement with the least risky path: Pi's example already solves process spawning, agent definitions, parallel/chain orchestration, result rendering, and usage capture; RPC adds the missing live steering/cancel channel; session persistence adds reloadable transcript inspection.

## Map pointer

Pi already has enough extension/RPC/session/TUI APIs to build switchable subagents as a local hybrid extension: reuse the example subagent executor, run children as persisted RPC sessions, and feed the existing visualizer plus a new `/agents` transcript/steering UI.
