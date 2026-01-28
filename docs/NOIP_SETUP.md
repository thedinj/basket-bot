# Using No-IP with Basket Bot Backend

This guide explains how to set up Basket Bot with a free dynamic DNS hostname from No-IP.com, enabling HTTPS access to your Raspberry Pi backend from anywhere.

## Overview

No-IP provides free dynamic DNS hostnames that automatically track your changing public IP address. This is ideal for home/residential internet connections where your public IP changes periodically.

**What you'll get:**

- A free subdomain like `yourname.ddns.net` or `yourname.hopto.org`
- Automatic SSL certificate from Let's Encrypt (via Caddy)
- Secure HTTPS access to your backend from anywhere
- Mobile app can connect over the internet

**Requirements:**

- Raspberry Pi with Raspbian running Basket Bot backend
- Home router with port forwarding capability
- Free No-IP account
- Ports 80 and 443 forwarded to your Raspberry Pi

---

## Step 1: Create No-IP Account and Hostname

### 1.1 Sign Up for No-IP

1. Go to [https://www.noip.com/sign-up](https://www.noip.com/sign-up)
2. Enter your email and create a password
3. Verify your email address (check your inbox)
4. Log in to your No-IP account

### 1.2 Create a Hostname

1. After logging in, click **"Create Hostname"** or go to **Dynamic DNS → No-IP Hostnames**
2. Fill in the hostname form:
    - **Hostname:** Choose a name (e.g., `basketbot`)
    - **Domain:** Select a free domain (e.g., `ddns.net`, `hopto.org`, `zapto.org`)
    - **Record Type:** A (IPv4)
    - **IP Address:** Should auto-detect your current public IP (leave as-is)
3. Click **"Create Hostname"**

Your hostname will be something like: `basketbot.ddns.net`

**Note:** Free accounts can create up to 3 hostnames, and you must confirm them every 30 days (No-IP will send reminder emails).

---

## Step 2: Install No-IP Dynamic Update Client (DUC)

The DUC runs on your Raspberry Pi and automatically updates No-IP whenever your public IP changes.

### 2.1 Install Dependencies

```bash
sudo apt update
sudo apt install -y build-essential
```

### 2.2 Download and Install No-IP DUC

```bash
cd /usr/local/src
sudo wget https://dmej72pbskrbg.cloudfront.net/downloads/noip-duc_3.0.0-beta.7.tar.gz
sudo tar xzf noip-duc_3.0.0-beta.7.tar.gz
cd noip-duc_3.0.0-beta.7
sudo ./install.sh
```

**Note:** Check [No-IP's download page](https://www.noip.com/download) for the latest version if the above link doesn't work.

### 2.3 Configure the DUC

During installation, you'll be prompted:

```
Please enter your No-IP account username: YOUR_EMAIL@example.com
Please enter your No-IP account password: YOUR_PASSWORD
```

Enter your No-IP account credentials.

The installer will show your hostnames and ask which one to update:

```
1. basketbot.ddns.net
Please select a hostname to update: 1
```

Select your hostname by entering its number.

### 2.4 Set Update Interval

```
Please enter an update interval (in minutes): 5
```

Enter `5` (updates every 5 minutes) or `30` (every 30 minutes). Lower intervals ensure faster IP change detection.

### 2.5 Enable DUC as a Service

The installer will create a systemd service automatically. Enable and start it:

```bash
sudo systemctl enable noip-duc
sudo systemctl start noip-duc
```

### 2.6 Verify DUC is Running

```bash
sudo systemctl status noip-duc
```

You should see `Active: active (running)`.

Check logs to confirm it's updating:

```bash
sudo journalctl -u noip-duc -n 50
```

Look for messages like:

```
INFO: IP address updated successfully
```

---

## Step 3: Configure Router Port Forwarding

You need to forward ports 80 (HTTP) and 443 (HTTPS) from your router to your Raspberry Pi.

### 3.1 Find Your Raspberry Pi's Local IP Address

On your Raspberry Pi:

```bash
hostname -I
```

Note the first IP address (e.g., `192.168.1.100`).

### 3.2 Set Static Local IP (Recommended)

To prevent your Pi's local IP from changing, either:

**Option A: Reserve IP in Router DHCP Settings**

- Log into your router's admin page
- Find DHCP settings or "DHCP Reservation"
- Reserve the Pi's MAC address to always get the same local IP

**Option B: Configure Static IP on Pi**

- Edit `/etc/dhcpcd.conf`:
    ```bash
    sudo nano /etc/dhcpcd.conf
    ```
- Add at the end:
    ```
    interface eth0
    static ip_address=192.168.1.100/24
    static routers=192.168.1.1
    static domain_name_servers=192.168.1.1 8.8.8.8
    ```
- Replace `192.168.1.100` with your desired IP
- Replace `192.168.1.1` with your router's gateway IP
- Restart: `sudo reboot`

### 3.3 Configure Port Forwarding in Router

Router interfaces vary, but the general steps are:

1. **Access Router Admin Panel**
    - Open browser and go to router IP (usually `192.168.1.1` or `192.168.0.1`)
    - Log in with admin credentials

2. **Find Port Forwarding Settings**
    - Look for sections named:
        - Port Forwarding
        - Virtual Server
        - NAT / Gaming
        - Applications

3. **Create Port Forwarding Rules**

    Create two rules:

    **Rule 1: HTTP (Port 80)**
    - Service Name: `BasketBot-HTTP`
    - External Port: `80`
    - Internal Port: `80`
    - Internal IP: `192.168.1.100` (your Pi's local IP)
    - Protocol: `TCP`
    - Enable: Yes

    **Rule 2: HTTPS (Port 443)**
    - Service Name: `BasketBot-HTTPS`
    - External Port: `443`
    - Internal Port: `443`
    - Internal IP: `192.168.1.100` (your Pi's local IP)
    - Protocol: `TCP`
    - Enable: Yes

4. **Save and Apply Settings**

### 3.4 Test Port Forwarding

Wait 1-2 minutes after saving, then test:

```bash
# From your Pi, check if ports are open externally
curl http://portchecker.co/check?port=80
curl http://portchecker.co/check?port=443
```

Or use an online tool like [PortCheckTool.com](https://www.portchecktool.com/) and enter your No-IP hostname.

---

## Step 4: Run Basket Bot Installation with HTTPS

Now that your hostname and ports are configured, run the installation script.

### 4.1 Navigate to Backend Scripts Directory

```bash
cd ~/basket-bot/apps/backend/scripts
```

(Adjust path if your project is in a different location)

### 4.2 Run Installation Script

```bash
./install.sh
```

### 4.3 Follow Installation Prompts

The script will:

1. Install dependencies and build the backend
2. Create `.env` file (edit it with your admin credentials)
3. Ask if you want HTTPS

When prompted:

```
Enable HTTPS? (y/N): y
```

Type `y` and press Enter.

```
Enter your domain name (e.g., basketbot.yourdomain.com): basketbot.ddns.net
```

Enter your **full No-IP hostname** (e.g., `basketbot.ddns.net`).

The script will:

- Initialize the database
- Create systemd service for the backend
- Install Caddy reverse proxy
- Configure automatic HTTPS with Let's Encrypt
- Start all services

### 4.4 Wait for SSL Certificate

Caddy will automatically request an SSL certificate from Let's Encrypt. This takes 10-30 seconds.

Check Caddy logs:

```bash
sudo journalctl -u caddy -f
```

Look for:

```
certificate obtained successfully
```

---

## Step 5: Verify HTTPS is Working

### 5.1 Test from Raspberry Pi

```bash
curl -I https://basketbot.ddns.net
```

You should see:

```
HTTP/2 200
```

### 5.2 Test from Browser

On your computer or phone (connected to the internet, **not** your local network):

1. Open browser
2. Go to `https://basketbot.ddns.net`
3. You should see the Basket Bot API response (or redirect)
4. Check the lock icon - SSL should be valid

### 5.3 Test Admin Portal

Go to `https://basketbot.ddns.net/admin`

You should see the admin login page.

---

## Step 6: Configure Mobile App

Update your mobile app to use the No-IP hostname.

### 6.1 Edit Mobile App Environment File

```bash
cd ~/basket-bot/apps/mobile
nano .env
```

### 6.2 Set API Base URL

```env
VITE_API_BASE_URL=https://basketbot.ddns.net
```

Replace `basketbot.ddns.net` with your actual hostname.

### 6.3 Rebuild Mobile App

```bash
pnpm build
pnpm cap sync
```

### 6.4 Test Connection

Launch the app and try logging in. The app should now connect to your backend via HTTPS.

---

## Troubleshooting

### Issue: SSL Certificate Not Obtained

**Symptoms:**

- Browser shows "Connection not secure" or certificate error
- Caddy logs show certificate errors

**Solutions:**

1. **Check DNS Resolution**

    ```bash
    nslookup basketbot.ddns.net
    ```

    Should return your public IP. If not, wait a few minutes for DNS propagation.

2. **Verify Ports 80 and 443 are Open**

    ```bash
    curl -I http://basketbot.ddns.net
    ```

    Should return HTTP response (not connection refused).

3. **Check Caddy Logs**

    ```bash
    sudo journalctl -u caddy -n 100
    ```

    Look for specific error messages.

4. **Verify Domain Points to Your IP**
    - Log into No-IP account
    - Check that hostname shows your current public IP
    - Force an update with DUC:
        ```bash
        sudo systemctl restart noip-duc
        ```

5. **Check Firewall on Pi**
    ```bash
    sudo ufw status
    ```
    Ports 80 and 443 should be allowed:
    ```bash
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    ```

### Issue: No-IP DUC Not Updating

**Symptoms:**

- Hostname shows wrong/old IP address
- Connection works at home but not remotely

**Solutions:**

1. **Check DUC Status**

    ```bash
    sudo systemctl status noip-duc
    sudo journalctl -u noip-duc -n 50
    ```

2. **Restart DUC**

    ```bash
    sudo systemctl restart noip-duc
    ```

3. **Force Manual Update**
    - Log into No-IP account
    - Go to your hostname
    - Click "Modify" and update the IP manually

4. **Reconfigure DUC**
    ```bash
    cd /usr/local/src/noip-duc_3.0.0-beta.7
    sudo ./install.sh
    ```
    Enter your credentials and hostname again.

### Issue: Port Forwarding Not Working

**Symptoms:**

- Cannot access from outside network
- Ports appear closed when testing externally

**Solutions:**

1. **Verify Router Settings**
    - Log into router admin
    - Confirm port forwarding rules are enabled
    - Check internal IP matches Pi's IP

2. **Test from External Network**
    - Use mobile data (disable WiFi on phone)
    - Try accessing `http://YOUR_PUBLIC_IP:80`
    - If this works but hostname doesn't, it's a DNS issue

3. **Check for Double NAT**
   Some ISPs put you behind carrier-grade NAT. Check:
    - What's your public IP? `curl ifconfig.me`
    - Does it match IP shown in router's WAN settings?
    - If different, you may have double NAT (contact ISP)

4. **Try DMZ as Last Resort**
    - Some routers have a DMZ option
    - Set Pi's IP as DMZ host (exposes all ports)
    - **Security risk** - only use for testing

### Issue: Connection Works Locally but Not Remotely

**Symptoms:**

- HTTPS works when connected to home WiFi
- Fails when using mobile data or external network

**Solutions:**

1. **Hairpin NAT / NAT Loopback**
   Some routers don't support accessing your public hostname from inside the network.

    **Solution:** Use local IP when on home network:
    - Create separate mobile app build config for local testing
    - Or configure split DNS if router supports it

2. **ISP Blocking Ports**
   Some ISPs block common ports (especially 80).

    **Test:** Try accessing via port 8080 instead:
    - Configure Caddy to listen on 8080
    - Forward port 8080 in router
    - Access via `https://basketbot.ddns.net:8080`

### Issue: No-IP Hostname Requires Confirmation

**Symptoms:**

- Hostname stops working after 30 days
- Email from No-IP asking to confirm hostname

**Solution:**

Free No-IP hostnames require confirmation every 30 days:

1. Check email from No-IP
2. Click confirmation link
3. Or log into No-IP account and confirm manually

**Prevent this:**

- Upgrade to No-IP Enhanced ($24.95/year) - no confirmation needed
- Or set a calendar reminder to confirm monthly

---

## Maintenance

### Check Service Status

```bash
# Backend service
sudo systemctl status basket-bot-backend

# Caddy reverse proxy
sudo systemctl status caddy

# No-IP DUC
sudo systemctl status noip-duc
```

### View Logs

```bash
# Backend logs
sudo journalctl -u basket-bot-backend -f

# Caddy logs (access and errors)
sudo tail -f /var/log/caddy/basketbot-access.log
sudo journalctl -u caddy -f

# No-IP DUC logs
sudo journalctl -u noip-duc -f
```

### Restart Services

```bash
sudo systemctl restart basket-bot-backend
sudo systemctl restart caddy
sudo systemctl restart noip-duc
```

### Check Current Public IP

```bash
curl ifconfig.me
```

Should match the IP shown in your No-IP hostname.

### Force No-IP Update

```bash
sudo systemctl restart noip-duc
```

Check logs to confirm update:

```bash
sudo journalctl -u noip-duc -n 20
```

---

## Security Best Practices

1. **Keep Firmware Updated**

    ```bash
    sudo apt update && sudo apt upgrade -y
    ```

2. **Use Strong Passwords**
    - No-IP account password
    - Admin user password (in `.env`)
    - Router admin password

3. **Enable Firewall**

    ```bash
    sudo ufw enable
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 22/tcp  # SSH (be careful!)
    ```

4. **Limit SSH Access**
    - Don't forward port 22 in router (SSH only from local network)
    - Or use SSH keys and disable password authentication
    - Or use a non-standard SSH port

5. **Monitor Logs**
   Regularly check logs for suspicious activity:

    ```bash
    sudo journalctl -u caddy | grep -i error
    ```

6. **Backup Database**
    ```bash
    cp ~/basket-bot/apps/backend/production.db ~/backups/production-$(date +%Y%m%d).db
    ```

---

## Alternative: No-IP Enhanced vs Custom Domain

### No-IP Free

- **Cost:** Free
- **Hostnames:** 3 hostnames
- **Confirmation:** Required every 30 days
- **Best for:** Testing, personal use

### No-IP Enhanced ($24.95/year)

- **Cost:** $24.95/year
- **Hostnames:** 25 hostnames
- **Confirmation:** Not required
- **Features:** Email support, DDNS updates every 1 minute

### Custom Domain with No-IP Plus ($4.95/month)

- **Cost:** $4.95/month
- **Features:** Use your own domain (e.g., `basketbot.com`)
- **DNS Management:** Full DNS control

### Custom Domain with DNS Service (Recommended for Production)

- **Cost:** ~$10-15/year (domain) + free Cloudflare DNS
- **How:**
    1. Buy domain (Namecheap, Google Domains, etc.)
    2. Use Cloudflare for DNS (free)
    3. Create A record pointing to public IP
    4. Use Cloudflare API to auto-update IP (similar to No-IP DUC)
    5. Get SSL via Caddy or Cloudflare

---

## Summary

You should now have:

- ✅ No-IP hostname (e.g., `basketbot.ddns.net`)
- ✅ No-IP DUC running and auto-updating your IP
- ✅ Router forwarding ports 80 and 443 to your Pi
- ✅ Basket Bot backend running with systemd
- ✅ Caddy reverse proxy with automatic HTTPS/SSL
- ✅ Mobile app configured to connect via HTTPS

Your backend is now accessible from anywhere via:

```
https://basketbot.ddns.net
```

Admin portal:

```
https://basketbot.ddns.net/admin
```

---

## Additional Resources

- [No-IP Documentation](https://www.noip.com/support)
- [No-IP DUC Installation Guide](https://www.noip.com/support/knowledgebase/installing-the-linux-dynamic-update-client/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- Port Forwarding Guides: [PortForward.com](https://portforward.com/)

---

## Need Help?

If you encounter issues not covered here:

1. Check the logs (backend, Caddy, No-IP DUC)
2. Verify each step was completed
3. Test connectivity at each layer (local → router → external)
4. Search No-IP support forums
5. Open an issue on the Basket Bot GitHub repository
