# Design multiplexer sidebar for subagents

Type: prototype
Status: resolved
Blocked by: 08
Parent: ../map.md

## Question

What should the Herdr/tmux sidebar show and how should users interact with subagents from it?

## Requirements

- The sidebar is now the primary P0 visibility surface, replacing the earlier overlay-first design.
- It should list running/completed/blocked/failed subagents and expose focus/attach/stop/follow-up affordances.
- It must work with Herdr and degrade to tmux.
- It must preserve parent Pi context/draft.

## Exit criteria

- Define sidebar layout, keyboard/command controls, and pane/thread focus behavior.
- Define how subagent status reaches the sidebar.
- Define differences between Herdr and tmux modes.
- Provide a `## Map pointer` one-liner.

## Answer

### Decision

Make the **multiplexer sidebar the P0 visibility and switching surface**. This supersedes the overlay-first default from issue 03: `/agents` can still exist as a details/modal fallback, but the normal experience is now:

```text
┌──────────────────────────────────────── parent Pi ───────────────────────────────────────┐┌─ Subagents ───────────────┐
│ main conversation, tool output, and unchanged editor draft                                ││ 2 running · 1 blocked      │
│                                                                                          ││ ● docs-1  42% web_search…  │
│                                                                                          ││ ◆ work-2  approval: bash   │
│                                                                                          ││ ✓ scout-3 final ready      │
└──────────────────────────────────────────────────────────────────────────────────────────┘└───────────────────────────┘
```

The sidebar is always visible when the wrapper can launch Pi under Herdr or tmux. It lists every active/recent subagent and is the launch point for focus, attach/watch, stop, dismiss, and follow-up. Switching to a child should be a **multiplexer focus change or transcript pane attach**, not a Pi session switch; the parent Pi pane, context, and typed-but-unsent draft stay intact.

### Sidebar layout

Default width: 34-44 columns, right side. Collapse to a one-line footer/status chip below ~100 columns, and use `/agents`/`Ctrl+G` to open a full-width list.

Header:

```text
Subagents  2 running · 1 blocked · 3 done
↑↓ select · enter attach · m msg · s stop · ? help
```

Rows:

```text
› ● running docs-1  Docs Researcher
    42% ███░░░░  1m12s  web · read-only
    web_search "Herdr pane report-agent..."
  ◆ blocked work-2 Worker
    --          0m38s  writes · needs approval
    bash "npm test"
  ✓ done scout-3 Code Scout
    100% ███████ 2m03s final ready
  ✕ failed rev-4 Reviewer
    --          0m54s grep failed: no matches
```

Required row fields:

- selection marker, status icon, and status text; never color-only;
- stable id (`docs-1`) and agent display name;
- progress when known; otherwise `--`, not fake precision;
- elapsed/duration;
- badges: `web`, `read-only`, `writes`, `project-agent`, `blocked`, `detached`, `queued:N`;
- current activity preview: latest assistant text, tool call, permission request, queued follow-up, final summary, or error.

Sort order: `blocked`, `running`, `queued`, `failed`, `cancelled`, `succeeded`, then most recently updated first inside each bucket. Show terminal rows until dismissed; dismissed rows remain available through `/agents all`.

### Sidebar interactions

Keyboard in sidebar focus:

- `↑/↓` or `j/k` — move selection.
- `Enter` — attach/watch selected subagent transcript pane.
- `f` — focus the live subagent pane without taking over input mode.
- `a` — attach/take over the subagent pane for manual inspection; show warning first if this bypasses protocol controls.
- `m` — send message; default `steer` for running/blocked, `follow_up` for queued/running when explicitly chosen, `continuation` for terminal agents.
- `s` — stop selected running/blocked/queued subagent, after confirmation.
- `d` — dismiss terminal subagent; non-destructive.
- `t` — toggle tail/follow for attached transcript.
- `/` — filter by id/name/status/task/tool text.
- `?` — help.
- `Esc` — return focus to parent Pi pane; never stops children.

Parent Pi commands mirror the keys and work in degraded modes:

```text
/agents                         focus/open sidebar list
/agent <id>                     attach/watch transcript
/agent <id> focus               focus child pane
/agent <id> attach              take over child pane after confirmation
/agent <id> msg [--steer|--follow-up] <text>
/agent <id> stop                confirm, abort, then terminate if needed
/agent <id> dismiss             hide terminal row only
/agents all                     include dismissed/old records
/agents sidebar show|hide|toggle
```

Follow-up flow:

1. `m` opens a sidebar-local input/editor titled `Message to docs-1`.
2. Running/blocked default: `steer` via child RPC `steer`/`prompt(streamingBehavior:"steer")`.
3. User can choose `after current run`, which sends RPC `follow_up`/`prompt(streamingBehavior:"followUp")`.
4. Terminal agents show `Start continuation with transcript summary?`; do not claim live resume unless the child RPC session can actually resume the same state.
5. Sent messages appear in the child transcript and sidebar activity, but only a tiny notice is appended to the parent session.

Stop flow:

