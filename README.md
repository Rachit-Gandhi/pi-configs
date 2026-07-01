# Pi Configs

Source-controlled, non-secret pi configuration for this machine.

## Tracked custom pi resources

This repo is set up to track pi customizations from `~/.pi/agent/`:

- `agent/settings.json` - pi settings, package refs, default provider/model, etc.
- `agent/models.json` - custom model/provider definitions, if present.
- `agent/keybindings.json` - custom TUI keybindings, if present.
- `agent/AGENTS.md` - global instructions, if present.
- `agent/SYSTEM.md` / `agent/APPEND_SYSTEM.md` - global system prompt customizations, if present.
- `agent/extensions/` - global pi extensions.
- `agent/skills/` - global skills.
- `agent/prompts/` - global prompt templates.
- `agent/themes/` - global themes.

## Not tracked

These are intentionally excluded because they are secrets, machine state, or generated installs:

- `agent/auth.json`
- `agent/sessions/`
- `agent/trust.json`
- `agent/npm/`
- `agent/git/`
- `*.jsonl`
- `.env*`

Package references should be tracked through `agent/settings.json`; installed package contents under `agent/npm/` and `agent/git/` are generated/cache state.

## Sync from this machine into git

```bash
./sync-from-pi.sh
git add .
git commit -m "Update pi config"
git push
```

## Install / restore into pi's correct global locations

```bash
./install.sh
```

This copies files into `~/.pi/agent/`, pi's global config and auto-discovery directory.
