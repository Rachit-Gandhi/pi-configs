#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

mkdir -p "$ROOT/agent"

# Top-level custom/config files that are safe to source-control.
for file in \
  settings.json \
  models.json \
  keybindings.json \
  AGENTS.md \
  SYSTEM.md \
  APPEND_SYSTEM.md; do
  if [ -f "$PI_AGENT_DIR/$file" ]; then
    mkdir -p "$ROOT/agent"
    cp "$PI_AGENT_DIR/$file" "$ROOT/agent/$file"
  fi
done

# User-authored resources. These are pi's global auto-discovery locations.
for dir in extensions skills prompts themes; do
  if [ -d "$PI_AGENT_DIR/$dir" ]; then
    rm -rf "$ROOT/agent/$dir"
    mkdir -p "$ROOT/agent"
    cp -R "$PI_AGENT_DIR/$dir" "$ROOT/agent/$dir"
  fi
done

echo "Synced non-secret pi config from $PI_AGENT_DIR into $ROOT/agent"
