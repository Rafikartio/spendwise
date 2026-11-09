import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, ConfirmModal, Empty, PageHeader, Spinner, StatCard, useToast } from '../components/ui';
import { fmtDate, initials, money, monthLabel } from '../utils';

export default function Admin() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(() => api.get(`/admin/users?search=${encodeURIComponent(search)}`).then((d) => setUsers(d.users)), [search]);
  const loadStats = () => api.get('/admin/stats').then(setStats);

  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    const t = setTimeout(loadUsers, 200);
    return () => clearTimeout(t);
  }, [loadUsers]);

  async function patch(u, body, msg) {
    try {
      await api.patch(`/admin/users/${u.id}`, body);
      toast(msg);
      loadUsers();
      loadStats();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.del(`/admin/users/${deleting.id}`);
      toast('User deleted');
      setDeleting(null);
      loadUsers();
      loadStats();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Admin panel" subtitle="Manage users and monitor platform activity." />
      {!stats ? (
        <div className="center"><Spinner /></div>
      ) : (
        <>
          <div className="grid-4">
            <StatCard label="Total users" icon="👥" tone="brand" value={stats.totalUsers} hint={`${stats.admins} admin${stats.admins === 1 ? '' : 's'}`} />
            <StatCard label="Active this week" icon="⚡" tone="green" value={stats.activeThisWeek} hint={`${stats.activeUsers} active accounts`} />
            <StatCard label="Transactions" icon="🧾" tone="amber" value={stats.totalTransactions.toLocaleString()} hint="across all users" />
            <StatCard label="Tracked spend" icon="💸" tone="red" value={money(stats.totalExpenseVolume, 'USD', true)} hint="mixed currencies, face value" />
          </div>

          <Card title="New sign-ups" action={<span className="muted small">Last 6 months</span>}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.signups.map((s) => ({ ...s, label: monthLabel(s.month) }))} margin={{ left: -20, right: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--hover)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
                <Bar dataKey="users" name="Sign-ups" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      <Card title="Users" pad={false} action={<input className="search sm" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />}>
        {!users ? (
          <div className="center"><Spinner /></div>
        ) : users.length === 0 ? (
          <Empty icon="👤" title="No users found" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>User</th><th>Role</th><th>Status</th><th className="num">Txns</th><th>Joined</th><th>Last login</th><th /></tr></thead>
              <tbody>
                {users.map((u) => {
                  const self = u.id === me.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <span className="avatar sm">{initials(u.name)}</span>
                          <div><strong>{u.name}</strong>{self && <span className="you">You</span>}<div className="muted small">{u.email}</div></div>
                        </div>
                      </td>
                      <td><span className={`badge ${u.role === 'admin' ? 'b-purple' : 'b-gray'}`}>{u.role}</span></td>
                      <td><span className={`badge ${u.active ? 'b-green' : 'b-red'}`}>{u.active ? 'Active' : 'Suspended'}</span></td>
                      <td className="num">{u.transactionCount}</td>
                      <td className="muted nowrap">{fmtDate(u.createdAt.slice(0, 10))}</td>
                      <td className="muted nowrap">{fmtDate(u.lastLoginAt.slice(0, 10))}</td>
                      <td className="actions nowrap">
                        {!self && (
                          <>
                            <button className="btn btn-sm" onClick={() => patch(u, { role: u.role === 'admin' ? 'user' : 'admin' }, `Role changed to ${u.role === 'admin' ? 'user' : 'admin'}`)}>
                              {u.role === 'admin' ? 'Make user' : 'Make admin'}
                            </button>
                            <button className="btn btn-sm" onClick={() => patch(u, { active: !u.active }, u.active ? 'User suspended' : 'User reactivated')}>
                              {u.active ? 'Suspend' : 'Activate'}
                            </button>
                            <button className="btn btn-sm btn-ghost-danger" onClick={() => setDeleting(u)}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {deleting && <ConfirmModal title={`Delete ${deleting.name}?`} message={`This permanently removes the account and ${deleting.transactionCount} transaction(s).`} onConfirm={remove} onClose={() => setDeleting(null)} busy={busy} />}
    </>
  );
}
