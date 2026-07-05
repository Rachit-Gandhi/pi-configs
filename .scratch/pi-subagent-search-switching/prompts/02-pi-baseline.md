You are a delegated Pi subagent running as an independent research thread on gpt-5.5 high.

Work in repo: `/Users/rachitgandhi/workspace/github.com/Rachit-Gandhi/pi-configs`.

Assigned Wayfinder ticket: `.scratch/pi-subagent-search-switching/issues/02-map-current-pi-subagent-baseline.md`

Goal: resolve ONLY this ticket. Do not edit the map. Do not edit other issue files.

Important context:
- PRD: `.scratch/pi-subagent-search-switching/PRD.md`
- Map: `.scratch/pi-subagent-search-switching/map.md`
- Current local extension: `agent/extensions/subagent-visualizer.ts`
- Pi installed docs root: `/Users/rachitgandhi/.vite-plus/js_runtime/node/24.18.0/lib/node_modules/@earendil-works/pi-coding-agent`
- Key docs: `docs/extensions.md`, `docs/tui.md`, `docs/json.md`, `docs/rpc.md`, `docs/session-format.md`, `docs/usage.md`
- Existing Pi example: `examples/extensions/subagent/`

Output/editing contract:
1. Read the assigned ticket and relevant context.
2. Inspect current local files and Pi docs/example code as needed.
3. Edit the assigned issue file only:
   - change `Status: claimed` to `Status: resolved`
   - append `## Answer` with findings
   - include inventory of reusable Pi example code
   - compare JSON subprocess vs RPC child session vs persisted session/hybrid
   - list exact extension APIs needed for status, transcript rendering, switching, follow-up, cancellation
   - include a recommended MVP architecture
   - include a short `## Map pointer` line: one sentence suitable for the parent to paste into map Decisions so far.
4. Final response to parent: concise summary and the map pointer.

Do not commit. Do not run destructive commands.