---
name: omarchy-remote-desktop
description: Connect to and control Rachit's Omarchy/Arch Linux desktop over Tailscale using SSH, tmux, Sunshine, and Moonlight. Use when the user asks to use, debug, reconnect, maintain, or inspect the remote Omarchy desktop.
---

# Omarchy Remote Desktop

This skill records the working setup for Rachit's second desktop/laptop that is used as a remotely controlled desktop over Tailscale.

## Machines

### Control machine

- Role: local control space / current laptop
- Hostname: `Rachits-MacBook-Air.local`
- OS: macOS `26.5.1` build `25F80`
- Architecture: `arm64`
- Moonlight app: `/Applications/Moonlight.app`
- Moonlight CLI symlink: `/opt/homebrew/bin/moonlight`
- Tailscale CLI: `/opt/homebrew/bin/tailscale`

### Remote desktop

- Role: remote GUI desktop / machine to control
- Tailscale hostname: `omarchy`
- Tailscale IP: `100.76.100.66`
- SSH user: `rg`
- SSH target: `rg@100.76.100.66`
- OS: Arch Linux / Omarchy
- Kernel observed during setup: `Linux 7.0.10-arch1-1`
- Hardware vendor/model: `ASUSTeK COMPUTER INC. ASUS TUF Gaming A15 FA506IC_FA566IC`
- GPUs:
  - NVIDIA GA107M GeForce RTX 3050 Mobile
  - AMD Renoir Radeon Vega Series / Radeon Vega Mobile Series
- User groups for `rg`: `rg wheel input docker`

## Connectivity Model

- Tailscale is the private network layer.
- Normal SSH works over Tailscale:

```bash
ssh rg@100.76.100.66
```

- Interactive SSH shells auto-attach to tmux session `remote` via `~/.bashrc`:

```bash
if [[ -n "$SSH_CONNECTION" && -z "$TMUX" && -z "$SSH_ORIGINAL_COMMAND" ]]; then
  exec tmux new-session -A -s remote
fi
```

- Non-interactive SSH commands should continue to work because the tmux hook checks `SSH_ORIGINAL_COMMAND`.
- `rg` currently has passwordless sudo via `/etc/sudoers.d/90-rg-nopasswd`:

```sudoers
rg ALL=(ALL) NOPASSWD: ALL
```

Remove it later if desired:

```bash
sudo rm /etc/sudoers.d/90-rg-nopasswd
```

## Firewall / Ports

UFW is enabled on the remote desktop.

Default policy observed:

- incoming: deny
- outgoing: allow
- routed: disabled

Important Tailscale interface rules:

```bash
sudo ufw allow in on tailscale0 proto tcp to any port 22 comment "SSH over Tailscale"
sudo ufw allow in on tailscale0 proto tcp to any port 47984:48010 comment "Sunshine TCP over Tailscale"
sudo ufw allow in on tailscale0 proto udp to any port 47998:48010 comment "Sunshine UDP over Tailscale"
```

Sunshine listens on these TCP ports:

- `47984`
- `47989`
- `47990` HTTPS web UI
- `48010` RTSP/session

Moonlight stream uses UDP ports including:

- `47998` video
- `47999` control
- `48000` audio

## Remote Desktop Stack

- Server on remote: Sunshine
- Client on control machine: Moonlight
- Sunshine user service: `app-dev.lizardbyte.app.Sunshine.service`
- Sunshine status during setup: active and enabled

Check Sunshine:

```bash
ssh rg@100.76.100.66 'systemctl --user status app-dev.lizardbyte.app.Sunshine.service --no-pager'
```

Restart Sunshine:

```bash
ssh rg@100.76.100.66 'systemctl --user restart app-dev.lizardbyte.app.Sunshine.service'
```

View logs:

```bash
ssh rg@100.76.100.66 'journalctl --user -u app-dev.lizardbyte.app.Sunshine.service --no-pager -n 150'
```

Sunshine web UI:

```txt
https://100.76.100.66:47990
```

Credentials were configured during setup. Do not record secrets in this skill. If the web UI credentials are lost, reset them over SSH:

```bash
ssh rg@100.76.100.66 'sunshine --creds rg NEW_PASSWORD && systemctl --user restart app-dev.lizardbyte.app.Sunshine.service'
```

## Moonlight Usage

The host is paired already.

List apps:

```bash
/Applications/Moonlight.app/Contents/MacOS/Moonlight list 100.76.100.66
```

Known apps:

- `Desktop`
- `Low Res Desktop`
- `Steam Big Picture`

Start a desktop stream:

```bash
/Applications/Moonlight.app/Contents/MacOS/Moonlight stream 100.76.100.66 "Desktop" --1080 --fps 60 --bitrate 30000 --absolute-mouse --display-mode windowed
```

Or open Moonlight GUI and select:

```txt
omarchy -> Desktop
```

Pairing method used during setup:

1. Start Moonlight pairing with a PIN.
2. Submit the same PIN to Sunshine web API `/api/pin` using the Sunshine web credentials.
3. Verify with `moonlight list 100.76.100.66`.

If re-pairing manually, open Moonlight GUI, add `100.76.100.66`, then enter the shown PIN in the Sunshine web UI at `https://100.76.100.66:47990`.

## What The Agent Can Do

With SSH + passwordless sudo, the agent can:

- run commands on the remote desktop over Tailscale;
- stay resilient across terminal disconnects via tmux;
- install/update packages with `pacman`/`yay`;
- manage `sshd`, `tailscaled`, `ufw`, and Sunshine services;
- inspect hardware, sessions, logs, and listening ports;
- launch or debug Moonlight streams from the control machine;
- reset Sunshine credentials if the user provides a new password;
- maintain the remote desktop as a GUI worker machine.

## Safety Rules

- Prefer Tailscale IP/hostname; do not expose Sunshine or SSH publicly.
- Do not print or persist passwords/API secrets in transcripts or skill files.
- Preserve the tmux auto-attach behavior for interactive SSH.
- Before changing firewall rules, ensure SSH over `tailscale0` remains allowed.
- Before removing passwordless sudo, confirm with the user because it affects agent maintainability.

## Quick Health Check

Run this from the control machine:

```bash
tailscale ping -c 3 100.76.100.66
ssh rg@100.76.100.66 'echo ssh-ok; tmux -V; sudo -n true && echo sudo-ok; systemctl --user is-active app-dev.lizardbyte.app.Sunshine.service; ss -lntup | grep -E "47984|47989|47990|48010" || true'
/Applications/Moonlight.app/Contents/MacOS/Moonlight list 100.76.100.66
```
