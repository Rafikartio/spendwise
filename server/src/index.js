import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDb, q, uid, createDefaultCategories } from './db.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import transactionRoutes from './routes/transactions.js';
import statsRoutes from './routes/stats.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 4000;
const here = path.dirname(fileURLToPath(import.meta.url));

// Behind nginx in production: trust one proxy hop so rate limiting sees real client IPs
if (process.env.TRUST_PROXY || process.env.NODE_ENV === 'production') app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

const limiter = (limit) =>
  rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, please try again later' } });
app.use('/api/auth/login', limiter(30));
app.use('/api/auth/register', limiter(20));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app in production
const dist = path.join(here, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That already exists' });
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong' });
});

/** Creates the first admin from .env, only when no admin exists yet. */
async function ensureAdmin() {
  const [{ n }] = await q("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
  if (n > 0) return;
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || password.length < 8) {
    console.warn('[setup] No admin exists. Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) in server/.env and restart.');
    return;
  }
  const [existing] = await q('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    await q("UPDATE users SET role = 'admin', active = 1 WHERE id = ?", [existing.id]);
    console.log(`[setup] Existing user ${email} promoted to admin`);
    return;
  }
  const id = uid();
  const now = new Date();
  await q(
    'INSERT INTO users (id, name, email, password_hash, role, active, currency, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)',
    [id, process.env.ADMIN_NAME || 'Administrator', email, bcrypt.hashSync(password, 10), 'admin', 'USD', now, now]
  );
  await createDefaultCategories(id);
  console.log(`[setup] Admin account created: ${email}`);
}

try {
  await initDb();
  await ensureAdmin();
  app.listen(PORT, () => console.log(`Spendwise API running on http://localhost:${PORT}`));
} catch (err) {
  console.error('Failed to start:', err.code || '', err.message);
  if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('→ Check DB_USER / DB_PASSWORD in server/.env');
  if (err.code === 'ECONNREFUSED') console.error('→ MySQL is not reachable. Is the MySQL server running on DB_HOST:DB_PORT?');
  process.exit(1);
}
