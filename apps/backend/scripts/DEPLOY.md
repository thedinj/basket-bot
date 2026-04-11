# Deployment Guide

Basket Bot is the **canonical source** for the shared deploy scripts (`install.sh`,
`update.sh`). Installing it also registers `pi-app-install` and `pi-app-update`
system-wide so other apps (e.g. Chance-a-Maran) can be deployed without
re-cloning this repo.

---

## Prerequisites (one-time, per Pi)

```bash
# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version && npm --version

# SSH in as the admin user
ssh admin@your-pi-hostname
```

---

## 1. Install Basket Bot (do this first)

Basket Bot must be installed before any other app — it sets up the shared
`pi-app-install` / `pi-app-update` commands.

```bash
cd ~
git clone https://github.com/thedinj/basket-bot.git
cd ~/basket-bot && git config core.filemode false
chmod +x apps/backend/scripts/*.sh
./apps/backend/scripts/install.sh
```

**Interactive prompts during install:**
- Edit `.env` — set `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` (press Enter when done)
- Enable HTTPS? → `y`, then enter `basketbot.ddns.net`
- Install Samba? → `y` or `n`

After install, `pi-app-install` and `pi-app-update` are available system-wide.

---

## 2. Install Chance-a-Maran (after Basket Bot)

First, bring the hoisted scripts up to date with the latest fixes from this repo.
Use bootstrap if you only want to refresh the scripts without a full basket-bot
build/restart cycle:

```bash
# Fast — pull latest scripts and hoist, no build or service restart
cd ~/basket-bot && git pull && apps/backend/scripts/bootstrap.sh

# Full — pull, rebuild, restart basket-bot, then hoist (use when updating basket-bot itself)
cd ~/basket-bot/apps/backend/scripts && ./update.sh
```

Then clone and install Chance:

```bash
cd ~
git clone https://github.com/thedinj/chance-a-maran.git
cd ~/chance-a-maran && git config core.filemode false
chmod +x apps/backend/scripts/*.sh
pi-app-install ~/chance-a-maran/apps/backend/scripts/deploy.config.sh
```

**Interactive prompts during install:**
- Edit `.env` — confirm `PORT=3001`, set admin credentials
- Enable HTTPS? → `y`, then enter `chanceamaran.ddns.net`
- Install Samba? → existing shares will be reused, safe to say `y` or `n`

---

## Updating

### Update Basket Bot

Always update Basket Bot first — this also refreshes the hoisted `pi-app-update`
script so subsequent app updates use the latest version.

```bash
cd ~/basket-bot/apps/backend/scripts && ./update.sh
```

Or via the hoisted command (it self-re-execs from the local copy):

```bash
pi-app-update ~/basket-bot/apps/backend/scripts/deploy.config.sh
```

### Update Chance-a-Maran

```bash
pi-app-update ~/chance-a-maran/apps/backend/scripts/deploy.config.sh
```

### Update both in one go

```bash
cd ~/basket-bot/apps/backend/scripts && ./update.sh && \
pi-app-update ~/chance-a-maran/apps/backend/scripts/deploy.config.sh
```

### Skip flags

The update script uses incremental builds — it skips packages whose source hasn't
changed since the last successful build. You can also force-skip builds manually:

```bash
# Skip only the backend build (e.g. frontend-only change)
pi-app-update ~/chance-a-maran/apps/backend/scripts/deploy.config.sh --skip-backend

# Skip only the frontend build (e.g. backend-only change)
pi-app-update ~/chance-a-maran/apps/backend/scripts/deploy.config.sh --skip-frontend

# Skip all builds — just pull, migrate, and restart the service
pi-app-update ~/chance-a-maran/apps/backend/scripts/deploy.config.sh --skip-builds
```

Flags work before or after the config path. Skipping a build does **not** update
that package's marker file, so the next regular update will still detect any
accumulated changes correctly.

---

## Useful commands

```bash
# Service status
sudo systemctl status basket-bot-backend
sudo systemctl status chance-a-maran-backend

# Live logs
sudo journalctl -u basket-bot-backend -f
sudo journalctl -u chance-a-maran-backend -f

# Caddy
sudo systemctl status caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy

# Refresh hoisted scripts only (no build or service restart)
cd ~/basket-bot && git pull && apps/backend/scripts/bootstrap.sh
```

---

## Port map

| App            | Backend port | Frontend         | Domain                   |
|----------------|-------------|-----------------|--------------------------|
| Basket Bot     | 3000        | None (API only) | basketbot.ddns.net       |
| Chance-a-Maran | 3001        | Vite SPA (static, served by Caddy) | chanceamaran.ddns.net |

Both backends are **localhost-only** — Caddy is the sole public entry point on
ports 80/443. Neither backend port is opened in the firewall.
