#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${PI_CONFIG_REPO_URL:-https://github.com/Rachit-Gandhi/pi-configs.git}"
CONFIG_REPO="${PI_CONFIG_REPO:-$HOME/workspace/github.com/Rachit-Gandhi/pi-configs}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

TRACKED_FILES=(
  settings.json
  models.json
  keybindings.json
  AGENTS.md
  SYSTEM.md
  APPEND_SYSTEM.md
)

TRACKED_DIRS=(
  extensions
  extensions.disabled
  skills
  agents
  prompts
  themes
  research
  bin
)

if [ ! -d "$ROOT/agent" ]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "git is required when running install.sh directly from curl" >&2
    exit 1
  fi
  if [ -d "$CONFIG_REPO/.git" ]; then
    git -C "$CONFIG_REPO" pull --ff-only >/dev/null
  else
    mkdir -p "$(dirname "$CONFIG_REPO")"
    git clone --depth 1 "$REPO_URL" "$CONFIG_REPO" >/dev/null
  fi
  ROOT="$CONFIG_REPO"
fi

cleanup_generated_state() {
  local target="$1"
  [ -d "$target" ] || return 0
  find "$target" \( -name .git -o -name node_modules \) -prune -exec rm -rf {} +
  find "$target" -name .DS_Store -type f -delete
}

copy_tree() {
  local source="$1"
  local target="$2"
  rm -rf "$target"
  mkdir -p "$(dirname "$target")"
  cp -R "$source" "$target"
  cleanup_generated_state "$target"
}

mkdir -p "$PI_AGENT_DIR"

for file in "${TRACKED_FILES[@]}"; do
  if [ -f "$ROOT/agent/$file" ]; then
    cp "$ROOT/agent/$file" "$PI_AGENT_DIR/$file"
  else
    rm -f "$PI_AGENT_DIR/$file"
  fi
done

for dir in "${TRACKED_DIRS[@]}"; do
  if [ -d "$ROOT/agent/$dir" ]; then
    copy_tree "$ROOT/agent/$dir" "$PI_AGENT_DIR/$dir"
  else
    rm -rf "$PI_AGENT_DIR/$dir"
  fi
done

echo "Installed pi config to $PI_AGENT_DIR"
echo "Synced repo location: $ROOT"
echo "Run /reload inside pi to reload extensions, skills, prompts, and themes."
