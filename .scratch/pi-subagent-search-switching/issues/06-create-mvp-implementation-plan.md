# Create the MVP implementation plan

Type: prototype
Status: resolved
Blocked by: 03, 04, 05
Parent: ../map.md

## Question

What tiny-commit implementation plan should build the first local MVP of search-capable, switchable Pi subagents?

## Exit criteria

- Produce a commit-by-commit plan that starts from the existing Pi example or a justified alternative.
- Include file paths in `pi-configs`.
- Include tests/manual verification steps for each milestone.
- Include rollback points and risk gates.
- Update `../PRD.md` if decisions change its scope.
- Resolve this ticket with a decision pointer in `../map.md`.

## Answer

### Decision

Build the local MVP as a **global Pi config extension** in this repo, not as an upstream/package deliverable yet. Start from Pi's `examples/extensions/subagent/` shapes, but do not stop at the example's JSON one-shot architecture: use Phase 1 JSON only as a scaffold/fallback, then make Phase 2 RPC sessions the default so `/agents` can inspect, steer, and stop live children.

No PRD scope correction is needed.

### Commit-by-commit implementation plan

#### Phase 0 — scaffold and installable local resources

**Commit 0.1 — Track Pi agent definitions in config sync/install scripts**

Files:

- `install.sh`
- `sync-from-pi.sh`
- `README.md`
- `.gitignore`

Changes:

- Add `agents` to the resource directories copied by `install.sh` and `sync-from-pi.sh`; current scripts copy `extensions skills prompts themes` but would skip `agent/agents/*.md`.
- Document `agent/agents/` in `README.md` as the user-level subagent definition source.
- Add `node_modules/`, `coverage/`, and any future test output paths to `.gitignore` only if the test harness is added in commit 0.2.

Verification:

- `tmp="$(mktemp -d)"; PI_CODING_AGENT_DIR="$tmp" ./install.sh; find "$tmp" -maxdepth 2 -type d | sort`
- Confirm `agents` is copied once it exists and no secret/session directories are copied.

Rollback point:

- Revert this commit if agent definitions should not be managed by this repo.

**Commit 0.2 — Add a local dev/test harness for pure extension modules**

Files:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `.gitignore`
- `tests/subagent/README.md`

Changes:

- Add minimal dev scripts, e.g. `npm test`, `npm run typecheck`, and `npm run test:subagent`.
- Keep runtime behavior unchanged; Pi still loads `.ts` extensions directly with jiti.
- Keep tests outside `agent/extensions/` so install/sync does not copy tests into `~/.pi/agent/extensions/`.

Verification:

- `npm install`
- `npm test` should pass with only placeholder/no-op tests or an empty subagent test suite.
- `npm run typecheck` should not require committing generated build output.

Rollback point:

- If a Node test harness feels too heavy for a config repo, drop this commit and rely on manual Pi verification plus `pi -e` smoke tests.

**Commit 0.3 — Create the subagent extension module skeleton**

Files:

- `agent/extensions/subagent/index.ts`
- `agent/extensions/subagent/types.ts`
- `agent/extensions/subagent/pi-invocation.ts`
- `agent/extensions/subagent/jsonl.ts`
- `tests/subagent/jsonl.test.ts`
- `tests/subagent/pi-invocation.test.ts`

Changes:

- Add an auto-discovered directory extension at `agent/extensions/subagent/index.ts`.
- Add shared types for `SubagentRecord`, statuses, agent configs, transcript events, tool policies, invocation modes, and transport choice.
- Extract a strict LF JSONL parser for child stdout. Follow `docs/rpc.md`: split on `\n`, strip optional trailing `\r`, do not use Node `readline`.
- Extract `getPiInvocation()` from the Pi example into `pi-invocation.ts` so child processes use the current runtime when possible and fall back to `pi`.
- Register only a harmless `/agents` placeholder command for now, e.g. "subagent MVP installed; executor not enabled yet".

Verification:

- `npm test -- tests/subagent/jsonl.test.ts tests/subagent/pi-invocation.test.ts`
- Manual smoke: `pi --no-extensions -e agent/extensions/subagent/index.ts` then run `/agents` and confirm the placeholder command loads.

Risk gate:

- Do not register the model-callable `subagent` tool until the skeleton loads cleanly through Pi.

**Commit 0.4 — Add default local agents with explicit tool allowlists**

Files:

- `agent/agents/docs-researcher.md`
- `agent/agents/code-explorer.md`
- `agent/agents/reviewer.md`
- `agent/agents/worker.md`
- `README.md`

Changes:

- Add the four default agents decided in ticket 04.
- Use exact Pi tool names: `web_search`, `fetch_content`, `get_search_content`, `read`, `grep`, `find`, `ls`, `bash`, `edit`, `write`.
- Make `docs-researcher` and `code-explorer` strict read-only with no `bash`, `edit`, or `write`.
- Make `worker` local-code-only by default: no web tools.
- Add citation and prompt-injection guidance to `docs-researcher`.

Verification:

- `tmp="$(mktemp -d)"; PI_CODING_AGENT_DIR="$tmp" ./install.sh; ls "$tmp/agents"`
- Manually inspect that every shipped agent has `tools:` and `disallowedTools:` frontmatter.

Risk gate:

- Do not enable web tools unless `agent/settings.json` still includes `npm:pi-web-access` and tool validation can fail fast if those tools are unavailable.

**Commit 0.5 — Implement agent discovery, frontmatter parsing, and effective tool policy**

Files:

- `agent/extensions/subagent/agents.ts`
- `agent/extensions/subagent/tool-policy.ts`
- `agent/extensions/subagent/types.ts`
- `tests/subagent/agents.test.ts`
- `tests/subagent/tool-policy.test.ts`

Changes:

- Adapt Pi example `agents.ts` to parse the MVP frontmatter: `name`, `description`, `tools`, `disallowedTools`, `excludeTools`, `model`, `thinking`, `maxTurns`, `background`, `cwd`, `color`.
- Discover user agents from `~/.pi/agent/agents/*.md` and project agents from nearest `.pi/agents/*.md` only when the requested scope and trust rules allow it.
- Compute `effectiveTools = requestedTools ∩ parentActiveTools - disallowedTools - rolePolicyDeniedTools`.
- Validate unknown/unavailable tools before child spawn and return a clear error, especially for missing web tools.
- Record `networkAllowed` and `readOnly` on the planned `SubagentRecord`.

Verification:

- `npm test -- tests/subagent/agents.test.ts tests/subagent/tool-policy.test.ts`
- Manual smoke with temporary `PI_CODING_AGENT_DIR` containing only the four default agents.

Risk gate:

- Strict read-only agents must omit `edit`, `write`, and `bash` mechanically, not only by prompt.

#### Phase 1 — JSON/prototype executor and status integration

Phase 1 is deliberately a scaffold/fallback, not the final P0 UX. It proves agent discovery, tool allowlists, subprocess spawning, event parsing, status rows, and concise parent results before RPC control is added.

**Commit 1.1 — Add JSON one-shot runner adapted from Pi's example**

Files:

- `agent/extensions/subagent/json-runner.ts`
- `agent/extensions/subagent/render.ts`
- `agent/extensions/subagent/index.ts`
- `agent/extensions/subagent/types.ts`
- `tests/subagent/json-runner.test.ts`
- `tests/fixtures/subagent-json-child.mjs`

Changes:

- Port the example's `pi --mode json -p --no-session` subprocess flow behind `transport: "json"`.
- Support single, parallel, and chain schemas: `{ agent, task }`, `{ tasks: [...] }`, `{ chain: [...] }`.
- Keep the example's concurrency guard: max 8 parallel tasks, 4 concurrent for local MVP.
- Parse `message_end`, `tool_execution_*`, `agent_end`, and error events into in-memory transcript previews.
- Preserve the example's result cap behavior so parent-visible output stays concise.

Verification:

- Unit-test the runner against `tests/fixtures/subagent-json-child.mjs`, not a real LLM.
- Manual smoke only if credentials are available: load the extension with `pi -e agent/extensions/subagent/index.ts`, ask a `code-explorer` subagent to inspect `README.md`, and confirm a concise final answer.

Rollback point:

- If JSON mode destabilizes the extension, revert only Phase 1 commits; Phase 0 discovery/default agents remain useful.

**Commit 1.2 — Register the `subagent` tool with JSON transport and status events**

Files:

- `agent/extensions/subagent/index.ts`
- `agent/extensions/subagent/status.ts`
- `agent/extensions/subagent/render.ts`
- `agent/extensions/subagent-visualizer.ts`
- `tests/subagent/status.test.ts`

Changes:

