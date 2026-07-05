# Design permissions, persistence, and resume semantics

Type: research
Status: resolved
Blocked by: 01, 02, 03
Parent: ../map.md

## Question

How should the subagent extension handle permissions, source-labeled approvals, transcript persistence, reload/resume reconstruction, and follow-up/resume semantics?

## Requirements to honor

- Background subagent permission prompts must identify which subagent is asking.
- Project-local agents require trust or explicit confirmation.
- Read-only agents should be enforceably read-only by default.
- Completed subagent work should remain inspectable after reload/resume.
- Follow-up/resume should be honest about whether it resumes the same child context or spawns a continuation.

## Exit criteria

- Decide where child transcripts/state are stored.
- Decide how `subagent_status`/tool result details/session entries reconstruct state.
- Decide cancellation/cleanup semantics.
- Identify any Pi extension API gaps that block source-labeled approval prompts.
- Resolve this ticket with a decision pointer in `../map.md`.

## Answer

### Sources checked

- PRD and map, plus resolved tickets 01-04.
- Pi docs: `docs/rpc.md`, `docs/session-format.md`, `docs/sessions.md`, `docs/extensions.md`, `docs/tui.md`, `docs/json.md`, `docs/usage.md`, `docs/security.md`.
- Pi examples: `examples/extensions/subagent/`, `examples/extensions/permission-gate.ts`, `examples/extensions/protected-paths.ts`, `examples/extensions/project-trust.ts`, `examples/rpc-extension-ui.ts`.
- Local config: `agent/extensions/subagent-visualizer.ts`, `agent/settings.json`.

### Decision summary

Use persisted child RPC sessions, with parent-side records as an index and control plane:

- Child transcripts are canonical Pi session JSONL files, not blobs copied into the parent conversation.
- Parent state is a sequence of `custom` entries in the parent session, plus small private on-disk state for locks and immutable agent snapshots.
- Permission prompts from children are proxied through the parent RPC client and always prefixed with the requesting subagent id/name/source.
- Read-only is enforced by exact `--tools` allowlists and a child policy guard; `bash` is omitted for strict read-only agents.
- Running follow-up/steering is true same-context RPC control. Terminal resume is true only when it appends to the same child session file with the same agent/policy snapshot; otherwise it is a clearly labeled continuation.

### Transcript and state storage

Store subagent artifacts outside the project repo, under the user's Pi agent directory:

```text
~/.pi/agent/subagents/
  <parent-session-id-or-hash>/
    sessions/                     # child Pi --session-dir root
      --<child-cwd>--/<timestamp>_<uuid>.jsonl
    agents/
      <subagent-id>.md             # immutable agent prompt/frontmatter snapshot, 0600
    locks/
      <subagent-id>.json           # live pid/session lock, removed on clean exit
```

Rules:

1. The child transcript is the child Pi session JSONL file under the per-parent `sessions/` dir, created by launching child Pi with `--mode rpc --session-dir <.../sessions>` and a clear `--name`, for example `subagent docs-1 docs-researcher`.
2. The parent record stores the absolute `sessionFile`, `sessionId`, and state-root paths. `/agents` reads/parses that session file to render completed transcripts after reload.
3. The immutable agent snapshot is kept because Pi sessions do not store the system prompt/tool policy. True resume must use the same snapshot, not a possibly edited current agent file.
4. Dismiss hides records from the default panel only. It does not delete child sessions, prompt snapshots, or parent custom entries.
5. Deletion/retention pruning is out of MVP; add an explicit future `/agents prune` rather than deleting transcripts as part of cancel/dismiss.
6. Direct raw tool output is not duplicated into the parent session. Parent records keep capped previews/current activity only.

### Parent record format and reconstruction

Use `pi.appendEntry("subagent-record", snapshot)` for executor-owned state. This is a parent-session `custom` entry, so it survives reload and does not enter LLM context.

Minimum snapshot:

```ts
interface SubagentRecordSnapshot {
  schemaVersion: 1;
  seq: number;
  id: string;
  invocationId: string;
  parentToolCallId?: string;
  parentSessionFile?: string;
  parentSessionId?: string;
  name: string;
  agentName: string;
  agentSource: "user" | "project" | "builtin" | "unknown";
  agentFile?: string;
  agentSnapshotFile?: string;
  agentSnapshotHash?: string;
  task: string;
  cwd: string;
  status: "queued" | "running" | "blocked" | "succeeded" | "failed" | "cancelled" | "detached";
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  sessionFile?: string;
  sessionId?: string;
  lastChildEntryId?: string;
  currentActivity?: string;
  finalSummary?: string;
  error?: string;
  dismissed?: boolean;
  usage?: {
    turns?: number;
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    cost?: number;
    contextTokens?: number;
  };
  policy: {
    effectiveTools: string[];
    disallowedTools: string[];
    readOnly: boolean;
    networkAllowed: boolean;
    projectTrust: "trusted" | "one-time-approved" | "not-applicable";
  };
  pendingApproval?: {
    childRequestId: string;
    method: "select" | "confirm" | "input" | "editor";
    title: string;
    toolName?: string;
    requestedAt: number;
  };
  continuesFrom?: string;
  resumeMode?: "live-rpc" | "same-session" | "continuation";
}
```

