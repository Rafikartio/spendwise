import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { Field } from '../components/ui';

export default function AuthPage({ mode }) {
  const { login, register } = useAuth();
  const isLogin = mode === 'login';
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(f.email, f.password);
      else await register(f.name, f.email, f.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="brand light"><span className="logo">S</span> Spendwise</div>
        <h2>Take control of your money, one transaction at a time.</h2>
        <ul>
          <li>📊 Beautiful dashboards and monthly reports</li>
          <li>🏷️ Custom categories with budgets</li>
          <li>🔒 Private, secure, and yours alone</li>
        </ul>
      </div>

      <div className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="muted">{isLogin ? 'Sign in to continue to Spendwise.' : 'Start tracking your expenses in under a minute.'}</p>

          {!isLogin && (
            <Field label="Full name">
              <input required autoFocus value={f.name} onChange={set('name')} placeholder="Jane Cooper" />
            </Field>
          )}
          <Field label="Email">
            <input type="email" required autoFocus={isLogin} value={f.email} onChange={set('email')} placeholder="you@company.com" />
          </Field>
          <Field label="Password" hint={!isLogin ? 'At least 8 characters' : undefined}>
            <input type="password" required minLength={isLogin ? 1 : 8} value={f.password} onChange={set('password')} placeholder="••••••••" />
          </Field>

          {error && <div className="alert">{error}</div>}
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>

          <p className="switch muted">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Sign up' : 'Sign in'}</Link>
          </p>

        </form>
      </div>
    </div>
  );
}