- Register the model-callable `subagent` tool.
- Add tool params for `agent`, `task`, `tasks`, `chain`, `agentScope`, `confirmProjectAgents`, `cwd`, and temporary `transport: "json" | "rpc"` with JSON as the only implemented option for this phase.
- Emit `pi.events.emit("subagent:status", ...)` for queued/running/blocked/succeeded/failed/cancelled.
- Update `subagent-visualizer.ts` copy only if needed for `/agents` hint text and compatibility with executor-generated ids.
- Keep `/subagents` behavior intact.

Verification:

- `npm test -- tests/subagent/status.test.ts`
- Manual: run two JSON subagents in parallel; confirm the existing visualizer shows running and terminal rows.
- Manual: abort a parent `subagent` tool call and confirm child subprocesses receive SIGTERM then SIGKILL fallback.

Risk gate:

- Parent result must not include raw search/fetch output beyond caps; full details stay in tool details/transcript previews.

**Commit 1.3 — Add a read-only `/agents list` prototype over JSON run records**

Files:

- `agent/extensions/subagent/records.ts`
- `agent/extensions/subagent/commands.ts`
- `agent/extensions/subagent/index.ts`
- `tests/subagent/records.test.ts`

Changes:

- Store in-memory records for JSON runs with stable ids, status, task, tool policy, usage, final summary, and preview transcript rows.
- Add `/agents` and `/agent` aliases that can list current-session JSON prototype records and show a selected record's preview via `ctx.ui.select`/`ctx.ui.notify` fallback.
- Mark the UI as "prototype: no live steering in JSON transport".

Verification:

- `npm test -- tests/subagent/records.test.ts`
- Manual: after a JSON subagent finishes, run `/agents` and inspect the preview.

Risk gate:

- Do not call Phase 1 complete for the PRD. It lacks live RPC steering and persisted child sessions.

#### Phase 2 — RPC live control, persistence, and switchable transcript UX

Phase 2 is the MVP completion phase. RPC becomes the default transport once the risk gates pass; JSON remains as an explicit fallback/debug option.

**Commit 2.1 — Add a typed RPC child client and process lifecycle manager**

Files:

- `agent/extensions/subagent/rpc-client.ts`
- `agent/extensions/subagent/process.ts`
- `agent/extensions/subagent/types.ts`
- `tests/subagent/rpc-client.test.ts`
- `tests/fixtures/subagent-rpc-child.mjs`

Changes:

- Spawn `pi --mode rpc` children with strict JSONL stdout parsing and JSONL stdin writes.
- Correlate command responses by `id`.
- Expose `prompt`, `steer`, `follow_up`, `abort`, `get_state`, `get_entries`, `get_last_assistant_text`, `get_session_stats`, and `set_session_name` helpers.
- Collect stderr and child exit status.
- Implement graceful shutdown helpers: RPC `abort`, SIGTERM, SIGKILL after timeout.

Verification:

- `npm test -- tests/subagent/rpc-client.test.ts`
- The mock fixture should cover partial chunks, CRLF, malformed lines, command failure, and child exit.

Risk gate:

- Do not point this client at real `pi` until the mock proves response/event demultiplexing and cancellation.

**Commit 2.2 — Add private state roots, agent snapshots, locks, and parent custom records**

Files:

- `agent/extensions/subagent/state-root.ts`
- `agent/extensions/subagent/records.ts`
- `agent/extensions/subagent/agent-snapshot.ts`
- `agent/extensions/subagent/index.ts`
- `tests/subagent/state-root.test.ts`
- `tests/subagent/records.test.ts`

Changes:

- Store child artifacts under `~/.pi/agent/subagents/<parent-session-id-or-hash>/`:
  - `sessions/`
  - `agents/<subagent-id>.md`
  - `locks/<subagent-id>.json`
- Snapshot the exact agent markdown/frontmatter at launch with private file modes.
- Append parent-session `custom` entries via `pi.appendEntry("subagent-record", snapshot)` on meaningful state changes.
- Reconstruct records from parent `custom` entries on `session_start` and `session_tree`.
- Re-emit reconstructed rows to `subagent-visualizer.ts`.

Verification:

- `npm test -- tests/subagent/state-root.test.ts tests/subagent/records.test.ts`
- Manual: run one child, `/reload`, then `/agents` should still list the completed record and session path.

Rollback point:

- If persistence leaks too much data into the parent session, revert this commit before enabling RPC by default. Parent custom records must store caps/previews only.

