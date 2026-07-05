# Design the switchable subagent transcript UX

Type: prototype
Status: resolved
Blocked by: 01, 02
Parent: ../map.md

## Question

What should the `/agent` or `/agents` experience look like so the user can switch into a subagent, watch its work, steer it, stop it, and return to the main session without confusion?

## Requirements to honor

- Switching/seeing work is P0.
- The UI should remain Pi-simple and terminal-friendly.
- It must handle active, completed, failed, and cancelled subagents.
- It should work with parallel runs.
- It should not lose the main editor draft.

## Exit criteria

- Produce a small UX spec for commands, keys, panel rows, transcript display, and follow-up input.
- Decide whether the first implementation should use a widget, overlay, full custom view, session switch, or hybrid.
- Define minimal transcript fields needed for MVP.
- Resolve this ticket with a decision pointer in `../map.md`.

## Answer

### MVP UX decision

Use a **hybrid** MVP:

1. **Status widget/panel stays always-on** for glanceable live visibility, using/expanding the existing `subagent-visualizer.ts` pattern and `subagent:status` events.
2. **`/agents` is the primary switcher**, with `/agent` as an alias for Codex parity.
3. `/agents` opens an **overlay inspector** in the parent Pi TUI, not a default `ctx.switchSession(...)`. This preserves the main session, draft editor text, model context, and current branch.
4. The overlay is a two-pane list + transcript view on wide terminals; on narrow terminals it falls back to single-pane list then transcript.
5. A full child-session switch is an explicit advanced action only (`o` / `open session`, behind confirmation). It is not the MVP default because it risks confusing parent/child context and draft state.

So: **not widget-only**, **not full session switch by default**, and **not a separate permanent custom view**. MVP is **widget + overlay transcript/control inspector**, with child sessions persisted underneath.

### Commands

Primary commands:

- `/agents` — open the switcher/inspector overlay showing active, completed, failed, cancelled, and recently dismissed subagents.
- `/agent` — alias for `/agents`.
- `/agent <id>` or `/agents <id>` — open one transcript directly.
- `/agent list` — text/notification fallback list for non-TUI or very small terminals.
- `/agent follow <id>` — prompt for a message to a running/resumable subagent.
- `/agent stop <id>` — confirm and cancel a running/blocked subagent.
- `/agent dismiss <id>` — hide a completed/failed/cancelled subagent from the panel while preserving transcript/session.
- `/agents all` — include dismissed and older completed records.

Keep `/subagents` as the existing visualizer/widget command for compatibility, but document `/agents` as the real transcript switcher.

### Keyboard controls

Use Pi's standard keybinding manager for navigation/cancel/confirm where possible (`tui.select.*`, `app.tools.expand`, etc.), and show literal hints for MVP-only actions.

Switcher list:

- `↑` / `↓` or `j` / `k` — move selection.
- `PageUp` / `PageDown` — page through many agents.
- `Enter` — open selected transcript.
- `Esc` — close overlay and return to the unchanged main session/editor.
- `/` — filter by id/name/status/task text.
- `a` — toggle active-only vs all visible records.
- `m` or `f` — send message/follow-up to selected agent.
- `s` — stop selected running/blocked agent, after confirmation.
- `d` — dismiss selected completed/failed/cancelled agent.
- `?` — show help.

Transcript view:

- `Esc` — back to list, then close overlay from list.
- `Tab` — switch focus between list, transcript, and action footer on wide layouts.
- `↑` / `↓`, `j` / `k` — scroll transcript.
- `PageUp` / `PageDown`, `Home` / `End` — jump through transcript.
- `t` — toggle live tail/follow mode for running agents.
- `Ctrl+O` — expand/collapse tool result previews, matching Pi's existing tool expansion affordance.
- `Enter` on a tool row — expand/collapse that tool row.
- `m` or `f` — compose a steer/follow-up message.
- `s` — stop/cancel running agent, after confirmation.
- `d` — dismiss when terminal state is completed/failed/cancelled.
- `o` — explicit “open child session” advanced action, with confirmation and clear warning that it switches away from the parent session.

Single-key destructive actions (`s`, `d`, `o`) should always show a confirm dialog with the subagent id/name.

### Panel row design

Panel rows are compact, non-interactive status rows. They should give enough information to decide whether opening `/agents` is worthwhile.

Header:

