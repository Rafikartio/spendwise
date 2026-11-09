import jwt from 'jsonwebtoken';
import { q, userOut } from '../db.js';

const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
export const SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret';
if (!process.env.JWT_SECRET) console.warn('[warn] JWT_SECRET not set - using an insecure development secret.');

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    let payload;
    try {
      payload = jwt.verify(token, SECRET);
    } catch {
      return res.status(401).json({ error: 'Session expired, please sign in again' });
    }
    const [row] = await q('SELECT * FROM users WHERE id = ?', [payload.sub]);
    if (!row) return res.status(401).json({ error: 'Account not found' });
    if (!row.active) return res.status(403).json({ error: 'This account has been suspended' });
    req.user = userOut(row);
    next();
  } catch (err) {
    next(err);
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
