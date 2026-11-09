import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q, uid, userOut, createDefaultCategories, deleteUserCascade } from '../db.js';
import { auth, signToken } from '../middleware/auth.js';
import { wrap } from '../middleware/wrap.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR', 'CAD', 'AUD', 'JPY'];

// Public sign-up ALWAYS creates a normal user. Admins are created from .env on
// first start or promoted by an existing admin - never through this endpoint.
router.post('/register', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Please enter your full name' });
  if (!EMAIL_RE.test(email) || email.length > 190) return res.status(400).json({ error: 'Please enter a valid email' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be 8–72 characters' });

  const [exists] = await q('SELECT id FROM users WHERE email = ?', [email]);
  if (exists) return res.status(409).json({ error: 'An account with this email already exists' });

  const id = uid();
  const now = new Date();
  await q(
    'INSERT INTO users (id, name, email, password_hash, role, active, currency, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)',
    [id, name, email, bcrypt.hashSync(password, 10), 'user', 'USD', now, now]
  );
  await createDefaultCategories(id);
  const [row] = await q('SELECT * FROM users WHERE id = ?', [id]);
  res.status(201).json({ token: signToken(userOut(row)), user: userOut(row) });
}));

router.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const [row] = await q('SELECT * FROM users WHERE email = ?', [email]);
  if (!row || !bcrypt.compareSync(password, row.password_hash))
    return res.status(401).json({ error: 'Incorrect email or password' });
  if (!row.active) return res.status(403).json({ error: 'This account has been suspended' });
  await q('UPDATE users SET last_login_at = ? WHERE id = ?', [new Date(), row.id]);
  const user = userOut({ ...row, last_login_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
  res.json({ token: signToken(user), user });
}));

router.get('/me', auth, (req, res) => res.json({ user: req.user }));

router.put('/me', auth, wrap(async (req, res) => {
  const { name, currency, currentPassword, newPassword } = req.body;
  const sets = [];
  const vals = [];
  if (name !== undefined) {
    const n = String(name).trim();
    if (n.length < 2 || n.length > 100) return res.status(400).json({ error: 'Name is too short' });
    sets.push('name = ?');
    vals.push(n);
  }
  if (currency !== undefined) {
    if (!CURRENCIES.includes(currency)) return res.status(400).json({ error: 'Unsupported currency' });
    sets.push('currency = ?');
    vals.push(currency);
  }
  if (newPassword) {
    const [row] = await q('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(String(currentPassword || ''), row.password_hash))
      return res.status(400).json({ error: 'Current password is incorrect' });
    const np = String(newPassword);
    if (np.length < 8 || np.length > 72) return res.status(400).json({ error: 'New password must be 8–72 characters' });
    sets.push('password_hash = ?');
    vals.push(bcrypt.hashSync(np, 10));
  }
  if (sets.length) await q(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.user.id]);
  const [row] = await q('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: userOut(row) });
}));

router.delete('/me', auth, wrap(async (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Admin accounts cannot be deleted here' });
  await deleteUserCascade(req.user.id);
  res.json({ ok: true });
}));

export default router;
