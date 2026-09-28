# 🚀 Deployment Guide: Oracle Cloud Ubuntu VPS + apparatuscertified.tech

This guide covers deploying the **Smart Helmet Tactical Mesh System** to your **Oracle Cloud Ubuntu VPS** and linking your domain **`apparatuscertified.tech`** with HTTPS (Let's Encrypt SSL).

---

## 1. Prerequisites on Oracle Cloud Ubuntu VPS

### A. Open Firewall Ports on Oracle Cloud (Security List & iptables)
Oracle Cloud instances block ports 80 and 443 by default in both the VCN Security List and OS firewall (`iptables`).

1. **In Oracle Cloud Web Console**:
   - Go to **Networking** > **Virtual Cloud Networks** > Click your VCN > Click **Security Lists** (Default Security List).
   - Click **Add Ingress Rules**:
     - **Source CIDR**: `0.0.0.0/0`
     - **IP Protocol**: `TCP`
     - **Destination Port Range**: `80,443,8090,8091`
     - **Description**: `HTTP, HTTPS, Video WS Relay`

2. **In your Ubuntu VPS Terminal**:
   Open ports in Ubuntu's `iptables` and save:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8090 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8091 -j ACCEPT
   sudo netfilter-persistent save || sudo iptables-save | sudo tee /etc/iptables/rules.v4
   ```

---

## 2. DNS Configuration (Domain Pointing)

Log in to your Domain Registrar (where you manage `apparatuscertified.tech`) and create **A Records**:

| Type | Host / Name | Value / IP Address | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `<YOUR_ORACLE_VPS_PUBLIC_IP>` | Automatic / 300 |
| **A** | `www` | `<YOUR_ORACLE_VPS_PUBLIC_IP>` | Automatic / 300 |

*(Wait 2–5 minutes for DNS propagation)*.

---

## 3. Install Docker & Docker Compose on Ubuntu VPS

Run the following on your VPS:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add ubuntu user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

---

## 4. Clone Repository & Run Container

```bash
# 1. Clone your GitHub repository
git clone https://github.com/UAnjana000/The_start.git
cd The_start

# 2. Build and run in background
docker compose up -d --build
```

### Option A: Frontend Only (No Video Backend)
If you only want to host the frontend dashboard without the video relay backend:
```bash
docker compose up -d --build frontend
```

### Option B: Full Stack (Frontend + Video Relay Backend)
```bash
docker compose up -d --build
```

To verify running containers:
```bash
docker ps
```

---

## 5. Enable HTTPS / SSL with Certbot (Free Let's Encrypt)

To secure `https://apparatuscertified.tech`:

### Method 1: Using Certbot with Host Nginx Proxy (Recommended)
```bash
# Stop standalone container port 80 mapping if using host nginx
# Or run Certbot in standalone mode:
sudo apt install -y certbot

# Request Certificate
sudo certbot certonly --standalone -d apparatuscertified.tech -d www.apparatuscertified.tech
```

### Method 2: Certbot Auto-Renew Cron
```bash
# Test renewal
sudo certbot renew --dry-run
```

---

## 6. Useful Maintenance Commands

```bash
# View live logs
docker compose logs -f

# Restart services
docker compose restart

# Update to latest git changes
git pull origin main
docker compose up -d --build
```
