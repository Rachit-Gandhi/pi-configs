$ErrorActionPreference = "Stop"

$RepoUrl = if ($env:PI_CONFIG_REPO_URL) {
  $env:PI_CONFIG_REPO_URL
} else {
  "https://github.com/Rachit-Gandhi/pi-configs.git"
}

$ConfigRepo = if ($env:PI_CONFIG_REPO) {
  $env:PI_CONFIG_REPO
} else {
  Join-Path $HOME "workspace/github.com/Rachit-Gandhi/pi-configs"
}

$Root = $PSScriptRoot

$PiAgentDir = if ($env:PI_CODING_AGENT_DIR) {
  $env:PI_CODING_AGENT_DIR
} else {
  Join-Path $HOME ".pi/agent"
}

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

# When run with: iwr ... | iex
# $PSScriptRoot is empty, so use the cloned repo path instead.
if (-not $Root -or -not (Test-Path -LiteralPath (Join-Path $Root "agent") -PathType Container)) {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git is required when running install.ps1 directly from Invoke-WebRequest"
  }

  if (Test-Path -LiteralPath (Join-Path $ConfigRepo ".git") -PathType Container) {
    git -C $ConfigRepo pull --ff-only | Out-Null
  } else {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ConfigRepo) | Out-Null
    git clone --depth 1 $RepoUrl $ConfigRepo | Out-Null
  }

  $Root = $ConfigRepo
}

$AgentRoot = Join-Path $Root "agent"

if (-not (Test-Path -LiteralPath $AgentRoot -PathType Container)) {
  throw "Agent config folder not found: $AgentRoot"
}

function Remove-IfExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

function Clean-GeneratedState {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    return
  }

  Get-ChildItem -LiteralPath $Path -Recurse -Force -Directory |
    Where-Object { $_.Name -in @(".git", "node_modules") } |
    Sort-Object FullName -Descending |
    Remove-Item -Recurse -Force

  Get-ChildItem -LiteralPath $Path -Recurse -Force -File -Filter ".DS_Store" |
    Remove-Item -Force
}

function Copy-Tree {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(Mandatory = $true)]
    [string]$Target
  )

  Remove-IfExists $Target
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Target -Recurse -Force
  Clean-GeneratedState $Target
}

New-Item -ItemType Directory -Force -Path $PiAgentDir | Out-Null

foreach ($File in $TrackedFiles) {
  $Source = Join-Path $AgentRoot $File
  $Target = Join-Path $PiAgentDir $File

  if (Test-Path -LiteralPath $Source -PathType Leaf) {
    Copy-Item -LiteralPath $Source -Destination $Target -Force
  } else {
    Remove-IfExists $Target
  }
}

foreach ($Dir in $TrackedDirs) {
  $Source = Join-Path $AgentRoot $Dir
  $Target = Join-Path $PiAgentDir $Dir

  if (Test-Path -LiteralPath $Source -PathType Container) {
    Copy-Tree $Source $Target
  } else {
    Remove-IfExists $Target
  }
}

Write-Host "Installed pi config to $PiAgentDir"
Write-Host "Synced repo location: $Root"
Write-Host "Run /reload inside pi to reload extensions, skills, prompts, and themes."