**Commit 2.3 — Implement the default RPC runner for single/parallel/chain**

Files:

- `agent/extensions/subagent/rpc-runner.ts`
- `agent/extensions/subagent/index.ts`
- `agent/extensions/subagent/status.ts`
- `agent/extensions/subagent/render.ts`
- `tests/subagent/rpc-runner.test.ts`

Changes:

- Launch each child with `--mode rpc --session-dir <stateRoot>/sessions --name "subagent <id> <agent>"`.
- Pass `--model`, `--thinking`, `--tools <effectiveTools>`, `--approve` only when parent project trust is active, and `--no-approve` otherwise.
- Use the immutable agent snapshot through `--append-system-prompt`.
- Send the delegated task via RPC `prompt`.
- Update `SubagentRecord` from RPC events and stats.
- Return concise summaries to the parent model; keep full transcript available through `/agents`.
- Preserve JSON fallback behind explicit `transport: "json"` for debugging.

Verification:

- `npm test -- tests/subagent/rpc-runner.test.ts`
- Manual: one `code-explorer` RPC child reads `README.md`; confirm child session file exists and parent result is concise.
- Manual: two parallel children stream status rows without dumping full output into the parent conversation.

Risk gate:

- Verify Pi accepts `/agents` or another extension command while a parent `subagent` tool call is still running. If commands cannot run during tool execution, change the tool contract before proceeding: add `wait: false` background spawning as the P0 path and a separate wait/collect command later.

**Commit 2.4 — Proxy child extension UI requests with source labels and add child policy guard**

Files:

- `agent/extensions/subagent/child-policy.ts`
- `agent/extensions/subagent/ui-proxy.ts`
- `agent/extensions/subagent/rpc-runner.ts`
- `agent/extensions/subagent/types.ts`
- `tests/subagent/ui-proxy.test.ts`
- `tests/subagent/child-policy.test.ts`

Changes:

- Load `child-policy.ts` into every child with `-e <path>`.
- Pass policy via env or private policy file: subagent id/name, read-only flag, effective tools, bash policy, network flag.
- In the child policy extension, hard-deny impossible/disallowed tool use and ask only for configured risky cases.
- In the parent, proxy every child `extension_ui_request` through `ctx.ui.*` with a clear prefix: `Subagent <id> / <agent> requests ...`.
- Mark the record `blocked` while waiting; store only non-sensitive approval metadata in parent records.

Verification:

- `npm test -- tests/subagent/ui-proxy.test.ts tests/subagent/child-policy.test.ts`
- Manual: use a `reviewer` task that attempts a non-read-only bash command; confirm the prompt is source-labeled or blocked.
- Manual: no UI/noninteractive child requests are denied/cancelled by default.

Risk gate:

- Do not allow project-local agents or reviewer bash broadly until source-labeled prompts and hard-denies are proven.

**Commit 2.5 — Build transcript reducer and child session parser**

Files:

- `agent/extensions/subagent/transcript.ts`
- `agent/extensions/subagent/session-parser.ts`
- `agent/extensions/subagent/types.ts`
- `tests/subagent/transcript.test.ts`
- `tests/fixtures/session-v3-subagent.jsonl`

Changes:

- Reduce live RPC events into transcript rows: task/user messages, assistant text, tool calls, tool results, queue updates, permission events, errors, usage, lifecycle.
- Parse completed child session JSONL v3 files for reload inspection.
- Use child session files as canonical transcript storage; parent records store only cursor/previews.
- Include truncation markers for large tool outputs and link to session file/path.

Verification:

- `npm test -- tests/subagent/transcript.test.ts`
- Manual: after reload, `/agents <id>` should render a completed transcript from the child session file without needing the child process.

Risk gate:

- Check transcript rendering never appends raw child output into parent LLM context.

**Commit 2.6 — Implement `/agents` and `/agent` overlay inspector**

Files:

- `agent/extensions/subagent/commands.ts`
- `agent/extensions/subagent/ui.ts`
- `agent/extensions/subagent/index.ts`
- `agent/extensions/subagent/render.ts`
- `agent/extensions/subagent-visualizer.ts`
- `tests/subagent/ui-model.test.ts`

Changes:

- Replace the Phase 1 list prototype with the MVP overlay inspector.
- Use a two-pane custom TUI component when possible: list on the left, transcript on the right.
- Provide a simple `ctx.ui.select`/text fallback for tiny/non-TUI contexts.
- Commands to support:
  - `/agents`
  - `/agent`
  - `/agent <id>`
  - `/agent list`
  - `/agents all`
