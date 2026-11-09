import { Router } from 'express';
import { q, uid, txOut } from '../db.js';
import { auth } from '../middleware/auth.js';
import { wrap } from '../middleware/wrap.js';

const router = Router();
router.use(auth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s) => DATE_RE.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

async function validate(req, body) {
  const type = body.type === 'income' ? 'income' : 'expense';
  const amount = Number(body.amount);
  const date = String(body.date || '');
  const [cat] = await q('SELECT * FROM categories WHERE id = ? AND user_id = ?', [String(body.categoryId || ''), req.user.id]);
  if (!(amount > 0) || amount > 999999999999) return { error: 'Amount must be greater than 0' };
  if (!validDate(date)) return { error: 'Please choose a valid date' };
  if (!cat) return { error: 'Please choose a category' };
  if (cat.type !== type) return { error: `Category "${cat.name}" is not an ${type} category` };
  return {
    value: {
      type,
      amount: Math.round(amount * 100) / 100,
      date,
      categoryId: cat.id,
      description: String(body.description || '').trim().slice(0, 200),
      notes: String(body.notes || '').trim().slice(0, 1000),
    },
  };
}

function buildWhere(req) {
  const c = ['t.user_id = ?'];
  const p = [req.user.id];
  const { search, type, categoryId, from, to, min, max } = req.query;
  if (type === 'income' || type === 'expense') { c.push('t.type = ?'); p.push(type); }
  if (categoryId) { c.push('t.category_id = ?'); p.push(String(categoryId)); }
  if (validDate(String(from || ''))) { c.push('t.`date` >= ?'); p.push(from); }
  if (validDate(String(to || ''))) { c.push('t.`date` <= ?'); p.push(to); }
  if (min !== undefined && min !== '' && !isNaN(min)) { c.push('t.amount >= ?'); p.push(Number(min)); }
  if (max !== undefined && max !== '' && !isNaN(max)) { c.push('t.amount <= ?'); p.push(Number(max)); }
  if (search) {
    const like = '%' + String(search).replace(/[\\%_]/g, '\\$&') + '%';
    c.push('(t.description LIKE ? OR t.notes LIKE ?)');
    p.push(like, like);
  }
  return { sql: c.join(' AND '), params: p };
}

router.get('/', wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
  const col = req.query.sort === 'amount' ? 't.amount' : 't.`date`';
  const dir = req.query.order === 'asc' ? 'ASC' : 'DESC';
  const { sql, params } = buildWhere(req);

  const [agg] = await q(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) AS income,
            COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) AS expense
     FROM transactions t WHERE ${sql}`,
    params
  );
  const rows = await q(
    `SELECT t.* FROM transactions t WHERE ${sql} ORDER BY ${col} ${dir}, t.created_at ${dir} LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  const total = Number(agg.total);
  const income = Number(agg.income);
  const expense = Number(agg.expense);
  res.json({
    transactions: rows.map(txOut),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: { income, expense, net: income - expense },
  });
}));

router.get('/export.csv', wrap(async (req, res) => {
  const { sql, params } = buildWhere(req);
  const rows = await q(
    `SELECT t.*, c.name AS category_name FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE ${sql} ORDER BY t.\`date\` DESC, t.created_at DESC`,
    params
  );
  // quote values and neutralise spreadsheet formula injection
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    'Date,Type,Category,Description,Amount,Notes',
    ...rows.map((t) => [t.date, t.type, esc(t.category_name), esc(t.description), Number(t.amount), esc(t.notes)].join(',')),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
  res.send(csv);
}));

router.post('/', wrap(async (req, res) => {
  const { error, value: v } = await validate(req, req.body);
  if (error) return res.status(400).json({ error });
  const id = uid();
  await q(
    'INSERT INTO transactions (id, user_id, category_id, type, amount, `date`, description, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, v.categoryId, v.type, v.amount, v.date, v.description, v.notes, new Date()]
  );
  const [row] = await q('SELECT * FROM transactions WHERE id = ?', [id]);
  res.status(201).json({ transaction: txOut(row) });
}));

router.put('/:id', wrap(async (req, res) => {
  const [existing] = await q('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'Transaction not found' });
  const { error, value: v } = await validate(req, req.body);
  if (error) return res.status(400).json({ error });
  await q(
    'UPDATE transactions SET category_id = ?, type = ?, amount = ?, `date` = ?, description = ?, notes = ? WHERE id = ?',
    [v.categoryId, v.type, v.amount, v.date, v.description, v.notes, existing.id]
  );
  const [row] = await q('SELECT * FROM transactions WHERE id = ?', [existing.id]);
  res.json({ transaction: txOut(row) });
}));

router.delete('/:id', wrap(async (req, res) => {
  const result = await q('DELETE FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ ok: true });
}));

export default router;
