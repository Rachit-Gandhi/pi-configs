# Subagent Orchestrator Research (2026-07-05)

## Recommendation

For Pi, the best orchestrator skill/package to review first is **Kanevry/session-orchestrator**.

Why:

- It explicitly supports **Pi** alongside Claude Code, Codex CLI, and Cursor, and documents a Pi setup path. Source: https://github.com/Kanevry/session-orchestrator and https://github.com/Kanevry/session-orchestrator/blob/main/docs/pi-setup.md
- It is packaged as a Pi package with `pi.extensions`, `pi.skills`, and `pi.prompts` entries. Source: https://github.com/Kanevry/session-orchestrator/blob/main/package.json
- It provides a structured lifecycle loop (`/session`, `/go`, `/close`, plus planning/evolution commands) rather than just raw parallel process spawning. Source: https://github.com/Kanevry/session-orchestrator
- Its Pi docs say the package exposes `./pi/extensions/session-orchestrator.ts`, `./skills`, and generated Pi prompts, which matches Pi’s extension/skill/prompt architecture. Source: https://github.com/Kanevry/session-orchestrator/blob/main/docs/pi-setup.md

Caveat: Session Orchestrator’s Pi support is not equivalent to Claude Code native subagents. Its Pi setup guide says Pi maps `session_start`, `session_shutdown`, `tool_call`, `tool_result`, and `agent_end`; it also says `SubagentStart` and `SubagentStop` are not mapped yet, and that Pi agent dispatch is “Sequential v1.” Source: https://github.com/Kanevry/session-orchestrator/blob/main/docs/pi-setup.md

That caveat is exactly why a Pi-native visualization extension should be **tool-driven** (`subagent_status`) rather than relying on non-existent Pi subagent lifecycle events.

## Pi platform facts

- Pi intentionally ships without built-in subagents; the README says “No sub-agents. There’s many ways to do this. Spawn pi instances via tmux, or build your own with extensions, or install a package that does it your way.” Source: local Pi README at `/Users/rachitgandhi/.vite-plus/js_runtime/node/24.18.0/lib/node_modules/@earendil-works/pi-coding-agent/README.md`
- Pi extensions can register custom tools, commands, event handlers, UI components, widgets, status lines, and custom renderers. Source: local Pi docs at `/Users/rachitgandhi/.vite-plus/js_runtime/node/24.18.0/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
- Pi skills are progressively disclosed workflow packages and can be invoked as `/skill:name`. Source: local Pi docs at `/Users/rachitgandhi/.vite-plus/js_runtime/node/24.18.0/lib/node_modules/@earendil-works/pi-coding-agent/docs/skills.md`

## Other candidates checked

### josstei/maestro-orchestrate

Maestro is a multi-agent orchestration platform with 39 specialists and runtime targets for Gemini CLI, Claude Code, Codex, and Qwen Code. Its README does not list Pi as a runtime target. Good orchestration design reference, not the best direct Pi package. Source: https://github.com/josstei/maestro-orchestrate

### AgentWrapper/agent-orchestrator

Agent Orchestrator is a full external IDE/supervision layer for parallel coding agents in isolated workspaces. It is not a Pi skill/package; it is a separate harness. Source: https://github.com/AgentWrapper/agent-orchestrator

### Happenmass/omux

omux orchestrates CLI coding agents through tmux and can run agents in parallel at scale. It is promising if we want real external process orchestration, but it is not a Pi skill package. Source: https://github.com/Happenmass/omux

### stephenleo/bmad-autonomous-development

BAD is a BMad autonomous development module that delegates story lifecycle steps to dedicated subagents with fresh context windows. It is useful as a BMAD workflow reference, but it is not the simplest Pi-native starting point. Source: https://github.com/stephenleo/bmad-autonomous-development

### bestmark1/Phased-Engineering-Pipeline

This is a Claude Code skill enforcing an eight-agent BMAD-style pipeline with approval gates. It is useful as a skill-design reference, but it targets Claude Code rather than Pi. Source: https://github.com/bestmark1/Phased-Engineering-Pipeline

## Implementation decision

I created a local Pi extension rather than installing a third-party package automatically, because Pi packages/extensions execute arbitrary code with full user permissions and should be reviewed before install.

Implemented local pieces:

- `~/.pi/agent/extensions/subagent-visualizer.ts` — Pi extension with a `subagent_status` tool, `/subagents` command, footer status, and editor widget.
- `~/.pi/agent/skills/orchestrate-subagents/SKILL.md` — skill that instructs the agent to use the visualizer while coordinating workstreams.

Suggested next step if the user wants the full orchestrator package:

```bash
git clone https://github.com/Kanevry/session-orchestrator.git ~/Projects/session-orchestrator
cd ~/Projects/session-orchestrator && npm install
node scripts/pi-install.mjs --global --settings-only
```

Review the repository before running this because it installs executable hooks/extensions.
