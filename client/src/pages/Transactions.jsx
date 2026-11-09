import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, ConfirmModal, Empty, PageHeader, Pagination, Spinner, useToast } from '../components/ui';
import TransactionForm from '../components/TransactionForm';
import { fmtDate, money } from '../utils';

const blank = { search: '', type: '', categoryId: '', from: '', to: '' };

export default function Transactions() {
  const { user } = useAuth();
  const toast = useToast();
  const cur = user.currency;
  const [filters, setFilters] = useState(blank);
  const [sort, setSort] = useState({ key: 'date', order: 'desc' });
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null); // null | {} (new) | tx
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const debounce = useRef();

  const query = useCallback(
    (extra = {}) => {
      const p = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), sort: sort.key, order: sort.order, ...extra });
      return p.toString();
    },
    [filters, sort]
  );

  const load = useCallback(() => {
    api.get(`/transactions?${query({ page, limit: 12 })}`).then(setRes);
  }, [query, page]);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(load, 200);
    return () => clearTimeout(debounce.current);
  }, [load]);
  useEffect(() => { api.get('/categories').then((d) => setCats(d.categories)); }, []);

  const setFilter = (k) => (e) => { setPage(1); setFilters((f) => ({ ...f, [k]: e.target.value })); };
  const toggleSort = (key) => setSort((s) => ({ key, order: s.key === key && s.order === 'desc' ? 'asc' : 'desc' }));
  const arrow = (k) => (sort.key === k ? (sort.order === 'desc' ? ' ↓' : ' ↑') : '');
  const catOf = (id) => cats.find((c) => c.id === id);
  const hasFilters = Object.values(filters).some(Boolean);

  async function remove() {
    setBusy(true);
    try {
      await api.del(`/transactions/${deleting.id}`);
      toast('Transaction deleted');
      setDeleting(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Search, filter and manage everything you've recorded."
        actions={
          <>
            <button className="btn" onClick={() => api.download(`/transactions/export.csv?${query()}`, 'transactions.csv').catch((e) => toast(e.message, 'error'))}>⬇ Export CSV</button>
            <button className="btn btn-primary" onClick={() => setEditing({})}>+ Add transaction</button>
          </>
        }
      />

      {res && (
        <div className="grid-3 mini">
          <div className="card mini-stat"><span>Income</span><strong className="pos">{money(res.totals.income, cur)}</strong></div>
          <div className="card mini-stat"><span>Expenses</span><strong className="neg">{money(res.totals.expense, cur)}</strong></div>
          <div className="card mini-stat"><span>Net</span><strong>{money(res.totals.net, cur)}</strong></div>
        </div>
      )}

      <Card pad={false}>
        <div className="filters">
          <input className="search" placeholder="🔍 Search description or notes…" value={filters.search} onChange={setFilter('search')} />
          <select value={filters.type} onChange={setFilter('type')}>
            <option value="">All types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>
          <select value={filters.categoryId} onChange={setFilter('categoryId')}>
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <input type="date" value={filters.from} onChange={setFilter('from')} title="From" />
          <input type="date" value={filters.to} onChange={setFilter('to')} title="To" />
          {hasFilters && <button className="btn btn-sm" onClick={() => { setFilters(blank); setPage(1); }}>Clear</button>}
        </div>

        {!res ? (
          <div className="center"><Spinner /></div>
        ) : res.transactions.length === 0 ? (
          <Empty icon="🔎" title={hasFilters ? 'No matching transactions' : 'No transactions yet'} text={hasFilters ? 'Try adjusting your filters.' : 'Record your first income or expense.'} action={!hasFilters && <button className="btn btn-primary" onClick={() => setEditing({})}>+ Add transaction</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort('date')}>Date{arrow('date')}</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="num sortable" onClick={() => toggleSort('amount')}>Amount{arrow('amount')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {res.transactions.map((t) => {
                  const c = catOf(t.categoryId);
                  return (
                    <tr key={t.id}>
                      <td className="muted nowrap">{fmtDate(t.date)}</td>
                      <td><strong>{t.description || '—'}</strong>{t.notes && <div className="muted small clip">{t.notes}</div>}</td>
                      <td><span className="badge" style={{ background: (c?.color || '#64748b') + '1f', color: c?.color }}>{c?.icon} {c?.name || 'Unknown'}</span></td>
                      <td className={`num ${t.type === 'income' ? 'pos' : 'neg'}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount, cur)}</td>
                      <td className="actions">
                        <button className="icon-btn" onClick={() => setEditing(t)} aria-label="Edit">✏️</button>
                        <button className="icon-btn" onClick={() => setDeleting(t)} aria-label="Delete">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {res && <div className="table-foot"><span className="muted small">{res.total} result{res.total === 1 ? '' : 's'}</span><Pagination page={res.page} pages={res.pages} onChange={setPage} /></div>}
      </Card>

      {editing && (
        <TransactionForm categories={cats} initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
      {deleting && (
        <ConfirmModal title="Delete transaction?" message={`"${deleting.description || 'This transaction'}" (${money(deleting.amount, cur)}) will be permanently removed.`} onConfirm={remove} onClose={() => setDeleting(null)} busy={busy} />
      )}
    </>
  );
}