```text
Subagents · 2 running · 1 blocked · 3 done   /agents to inspect
```

Row shape:

```text
  ● running   docs-1   Docs Researcher   45% ████░░░░ 1m12s  web · read-only — web_search “Pi RPC...”
  ◆ blocked   work-2   Worker            16% ██░░░░░░ 0m38s  needs approval: bash npm test
  ✓ done      scout-3  Code Scout        100% ████████ 2m03s  final ready
  ⊘ cancelled old-4    Reviewer           --          0m21s  stopped by user
```

Required row fields:

- Status icon **and text**: `queued`, `running`, `blocked`, `succeeded`, `failed`, `cancelled`.
- Stable id, e.g. `docs-1`, because follow-up/stop/dismiss commands need a durable target.
- Agent display name/role.
- Progress percent/bar when known; omit rather than fake precision when unknown.
- Elapsed time for active agents; duration for terminal agents.
- Current activity preview: latest assistant text fragment, latest tool call, waiting approval, queued follow-up, final ready, or error preview.
- Badges where relevant: `web`, `read-only`, `writes`, `project-agent`, `fork`, `queued:N`.

Sorting: running, blocked, queued, failed, cancelled, succeeded; within each bucket most recently updated first. Show only the first 6-8 rows in the widget; `/agents` shows all.

### Transcript view fields

Transcript header:

- Stable id and display name.
- Status and current activity.
- Original task prompt.
- Agent definition source: user/project/builtin/example.
- Model + thinking level.
- CWD.
- Tool allowlist and network/search badge.
- Child session file/id when available.
- Started/updated/finished timestamps.
- Usage stats: turns, input/output/cache tokens, cost, context usage.

Transcript body timeline:

- Initial task prompt.
- User steer/follow-up messages sent to the child.
- Assistant text, streaming live for active agents.
- Tool calls with tool name, args preview, timestamp, status.
- Tool result previews with truncation marker and full-output/session reference.
- Errors, aborts, retries, compaction events, and queue updates.
- Pending permission/UI requests from child RPC sessions, clearly labeled.
- Final result/summary when terminal.

Footer/action bar:

```text
↑↓ scroll · Ctrl+O expand tools · m message · s stop · d dismiss · t tail · Esc back
```

The transcript view should prefer readable, timestamped rows over chat-bubble complexity. Use `Markdown` only for final assistant output and larger assistant text blocks; use `Text` rows for tool events and status lines.

### Follow-up, stop, dismiss flows

Follow-up / steering:

- Running agent: `m`/`f` opens an editor/input titled `Message to docs-1`.
- The dialog offers mode choices:
  - `Steer now` → RPC `steer` or `prompt` with `streamingBehavior: "steer"`.
  - `After current run` → RPC `follow_up` or `prompt` with `streamingBehavior: "followUp"`.
- Default for a running agent is **steer now**, because the user is actively switching into the subagent to guide it.
- The sent message appears in the child transcript as a user event with mode `steer` or `follow_up`.
- Parent conversation receives only a tiny status notice, not the message content unless the parent later asks for it.
- Completed/stopped agent: MVP should say either `resume unavailable; start continuation?` or create a new continuation child seeded with a transcript summary. Do not pretend it is the same live context unless RPC/session resume really supports it.

Stop/cancel:

- `s` on running/blocked agents shows confirmation: `Stop docs-1? Current tool: web_search ...`.
- On confirm, send child RPC `abort` first.
- If it does not exit promptly, send `SIGTERM`, then `SIGKILL` after a short timeout.
- Mark status `cancelled`, preserve transcript, final visible note `stopped by user`.
- `Esc` must never stop a child; it only leaves the UI.

Dismiss:

- Allowed for `succeeded`, `failed`, and `cancelled` agents.
- Hides the row from the widget/default `/agents` list.
- Does **not** delete the child session file or transcript record.
- `/agents all` reveals dismissed records.
- Active agents cannot be dismissed without first stopping them, unless a future `hide active` feature is deliberately added.

### Minimal transcript event model for MVP

Keep the child Pi session JSONL as the canonical durable transcript. Store parent-side snapshots/custom entries only for index/list reconstruction and capped previews.

Minimum parent record:

