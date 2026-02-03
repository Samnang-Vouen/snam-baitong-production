# GCP VM Setup (Ubuntu) — Nginx + PM2 + GitHub Actions SSH Deploy

This project is designed to run on a single GCP VM with:
- Nginx serving the React build (static)
- Nginx proxying `/api/*` and `/health` to the Node/Express backend on localhost
- PM2 running the backend as a **single instance** (required for MQTT + Telegram single-instance behavior)
- GitHub Actions deploying over SSH (rsync)

## 1) VM prerequisites

- Ubuntu LTS VM (22.04+ recommended)
- DNS A record (optional) pointing to the VM
- Firewall rules:
  - Allow TCP 80 (and 443 if you add TLS)
  - Allow SSH (22 or custom). If you can, restrict SSH source ranges.

## 2) Create deploy user and folders

Example:

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy

# deployment root used by workflow + nginx sample
sudo mkdir -p /opt/snam-baitong
sudo chown -R deploy:deploy /opt/snam-baitong
```

## 3) Install Node.js + PM2

Recommended (Node 20):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get update
sudo apt-get install -y nodejs

sudo npm i -g pm2
pm2 -v
```

Enable PM2 on boot:

```bash
pm2 startup systemd -u deploy --hp /home/deploy
# follow the printed command (usually requires sudo)
pm2 save
```

## 4) Install and configure Nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

- Copy the sample config from `deploy/nginx/snam-baitong.conf` into Nginx:

```bash
sudo cp /opt/snam-baitong/deploy/nginx/snam-baitong.conf /etc/nginx/sites-available/snam-baitong
sudo ln -s /etc/nginx/sites-available/snam-baitong /etc/nginx/sites-enabled/snam-baitong

# Optional: disable default site
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

Notes:
- The Nginx sample assumes the repo is deployed to `/opt/snam-baitong` and serves static files from `/opt/snam-baitong/frontend/dist`.
- The backend should listen on `127.0.0.1:3000` in production (already defaulted in code).

## 5) Backend environment variables

Create the backend env file on the VM (do not commit this file):

```bash
cd /opt/snam-baitong/backend
cp .env.example .env
nano .env
```

Minimum production notes:
- Set real values for: `MYSQL_*`, `JWT_SECRET`, `INFLUXDB_*`, `TELEGRAM_BOT_TOKEN`, MQTT host/port.
- Do **not** enable admin seeding on startup unless you intend to:
  - `SEED_ADMINS_ON_STARTUP=false`

If you do want to seed admins one time:
- Temporarily set:
  - `SEED_ADMINS_ON_STARTUP=true`
  - `SEED_ADMINS_JSON=[{"email":"admin@example.com","password":"CHANGE_ME"}]`
- Deploy once, login, change password, then turn seeding back off and redeploy.

## 6) First-time PM2 start

From the deploy user:

```bash
cd /opt/snam-baitong
pm2 start ecosystem.config.js --only snam-baitong-api --env production --update-env
pm2 save
```

## 7) GitHub Actions secrets to create

In your GitHub repo settings → **Secrets and variables** → **Actions**, add:
- `SSH_PRIVATE_KEY` — private key matching the deploy user’s `~/.ssh/authorized_keys`
- `SSH_HOST` — VM public IP or hostname
- `SSH_USER` — `deploy`
- `SSH_PORT` — `22` (or your custom port)
- `DEPLOY_PATH` — `/opt/snam-baitong`

The workflow builds the frontend, rsyncs the repo (excluding `.env`), installs backend deps, then runs:
- `pm2 reload snam-baitong-api --update-env` if it already exists
- `pm2 start ecosystem.config.js ...` if it does not

## 8) Smoke checks

On the VM:

```bash
# Backend via localhost only
curl -sSf http://127.0.0.1:3000/health

# Via Nginx
curl -sSf http://localhost/health
curl -I http://localhost/
```

## 9) TLS (optional but recommended)

Use Certbot (Let’s Encrypt) once DNS is configured.

---

Related files:
- `ecosystem.config.js`
- `deploy/nginx/snam-baitong.conf`
- `.github/workflows/deploy.yml`