Reconstruction algorithm on `session_start`, `session_tree`, and reload:

1. Reset in-memory records.
2. Scan `ctx.sessionManager.getBranch()` in append order, not all session entries, so parent branch navigation is respected.
3. Apply every parent `custom` entry with `customType === "subagent-record"`; latest `seq`/`updatedAt` wins for each id.
4. Also ingest foreground/legacy parent tool-result details from `toolName === "subagent"` if they contain record snapshots. This lets older blocking invocations reconstruct even if they predate `appendEntry`.
5. Keep existing `subagent_status` tool-result details as visualizer compatibility only; do not treat them as canonical executor records unless no executor record exists for that id.
6. For each record with `sessionFile`, parse the child session JSONL or use `SessionManager.open()`/RPC `get_entries` when a live client exists. Derive transcript rows from user, assistant, toolResult, custom, compaction, and session-info entries. Use `lastChildEntryId` as the incremental cursor for running children.
7. If a reconstructed record was terminal (`succeeded`, `failed`, `cancelled`), keep it terminal and inspectable.
8. If a reconstructed record was non-terminal but this extension instance has no live process handle, mark it `detached` with note `parent reloaded before child was reattached`. When feeding the current visualizer, map `detached` to `cancelled` plus that note unless the visualizer grows a native `detached` state.
9. Emit/update `subagent:status` rows from reconstructed records so the existing widget remains useful.

Important branch caveat: `pi.appendEntry()` appends to the current parent leaf. MVP should cancel live children before parent session replacement/tree navigation. If true detached background agents become P1, they need an external branch-independent supervisor or a Pi API that appends state to a specific parent entry.

### Project trust and effective tool policy

Project-local agents are prompt/code owned by the repo, so loading them must be gated separately from normal user agents:

1. User agents from `~/.pi/agent/agents/*.md` are always eligible.
2. Project agents from `.pi/agents/*.md` are eligible only when `ctx.isProjectTrusted()` is true, or after an explicit one-time confirmation naming the exact directory and requested agent files.
3. If project trust is not active and there is no UI, project agents are not loaded.
4. Child Pi gets `--approve` only when the parent session is project-trusted. Otherwise launch with `--no-approve` so child Pi does not load project-local settings/extensions/resources just because the parent manually approved one agent file.
5. Record the project trust mode in `policy.projectTrust`.

Effective tools are computed before spawning:

```text
effectiveTools = requestedTools
  ∩ parentActiveTools
  - frontmatter.disallowedTools/excludeTools
  - rolePolicyDeniedTools
```

Then validate every name against `pi.getAllTools()` and fail fast on unknown/unavailable tools. Pass the final exact list via child `--tools`.

Read-only/search agents:

- Strict read-only agents omit `edit`, `write`, and `bash`.
- Web tools (`web_search`, `fetch_content`, `get_search_content`) are opt-in only when named in `tools`.
- Arbitrary third-party tools are denied for read-only presets unless explicitly classified as safe by config.
- `reviewer` may allow `bash`, but only with a child policy guard for known read-only git commands; this is not as strong as omitting bash and must be labeled as weaker.

### Source-labeled approvals

Pi has no first-party approval overlay, so the subagent extension should own the approval path.

Implementation strategy:

1. Launch children in RPC mode and proxy every child `extension_ui_request` through the parent extension.
2. Parent already knows which process emitted the request, so it prefixes every dialog title/message with a source label:

   ```text
   Subagent docs-1 / docs-researcher (project-agent, read-only) requests:
   bash: git diff --stat
   ```

3. Mark the record `blocked`, store `pendingApproval`, append a `subagent-record` snapshot, and emit `subagent:status` with a note such as `needs approval: bash git diff --stat`.
4. Show the parent TUI prompt with `ctx.ui.confirm/select/input/editor`. If `/agents` is open, show the same pending request in the transcript header.
5. Send the user's answer back to the child as `extension_ui_response` with the original child request id.
6. Record the outcome as an approval transcript event. Do not store sensitive `input`/`editor` response values in parent records; store only `allowed`, `denied`, or `cancelled` plus metadata.
7. If parent has no UI, deny/cancel by default and tell the child `cancelled: true` or `confirmed: false`.
8. If the child is cancelled while blocked, first answer all pending child UI requests as cancelled/denied, then send RPC `abort`.

For consistent tool-specific approvals, load a small child policy extension with every child. It handles child `tool_call` events, enforces hard denies, and asks for approval only for configured `ask` cases. Generic third-party child extension prompts can still be source-labeled by the parent, but precise tool metadata is only guaranteed for prompts produced by this child policy extension.

### Pi API gaps and limitations

Not blockers for an MVP, but they shape the design:

