# Compare Codex and Claude subagent parity targets

Type: research
Status: resolved
Blocked by:
Parent: ../map.md

## Question

What exact Codex and Claude Code subagent/search/visibility behaviors should Pi emulate for the MVP, and which should be P1/P2 or explicitly out of scope?

## Starting sources

- Codex subagents: https://developers.openai.com/codex/subagents
- Codex CLI features / web search: https://developers.openai.com/codex/cli/features#web-search
- Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Claude subagents: https://code.claude.com/docs/en/subagents
- Claude tools reference: https://code.claude.com/docs/ru/tools-reference

## Exit criteria

- Produce a compact parity matrix with Codex, Claude, current Pi, and proposed Pi columns.
- Mark each feature P0/P1/P2/out-of-scope.
- Call out search-specific requirements (`WebSearch`/`WebFetch` vs Pi `web_search`/`fetch_content`).
- Resolve this ticket with a decision pointer in `../map.md`.

## Answer

### High-trust sources checked

- Codex subagents: https://developers.openai.com/codex/subagents
- Codex CLI web search/features: https://developers.openai.com/codex/cli/features#web-search
- Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Claude Code subagents: https://code.claude.com/docs/en/subagents
- Claude Code tools reference: https://code.claude.com/docs/en/tools-reference
- Current Pi docs/examples: `docs/extensions.md`, `docs/tui.md`, `docs/json.md`, `docs/rpc.md`, `docs/session-format.md`, `examples/extensions/subagent/README.md`, `examples/extensions/subagent/index.ts`
- Current local Pi config: `agent/extensions/subagent-visualizer.ts`, `agent/settings.json`

### Parity matrix

