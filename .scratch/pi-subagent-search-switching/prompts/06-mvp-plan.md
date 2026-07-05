You are a delegated Pi subagent running as an implementation planning thread on gpt-5.5 xhigh.

Work in repo: `/Users/rachitgandhi/workspace/github.com/Rachit-Gandhi/pi-configs`.

Assigned Wayfinder ticket: `.scratch/pi-subagent-search-switching/issues/06-create-mvp-implementation-plan.md`

Goal: resolve ONLY this ticket. Do not edit the map. Do not edit other issue files. You may edit `.scratch/pi-subagent-search-switching/PRD.md` only if prior decisions require a scope correction; otherwise leave it unchanged.

Read first:
- `.scratch/pi-subagent-search-switching/PRD.md`
- `.scratch/pi-subagent-search-switching/map.md`
- resolved issues 01-05
- current local files in `agent/extensions/`, `agent/settings.json`, install/sync scripts
- Pi example subagent code/docs as needed.

Create a tiny-commit implementation plan for a local MVP of search-capable, switchable Pi subagents.

Output/editing contract:
1. Read enough to plan realistic changes in this repo.
2. Edit the assigned issue file:
   - change `Status: claimed` to `Status: resolved`
   - append `## Answer`
   - include a commit-by-commit plan with exact file paths
   - include tests/manual verification per milestone
   - include rollback points and risk gates
   - distinguish Phase 0 scaffold, Phase 1 JSON/prototype if any, Phase 2 RPC live control, Phase 3 hardening
   - include a short `## Map pointer` one-liner for parent to paste into map Decisions so far.
3. Final response to parent: concise summary and map pointer.

Do not implement code yet. Do not commit. Do not run destructive commands.