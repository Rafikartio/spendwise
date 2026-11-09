# Spendwise – Expense Tracker SaaS

Node.js + Express API · MySQL · React (Vite) frontend.

## Features

- **Auth**: register / login (JWT, bcrypt), rate-limited auth endpoints
- **Roles**: `user` and `admin`. Public sign-up only creates normal users; the first admin comes from `server/.env`, further admins are promoted in the Admin panel
- **Admin panel**: platform stats, sign-ups chart, user search, promote/demote, suspend, delete
- **Transactions**: add / edit / delete, search, filters, sort, pagination, CSV export
- **Categories**: custom icon, colour and monthly budget
- **Dashboard & reports**: charts, budgets, yearly report
- **Settings**: profile, currency, password, delete account · dark mode · responsive

## Run locally

Requirements: Node 18+, MySQL 8 running locally.

```bash
# 1. create the database + user (once)
sudo mysql        # or: mysql -u root -p
#   CREATE DATABASE spendwise_db;
#   CREATE USER 'node_user'@'localhost' IDENTIFIED BY 'your-password';
#   GRANT ALL PRIVILEGES ON spendwise_db.* TO 'node_user'@'localhost';

# 2. install and configure
npm run install:all
cp server/.env.example server/.env     # fill DB_PASSWORD, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# 3. run API (:4000) and UI (:5173) together
npm run dev
```

Open http://localhost:5173. Tables and the first admin are created automatically on first start.

## Deploy to production (AWS EC2)

See **[DEPLOY.md](DEPLOY.md)**. Short version, on the server:

```bash
cp deploy/env.production.example server/.env && nano server/.env
bash deploy/deploy.sh
```

Local and production use the same code; only `server/.env` differs (it is never committed).

## Project structure

```
├── client/                 React + Vite UI
├── server/src/             Express API (routes/, middleware/, db.js)
├── deploy/                 nginx.conf, PM2 config, deploy.sh, production env template
├── DEPLOY.md               EC2 deployment guide
└── package.json            root scripts (dev / build / start)
```

## Configuration (`server/.env`)

| Variable | Purpose |
|---|---|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | MySQL connection |
| `DB_SSL=true` | enable for managed DBs that require SSL |
| `JWT_SECRET` | required in production |
| `ADMIN_EMAIL/PASSWORD/NAME` | first admin (only if no admin exists) |
| `CLIENT_ORIGIN` | allowed CORS origin / public URL |
| `TRUST_PROXY` | proxy hops (auto `1` in production) |

## API

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | returns `{ token, user }` |
| GET/PUT/DELETE | `/api/auth/me` | profile, password, delete account |
| GET/POST/PUT/DELETE | `/api/categories` | per user |
| GET/POST/PUT/DELETE | `/api/transactions` | `search,type,categoryId,from,to,sort,order,page,limit` |
| GET | `/api/transactions/export.csv` | same filters |
| GET | `/api/stats/summary?month=YYYY-MM`, `/api/stats/yearly?year=YYYY` | dashboards |
| GET/PATCH/DELETE | `/api/admin/...` | admin only |
| GET | `/api/health` | health check |
