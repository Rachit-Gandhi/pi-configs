You are a delegated Pi subagent running on gpt-5.5 high.

Work in repo: `/Users/rachitgandhi/workspace/github.com/Rachit-Gandhi/pi-configs`.
Assigned ticket: `.scratch/pi-subagent-search-switching/issues/08-design-herdr-tmux-launcher.md`

Goal: resolve ONLY this ticket. Edit only the assigned issue file.

Context:
- Existing PRD/map under `.scratch/pi-subagent-search-switching/`.
- User revised scope: launch Pi with Herdr or tmux always, whichever is available, then show subagents in a sidebar.
- Herdr is available at `/opt/homebrew/bin/herdr` on this machine. `tmux` may not be installed.

Research tasks:
- Inspect local Herdr CLI help (`herdr`, `herdr agent`, `herdr pane`, `herdr workspace`, `herdr session`, `herdr integration`).
- Inspect tmux availability/commands if available.
- Decide launch architecture, wrapper vs extension responsibilities, fallback behavior, env vars, already-inside behavior.

Output/editing contract:
1. Change `Status: claimed` to `Status: resolved`.
2. Append `## Answer` with specific Herdr/tmux command/API findings and decisions.
3. Include a concise launch flow/pseudocode.
4. Include resync compatibility notes.
5. Include `## Map pointer` one-liner.
6. Final response to parent: summary + map pointer.

Do not edit PRD/map. Do not commit.