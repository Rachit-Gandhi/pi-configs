#!/usr/bin/env bash
set -euo pipefail

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

mkdir -p "$ROOT/agent"

# Top-level custom/config files that are safe to source-control.
for file in "${TRACKED_FILES[@]}"; do
  if [ -f "$PI_AGENT_DIR/$file" ]; then
    cp "$PI_AGENT_DIR/$file" "$ROOT/agent/$file"
  else
    rm -f "$ROOT/agent/$file"
  fi
done

# User-authored resources and non-secret helper artifacts. Mirror these so the
# repo exactly reflects the current safe pi config, excluding generated installs
# and nested git metadata from vendored skill/extension repos.
for dir in "${TRACKED_DIRS[@]}"; do
  if [ -d "$PI_AGENT_DIR/$dir" ]; then
    copy_tree "$PI_AGENT_DIR/$dir" "$ROOT/agent/$dir"
  else
    rm -rf "$ROOT/agent/$dir"
  fi
done

echo "Synced non-secret pi config from $PI_AGENT_DIR into $ROOT/agent"
