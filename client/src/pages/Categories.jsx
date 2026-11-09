import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, ConfirmModal, Empty, Field, Modal, PageHeader, Spinner, useToast } from '../components/ui';
import { money } from '../utils';

const COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#ef4444', '#eab308', '#14b8a6', '#22c55e', '#6366f1', '#64748b', '#84cc16'];
const ICONS = ['🍔', '🚗', '🏠', '💡', '🛍️', '💊', '🎬', '📚', '✈️', '🎁', '🐶', '☕', '💼', '💻', '📈', '💰', '🏋️', '📱', '🧾', '📦'];

function CategoryForm({ initial, type, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(initial || { name: '', type, color: COLORS[0], icon: ICONS[0], budget: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (initial) await api.put(`/categories/${initial.id}`, f);
      else await api.post('/categories', f);
      toast(initial ? 'Category updated' : 'Category created');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial ? 'Edit category' : `New ${f.type} category`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button form="cat-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <form id="cat-form" onSubmit={submit} className="stack">
        <Field label="Name"><input required autoFocus maxLength={40} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div>
          <span className="label">Icon</span>
          <div className="picker">
            {ICONS.map((i) => <button type="button" key={i} className={f.icon === i ? 'on' : ''} onClick={() => setF({ ...f, icon: i })}>{i}</button>)}
          </div>
        </div>
        <div>
          <span className="label">Color</span>
          <div className="picker">
            {COLORS.map((c) => <button type="button" key={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={c} />)}
          </div>
        </div>
        {f.type === 'expense' && (
          <Field label="Monthly budget (optional)" hint="Leave at 0 for no budget">
            <input type="number" min="0" step="1" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} placeholder="0" />
          </Field>
        )}
        {error && <div className="alert">{error}</div>}
      </form>
    </Modal>
  );
}

export default function Categories() {
  const { user } = useAuth();
  const toast = useToast();
  const [cats, setCats] = useState(null);
  const [tab, setTab] = useState('expense');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get('/categories').then((d) => setCats(d.categories)), []);
  useEffect(() => { load(); }, [load]);

  async function remove() {
    setBusy(true);
    try {
      await api.del(`/categories/${deleting.id}`);
      toast('Category deleted');
      setDeleting(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  const list = (cats || []).filter((c) => c.type === tab);

  return (
    <>
      <PageHeader title="Categories" subtitle="Organise your money and set monthly budgets." actions={<button className="btn btn-primary" onClick={() => setEditing({ new: true })}>+ New category</button>} />
      <div className="tabs">
        <button className={tab === 'expense' ? 'on' : ''} onClick={() => setTab('expense')}>Expense categories</button>
        <button className={tab === 'income' ? 'on' : ''} onClick={() => setTab('income')}>Income categories</button>
      </div>

      {!cats ? (
        <div className="center"><Spinner /></div>
      ) : list.length === 0 ? (
        <Card><Empty icon="🏷️" title="No categories" text="Create one to start organising." /></Card>
      ) : (
        <div className="cat-grid">
          {list.map((c) => (
            <div key={c.id} className="card cat-card">
              <div className="cat-top">
                <span className="cat-icon" style={{ background: c.color + '22', color: c.color }}>{c.icon}</span>
                <div>
                  <strong>{c.name}</strong>
                  <div className="muted small">{c.transactionCount} transaction{c.transactionCount === 1 ? '' : 's'}</div>
                </div>
              </div>
              {c.type === 'expense' && <div className="muted small">Budget: {c.budget > 0 ? money(c.budget, user.currency) + ' / month' : 'not set'}</div>}
              <div className="cat-actions">
                <button className="btn btn-sm" onClick={() => setEditing(c)}>Edit</button>
                <button className="btn btn-sm btn-ghost-danger" onClick={() => setDeleting(c)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <CategoryForm initial={editing.new ? null : editing} type={tab} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {deleting && <ConfirmModal title={`Delete "${deleting.name}"?`} message="This can't be undone. Categories that are used by transactions can't be deleted." onConfirm={remove} onClose={() => setDeleting(null)} busy={busy} />}
    </>
  );
}
