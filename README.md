# Pi Configs

Source-controlled, non-secret pi configuration for this machine.

## Contents

- `agent/settings.json` - pi agent preferences/model defaults.
- `agent/extensions/repo-cleanup-agent.ts` - workspace repo cleanup extension.

## Not committed

The following are intentionally excluded because they contain secrets or noisy local state:

- `agent/auth.json`
- `agent/sessions/`
- `*.jsonl`
- `.env*`

## Install / sync to the correct pi locations

```bash
./install.sh
```

This copies files into `~/.pi/agent/`, which is the correct global auto-discovery location for pi agent settings and extensions.
