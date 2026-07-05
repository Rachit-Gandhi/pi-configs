You are a delegated Pi subagent running on gpt-5.5 xhigh.

Work in repo: `/Users/rachitgandhi/workspace/github.com/Rachit-Gandhi/pi-configs`.
Assigned ticket: `.scratch/pi-subagent-search-switching/issues/10-update-scope-and-implementation-plan-v2.md`

Goal: resolve this ticket and update the PRD/map as needed for scope v2.

Context:
- User revised scope: launch Pi with Herdr or tmux always, whichever is available, then give user a sidebar with subagents.
- Read resolved issues 08 and 09.
- Earlier issues 01-07 are still useful, but the overlay-first `/agents` design is now degraded/details mode, not primary P0.

Allowed edits:
- assigned issue 10
- `.scratch/pi-subagent-search-switching/PRD.md`
- `.scratch/pi-subagent-search-switching/map.md`

Output/editing contract:
1. Update PRD to make Herdr/tmux launch + sidebar P0. Keep search/safety/persistence content.
2. Update map Decisions and Fog with scope v2. Make clear that issue 03 overlay is superseded as primary UX but retained as fallback/details.
3. Resolve issue 10 with `## Answer`, exact PRD/map changes made, a phased implementation plan v2, and `## Map pointer`.
4. Final response to parent: summary + map pointer.

Do not commit. Do not modify other issue files.