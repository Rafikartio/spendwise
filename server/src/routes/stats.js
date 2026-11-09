import { Router } from 'express';
import { q, txOut } from '../db.js';
import { auth } from '../middleware/auth.js';
import { wrap } from '../middleware/wrap.js';

const router = Router();
router.use(auth);

const pad = (n) => String(n).padStart(2, '0');
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const currentMonth = () => monthKey(new Date());
const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Income/expense totals (and row count) between [from, to) */
async function totals(userId, from, to) {
  const rows = await q(
    'SELECT type, SUM(amount) AS s, COUNT(*) AS n FROM transactions WHERE user_id = ? AND `date` >= ? AND `date` < ? GROUP BY type',
    [userId, from, to]
  );
  const out = { income: 0, expense: 0, count: 0 };
  for (const r of rows) {
    out[r.type] = Number(r.s);
    out.count += Number(r.n);
  }
  return out;
}

router.get('/summary', wrap(async (req, res) => {
  const uid = req.user.id;
  const month = MONTH_RE.test(req.query.month || '') ? req.query.month : currentMonth();
  const prev = addMonths(month, -1);
  const start = `${month}-01`;
  const end = `${addMonths(month, 1)}-01`;

  const cur = await totals(uid, start, end);
  const prv = await totals(uid, `${prev}-01`, start);

  const byCategory = (
    await q(
      `SELECT c.id, c.name, c.color, c.icon, c.budget, COALESCE(SUM(t.amount), 0) AS spent
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id AND t.type = 'expense' AND t.\`date\` >= ? AND t.\`date\` < ?
       WHERE c.user_id = ? AND c.type = 'expense'
       GROUP BY c.id, c.name, c.color, c.icon, c.budget
       HAVING spent > 0 OR c.budget > 0
       ORDER BY spent DESC`,
      [start, end, uid]
    )
  ).map((r) => ({ id: r.id, name: r.name, color: r.color, icon: r.icon, spent: Number(r.spent), budget: Number(r.budget) }));

  // daily series
  const dailyRows = await q(
    'SELECT `date` AS d, type, SUM(amount) AS s FROM transactions WHERE user_id = ? AND `date` >= ? AND `date` < ? GROUP BY `date`, type',
    [uid, start, end]
  );
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const daily = Array.from({ length: days }, (_, i) => {
    const date = `${month}-${pad(i + 1)}`;
    const get = (type) => Number(dailyRows.find((r) => r.d === date && r.type === type)?.s || 0);
    return { date, day: i + 1, expense: get('expense'), income: get('income') };
  });

  // 6-month trend
  const trendStart = `${addMonths(month, -5)}-01`;
  const trendRows = await q(
    `SELECT DATE_FORMAT(\`date\`, '%Y-%m') AS m, type, SUM(amount) AS s
     FROM transactions WHERE user_id = ? AND \`date\` >= ? AND \`date\` < ? GROUP BY m, type`,
    [uid, trendStart, end]
  );
  const trend = Array.from({ length: 6 }, (_, i) => {
    const ym = addMonths(month, i - 5);
    const get = (type) => Number(trendRows.find((r) => r.m === ym && r.type === type)?.s || 0);
    return { month: ym, income: get('income'), expense: get('expense') };
  });

  const recent = (
    await q(
      `SELECT t.*, c.name AS c_name, c.color AS c_color, c.icon AS c_icon
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? ORDER BY t.\`date\` DESC, t.created_at DESC LIMIT 6`,
      [uid]
    )
  ).map((r) => ({ ...txOut(r), category: { id: r.category_id, name: r.c_name, color: r.c_color, icon: r.c_icon } }));

  res.json({
    month,
    income: cur.income,
    expense: cur.expense,
    balance: cur.income - cur.expense,
    savingsRate: cur.income > 0 ? Math.round(((cur.income - cur.expense) / cur.income) * 100) : 0,
    previous: { income: prv.income, expense: prv.expense },
    transactionCount: cur.count,
    byCategory,
    daily,
    trend,
    recent,
  });
}));

router.get('/yearly', wrap(async (req, res) => {
  const uid = req.user.id;
  const year = Math.min(2100, Math.max(2000, parseInt(req.query.year) || new Date().getFullYear()));
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;

  const rows = await q(
    `SELECT DATE_FORMAT(\`date\`, '%Y-%m') AS m, type, SUM(amount) AS s
     FROM transactions WHERE user_id = ? AND \`date\` >= ? AND \`date\` < ? GROUP BY m, type`,
    [uid, from, to]
  );
  let cumulative = 0;
  let totalIncome = 0;
  let totalExpense = 0;
  const months = Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${pad(i + 1)}`;
    const get = (type) => Number(rows.find((r) => r.m === ym && r.type === type)?.s || 0);
    const income = get('income');
    const expense = get('expense');
    cumulative += income - expense;
    totalIncome += income;
    totalExpense += expense;
    return { month: ym, income, expense, net: income - expense, cumulative };
  });

  const topCategories = (
    await q(
      `SELECT c.id, c.name, c.color, c.icon, SUM(t.amount) AS total
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.type = 'expense' AND t.\`date\` >= ? AND t.\`date\` < ?
       GROUP BY c.id, c.name, c.color, c.icon ORDER BY total DESC`,
      [uid, from, to]
    )
  ).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    total: Number(r.total),
    share: totalExpense ? Math.round((Number(r.total) / totalExpense) * 100) : 0,
  }));

  res.json({ year, months, topCategories, totals: { income: totalIncome, expense: totalExpense } });
}));

export default router;
