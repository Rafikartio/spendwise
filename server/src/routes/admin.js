import { Router } from 'express';
import { q, userOut, deleteUserCascade } from '../db.js';
import { auth, adminOnly } from '../middleware/auth.js';
import { wrap } from '../middleware/wrap.js';

const router = Router();
router.use(auth, adminOnly);

router.get('/stats', wrap(async (_req, res) => {
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [u] = await q(
    `SELECT COUNT(*) AS total, SUM(active = 1) AS active, SUM(role = 'admin') AS admins, SUM(last_login_at > ?) AS week FROM users`,
    [weekAgo]
  );
  const [t] = await q(
    `SELECT COUNT(*) AS n,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income
     FROM transactions`
  );
  const su = await q(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS m, COUNT(*) AS n FROM users WHERE created_at >= ? GROUP BY m`,
    [since]
  );
  const signups = Array.from({ length: 6 }, (_, i) => {
    const key = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1)).toISOString().slice(0, 7);
    return { month: key, users: Number(su.find((r) => r.m === key)?.n || 0) };
  });

  res.json({
    totalUsers: Number(u.total),
    activeUsers: Number(u.active || 0),
    admins: Number(u.admins || 0),
    activeThisWeek: Number(u.week || 0),
    totalTransactions: Number(t.n),
    totalExpenseVolume: Number(t.expense),
    totalIncomeVolume: Number(t.income),
    signups,
  });
}));

router.get('/users', wrap(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const like = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
  const rows = await q(
    `SELECT u.*, (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) AS transaction_count
     FROM users u WHERE (? = '' OR u.name LIKE ? OR u.email LIKE ?) ORDER BY u.created_at DESC`,
    [search, like, like]
  );
  res.json({ users: rows.map((r) => ({ ...userOut(r), transactionCount: Number(r.transaction_count) })) });
}));

router.patch('/users/:id', wrap(async (req, res) => {
  const [u] = await q('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.id === req.user.id) return res.status(400).json({ error: "You can't change your own role or status" });
  const sets = [];
  const vals = [];
  if (['admin', 'user'].includes(req.body.role)) { sets.push('role = ?'); vals.push(req.body.role); }
  if (typeof req.body.active === 'boolean') { sets.push('active = ?'); vals.push(req.body.active ? 1 : 0); }
  if (sets.length) await q(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, u.id]);
  const [row] = await q('SELECT * FROM users WHERE id = ?', [u.id]);
  res.json({ user: userOut(row) });
}));

router.delete('/users/:id', wrap(async (req, res) => {
  const [u] = await q('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.id === req.user.id) return res.status(400).json({ error: "You can't delete your own account" });
  await deleteUserCascade(u.id);
  res.json({ ok: true });
}));

export default router;
