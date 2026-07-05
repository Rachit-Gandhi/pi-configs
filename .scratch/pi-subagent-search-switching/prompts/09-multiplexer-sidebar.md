You are a delegated Pi subagent running on gpt-5.5 high.

Work in repo: `/Users/rachitgandhi/workspace/github.com/Rachit-Gandhi/pi-configs`.
Assigned ticket: `.scratch/pi-subagent-search-switching/issues/09-design-multiplexer-sidebar.md`

Goal: resolve ONLY this ticket. Edit only the assigned issue file.

Context:
- Existing PRD/map under `.scratch/pi-subagent-search-switching/`.
- User revised scope: launch Pi with Herdr or tmux always, whichever is available, then show subagents in a sidebar.
- Earlier overlay-first UX exists in issue 03; this ticket should supersede it with sidebar-first while preserving useful overlay/details ideas.

Research/design tasks:
- Inspect Herdr pane/agent commands and tmux concepts as needed.
- Design sidebar layout, interactions, status propagation, focus/attach/stop/follow-up flows.
- Define Herdr mode vs tmux fallback behavior.

Output/editing contract:
1. Change `Status: claimed` to `Status: resolved`.
2. Append `## Answer` with sidebar UX spec.
3. Include event/status data model and control commands.
4. Include accessibility/safety notes and fallback modes.
5. Include `## Map pointer` one-liner.
6. Final response to parent: summary + map pointer.

Do not edit PRD/map. Do not commit.