- Show status, id/name, task, model/thinking, cwd, effective tools, network/read-only badges, session file, usage, current activity, and transcript timeline.
- Update visualizer copy to say `/agents to inspect` instead of only `/subagents to list`.

Verification:

- `npm test -- tests/subagent/ui-model.test.ts`
- Manual: while an RPC child is running, open `/agents`, switch between two child records, scroll/tail transcript, close with Esc, and confirm the parent editor draft/context survives.

Risk gate:

- Esc from the overlay must never cancel a child. Stop/cancel must be explicit.

**Commit 2.7 — Add live steer/follow-up, stop, and dismiss controls**

Files:

- `agent/extensions/subagent/controls.ts`
- `agent/extensions/subagent/commands.ts`
- `agent/extensions/subagent/ui.ts`
- `agent/extensions/subagent/rpc-runner.ts`
- `tests/subagent/controls.test.ts`

Changes:

- In `/agents`, implement:
  - `m`/`f` message: choose steer-now vs follow-up, then send RPC `steer`/`follow_up` or `prompt` with `streamingBehavior`.
  - `s` stop: confirm, answer pending UI requests as cancelled/denied, RPC `abort`, SIGTERM, SIGKILL fallback.
  - `d` dismiss: terminal records only; hide from default panel/list while preserving session and parent record.
- Add command forms:
  - `/agent follow <id>`
  - `/agent stop <id>`
  - `/agent dismiss <id>`
- For terminal records, show "resume unavailable; start continuation?" unless true same-session resume is implemented later.

Verification:

- `npm test -- tests/subagent/controls.test.ts`
- Manual: steer a running child and confirm the user message appears in the child transcript only.
- Manual: stop a long-running child and confirm final status is `cancelled`, transcript remains inspectable, and process lock is removed.
- Manual: dismiss a completed child; verify `/agents all` shows it again.

Risk gate:

- Follow-up to a terminal child must not pretend to be same-context resume unless it reopens the same child session with the same agent snapshot and policy.

**Commit 2.8 — Add session shutdown/reload cancellation and detached handling**

Files:

- `agent/extensions/subagent/lifecycle.ts`
- `agent/extensions/subagent/records.ts`
- `agent/extensions/subagent/status.ts`
- `agent/extensions/subagent/index.ts`
- `agent/extensions/subagent-visualizer.ts`
- `tests/subagent/lifecycle.test.ts`

Changes:

- On controlled `session_shutdown`, cancel live children cleanly.
- On reload/session reconstruction, mark records that were non-terminal without a live process as `detached` internally and map them to a clear visible note if the visualizer only supports P0 statuses.
- Prevent two writers to one child session by respecting/removing lock files.

Verification:

- `npm test -- tests/subagent/lifecycle.test.ts`
- Manual: start a child, `/reload`, then confirm `/agents` shows terminal or detached/cancelled state honestly, not stale `running`.

Risk gate:

- Do not attempt background orphan/reattach semantics in MVP; that is P1/supervisor work.

#### Phase 3 — hardening, docs, and local dogfood

**Commit 3.1 — Harden project-agent trust and one-time confirmation**

Files:

- `agent/extensions/subagent/agents.ts`
- `agent/extensions/subagent/index.ts`
- `agent/extensions/subagent/tool-policy.ts`
- `tests/subagent/project-trust.test.ts`

Changes:

- Require `ctx.isProjectTrusted()` or an explicit one-time confirmation before loading `.pi/agents/*.md`.
- Record project-agent source/hash and trust mode in `SubagentRecord.policy`.
- Ensure untrusted one-time project-agent approval does not grant child process project `.pi` resources; launch with `--no-approve` unless parent project trust is active.

Verification:

- `npm test -- tests/subagent/project-trust.test.ts`
- Manual: create a temporary `.pi/agents/test.md`; confirm it is ignored by default and prompts only when `agentScope: "project" | "both"` is requested.

Risk gate:

- Project-local agents must never be silently loaded from an untrusted repo.

**Commit 3.2 — Harden output caps, privacy, and file modes**

Files:

- `agent/extensions/subagent/state-root.ts`
- `agent/extensions/subagent/transcript.ts`
- `agent/extensions/subagent/render.ts`
- `agent/extensions/subagent/records.ts`
- `tests/subagent/privacy.test.ts`

