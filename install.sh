#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_AGENT_DIR="$HOME/.pi/agent"

mkdir -p "$PI_AGENT_DIR/extensions"
cp "$ROOT/agent/settings.json" "$PI_AGENT_DIR/settings.json"
cp "$ROOT/agent/extensions/"*.ts "$PI_AGENT_DIR/extensions/"

echo "Installed pi config to $PI_AGENT_DIR"
