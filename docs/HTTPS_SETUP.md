# HTTPS Setup Guide — Basket Bot Production Deployment

This guide covers enabling free HTTPS for the Basket Bot backend using **Caddy**, a modern web server with automatic Let's Encrypt certificate provisioning and renewal.

## Why Caddy?

Caddy is the recommended choice for Raspberry Pi deployments because:

- **Zero-config HTTPS**: Automatically obtains and renews Let's Encrypt certificates
- **Simple configuration**: Minimal Caddyfile (typically 5-10 lines)
- **Perfect for home servers**: Handles dynamic IP scenarios gracefully
- **Built-in reverse proxy**: No separate tools needed

Alternative approaches (nginx + Certbot) work but require more manual setup and maintenance.

---

## Prerequisites

### 1. Domain Name

You **must** have a domain name that points to your Raspberry Pi. HTTPS certificates cannot be issued for IP addresses.

**Free dynamic DNS options** (if you don't own a domain):

- [DuckDNS](https://www.duckdns.org/) — Free subdomains (e.g., `yourapp.duckdns.org`)
- [No-IP](https://www.noip.com/) — Free dynamic DNS with 30-day renewal (see setup instructions below)
- [FreeDNS](https://freedns.afraid.org/) — Free subdomains

**If you own a domain:**

- Create an A record pointing to your Pi's public IP
- Example: `basketbot.yourdomain.com` → `203.0.113.42`

#### Setting up No-IP Dynamic DNS Client (Raspbian)

If using No-IP, install their Dynamic Update Client (DUC) to automatically keep your hostname updated:

1. **Create a No-IP account and hostname** at [www.noip.com](https://www.noip.com/)

2. **Install dependencies:**

    ```bash
    sudo apt update
    sudo apt install -y build-essential
    ```

3. **Download and extract the No-IP client:**

    ```bash
    cd /usr/local/src
    sudo wget https://dmej72pbq76ed.cloudfront.net/novell/noip-duc_3.3.0.tar.gz
    sudo tar xzf noip-duc_3.3.0.tar.gz
    cd noip-duc_3.3.0
    ```

4. **Build and install:**

    ```bash
    sudo make
    sudo make install
    ```

5. **Configure the client:**

    ```bash
    sudo noip-duc --username your-email@example.com --password your-password \
        --hostnames your-hostname.ddns.net --daemon
    ```

6. **Create systemd service** for automatic startup:

    ```bash
    sudo tee /etc/systemd/system/noip-duc.service > /dev/null <<EOF
    [Unit]
    Description=No-IP Dynamic DNS Update Client
    After=network.target

    [Service]
    Type=forking
    ExecStart=/usr/local/bin/noip-duc --username your-email@example.com --password your-password --hostnames your-hostname.ddns.net --daemon
    Restart=always
    RestartSec=60

    [Install]
    WantedBy=multi-user.target
    EOF
    ```

7. **Enable and start the service:**

    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable noip-duc
    sudo systemctl start noip-duc
    ```

8. **Verify status:**
    ```bash
    sudo systemctl status noip-duc
    ```

**Note:** Free No-IP hostnames require confirmation every 30 days via email. Paid accounts remove this requirement.

### 2. Port Forwarding

Configure your router to forward port **443** (HTTPS) and optionally port **80** (HTTP redirect) to your Raspberry Pi's local IP address.

Steps (vary by router):

1. Find your Pi's local IP: `hostname -I | awk '{print $1}'`
2. Access your router admin panel (typically `192.168.1.1` or `192.168.0.1`)
3. Navigate to Port Forwarding / Virtual Server / NAT settings
4. Add forwarding rules:
    - External Port **443** → Internal IP `<Pi IP>`, Internal Port **443** (TCP)
    - External Port **80** → Internal IP `<Pi IP>`, Internal Port **80** (TCP)

### 3. Firewall Configuration

The Pi's firewall must allow incoming HTTPS traffic. If you've already run `install.sh`, port 3000 is open. You'll need to open port 443 as well (automated in the install script if you enable HTTPS).

Manual firewall configuration:

```bash
# ufw
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp  # For HTTP→HTTPS redirect

# iptables
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo sh -c "iptables-save > /etc/iptables/rules.v4"  # Persist rules
```

---

## Installation

### Option A: Automated (Recommended)

When running the backend installation script, answer **Yes** when prompted to enable HTTPS:

```bash
cd apps/backend/scripts
./install.sh
```

The script will:

1. Prompt for your domain name
2. Install Caddy
3. Create Caddyfile with reverse proxy configuration
4. Configure firewall rules (ports 80, 443)
5. Set up systemd service for Caddy
6. Automatically obtain Let's Encrypt certificate

### Option B: Manual Setup

If you've already installed the backend without HTTPS, follow these steps:

#### 1. Install Caddy

```bash
# Debian/Ubuntu/Raspbian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

#### 2. Create Caddyfile

Create `/etc/caddy/Caddyfile`:

```caddy
# Replace with your actual domain
basketbot.yourdomain.com {
    # Reverse proxy to Next.js backend
    reverse_proxy localhost:3000

    # Enable gzip compression
    encode gzip

    # Security headers
    header {
        # Enable HSTS (6 months)
        Strict-Transport-Security "max-age=15552000; includeSubDomains"
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        # Prevent MIME sniffing
        X-Content-Type-Options "nosniff"
        # Enable XSS filter
        X-XSS-Protection "1; mode=block"
    }

    # Log access (optional)
    log {
        output file /var/log/caddy/basketbot-access.log
    }
}

# Optional: Redirect www to non-www
www.basketbot.yourdomain.com {
    redir https://basketbot.yourdomain.com{uri} permanent
}
```

#### 3. Configure Systemd Service

Caddy comes with a systemd service. Enable and start it:

```bash
sudo systemctl enable caddy
sudo systemctl start caddy
```

#### 4. Open Firewall Ports

```bash
# ufw
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo sh -c "iptables-save > /etc/iptables/rules.v4"
```

#### 5. Verify Certificate

Caddy will automatically obtain a Let's Encrypt certificate on first request. Visit your domain:

```bash
curl -I https://basketbot.yourdomain.com
```

Check for `200 OK` and valid certificate. You can also visit the URL in a browser and check for the padlock icon.

---

## Verification

### Check Caddy Status

```bash
sudo systemctl status caddy
```

Expected output: `Active: active (running)`

### View Caddy Logs

```bash
# Live logs
sudo journalctl -u caddy -f

# Recent logs
sudo journalctl -u caddy -n 100
```

### Test HTTPS Endpoint

```bash
# Should return 200 OK with valid TLS certificate
curl -I https://basketbot.yourdomain.com

# Should redirect to HTTPS
curl -I http://basketbot.yourdomain.com
```

### Verify Certificate Details

```bash
echo | openssl s_client -servername basketbot.yourdomain.com -connect basketbot.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates -issuer
```

Expected issuer: `Let's Encrypt`

---

## Updating Mobile App Configuration

After enabling HTTPS, update the mobile app to use the secure URL:

1. Edit `apps/mobile/.env` or `apps/mobile/.env.production`:

    ```
    VITE_API_BASE_URL=https://basketbot.yourdomain.com
    ```

2. Rebuild the mobile app:

    ```bash
    cd apps/mobile
    pnpm build
    npx cap sync
    ```

3. Re-deploy to your device/emulator

**Important:** The mobile app's API client already supports HTTPS. No code changes needed—just update the environment variable.

---

## Certificate Renewal

Caddy **automatically renews** Let's Encrypt certificates. No manual intervention required.

- Certificates are renewed ~30 days before expiration
- Caddy checks for renewal daily
- Renewal happens in the background with zero downtime

### Check Certificate Expiration

```bash
echo | openssl s_client -servername basketbot.yourdomain.com -connect basketbot.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## Troubleshooting

### Certificate Not Obtained

**Problem:** Caddy starts but HTTPS doesn't work.

**Solutions:**

1. Verify domain points to your public IP: `nslookup basketbot.yourdomain.com`
2. Ensure port 80 is forwarded (Let's Encrypt uses HTTP-01 challenge)
3. Check Caddy logs: `sudo journalctl -u caddy -n 100`
4. Test with `caddy validate --config /etc/caddy/Caddyfile`

### "Connection Refused" or "Cannot Connect"

**Problem:** Domain doesn't resolve or refuses connection.

**Solutions:**

1. Verify port forwarding on router (443 and 80)
2. Check firewall allows ports: `sudo ufw status` or `sudo iptables -L`
3. Confirm Caddy is running: `sudo systemctl status caddy`
4. Test from external network (not local network) — use mobile data or ask a friend

### Backend Returns 502 Bad Gateway

**Problem:** Caddy is running but can't reach Next.js backend.

**Solutions:**

1. Verify backend service is running: `sudo systemctl status basket-bot-backend`
2. Check backend is listening on port 3000: `ss -tlnp | grep 3000`
3. Review backend logs: `sudo journalctl -u basket-bot-backend -n 50`
4. Confirm Caddyfile reverse proxy target is correct: `reverse_proxy localhost:3000`

### Rate Limit Errors

**Problem:** Let's Encrypt rate limit exceeded.

**Solutions:**

- Let's Encrypt has limits: 50 certificates per domain per week
- Wait 1 week if you hit the limit
- Use staging environment for testing: Add `acme_ca https://acme-staging-v02.api.letsencrypt.org/directory` to Caddyfile

---

## Security Considerations

### Keep Backend on Port 3000 (Internal Only)

After enabling HTTPS with Caddy:

- **Do NOT expose port 3000 externally** (remove port forwarding if added)
- Only Caddy (localhost) should access the backend
- All external traffic goes through Caddy on port 443

### Update Firewall Rules

After enabling HTTPS, you may want to **restrict port 3000** to localhost only:

```bash
# ufw: Remove old rule allowing external access to 3000
sudo ufw delete allow 3000/tcp

# iptables: More complex — typically leave as-is unless security-critical
```

The backend's `middleware.ts` already includes HTTPS redirect logic (commented out by default). You can enable it if needed, but Caddy handles this better at the reverse proxy level.

### Rate Limiting

Consider enabling rate limiting in Caddy if the app is publicly accessible:

```caddy
basketbot.yourdomain.com {
    # Rate limit: 100 requests per minute per IP
    rate_limit {
        zone dynamic {
            key {remote_host}
            events 100
            window 1m
        }
    }

    reverse_proxy localhost:3000
    # ... rest of config
}
```

(Requires `caddy-ratelimit` plugin — not included by default)

---

## Alternative: nginx + Certbot

If you prefer nginx over Caddy:

### Install nginx and Certbot

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

### Create nginx Configuration

`/etc/nginx/sites-available/basketbot`:

```nginx
server {
    listen 80;
    server_name basketbot.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/basketbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Obtain Certificate

```bash
sudo certbot --nginx -d basketbot.yourdomain.com
```

Certbot will:

- Obtain certificate
- Automatically configure nginx for HTTPS
- Set up auto-renewal cron job

**Downside:** More manual steps, separate renewal process (though automated via cron).

---

## Useful Commands

```bash
# Caddy
sudo systemctl status caddy                # Check status
sudo systemctl restart caddy               # Restart Caddy
sudo journalctl -u caddy -f                # View live logs
caddy validate --config /etc/caddy/Caddyfile  # Test config

# Test HTTPS
curl -I https://basketbot.yourdomain.com   # Check HTTPS response
openssl s_client -connect basketbot.yourdomain.com:443  # Test TLS handshake

# View certificate details
echo | openssl s_client -servername basketbot.yourdomain.com \
    -connect basketbot.yourdomain.com:443 2>/dev/null | openssl x509 -noout -text

# Backend service
sudo systemctl status basket-bot-backend   # Check backend
sudo journalctl -u basket-bot-backend -n 50  # Backend logs

# Firewall
sudo ufw status                            # Check firewall rules (ufw)
sudo iptables -L -n                        # Check firewall rules (iptables)
```

---

## Summary

1. **Prerequisites**: Domain name + port forwarding (80, 443)
2. **Install Caddy**: Via package manager or automated install script
3. **Create Caddyfile**: Point your domain to `localhost:3000`
4. **Enable and start Caddy**: `sudo systemctl enable caddy && sudo systemctl start caddy`
5. **Verify**: Visit `https://yourdomain.com` — should show valid certificate
6. **Update mobile app**: Change `VITE_API_BASE_URL` to HTTPS URL
7. **Done**: Certificates auto-renew, no maintenance required

For troubleshooting or questions, refer to [Caddy documentation](https://caddyserver.com/docs/) or the backend README.
