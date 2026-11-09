import { useMemo, useState } from 'react';
import { api } from '../api';
import { Field, Modal, useToast } from './ui';
import { today } from '../utils';

export default function TransactionForm({ categories, initial, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(
    initial
      ? { ...initial }
      : { type: 'expense', amount: '', date: today(), categoryId: '', description: '', notes: '' }
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const options = useMemo(() => categories.filter((c) => c.type === f.type), [categories, f.type]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const switchType = (type) => setF((s) => ({ ...s, type, categoryId: '' }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (initial) await api.put(`/transactions/${initial.id}`, f);
      else await api.post('/transactions', f);
      toast(initial ? 'Transaction updated' : 'Transaction added');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial ? 'Edit transaction' : 'New transaction'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button form="tx-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save transaction'}</button>
        </>
      }
    >
      <form id="tx-form" onSubmit={submit} className="form-grid">
        <div className="segmented full">
          <button type="button" className={f.type === 'expense' ? 'on expense' : ''} onClick={() => switchType('expense')}>Expense</button>
          <button type="button" className={f.type === 'income' ? 'on income' : ''} onClick={() => switchType('income')}>Income</button>
        </div>
        <Field label="Amount">
          <input type="number" step="0.01" min="0.01" required autoFocus placeholder="0.00" value={f.amount} onChange={set('amount')} />
        </Field>
        <Field label="Date">
          <input type="date" required value={f.date} onChange={set('date')} />
        </Field>
        <Field label="Category">
          <select required value={f.categoryId} onChange={set('categoryId')}>
            <option value="">Select category…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input maxLength={200} placeholder="e.g. Lunch with team" value={f.description} onChange={set('description')} />
        </Field>
        <div className="full">
          <Field label="Notes (optional)">
            <textarea rows={3} maxLength={1000} value={f.notes} onChange={set('notes')} />
          </Field>
        </div>
        {error && <div className="alert full">{error}</div>}
      </form>
    </Modal>
  );
}