- There is no core Pi permission/approval primitive comparable to Codex/Claude source-labeled approvals. We must implement approvals as extension UI requests.
- `extension_ui_request` is generic and does not include semantic fields like source extension, toolCallId, tool name, risk level, or approval policy. Parent can label the child source, but child policy must include tool details in the prompt.
- There is no parent-side hook for a child process's `tool_call` events unless the child is launched with an extension that emits/prompts through RPC.
- RPC child `ctx.ui.custom()` is unsupported; child interactive UI must use dialog/fire-and-forget methods only and parent must render any rich UI itself.
- There is no documented CLI `--parent-session` flag; parent linkage either lives in the parent record or requires an initial RPC `new_session { parentSession }` round trip before the first prompt.
- There is no built-in OS sandbox or mechanical read-only shell mode. Exact `--tools` allowlists are strong for absent tools; `bash` read-only is only a best-effort policy guard.
- There is no reattach API for an already-running orphaned RPC child after parent reload. MVP should cancel on controlled shutdown and mark uncontrolled survivors `detached`.
- `pi.appendEntry()` appends to the current parent branch only; branch-safe background status updates need extra design.

### Cancellation and cleanup semantics

Stop paths: user `/agent stop`, parent tool abort signal, timeout, reload/session shutdown, or process failure.

Cancellation sequence:

1. Set `currentActivity: "cancelling"`, append a parent `subagent-record` snapshot, and update the visualizer.
2. If the child is blocked on UI, respond to each pending `extension_ui_request` with denial/cancellation.
3. Send RPC `abort` to the child and wait a short grace period.
4. If the child is still alive, send `SIGTERM` to the child process/process group.
5. If still alive after another grace period, send `SIGKILL`.
6. Close stdin/stdout listeners, clear timers, remove the live lock file, and keep the child session file.
7. If cancellation was requested by the user/parent/reload, final status is `cancelled` even if the child exits non-zero during shutdown.
8. If the child exits non-zero without a cancellation request, final status is `failed` with stderr/error preview.
9. On controlled `session_shutdown` (`reload`, `new`, `resume`, `fork`, `quit`), cancel all live children. Do not leave background children orphaned until a real supervisor/reattach design exists.

Dismiss is non-destructive. It never kills a running child; active children must be stopped first.

### Follow-up, true resume, and continuation semantics

Use three explicit terms in UI and records:

1. **Steer** — running child, same RPC process/session. Send RPC `steer` or `prompt` with `streamingBehavior: "steer"`. Delivered after current tool calls before the next LLM call.
2. **Follow-up** — running child, same RPC process/session, but queued for after the child finishes current work. Send RPC `follow_up` or `prompt` with `streamingBehavior: "followUp"`.
3. **Resume** — terminal/idle child, same child session file and same model/tool/agent snapshot. This may use a new OS process, but it must start with `--mode rpc --session <sessionFile>` and the original agent snapshot/effective tools, then append the user's new prompt to that same JSONL session. This is true same-context resume.

True resume is allowed only when all are true:

- `sessionFile` exists and parses as a Pi session.
- No live lock indicates another child process is writing that session.
- The immutable agent snapshot and effective tool policy are available.
- The requested model/thinking/tool policy is compatible with the original record, or the user explicitly accepts the policy change as a new continuation instead.
- The record is not `detached` with uncertain liveness, unless the user first confirms cleanup of the stale lock/process.

Otherwise offer **Start continuation**:

- Create a new subagent id/session.
- Set `continuesFrom` to the old id/session file.
- Seed the new task with a concise summary/excerpts of the old transcript.
- Label it clearly: `continuation from docs-1; not the same child context`.

For legacy JSON/`--no-session` children, missing session files, changed/missing agent snapshots, or deliberate role/tool changes such as `resume docs-researcher as worker`, only continuation is honest.

### Risk register

- **Sensitive transcript persistence** — child sessions can contain secrets/tool output. Store under `~/.pi/agent`, use private file modes, avoid parent raw-output duplication, and document retention.
- **False read-only confidence** — `bash` and unknown extension tools can mutate state. Strict read-only presets should omit them; guarded bash is weaker and must be labeled.
- **Approval spoofing/confusion** — child prompts are generic UI requests. Parent must add source labels, and child policy should include tool metadata in every approval prompt.
- **Orphaned processes/two writers** — parent crash can leave unknown child state. Use lock files, cancel on controlled shutdown, and refuse true resume while liveness is uncertain.
- **Branch drift** — background updates appended after parent branch changes may reconstruct on the wrong branch. Keep MVP foreground/cancel-on-tree, or add a supervisor/branch-safe API later.
- **Project-agent prompt injection** — project agents are repo-controlled. Require trust or explicit one-time confirmation and record source/hash.
- **Web/search prompt injection** — network output remains untrusted; keep web tools opt-in and raw output in child transcript.
- **Storage leaks/orphans** — child state under `~/.pi/agent/subagents` can outlive parent session deletion. Add explicit pruning later.

## Map pointer

Permissions/persistence decision: store each child as a persisted RPC Pi session under a private per-parent subagent state dir, index it with parent `subagent-record` custom entries, proxy child RPC UI requests with source labels, cancel live children cleanly on shutdown, and distinguish live/same-session resume from summary-seeded continuations.
