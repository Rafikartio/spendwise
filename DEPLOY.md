# Deploying Spendwise to AWS EC2 (Ubuntu + nginx + MySQL + PM2)

How it works: nginx (port 80/443) → Node/Express on `127.0.0.1:4000` → MySQL on localhost.
Express serves both the API (`/api/*`) and the built React app, so there is a single process.

You already have: MySQL running, `spendwise_db` database, `node_user`, Node, npm and nginx installed.

## 0. AWS prerequisites

- **Security group**: allow inbound **22** (SSH, ideally your IP only), **80** and **443**. Do **not** open 3306 or 4000.
- Small instance (≤1 GB RAM)? Add swap first, otherwise the Vite build can be killed:
  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

## 1. First-time setup on the server

```bash
# PM2 keeps the app running and restarts it on reboot
sudo npm install -g pm2

# get the code
git clone https://github.com/<you>/<repo>.git spendwise
cd spendwise

# production config
cp deploy/env.production.example server/.env
nano server/.env        # fill JWT_SECRET, DB_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD, CLIENT_ORIGIN
chmod 600 server/.env
```

Generate a new JWT secret (don't reuse your local one):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`DB_USER=node_user`, `DB_NAME=spendwise_db` and `DB_PASSWORD` must match what you created in MySQL.

## 2. Build and start

```bash
bash deploy/deploy.sh
```

On first start the app creates its tables and the first admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
You should see `{"ok":true}` at the end. Then make PM2 survive reboots:

```bash
pm2 startup           # run the sudo command it prints
pm2 save
```

## 3. nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/spendwise
sudo nano /etc/nginx/sites-available/spendwise     # set server_name to your domain (or _ for IP only)
sudo ln -s /etc/nginx/sites-available/spendwise /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Open `http://<EC2-public-IP>` — you should see the login page.

## 4. HTTPS (needs a domain pointing at the EC2 IP)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
Then set `CLIENT_ORIGIN=https://your-domain.com` in `server/.env` and run `pm2 restart spendwise --update-env`.

## 5. Updating later

Push to GitHub, then on the server:
```bash
cd ~/spendwise && bash deploy/deploy.sh
```

## Useful commands

```bash
pm2 logs spendwise          # live logs
pm2 status
pm2 restart spendwise --update-env
sudo tail -f /var/log/nginx/error.log
curl http://127.0.0.1:4000/api/health
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| 502 Bad Gateway | App isn't running: `pm2 logs spendwise` |
| `ER_ACCESS_DENIED_ERROR` | `DB_USER`/`DB_PASSWORD` in `server/.env` don't match MySQL. Quote passwords with special characters: `DB_PASSWORD="..."` |
| `JWT_SECRET must be set in production` | Fill `JWT_SECRET` in `server/.env` |
| Build killed / `Killed` | Out of memory: add swap (step 0) |
| Can't log in as admin | The admin is created only if no admin exists. Check `pm2 logs` for `[setup]` lines |

## Security checklist

- `server/.env` is git-ignored — never commit it. Use a strong, unique `JWT_SECRET` and admin password.
- Keep MySQL bound to localhost; `node_user` only has rights on `spendwise_db`.
- Back up the database regularly, e.g. `mysqldump -u node_user -p spendwise_db > backup.sql` (cron or AWS snapshots).
- Keep the OS patched (`sudo apt update && sudo apt upgrade`) and reboot for kernel updates.
