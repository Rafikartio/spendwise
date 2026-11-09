import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const Spinner = () => <div className="spinner" aria-label="Loading" />;

export function Modal({ title, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onClose, busy }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Modal>
  );
}

export function Card({ title, action, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <h3>{title}</h3>
          {action}
        </header>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, delta, goodWhenUp = true, icon, tone = 'brand', hint }) {
  const hasDelta = delta !== null && delta !== undefined;
  const good = hasDelta && (delta === 0 ? null : goodWhenUp ? delta > 0 : delta < 0);
  return (
    <div className="card stat">
      <div className={`stat-icon tone-${tone}`}>{icon}</div>
      <div className="stat-main">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {hasDelta ? (
          <span className={`delta ${good === null ? '' : good ? 'up' : 'down'}`}>
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta)}% <em>vs last month</em>
          </span>
        ) : (
          hint && <span className="delta"><em>{hint}</em></span>
        )}
      </div>
    </div>
  );
}

export const Empty = ({ icon = '🗂️', title, text, action }) => (
  <div className="empty">
    <div className="empty-icon">{icon}</div>
    <h4>{title}</h4>
    {text && <p className="muted">{text}</p>}
    {action}
  </div>
);

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="page-head">
    <div>
      <h1>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </div>
    <div className="page-actions">{actions}</div>
  </div>
);

export const Field = ({ label, error, children, hint }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {hint && <small className="muted">{hint}</small>}
    {error && <small className="err">{error}</small>}
  </label>
);

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.type === 'error' ? '⚠️' : '✓'}</span> {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</button>
      <span className="muted">Page {page} of {pages}</span>
      <button className="btn btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  );
}