```ts
type SubagentStatus = "queued" | "running" | "blocked" | "succeeded" | "failed" | "cancelled" | "detached";

interface SubagentRecord {
  id: string;
  name: string;
  role?: string;
  task: string;
  status: SubagentStatus;
  agentSource: "user" | "project" | "builtin" | "unknown";
  cwd: string;
  model?: string;
  thinking?: string;
  tools?: string[];
  networkAllowed?: boolean;
  sessionFile?: string;
  sessionId?: string;
  parentSessionFile?: string;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  progress?: number;
  currentActivity?: string;
  queue?: { steering: number; followUp: number };
  usage?: { turns?: number; input?: number; output?: number; cacheRead?: number; cacheWrite?: number; cost?: number; contextTokens?: number };
  finalSummary?: string;
  error?: string;
  dismissed?: boolean;
}
```

Minimum transcript events derived from RPC/JSON events:

```ts
type TranscriptEvent =
  | { kind: "lifecycle"; status: SubagentStatus; timestamp: number; note?: string }
  | { kind: "user"; mode: "task" | "steer" | "follow_up"; text: string; timestamp: number }
  | { kind: "assistant"; messageId?: string; text: string; isFinal: boolean; timestamp: number; stopReason?: string }
  | { kind: "tool"; toolCallId: string; name: string; args: unknown; status: "running" | "succeeded" | "failed"; timestamp: number; outputPreview?: string; isError?: boolean }
  | { kind: "queue"; steering: number; followUp: number; timestamp: number }
  | { kind: "permission"; requestId: string; toolName?: string; title: string; status: "waiting" | "allowed" | "denied"; timestamp: number }
  | { kind: "error"; source: "agent" | "tool" | "process" | "extension"; message: string; timestamp: number }
  | { kind: "usage"; usage: NonNullable<SubagentRecord["usage"]>; timestamp: number };
```

RPC source events needed for MVP: `agent_start`, `agent_end`, `turn_start`, `turn_end`, `message_start`, `message_update`, `message_end`, `tool_execution_start`, `tool_execution_update`, `tool_execution_end`, `queue_update`, `compaction_start/end`, `auto_retry_start/end`, `extension_error`, plus `extension_ui_request/response` for child prompts/permissions.

For live UI, maintain an in-memory reducer over RPC events. For reload/completed inspection, rebuild from `get_entries` / the child session file and the latest parent `subagent-record` custom entries.

### Accessibility and safety notes

- Never rely on color alone: every status row includes icon + text.
- Keep all actions keyboard reachable; no mouse requirement.
- Preserve and restore the parent editor draft around `/agents`; overlay closure must not mutate parent draft.
- Avoid default full-session switching. If the user explicitly opens the child session, show a confirmation warning.
- Permission prompts must identify the requesting child: `docs-1 / docs-researcher wants bash ...`.
- Read-only/search agents should show a visible `read-only`/`web` badge and should not expose `edit`/`write` tools.
- Project-local agents should show `project-agent` and require trust/confirmation before execution.
- Large outputs are previewed and marked truncated; full content remains in the child session/tool detail, not dumped into the parent context.
- Dismiss is non-destructive; deleting child transcript/session files is out of MVP.
- If a child emits an RPC UI request while the inspector is open, temporarily surface that request above the transcript and mark the row `blocked` until answered.

### Edge cases

- Parallel runs: all children have stable ids; `/agents` can switch between them while they update live.
- Same agent name many times: ids, not names, are authoritative.
- Child exits while transcript is open: view stays open, status flips to terminal state, final summary/usage renders.
- Parent reload while children were running: reconstruct records; mark unreconnected processes `detached` or `cancelled` with the last known session file, not silently `running`.
- Tiny terminals: fall back to text list/select flow and one-pane transcript.
- Huge transcripts: render a virtualized/windowed view, default to tail for running agents, and cap per-tool previews.
- Child session file missing/unreadable: show a failed transcript placeholder with the stored session path and error.
- Child RPC `custom()` UI is unsupported; only dialog/fire-and-forget `extension_ui_request`s should be proxied in MVP.
- Permission request arrives for a dismissed/completed-looking agent: undismiss it, mark `blocked`, and surface the request.

### Map pointer

Switching UX decision: MVP should use a hybrid `subagent_status` widget plus `/agents` (`/agent` alias) overlay inspector for live child transcripts, steering, stop, and dismiss; avoid default full session switching, preserve parent draft/context, and store child session files as canonical transcripts with parent-side indexed snapshots.
