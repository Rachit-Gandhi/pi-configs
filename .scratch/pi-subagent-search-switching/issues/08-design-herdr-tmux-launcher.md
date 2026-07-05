# Redesign launcher around Herdr/tmux

Type: research
Status: resolved
Blocked by:
Parent: ../map.md

## Question

How should the revised Pi subagent feature launch Pi under Herdr when available, or tmux as a fallback, so users always get a multiplexer-backed subagent workspace?

## Requirements

- Prefer Herdr when `herdr` is available.
- Fall back to tmux when Herdr is unavailable and `tmux` is available.
- If neither is available, Pi should still run with a degraded in-TUI/overlay mode and a clear warning.
- Preserve compatibility with `pi-configs` install/resync.
- Avoid changing Pi core until extension/wrapper feasibility is proven.

## Exit criteria

- Identify relevant Herdr and tmux commands/APIs.
- Decide wrapper/extension responsibilities.
- Define launch detection/order and environment variables.
- Define what happens when already inside Herdr/tmux.
- Provide a `## Map pointer` one-liner.

## Answer

### Local command/API findings

Herdr is installed at `/opt/homebrew/bin/herdr` (`0.7.1`); tmux is not installed on this machine (`tmux: command not found`).

Relevant Herdr surface:

- `herdr` launches/attaches the persistent default session; `herdr --session <name>` or `herdr session attach <name>` uses a named persistent session. `herdr status` reports client/server/protocol/socket state.
- `herdr workspace create [--cwd PATH] [--label TEXT] [--env KEY=VALUE] [--focus|--no-focus]` creates the project container; `workspace list/get/focus/rename/close` are available.
- `herdr pane split ... --direction right|down [--ratio FLOAT] [--cwd PATH] [--env KEY=VALUE]` creates panes; `pane run`, `pane read`, `pane focus`, `pane resize`, `pane zoom`, `pane close`, `pane list/current/get/layout/process-info` cover orchestration/debugging.
- `herdr agent start <name> [--cwd PATH] [--workspace ID] [--tab ID] [--split right|down] [--env KEY=VALUE] [--focus|--no-focus] -- <argv...>` starts an agent terminal directly. `agent list/get/read/send/focus/wait/attach/rename/explain` can inspect and control it.
- `herdr pane report-agent <pane_id> --source ID --agent LABEL --state idle|working|blocked|unknown [--message TEXT] [--custom-status TEXT] [--agent-session-id ID] [--agent-session-path PATH]` and `report-agent-session` are the key sidebar-state APIs. `pane report-metadata` can change visual labels without taking lifecycle authority.
- `herdr integration install pi` writes Herdr's bundled Pi state extension to `~/.pi/agent/extensions/herdr-agent-state.ts`, or `$PI_CODING_AGENT_DIR/extensions/herdr-agent-state.ts`; current `herdr integration status` says it is not installed. Pi is a lifecycle-authority integration and can report state/session identity to Herdr.
- Herdr injects managed-pane env: `HERDR_SOCKET_PATH`, `HERDR_ENV=1`, `HERDR_WORKSPACE_ID`, `HERDR_TAB_ID`, `HERDR_PANE_ID`; plugin/action contexts may also receive `HERDR_BIN_PATH` and active workspace/tab/pane/cwd vars. Config envs include `HERDR_CONFIG_PATH`, `HERDR_SESSION`, `HERDR_SOCKET_PATH`, `HERDR_LOG`, `HERDR_DISABLE_SOUND`. The changelog also notes `HERDR_AGENT=<agent>` as a foreground-process hint for wrappers.
- Herdr protects against nested Herdr by default (`[experimental] allow_nested = false`), so already-inside detection should not launch another Herdr client.
- Herdr sidebar is built in: config exposes `toggle_sidebar`, `agent_panel_sort = "spaces"|"priority"`, widths, and agent panel behavior. This should be the P0 visibility surface; Pi only needs to report state and provide optional richer transcript controls.

Tmux fallback surface if installed later:

- Detect with `command -v tmux` and `$TMUX` for inside-session state.
- Use a deterministic session name, e.g. `pi-${repoSlug}`; create/attach with `tmux new-session -A -s "$session" -c "$cwd" "pi ..."`.
- Create sidebar/worker panes with `tmux split-window -h -l <cols>` or `-p <percent>`, `tmux send-keys`, `tmux select-pane`, `tmux respawn-pane`, `tmux capture-pane -p -S -<lines>`, `tmux list-panes -F ...`, and `tmux attach -t "$session"`.
- Tmux has no native agent status model, so the sidebar must be a Pi-owned status pane running a small watcher/TUI that reads the same subagent state store/events used by the parent Pi extension.

### Decision

Add a thin launch wrapper in `pi-configs` first; keep Pi core unchanged until the wrapper + extension seam is proven.

Wrapper responsibilities:

1. Detect context and choose multiplexer: Herdr first, then tmux, then degraded Pi.
2. Set stable env for the Pi session: `PI_SUBAGENTS_MULTIPLEXER=herdr|tmux|none`, `PI_SUBAGENTS_SESSION=<stable-name>`, `PI_SUBAGENTS_PARENT_CWD=<cwd>`, and when known `PI_SUBAGENTS_HERDR_WORKSPACE_ID`, `PI_SUBAGENTS_HERDR_PANE_ID`, or `PI_SUBAGENTS_TMUX_SESSION`.
3. Avoid recursion with `PI_SUBAGENTS_LAUNCHER_ACTIVE=1` and existing multiplexer vars (`HERDR_ENV=1`, `HERDR_SOCKET_PATH`, `TMUX`).
4. Launch/attach the multiplexer and run the real `pi` inside it.
5. Print a clear warning and exec normal `pi` when neither Herdr nor tmux exists.

