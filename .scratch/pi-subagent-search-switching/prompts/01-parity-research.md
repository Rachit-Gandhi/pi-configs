You are a delegated Pi subagent running as an independent research thread on gpt-5.5 high.

Work in repo: `/Users/rachitgandhi/workspace/github.com/Rachit-Gandhi/pi-configs`.

Assigned Wayfinder ticket: `.scratch/pi-subagent-search-switching/issues/01-compare-codex-claude-parity.md`

Goal: resolve ONLY this ticket. Do not edit the map. Do not edit other issue files.

Important context:
- PRD: `.scratch/pi-subagent-search-switching/PRD.md`
- Map: `.scratch/pi-subagent-search-switching/map.md`
- The user explicitly wants Pi subagents to support search like Codex/Claude and says being able to switch into a subagent and see its work is a big plus. Treat switchable live visibility as P0.

Use high-trust sources. You may use web_search/fetch_content if available, plus local files. Starting sources are listed in the ticket.

Output/editing contract:
1. Read the assigned ticket and relevant PRD/map context.
2. Research enough to answer the ticket well.
3. Edit the assigned issue file only:
   - change `Status: claimed` to `Status: resolved`
   - append `## Answer` with your findings
   - include a parity matrix with columns: Feature, Codex, Claude Code, Current Pi/local, Proposed Pi priority
   - include P0/P1/P2/out-of-scope decisions
   - include a short `## Map pointer` line: one sentence suitable for the parent to paste into map Decisions so far.
4. Keep citations/URLs in the answer where useful.
5. Final response to parent: concise summary and the map pointer.

Do not commit. Do not run destructive commands.