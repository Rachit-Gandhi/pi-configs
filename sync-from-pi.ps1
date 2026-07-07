$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$PiAgentDir = if ($env:PI_CODING_AGENT_DIR) { $env:PI_CODING_AGENT_DIR } else { Join-Path $HOME ".pi/agent" }

$TrackedFiles = @(
  "settings.json",
  "models.json",
  "keybindings.json",
  "AGENTS.md",
  "SYSTEM.md",
  "APPEND_SYSTEM.md"
)

$TrackedDirs = @(
  "extensions",
  "extensions.disabled",
  "skills",
  "agents",
  "prompts",
  "themes",
  "research",
  "bin"
)

function Remove-IfExists([string]$Path) {
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

function Clean-GeneratedState([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return }
  Get-ChildItem -LiteralPath $Path -Recurse -Force -Directory |
    Where-Object { $_.Name -in @(".git", "node_modules") } |
    Sort-Object FullName -Descending |
    Remove-Item -Recurse -Force
  Get-ChildItem -LiteralPath $Path -Recurse -Force -File -Filter ".DS_Store" |
    Remove-Item -Force
}

function Copy-Tree([string]$Source, [string]$Target) {
  Remove-IfExists $Target
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Target -Recurse -Force
  Clean-GeneratedState $Target
}

$AgentRoot = Join-Path $Root "agent"
New-Item -ItemType Directory -Force -Path $AgentRoot | Out-Null

foreach ($File in $TrackedFiles) {
  $Source = Join-Path $PiAgentDir $File
  $Target = Join-Path $AgentRoot $File
  if (Test-Path -LiteralPath $Source -PathType Leaf) {
    Copy-Item -LiteralPath $Source -Destination $Target -Force
  } else {
    Remove-IfExists $Target
  }
}

foreach ($Dir in $TrackedDirs) {
  $Source = Join-Path $PiAgentDir $Dir
  $Target = Join-Path $AgentRoot $Dir
  if (Test-Path -LiteralPath $Source -PathType Container) {
    Copy-Tree $Source $Target
  } else {
    Remove-IfExists $Target
  }
}

Write-Host "Synced non-secret pi config from $PiAgentDir into $AgentRoot"
