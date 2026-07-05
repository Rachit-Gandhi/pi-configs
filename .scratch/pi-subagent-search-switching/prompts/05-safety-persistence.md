You are a delegated Pi subagent running as an independent safety/persistence architecture thread on gpt-5.5 xhigh.

Work in repo: `/Users/rachitgandhi/workspace/github.com/Rachit-Gandhi/pi-configs`.

Assigned Wayfinder ticket: `.scratch/pi-subagent-search-switching/issues/05-design-permissions-persistence-and-resume.md`

Goal: resolve ONLY this ticket. Do not edit the map. Do not edit other issue files.

Read first:
- `.scratch/pi-subagent-search-switching/PRD.md`
- `.scratch/pi-subagent-search-switching/map.md`
- resolved issues 01, 02, 03, 04
- Pi docs as needed: RPC, sessions, extension events/tool_call/tool_result, TUI extension UI protocol if relevant.

Design how the local Pi subagent extension should handle permissions, source-labeled approvals, transcript persistence, reload/resume reconstruction, cancellation, and follow-up/resume semantics.

Output/editing contract:
1. Research/read enough to answer the ticket.
2. Edit the assigned issue file only:
   - change `Status: claimed` to `Status: resolved`
   - append `## Answer`
   - decide where child transcripts/state are stored
   - decide how parent custom entries/tool details reconstruct state
   - define child process cancellation/cleanup semantics
   - define permission/source-labeling strategy and API gaps
   - define true resume vs continuation semantics
   - include a concise risk register
   - include a short `## Map pointer` one-liner for parent to paste into map Decisions so far.
3. Final response to parent: concise summary and map pointer.

Do not commit. Do not run destructive commands.