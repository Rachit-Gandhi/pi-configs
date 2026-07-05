#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

mkdir -p "$PI_AGENT_DIR"

for file in \
  settings.json \
  models.json \
  keybindings.json \
  AGENTS.md \
  SYSTEM.md \
  APPEND_SYSTEM.md; do
  if [ -f "$ROOT/agent/$file" ]; then
    cp "$ROOT/agent/$file" "$PI_AGENT_DIR/$file"
  fi
done

for dir in extensions skills agents prompts themes; do
  if [ -d "$ROOT/agent/$dir" ]; then
    mkdir -p "$PI_AGENT_DIR/$dir"
    cp -R "$ROOT/agent/$dir/." "$PI_AGENT_DIR/$dir/"
  fi
done

echo "Installed pi config to $PI_AGENT_DIR"