Extension responsibilities:

1. Keep implementing subagent execution, persistence, allowlists, approvals, and summaries inside Pi.
2. Emit Herdr sidebar state when `PI_SUBAGENTS_MULTIPLEXER=herdr` and `HERDR_PANE_ID`/`HERDR_SOCKET_PATH` are present, preferably via `pane.report-agent`/`pane.report-metadata`; do not require global `herdr integration install pi` for MVP, but recommend/detect it.
3. Emit/update a local state file/event stream for tmux mode so a tmux sidebar pane can render subagent status.
4. Maintain degraded in-TUI widget/overlay behavior for `PI_SUBAGENTS_MULTIPLEXER=none` and for noninteractive/headless sessions.

Already-inside behavior:

- Inside Herdr (`HERDR_ENV=1` or `HERDR_SOCKET_PATH`/`HERDR_PANE_ID` present): do not run `herdr` again. Exec `pi` in the current pane and let the extension report the current pane as the parent Pi. Subagents can later be started with `herdr agent start` or pane splits against the current workspace/tab.
- Inside tmux (`$TMUX` present) and not inside Herdr: do not nest tmux. Exec `pi` in the current pane; if a sidebar is missing, the extension or command can create a split via tmux commands.
- Inside neither: in Herdr mode, bootstrap a named Herdr session, create/focus a repo workspace, start the parent Pi as a managed agent pane, then attach the Herdr client. If Herdr is missing, use tmux. If both missing, warn and exec plain `pi`.

### Launch flow/pseudocode

```bash
pi_real="${PI_REAL_BIN:-pi}"
cwd="$(pwd)"
session="pi-$(basename "$cwd" | tr -cs 'A-Za-z0-9_.-' '-')"

if [ "${PI_SUBAGENTS_LAUNCHER_ACTIVE:-}" = 1 ]; then
  exec "$pi_real" "$@"
fi
export PI_SUBAGENTS_LAUNCHER_ACTIVE=1
export PI_SUBAGENTS_SESSION="$session"
export PI_SUBAGENTS_PARENT_CWD="$cwd"

if [ "${HERDR_ENV:-}" = 1 ] || [ -n "${HERDR_SOCKET_PATH:-}" ]; then
  export PI_SUBAGENTS_MULTIPLEXER=herdr
  exec "$pi_real" "$@"
elif [ -n "${TMUX:-}" ]; then
  export PI_SUBAGENTS_MULTIPLEXER=tmux
  export PI_SUBAGENTS_TMUX_SESSION="${TMUX_PANE:-unknown}"
  exec "$pi_real" "$@"
elif command -v herdr >/dev/null 2>&1; then
  export PI_SUBAGENTS_MULTIPLEXER=herdr
  # Bootstrap named Herdr session if needed; exact implementation can use
  # HERDR_SESSION="$session" herdr server in the background plus socket/CLI waits.
  ensure_herdr_server "$session"
  workspace_id="$(herdr --session "$session" workspace create --cwd "$cwd" --label "$session" --no-focus | parse_workspace_id)"
  herdr --session "$session" agent start parent-pi \
    --cwd "$cwd" \
    --workspace "$workspace_id" \
    --env PI_SUBAGENTS_MULTIPLEXER=herdr \
    --env PI_SUBAGENTS_SESSION="$session" \
    --focus \
    -- "$pi_real" "$@"
  exec herdr session attach "$session"
elif command -v tmux >/dev/null 2>&1; then
  export PI_SUBAGENTS_MULTIPLEXER=tmux
  exec tmux new-session -A -s "$session" -c "$cwd" "$pi_real $(printf '%q ' "$@")"
else
  export PI_SUBAGENTS_MULTIPLEXER=none
  printf 'warning: Herdr and tmux are unavailable; Pi subagents will use degraded in-TUI visibility only.\n' >&2
  exec "$pi_real" "$@"
fi
```

Implementation details to verify in the first spike: `herdr` itself primarily attaches the client, so the reliable launcher is likely a two-phase bootstrap: start or reuse a named session server, create/focus the workspace, start `pi` with `herdr agent start ... -- pi ...`, then attach. Prefer raw socket calls or JSON-capable commands where possible for stable workspace/pane IDs; if CLI output is not machine-readable enough, write a tiny Node/Bun socket client in the wrapper package.

### Resync compatibility notes

- Do not install Herdr's generated `herdr-agent-state.ts` into this repo silently. `sync-from-pi.sh` would otherwise copy it into `agent/extensions/` and make generated integration code look user-authored. Either document `herdr integration install pi` as optional local setup, or vendor a small pi-configs-owned Herdr bridge extension with a different filename and expected source.
- Existing `install.sh`/`sync-from-pi.sh` already round-trip `agent/extensions` and future `agent/agents`; add any wrapper under a repo-owned path such as `bin/pi-herdr` or `agent/prompts`, then update scripts intentionally if a new copied directory is needed.
- Runtime state must stay outside git, e.g. `~/.pi/agent/subagents/` or `~/.local/state/pi-subagents/`; the Herdr session files remain under Herdr config/session dirs.
- The wrapper must preserve normal `PI_CODING_AGENT_DIR` behavior so users can install this repo to an alternate Pi agent directory.
- Resync should not overwrite user Herdr config (`~/.config/herdr/config.toml`) or run `herdr integration install pi`; those are machine-local setup steps.

## Map pointer

Use Herdr as the preferred launcher/sidebar via a pi-configs wrapper plus Pi extension state reports, fall back to tmux with a Pi-owned status pane, and retain degraded in-TUI visibility when neither multiplexer exists.
