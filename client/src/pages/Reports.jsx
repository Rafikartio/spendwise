import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, Empty, PageHeader, Spinner, StatCard } from '../components/ui';
import { money, monthLabel } from '../utils';

const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13 }, itemStyle: { color: 'var(--text)' }, labelStyle: { color: 'var(--muted)' } };

export default function Reports() {
  const { user } = useAuth();
  const cur = user.currency;
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [d, setD] = useState(null);

  useEffect(() => {
    setD(null);
    api.get(`/stats/yearly?year=${year}`).then(setD);
  }, [year]);

  const years = Array.from({ length: 5 }, (_, i) => thisYear - i);
  const axis = { tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false, axisLine: false };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Yearly overview of your income, spending and savings."
        actions={<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select>}
      />
      {!d ? (
        <div className="center"><Spinner /></div>
      ) : (
        <>
          <div className="grid-3">
            <StatCard label={`Income ${year}`} icon="⬇️" tone="green" value={money(d.totals.income, cur)} />
            <StatCard label={`Expenses ${year}`} icon="⬆️" tone="red" value={money(d.totals.expense, cur)} />
            <StatCard label="Net savings" icon="🏦" tone="brand" value={money(d.totals.income - d.totals.expense, cur)} />
          </div>

          <div className="grid-2">
            <Card title="Monthly income & expenses">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={d.months.map((m) => ({ ...m, label: monthLabel(m.month) }))} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} tickFormatter={(v) => money(v, cur, true)} />
                  <Tooltip {...tip} cursor={{ fill: 'var(--hover)' }} formatter={(v) => money(v, cur)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="expense" name="Expenses" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Cumulative savings">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={d.months.map((m) => ({ ...m, label: monthLabel(m.month) }))} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} tickFormatter={(v) => money(v, cur, true)} />
                  <Tooltip {...tip} formatter={(v) => money(v, cur)} />
                  <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title="Where your money went" pad={false}>
            {d.topCategories.length ? (
              <table className="table">
                <thead><tr><th>Category</th><th style={{ width: '40%' }}>Share</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {d.topCategories.map((c) => (
                    <tr key={c.id}>
                      <td><span className="badge" style={{ background: c.color + '1f', color: c.color }}>{c.icon} {c.name}</span></td>
                      <td><div className="progress"><span style={{ width: c.share + '%', background: c.color }} /></div></td>
                      <td className="num"><strong>{money(c.total, cur)}</strong> <span className="muted small">{c.share}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty icon="📭" title={`No expenses in ${year}`} />
            )}
          </Card>
        </>
      )}
    </>
  );
}
