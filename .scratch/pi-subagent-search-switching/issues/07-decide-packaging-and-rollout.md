# Decide packaging and rollout path

Type: grilling
Status: resolved
Resolved by: packaging/resync compatibility pass
Blocked by: 06
Parent: ../map.md

## Question

Should this ship as a local-only `pi-configs` extension, a reusable Pi package, an upstream Pi example improvement, or staged across all three?

## Exit criteria

- Decide initial rollout target.
- Decide naming and package structure.
- Decide whether local agents/prompts are checked into `pi-configs`.
- Decide what documentation is needed for install/restore.
- Resolve this ticket with a decision pointer in `../map.md`.

## Answer

### Decision

Use a staged rollout:

1. **Stage 1 / MVP: local global Pi config in `pi-configs`.**
   - Put the executor extension under `agent/extensions/subagent/`.
   - Put default agent definitions under `agent/agents/`.
   - Keep the existing `agent/extensions/subagent-visualizer.ts` as the glanceable status layer and integrate through `subagent:status` events.
   - Keep Wayfinder/PRD artifacts under `.scratch/pi-subagent-search-switching/` and tracker docs under `docs/agents/`.

2. **Stage 2: package extraction after the MVP proves stable.**
   - Extract `agent/extensions/subagent/`, `agent/agents/`, and any prompt templates into a Pi package with a `package.json` `pi` manifest.
   - Keep `pi-configs` consuming that package or pinning it only after the local extension is stable.

3. **Stage 3: upstream/example contribution only after API seams are known.**
   - Feed improvements back to Pi's `examples/extensions/subagent/` once persisted RPC sessions, `/agents` switching, and source-labeled approval patterns are proven.

### pi-config resync compatibility

The local MVP must be compatible with the existing `pi-config-autosync.ts` / `sync-from-pi.sh` / `install.sh` flow:

- `sync-from-pi.sh` is the source-of-truth pull from `~/.pi/agent` into this repo and `pi-config-autosync.ts` commits/pushes whatever it changes.
- Any implementation files that should survive resync must live under directories copied by both sync directions.
- The scripts now include `agent/agents/` alongside `extensions`, `skills`, `prompts`, and `themes`, so default subagent definitions will round-trip correctly.
- Runtime child transcripts/state must **not** live under copied source-control dirs. The PRD decision to store runtime subagent state under `~/.pi/agent/subagents/` stays safe because `.gitignore` now excludes `agent/subagents/` if it ever appears locally.
- If future work edits `agent/extensions/subagent/` in the repo, run `./install.sh` before relying on autosync, otherwise the next resync from `~/.pi/agent` can overwrite repo-only extension edits.

### Naming and structure

MVP file layout:

```text
agent/extensions/subagent/
  index.ts
  agents.ts
  rpc-client.ts
  transcript.ts
  ui.ts
  policy-child.ts
agent/agents/
  docs-researcher.md
  code-explorer.md
  reviewer.md
  worker.md
.scratch/pi-subagent-search-switching/
  PRD.md
  map.md
  issues/*.md
docs/agents/issue-tracker.md
```

### Documentation needed

- Update `README.md` to list `agent/agents/` as tracked and `agent/subagents/` as not tracked.
- Keep `docs/agents/issue-tracker.md` as the Wayfinder/local tracker contract.
- When implementation lands, add short usage docs for `/agents`, default agent files, and the install/resync rule: **install repo changes into `~/.pi/agent` before autosync/resync**.

## Map pointer

Rollout decision: ship the MVP first as local `pi-configs` global resources under `agent/extensions/subagent/` and `agent/agents/`, update install/resync scripts to round-trip `agent/agents/`, keep runtime child state out of git under `~/.pi/agent/subagents/`, then extract a reusable Pi package/upstream example only after the local RPC `/agents` design proves stable.
