# Pi Configs

Source-controlled, non-secret pi configuration for this machine.

## One-command restore / setup

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/Rachit-Gandhi/pi-configs/main/install.sh | bash
```

Windows PowerShell:

```powershell
iwr -UseB https://raw.githubusercontent.com/Rachit-Gandhi/pi-configs/main/install.ps1 | iex
```

Manual clone on any OS:

```bash
git clone https://github.com/Rachit-Gandhi/pi-configs.git ~/workspace/github.com/Rachit-Gandhi/pi-configs
cd ~/workspace/github.com/Rachit-Gandhi/pi-configs
./install.sh        # macOS / Linux
# or: .\install.ps1 # Windows PowerShell
```

Override locations with `PI_CONFIG_REPO`, `PI_CONFIG_REPO_URL`, and `PI_CODING_AGENT_DIR` if needed.

## Tracked custom pi resources

This repo is set up to track pi customizations from `~/.pi/agent/`:

- `agent/settings.json` - pi settings, package refs, default provider/model, etc.
- `agent/models.json` - custom model/provider definitions, if present.
- `agent/keybindings.json` - custom TUI keybindings, if present.
- `agent/AGENTS.md` - global instructions, if present.
- `agent/SYSTEM.md` / `agent/APPEND_SYSTEM.md` - global system prompt customizations, if present.
- `agent/extensions/` - global pi extensions, including Herdr agent-state integration.
- `agent/extensions.disabled/` - disabled global extensions kept for restore parity.
- `agent/skills/` - global skills, including vendored skill repos with nested `.git` metadata stripped.
- `agent/agents/` - global subagent definitions.
- `agent/prompts/` - global prompt templates.
- `agent/themes/` - global themes.
- `agent/research/` - non-secret research notes created for pi work.
- `agent/bin/` - non-secret helper scripts.

## Not tracked

These are intentionally excluded because they are secrets, machine state, or generated installs:

- `agent/auth.json`
- `agent/sessions/`
- `agent/subagents/`
- `agent/trust.json`
- `agent/npm/`
- `agent/git/`
- Nested `.git/` directories inside copied resources
- `node_modules/`
- `*.jsonl`
- `.env*`

Package references should be tracked through `agent/settings.json`; installed package contents under `agent/npm/` and `agent/git/` are generated/cache state.

## Sync from this machine into git

macOS / Linux:

```bash
./sync-from-pi.sh
git add .
git commit -m "Update pi config"
git push
```

Windows PowerShell:

```powershell
.\sync-from-pi.ps1
git add .
git commit -m "Update pi config"
git push
```

Inside pi, `/pi-config-sync` force-syncs and commits these non-secret resources. `/pi-config-sync setup` or `/pi-config-setup` prints the macOS, Linux, and Windows restore commands.

## Install / restore into pi's correct global locations

```bash
./install.sh       # macOS / Linux
.\install.ps1     # Windows PowerShell
```

This mirrors tracked files into `~/.pi/agent/`, pi's global config and auto-discovery directory. Run `/reload` inside pi afterwards.
