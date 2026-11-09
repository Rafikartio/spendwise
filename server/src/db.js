import mysql from 'mysql2/promise';
import crypto from 'node:crypto';

export const uid = () => crypto.randomUUID();
export let pool;

const OPTS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role ENUM('user','admin') NOT NULL DEFAULT 'user',
    active TINYINT(1) NOT NULL DEFAULT 1,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at DATETIME NOT NULL,
    last_login_at DATETIME NOT NULL
  ) ${OPTS}`,
  `CREATE TABLE IF NOT EXISTS categories (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(60) NOT NULL,
    type ENUM('income','expense') NOT NULL,
    color CHAR(7) NOT NULL,
    icon VARCHAR(16) NOT NULL,
    budget DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_category (user_id, type, name),
    CONSTRAINT fk_cat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ${OPTS}`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    category_id CHAR(36) NOT NULL,
    type ENUM('income','expense') NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    \`date\` DATE NOT NULL,
    description VARCHAR(200) NOT NULL DEFAULT '',
    notes VARCHAR(1000) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    KEY idx_user_date (user_id, \`date\`),
    KEY idx_category (category_id),
    CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tx_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
  ) ${OPTS}`,
];

export async function initDb() {
  const { DB_HOST = 'localhost', DB_PORT = '3306', DB_USER = 'root', DB_PASSWORD = '', DB_NAME = 'spendwise_db' } = process.env;
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) throw new Error('DB_NAME may only contain letters, numbers and underscores');
  const base = { host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD };
  // Set DB_SSL=true for managed databases (RDS, etc.) that require encrypted connections
  if (process.env.DB_SSL === 'true') base.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };

  // Create the database if we're allowed to. Restricted users (managed DBs, a
  // user limited to one database) can't - then the database must already exist.
  try {
    const boot = await mysql.createConnection(base);
    await boot.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await boot.end();
  } catch (err) {
    // Wrong password / unreachable server etc. must still fail loudly
    if (!['ER_DBACCESS_DENIED_ERROR', 'ER_SPECIFIC_ACCESS_DENIED_ERROR'].includes(err.code)) throw err;
    console.warn(`[db] Could not run CREATE DATABASE (${err.code}); assuming "${DB_NAME}" already exists.`);
  }

  pool = mysql.createPool({
    ...base,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true, // DATE / DATETIME come back as strings ("2026-11-09")
    decimalNumbers: true, // DECIMAL / SUM() come back as numbers
    timezone: 'Z',
  });
  for (const sql of SCHEMA) await pool.query(sql);
}

/** Run a query and return the rows. */
export const q = async (sql, params = []) => (await pool.query(sql, params))[0];

/* ---------- row mappers (snake_case -> camelCase used by the API/UI) ---------- */
export const userOut = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  active: !!r.active,
  currency: r.currency,
  createdAt: r.created_at,
  lastLoginAt: r.last_login_at,
});

export const categoryOut = (r) => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  type: r.type,
  color: r.color,
  icon: r.icon,
  budget: Number(r.budget),
  createdAt: r.created_at,
});

export const txOut = (r) => ({
  id: r.id,
  userId: r.user_id,
  type: r.type,
  amount: Number(r.amount),
  date: r.date,
  categoryId: r.category_id,
  description: r.description,
  notes: r.notes,
  createdAt: r.created_at,
});

/** Remove a user and everything they own (transactions first: category FK is RESTRICT). */
export async function deleteUserCascade(userId) {
  await q('DELETE FROM transactions WHERE user_id = ?', [userId]);
  await q('DELETE FROM users WHERE id = ?', [userId]);
}

const DEFAULT_CATEGORIES = [
  ['Food & Dining', 'expense', '#f97316', '🍔'],
  ['Transport', 'expense', '#3b82f6', '🚗'],
  ['Housing', 'expense', '#8b5cf6', '🏠'],
  ['Utilities', 'expense', '#06b6d4', '💡'],
  ['Shopping', 'expense', '#ec4899', '🛍️'],
  ['Health', 'expense', '#ef4444', '💊'],
  ['Entertainment', 'expense', '#eab308', '🎬'],
  ['Education', 'expense', '#14b8a6', '📚'],
  ['Other', 'expense', '#64748b', '📦'],
  ['Salary', 'income', '#22c55e', '💼'],
  ['Freelance', 'income', '#10b981', '💻'],
  ['Investments', 'income', '#6366f1', '📈'],
  ['Other Income', 'income', '#84cc16', '💰'],
];

export async function createDefaultCategories(userId) {
  const now = new Date();
  const rows = DEFAULT_CATEGORIES.map(([name, type, color, icon]) => [uid(), userId, name, type, color, icon, 0, now]);
  await q('INSERT INTO categories (id, user_id, name, type, color, icon, budget, created_at) VALUES ?', [rows]);
}
