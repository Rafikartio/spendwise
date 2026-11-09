import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Empty, PageHeader, Spinner, StatCard } from '../components/ui';
import TransactionForm from '../components/TransactionForm';
import { fmtDate, money, monthLabel, pctChange, shiftMonth, thisMonth } from '../utils';

const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13 }, itemStyle: { color: 'var(--text)' }, labelStyle: { color: 'var(--muted)' } };

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(thisMonth());
  const [s, setS] = useState(null);
  const [cats, setCats] = useState([]);
  const [adding, setAdding] = useState(false);
  const cur = user.currency;

  const load = useCallback(() => {
    api.get(`/stats/summary?month=${month}`).then(setS);
  }, [month]);
  useEffect(load, [load]);
  useEffect(() => { api.get('/categories').then((d) => setCats(d.categories)); }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const monthPicker = (
    <div className="month-picker">
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
      <span>{monthLabel(month, true)}</span>
      <button className="icon-btn" disabled={month >= thisMonth()} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
    </div>
  );

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.split(' ')[0]} 👋`}
        subtitle="Here's how your money is moving."
        actions={<>{monthPicker}<button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add transaction</button></>}
      />

      {!s ? (
        <div className="center"><Spinner /></div>
      ) : (
        <>
          <div className="grid-4">
            <StatCard label="Total balance" icon="💳" tone="brand" value={money(s.balance, cur)} hint={`${s.transactionCount} transactions`} />
            <StatCard label="Income" icon="⬇️" tone="green" value={money(s.income, cur)} delta={pctChange(s.income, s.previous.income)} />
            <StatCard label="Expenses" icon="⬆️" tone="red" value={money(s.expense, cur)} delta={pctChange(s.expense, s.previous.expense)} goodWhenUp={false} />
            <StatCard label="Savings rate" icon="🎯" tone="amber" value={`${s.savingsRate}%`} hint="of income saved" />
          </div>

          <div className="grid-2-1">
            <Card title="Spending over time">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={s.daily} margin={{ left: -10, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => money(v, cur, true)} />
                  <Tooltip {...tip} formatter={(v) => money(v, cur)} labelFormatter={(d) => `Day ${d}`} />
                  <Area type="monotone" dataKey="expense" name="Expenses" stroke="#6366f1" strokeWidth={2.5} fill="url(#gExp)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Expenses by category">
              {s.byCategory.some((c) => c.spent > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={s.byCategory.filter((c) => c.spent > 0)} dataKey="spent" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                        {s.byCategory.filter((c) => c.spent > 0).map((c) => <Cell key={c.id} fill={c.color} />)}
                      </Pie>
                      <Tooltip {...tip} formatter={(v) => money(v, cur)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="legend">
                    {s.byCategory.filter((c) => c.spent > 0).slice(0, 5).map((c) => (
                      <li key={c.id}><i style={{ background: c.color }} />{c.name}<b>{money(c.spent, cur)}</b></li>
                    ))}
                  </ul>
                </>
              ) : (
                <Empty icon="🥧" title="No expenses yet" text="Add a transaction to see the breakdown." />
              )}
            </Card>
          </div>

          <div className="grid-2-1">
            <Card title="Income vs expenses" action={<span className="muted small">Last 6 months</span>}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={s.trend.map((t) => ({ ...t, label: monthLabel(t.month) }))} margin={{ left: -10, right: 8 }} barGap={4}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => money(v, cur, true)} />
                  <Tooltip {...tip} cursor={{ fill: 'var(--hover)' }} formatter={(v) => money(v, cur)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expense" name="Expenses" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Budgets">
              {s.byCategory.filter((c) => c.budget > 0).length ? (
                <div className="budgets">
                  {s.byCategory.filter((c) => c.budget > 0).map((c) => {
                    const pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
                    const over = c.spent > c.budget;
                    return (
                      <div key={c.id} className="budget">
                        <div className="budget-row">
                          <span>{c.icon} {c.name}</span>
                          <small className={over ? 'neg' : 'muted'}>{money(c.spent, cur)} / {money(c.budget, cur)}</small>
                        </div>
                        <div className="progress"><span style={{ width: pct + '%', background: over ? 'var(--red)' : pct > 80 ? 'var(--amber)' : c.color }} /></div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty icon="🎯" title="No budgets set" text="Set a monthly budget on a category." action={<Link className="btn btn-sm" to="/categories">Manage categories</Link>} />
              )}
            </Card>
          </div>

          <Card title="Recent transactions" action={<Link to="/transactions" className="link">View all →</Link>} pad={false}>
            {s.recent.length ? (
              <table className="table">
                <tbody>
                  {s.recent.map((t) => (
                    <tr key={t.id}>
                      <td><span className="cat-dot" style={{ background: (t.category?.color || '#64748b') + '22' }}>{t.category?.icon || '📦'}</span></td>
                      <td><strong>{t.description || t.category?.name}</strong><div className="muted small">{t.category?.name}</div></td>
                      <td className="muted hide-sm">{fmtDate(t.date)}</td>
                      <td className={`num ${t.type === 'income' ? 'pos' : 'neg'}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty icon="🧾" title="No transactions yet" text="Add your first transaction to get started." />
            )}
          </Card>
        </>
      )}

      {adding && <TransactionForm categories={cats} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </>
  );
}