| Feature | Codex | Claude Code | Current Pi/local | Proposed Pi priority |
|---|---|---|---|---|
| Explicit subagent spawning | Only spawns subagents when explicitly asked; orchestrates spawning, follow-ups, waiting, and closing threads. | Claude can delegate automatically by description, natural language, or @-mention; `Agent` tool starts a separate context and returns one text result. | No real installed executor; only visual status tool. Pi example has a `subagent` tool for single/parallel/chain JSON subprocesses. | **P0**: add real `subagent` tool; prefer explicit delegation for MVP, with natural-language parent tool use acceptable. |
| Isolated context windows | Each spawned agent has its own thread/context. | Each named subagent starts with fresh isolated context; fork mode is separate and inherits full history. | Example spawns separate `pi --mode json -p --no-session` processes, so context is isolated but not durable. | **P0**: isolated child sessions/processes with capped parent result and durable full transcript. |
| Built-in agent types | Built-ins: `default`, `worker`, `explorer`. | Built-ins include Explore, Plan, general-purpose, plus helpers. | Example agents: `scout`, `planner`, `reviewer`, `worker`; not installed locally. | **P0**: ship `docs-researcher`, `code-explorer/read-only`, `worker`; exact Codex/Claude names optional. |
| Custom agent definitions | TOML under `~/.codex/agents/` and `.codex/agents/`; required `name`, `description`, `developer_instructions`; can override model/sandbox/MCP/skills. | Markdown + YAML frontmatter under `~/.claude/agents/`, `.claude/agents/`, plugins, CLI JSON, managed settings; required `name`, `description`; rich fields. | Pi example supports markdown frontmatter in `~/.pi/agent/agents/*.md` and `.pi/agents/*.md` with `name`, `description`, `tools`, `model`. | **P0**: user + trusted project markdown agents with `name`, `description`, `tools`, `disallowedTools/excludeTools`, `model`, `thinking`, `maxTurns`, `background`, `cwd`, `color`. Rich Claude fields beyond this are P1/P2. |
| Project trust for project agents | Project `.codex/agents/` are project-scoped custom agents. | Project `.claude/agents/` are meant to be checked in; precedence rules apply. | Pi extension docs require project-local extensions/config only after trust; example prompts before project-local agents. | **P0**: load project agents only for trusted projects or after explicit confirmation. |
| Parallel work | Codex supports parallel subagent workflows and waits for all requested results before consolidated response; `agents.max_threads` default is 6. | Parallel research is a recommended pattern; background subagents run concurrently. | Example supports parallel tasks, max 8 tasks, 4 concurrent. | **P0**: at least two parallel subagents; **P1**: configurable max threads/concurrency/depth/timeouts. |
| Chain/batch fan-out | Codex can chain by parent orchestration; also experimental CSV fan-out with `spawn_agents_on_csv`. | Can chain subagents through parent prompts; Workflow can orchestrate many background subagents. | Example supports `chain`; no CSV/dynamic workflow. | **P1**: chain/batch workflows; **P2/out-of-scope MVP**: Codex CSV fan-out and Claude Workflow clone. |
| Live visibility/status | Subagent activity is surfaced in Codex app/CLI; IDE visibility coming. | Panel below prompt shows running forks/subagents and nested tree rows. | `subagent_status` widget shows queued/running/blocked/succeeded/failed/cancelled rows; example streams inside a tool render, not a switchable thread. | **P0**: live panel/status rows. |
| Switch into subagent transcript | `/agent` in Codex CLI switches between active threads and inspects ongoing thread. | Panel row Enter opens selected fork/subagent transcript; follow-up messages go to that agent. | No switchable child transcript. Example has expanded tool output (Ctrl+O), but it is still parent tool rendering. | **P0**: `/agent` or `/agents` switcher to open active/completed child transcript while it works. This is explicitly P0 per user. |
| Steering/follow-up | Codex lets user ask to steer running subagent, stop it, or close completed threads. | `SendMessage` resumes/steers by ID/name; open transcript accepts follow-up messages; stopped subagents auto-resume in background. | Pi RPC supports `steer`, `follow_up`, `abort`; example JSON subprocess is one-shot, so no true follow-up. | **P0**: stop/cancel and send follow-up to running child; **P1**: resume stopped/completed child with retained context. |
| Transcript persistence | Codex stores transcripts locally and can resume sessions. | Subagent transcripts are separate JSONL files under session projects; persist across resume; cleanup default 30 days. | Pi sessions are JSONL and extension custom entries can persist state. Example uses `--no-session`, so child transcripts are not durable. | **P0**: persist child record + transcript/session path; reload reconstructs active/completed list. |
| Parent context cleanliness | Codex consolidates results after subagents finish. | Agent tool returns one text result; parent does not see intermediate tool calls/outputs. | Example caps model-visible output but full details are inside tool result; visualizer stores status only. | **P0**: parent gets concise summaries only; transcript available on demand. |
| Permission inheritance/labels | Child inherits sandbox policy and live runtime overrides; approval overlay shows source thread label and can open thread. | Subagents inherit permission context; background prompts surface in main session and name subagent. | Pi can intercept/block tool calls via extensions; current visualizer has no executor/permission labeling. | **P0**: child tool approvals must identify requesting subagent; inherit parent safety, allow stricter agent config. |
| Read-only/search agents | Codex custom agents can set `sandbox_mode = "read-only"`; `explorer` is read-heavy. | Explore/Plan are read-only; custom `tools`/`disallowedTools` can exclude Write/Edit. | Example `tools` allowlist can restrict child `--tools`; no installed read-only docs agent. | **P0**: read-only/search agents cannot write/edit by default. |
| Local code search tools | Explorer/pr_explorer examples use fast search/read. | Read, Grep, Glob, Bash available by tool policy. | Pi has read/bash and project tools; the example formats read/grep/find/ls/bash calls if allowed. | **P0**: allow `read`, `grep`, `find`, `ls`, and only read-only `bash` patterns for search agents. |
| Web search | Codex has first-party `web_search`; local CLI default is cached search, `--search` or `web_search = "live"` enables live, `disabled` turns it off; web results are untrusted. | `WebSearch` returns result titles/URLs, may refine up to eight backend searches, supports `allowed_domains` or `blocked_domains`, and does not fetch pages. | `agent/settings.json` installs `npm:pi-web-access`; current session has `web_search`, `fetch_content`, `get_search_content`. | **P0**: search-capable agents explicitly allowlist Pi `web_search`, `fetch_content`, `get_search_content`; network/search never default for all agents. |
| Web fetch/content extraction | Codex web search items appear in transcript/JSON; live fetch mode exists via web search setting. | `WebFetch` takes URL + prompt, converts to Markdown, uses a small model, is lossy, caches 15 min, and prompts by domain unless preapproved. | Pi `fetch_content` fetches readable markdown for URLs/YouTube/GitHub/video; `get_search_content` retrieves stored full content from prior searches/fetches. | **P0**: docs-researcher workflow should use `web_search` for discovery, `fetch_content` for primary URLs, `get_search_content` for full stored content, and cite sources. **P1**: domain allow/deny/search policy knobs. |
| Instruction files/context | Codex loads `AGENTS.md`/`AGENTS.override.md` globally and down project path with precedence/size limits. | Subagents usually load CLAUDE.md/memory except Explore/Plan; custom subagent prompt is its own system prompt plus environment. | Pi loads workspace/project context files in normal sessions; child Pi subprocesses should do the same when started in cwd. | **P0**: preserve Pi context-file loading for child sessions; **P1**: expose context inheritance/skip options per agent. |
| Background default | Codex subagents run as active threads and parent waits for requested results in described workflow. | As of v2.1.198, subagents run background by default; foreground when result needed. | Example tool execution blocks parent tool call while child processes run, though it streams partial updates. | **P1**: background by default with foreground/blocking option. For MVP, parent may block as long as `/agent` live view works. |
| Usage/cost stats | Codex warns subagents consume more tokens; app/CLI show activity. | Tool docs and transcripts expose behavior; panel focuses on tasks. | Example tracks turns, tokens, cost, context per agent. | **P1**: keep/example usage stats per subagent. |
| Nested subagents/depth | Codex has configurable `agents.max_depth`, default 1. | Nested subagents supported to fixed depth 5; panel shows tree. | Example has no nested spawning beyond child having tools if allowed; no depth control installed. | **P2**: nested subagents with strict depth limits. |
| Worktree isolation | Codex custom agents can choose sandbox modes; Claude fork can pass worktree isolation; named subagent supports `isolation: worktree`. | `isolation: worktree` creates temp git worktree and cleanup behavior. | Pi has no current subagent worktree layer. | **P2**. |
| Per-agent MCP/tools ecosystem | Codex custom agents can configure MCP servers and skills. | `mcpServers`, `skills`, hooks, memory fields supported. | Pi can install packages/tools globally; no per-agent MCP/memory in local subagent example. | **P2** for MCP/memory/hooks; **P1** for simple tool allow/deny. |
| @-mention invocation | Not the primary Codex pattern; `/agent` for switching. | @-mention guarantees a subagent for one task and shows running named background agents in typeahead. | Pi has no @-agent mention convention. | **P1**: nice invocation shortcut after `/agent` and tool are stable. |
| Remote/cloud/task UI | Codex has cloud/remote TUI features outside local subagent MVP. | Claude has agent teams, remote control, workflows/plugins/managed settings. | Pi local extension target. | **Out of scope for MVP**. |