Changes:

- Use private modes for snapshot/policy/lock files where the OS supports them.
- Cap `currentActivity`, parent custom records, tool output previews, and parent-visible final summaries.
- Never store secret input/editor responses from child UI prompts in parent records.
- Add clear truncation messages pointing to the child session file/transcript.

Verification:

- `npm test -- tests/subagent/privacy.test.ts`
- Manual: run a child that emits large output; confirm parent result and widget remain small while `/agents` can inspect full session-backed content.

Risk gate:

- If a cap fails, disable web/search default agents until fixed because web tools can produce very large/untrusted output.

**Commit 3.3 — Add docs and local usage examples**

Files:

- `README.md`
- `docs/subagents.md`
- `agent/prompts/subagent-research.md` (optional)
- `agent/prompts/subagent-implement-and-review.md` (optional)

Changes:

- Document installation via `./install.sh` and `/reload`.
- Document default agents and their tool policies.
- Document `/agents` / `/agent` controls and safety semantics.
- Include examples for docs research, parallel code exploration, stop, dismiss, and reload inspection.
- Keep packaging/upstream instructions out of scope; ticket 07 decides rollout.

Verification:

- Read docs from a fresh checkout and confirm all file paths exist.
- Optional manual: run the documented examples exactly.

Rollback point:

- Docs can be reverted independently if implementation changes before rollout.

**Commit 3.4 — Dogfood acceptance scenarios and fix only local MVP blockers**

Files:

- Code files touched by fixes from the dogfood run, expected mainly under `agent/extensions/subagent/` and `agent/extensions/subagent-visualizer.ts`.
- `docs/subagents.md` if manual steps need correction.

Manual acceptance scenarios:

1. `docs-researcher` can use `web_search` and `fetch_content` for a current-docs question; parent gets a concise cited summary and `/agents` holds the full transcript.
2. Two children run in parallel and stream visible status rows.
3. `/agents` opens a running child and shows recent assistant text, tool calls, and tool results.
4. User sends a steer/follow-up to a running child without adding the message to the parent conversation.
5. User stops a running child; process exits, row becomes `cancelled`, transcript remains inspectable.
6. `/reload` reconstructs completed records and transcripts.
7. `code-explorer` cannot edit/write or run bash.
8. Project-local agent loading prompts for trust/confirmation.

Risk gate:

- If any P0 acceptance scenario fails, keep `transport: "rpc"` off by default or do not install the extension globally yet.

### Rollback strategy

- **After Phase 0:** remove `agent/extensions/subagent/`, `agent/agents/`, test harness files, and the `agents` script-copy change.
- **After Phase 1:** keep default agents if useful, but remove/disable `agent/extensions/subagent/` or set the tool to JSON-only debug; no child sessions/state roots are durable yet.
- **During Phase 2:** keep `transport: "json"` as a fallback until RPC passes manual acceptance; if RPC fails, revert Phase 2 commits without losing Phase 1.
- **After global install:** fastest user rollback is deleting `~/.pi/agent/extensions/subagent/` and `~/.pi/agent/agents/{docs-researcher,code-explorer,reviewer,worker}.md`, then `/reload`. Repo rollback is a normal git revert.
- **State cleanup:** never delete `~/.pi/agent/subagents/` automatically during rollback; provide a documented manual cleanup command later if needed.

### Cross-cutting risk gates

- `/agents` must be usable while a child is running. If Pi cannot run extension commands during a blocking tool call, change MVP execution to spawn background children and return ids immediately.
- Read-only means absent write tools, not prompt-only promises.
- Web/search tools are opt-in by frontmatter and visible in `/agents`.
- Child permission prompts are source-labeled before project agents or bash-capable agents are encouraged.
- Parent custom records store previews/index data only; child session JSONL is the canonical transcript.
- Controlled reload/shutdown cancels live children; no orphan reattach in MVP.
- Terminal resume is honest: true same-session resume only with same session file, agent snapshot, and policy; otherwise it is a continuation.

### Map pointer

MVP plan: ship a local global extension in `agent/extensions/subagent/`, add default agents under `agent/agents/`, first validate discovery/status with a JSON fallback, then make persisted RPC child sessions plus `/agents` overlay controls the P0 implementation path, with hard gates for read-only tools, source-labeled approvals, reload reconstruction, and live stop/steer.
