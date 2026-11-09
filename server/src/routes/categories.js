import { Router } from 'express';
import { q, uid, categoryOut } from '../db.js';
import { auth } from '../middleware/auth.js';
import { wrap } from '../middleware/wrap.js';

const router = Router();
router.use(auth);

const clean = (body) => ({
  name: String(body.name || '').trim().slice(0, 60),
  type: body.type === 'income' ? 'income' : 'expense',
  color: /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : '#64748b',
  icon: String(body.icon || '📦').slice(0, 8),
  budget: Math.min(999999999999, Math.max(0, Number(body.budget) || 0)),
});

const find = async (id, userId) => (await q('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, userId]))[0];

router.get('/', wrap(async (req, res) => {
  const rows = await q(
    `SELECT c.*, (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS transaction_count
     FROM categories c WHERE c.user_id = ? ORDER BY c.name`,
    [req.user.id]
  );
  res.json({ categories: rows.map((r) => ({ ...categoryOut(r), transactionCount: Number(r.transaction_count) })) });
}));

router.post('/', wrap(async (req, res) => {
  const f = clean(req.body);
  if (!f.name) return res.status(400).json({ error: 'Category name is required' });
  const id = uid();
  await q(
    'INSERT INTO categories (id, user_id, name, type, color, icon, budget, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, f.name, f.type, f.color, f.icon, f.type === 'expense' ? f.budget : 0, new Date()]
  );
  res.status(201).json({ category: categoryOut(await find(id, req.user.id)) });
}));

router.put('/:id', wrap(async (req, res) => {
  const cat = await find(req.params.id, req.user.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const f = clean({ ...req.body, type: cat.type }); // type can't change once created
  if (!f.name) return res.status(400).json({ error: 'Category name is required' });
  await q('UPDATE categories SET name = ?, color = ?, icon = ?, budget = ? WHERE id = ?', [
    f.name, f.color, f.icon, cat.type === 'expense' ? f.budget : 0, cat.id,
  ]);
  res.json({ category: categoryOut(await find(cat.id, req.user.id)) });
}));

router.delete('/:id', wrap(async (req, res) => {
  const cat = await find(req.params.id, req.user.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const [{ n }] = await q('SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?', [cat.id]);
  if (n > 0) return res.status(409).json({ error: `This category is used by ${n} transaction(s). Re-assign or delete them first.` });
  await q('DELETE FROM categories WHERE id = ?', [cat.id]);
  res.json({ ok: true });
}));

export default router;