### Decisions

#### P0 MVP

- Implement a real `subagent` executor in local Pi config, starting from Pi's example but not stopping at its one-shot `--no-session` limitations.
- Treat **switchable live visibility** as P0: `/agent`/`/agents` must list active/completed children, open a running transcript, show assistant text/tool calls/tool results/errors/final output, and return to main without losing draft/context.
- Support steering and cancellation from the UI for running children; if the chosen architecture cannot resume after completion, the UI must say it will spawn a continuation with summarized prior transcript.
- Persist child records/transcripts enough for Pi reload/resume to reconstruct active/completed threads.
- Provide user-level and trusted project-level markdown agent definitions with minimal frontmatter: `name`, `description`, `tools`, `excludeTools`/`disallowedTools`, `model`, `thinking`, `maxTurns`, `background`, `cwd`, `color`.
- Ship example agents for `docs-researcher` and `code-explorer` that are read-only by default.
- Search parity requirement: Pi does not need Claude's exact `WebSearch`/`WebFetch` semantics or Codex cached/live modes for MVP, but search-capable agents must be able to explicitly use Pi `web_search`, `fetch_content`, and `get_search_content`; search/network access must be opt-in per agent/tool allowlist.
- Permission prompts/approval requests from children must visibly name the requesting subagent/thread.
- Parent result must be concise and capped; raw search output and verbose tool logs stay in child transcript.

#### P1

- Background execution by default with foreground/blocking option.
- Configurable concurrency, max threads, max depth=1 default, max turns, timeout, output caps.
- Parallel, chain, and batch workflows with clear aggregate summaries.
- Resume stopped/completed subagents with retained context if using RPC/session architecture; otherwise continuation mode with transcript summary.
- Usage/cost/context statistics per subagent.
- Domain/search policy controls similar in spirit to Codex `disabled`/cached/live and Claude allowed/blocked domains, adapted to Pi web-access provider options.
- @-mention or prompt shortcut for selecting a subagent.
- Agent context inheritance controls: include/skip project instructions, inherited tools, model/thinking overrides.

#### P2

- Worktree isolation for editing subagents.
- Nested subagents with strict depth limits and tree UI.
- Per-agent MCP server config, hooks, memory directories, and plugin/package distribution.
- Codex-style CSV fan-out or Claude-style dynamic Workflow orchestration.
- Fork mode that inherits the full parent transcript/cache.

#### Explicitly out of scope for MVP

- Codex Cloud, remote app-server/TUI, and managed remote tasks.
- Claude Agent Teams, managed organization subagents, plugin ecosystem parity, artifacts, push notifications, and dynamic Workflow clone.
- Making web/network tools available to every subagent by default.
- Hiding or auto-approving subagent permission prompts.
- Modifying Pi core before extension/RPC limitations are proven.

### Map pointer

Resolved parity target: MVP should prioritize a real Pi subagent executor with opt-in Pi web tools plus Codex/Claude-style `/agent` live transcript switching/steering as P0; background defaults, resume, stats, richer policies, nesting, worktrees, MCP/memory, and batch workflows are P1/P2.