1. Confirm with id/name/current tool: `Stop work-2? Current: bash npm test`.
2. Send RPC `abort` first.
3. If still live after a short grace period, send pane process `SIGTERM`, then `SIGKILL`/pane close.
4. Mark `cancelled`, preserve session/transcript, and keep the row visible until dismissed.

### Pane/thread focus behavior

- The parent Pi pane is authoritative for the main conversation and editor draft.
- The child transcript/runner pane is authoritative for watching child work.
- `focus` moves terminal focus to the child pane but keeps protocol ownership with the parent extension/sidebar.
- `attach` is a stronger action: user may type directly into the child runner pane. Use it only for inspection/manual rescue, and warn that normal follow-up should use `m` so state and transcript events remain structured.
- Returning to parent uses Herdr/tmux pane focus, not Pi `/resume` or session switching.
- On narrow terminals, attach opens the selected child pane full-width/zoomed; `Esc`/documented multiplexer key returns to parent/sidebar.

### Event and status data model

Canonical durable storage remains the child Pi session JSONL plus a parent-side subagent state directory. The sidebar, parent Pi widget, and Herdr/tmux integrations consume the same reduced records.

```ts
type SubagentStatus =
  | "queued"
  | "running"
  | "blocked"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "detached";

type MuxKind = "herdr" | "tmux" | "in_tui" | "none";

interface SubagentRecord {
  id: string;
  name: string;
  role?: string;
  task: string;
  status: SubagentStatus;
  progress?: number;
  currentActivity?: string;
  badges: Array<"web" | "read-only" | "writes" | "project-agent" | "blocked" | "detached">;
  agentSource: "user" | "project" | "builtin" | "unknown";
  cwd: string;
  model?: string;
  thinking?: string;
  tools?: string[];
  networkAllowed?: boolean;
  parentSessionId: string;
  parentSessionFile?: string;
  childSessionId?: string;
  childSessionFile?: string;
  stateDir: string;
  mux: {
    kind: MuxKind;
    session?: string;
    workspaceId?: string;
    tabId?: string;
    paneId?: string;
    agentTarget?: string;      // Herdr agent target or tmux pane/window target
    sidebarPaneId?: string;
  };
  queue?: { steering: number; followUp: number };
  usage?: {
    turns?: number;
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    cost?: number;
    contextTokens?: number;
  };
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  finalSummary?: string;
  error?: string;
  dismissed?: boolean;
  seq: number;
}

type TranscriptEvent =
  | { kind: "lifecycle"; id: string; status: SubagentStatus; timestamp: number; note?: string; seq: number }
  | { kind: "user"; id: string; mode: "task" | "steer" | "follow_up" | "continuation"; text: string; timestamp: number; seq: number }
  | { kind: "assistant"; id: string; text: string; isFinal: boolean; timestamp: number; stopReason?: string; seq: number }
  | { kind: "tool"; id: string; toolCallId: string; name: string; argsPreview: string; status: "running" | "succeeded" | "failed"; outputPreview?: string; timestamp: number; seq: number }
  | { kind: "permission"; id: string; requestId: string; title: string; toolName?: string; status: "waiting" | "allowed" | "denied"; timestamp: number; seq: number }
  | { kind: "queue"; id: string; steering: number; followUp: number; timestamp: number; seq: number }
  | { kind: "usage"; id: string; usage: NonNullable<SubagentRecord["usage"]>; timestamp: number; seq: number }
  | { kind: "error"; id: string; source: "agent" | "tool" | "runner" | "mux" | "extension"; message: string; timestamp: number; seq: number };

type ControlCommand =
  | { type: "focus"; id: string }
  | { type: "attach"; id: string; takeover?: boolean }
  | { type: "message"; id: string; mode: "steer" | "follow_up" | "continuation"; text: string }
  | { type: "stop"; id: string; forceAfterMs?: number }
  | { type: "dismiss"; id: string }
  | { type: "tail"; id: string; enabled: boolean }
  | { type: "resizeSidebar"; columns: number }
  | { type: "refresh" };
```

Status propagation pipeline:

1. A subagent runner starts a child `pi --mode rpc` session and translates RPC events (`agent_start/end`, `message_update/end`, `tool_execution_*`, `queue_update`, `extension_ui_request`, `extension_error`) into `TranscriptEvent`s.
2. The runner writes append-only `events.jsonl` and latest `record.json` under `~/.pi/agent/subagents/<parent-session-id>/<subagent-id>/` with `0600` file permissions.
3. The parent extension appends compact `subagent-record` custom entries to the parent Pi session for reload reconstruction and emits `subagent:status` so the existing visualizer/status line remains compatible.
4. The sidebar renderer watches the state dir or subscribes over a local Unix socket and reduces records by `seq`.
5. In Herdr mode, each status update also calls Herdr reporting commands so Herdr's own agent metadata stays synchronized.

### Herdr mode

Use Herdr when `herdr` is available or the current terminal is already inside a Herdr session. Relevant inspected commands:

- `herdr agent start <name> --cwd PATH --split right|down --env KEY=VALUE --focus|--no-focus -- <argv...>`
- `herdr agent list|get|read|send|focus|wait|attach|rename|explain`
- `herdr pane split/read/focus/resize/zoom/close/run/send-text/send-keys`
- `herdr pane report-agent ... --state idle|working|blocked|unknown --message ... --agent-session-id ... --agent-session-path ...`
- `herdr pane report-agent-session ...`
- `herdr pane report-metadata ... --title ... --display-agent ... --custom-status ...`

Recommended behavior:

- Wrapper launches/attaches to a named Herdr session for the project, then starts parent Pi in the main pane.
- Create or reuse a right sidebar pane labelled `Pi Subagents` running the sidebar renderer.
- Start each subagent as a Herdr agent/pane using the common runner. Label it with the stable id and agent name.
- On every status update, call `herdr pane report-agent` with mapped states:
  - `queued` -> `unknown` + custom status `queued`
  - `running` -> `working`
  - `blocked` -> `blocked`
  - `succeeded` -> `idle` + custom status `done`
  - `failed` -> `idle` + custom status `failed`
  - `cancelled` -> `idle` + custom status `cancelled`
  - `detached` -> `unknown` + custom status `detached`
- Include `--agent-session-id` and `--agent-session-path` when known so Herdr `agent explain` can point to the Pi transcript.
- `focus` uses `herdr agent focus <target>` or `herdr pane focus`.
- `attach` uses `herdr agent attach <target>`; `--takeover` only after confirmation.
- `stop` uses RPC abort first, then `herdr pane close`/process termination if needed.
- `follow-up` should use the runner control socket/RPC, not raw `herdr agent send`, unless the user explicitly chose manual attach.

Herdr should be the richest mode: native agent metadata, readable panes, easy attach/focus, and future Herdr-specific notifications without changing the Pi sidebar contract.

### tmux fallback mode

Use tmux when Herdr is not available but `tmux` is. tmux has no semantic agent registry, so Pi owns the sidebar renderer and treats panes/windows as dumb terminals.

Recommended behavior:

- Wrapper creates/attaches a named project session, e.g. `tmux new-session -A -s pi-<project-slug>`.
- Main pane runs parent Pi.
- Right split runs `pi-subagent-sidebar --state <state-dir>`; keep it around 34-44 columns with `tmux resize-pane`.
- Subagents run in either hidden/right-side panes or a `subagents` window using the same runner.
- Store tmux targets in `record.mux.agentTarget`, e.g. `%12` pane id or `session:window.pane`.
- `focus` uses `tmux select-pane -t <target>` / `select-window`.
- `attach` uses `tmux select-pane` plus optional `resize-pane -Z` for zoom.
- `stop` uses RPC abort first, then `tmux send-keys -t <target> C-c`, then `tmux kill-pane -t <target>` if needed.
- `read`/manual diagnostics can use `tmux capture-pane -p -t <target>` but canonical transcript remains the child session JSONL.
- Pane titles/status should be updated with id/status when possible, but all real status comes from the shared state dir.

If tmux is already active, reuse the current session/window and only add the sidebar split if it does not exist. Do not nest tmux unless the user explicitly asks.

### Fallback/degraded modes

- **Neither Herdr nor tmux:** run Pi normally, show a warning once, and fall back to the issue-03 in-TUI status widget plus `/agents` overlay inspector. Focus/attach become transcript-overlay actions, not pane switching.
- **Non-TUI/RPC/print parent:** no live sidebar; expose `/agent ...` commands through RPC/text and persist records for later inspection.
- **Narrow terminal:** collapse sidebar to a footer chip and use `/agents` for full-screen list/details.
- **Sidebar process crashes:** parent extension keeps subagents running, shows a warning, and can restart the sidebar from state.
- **Herdr/tmux server disconnect:** mark active children `detached` unless their runner heartbeat reconnects; never silently show stale `running`.
- **Child session file missing:** row becomes `failed`/`detached` with the missing path and recovery hint.

### Accessibility and safety notes

- Every status has text plus icon; color is supplemental.
- All controls are keyboard accessible and mirrored as slash commands.
- `Esc` only changes focus/closes UI; it must not stop a child.
- Stop, attach-takeover, kill-pane, and transcript deletion require confirmation. Dismiss is non-destructive.
- Permission prompts from child RPC sessions must be labelled with subagent id/name and surfaced as `blocked` in the sidebar.
- Read-only/search agents show `read-only`/`web` badges and must not receive write/edit tools by default.
- Project-local agents show `project-agent` and require trust/confirmation before execution.
- Large tool outputs are previewed with truncation markers; full output stays in the child transcript/session, not the parent context.
- State files/transcripts should be private (`0600` files under the user's Pi agent dir) and should not be committed.
- Manual raw typing into child panes is an escape hatch; structured messages should use `m`/`/agent msg` so safety, queues, and transcripts remain coherent.

## Map pointer

Sidebar UX decision: make Herdr/tmux the primary P0 surface by launching Pi in a multiplexer-backed workspace with a persistent right sidebar; use Herdr agent/pane metadata when available, a tmux renderer pane as fallback, and the old `/agents` overlay only as a degraded/details mode while preserving parent Pi draft/context.
