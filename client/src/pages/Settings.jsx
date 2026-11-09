import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Card, ConfirmModal, Field, PageHeader, useToast } from '../components/ui';
import { CURRENCIES } from '../utils';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({ name: user.name, currency: user.currency });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy('profile');
    try {
      const d = await api.put('/auth/me', profile);
      setUser(d.user);
      toast('Profile saved');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setBusy('pw');
    try {
      await api.put('/auth/me', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password updated');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function deleteAccount() {
    setBusy('del');
    try {
      await api.del('/auth/me');
      logout();
    } catch (err) {
      toast(err.message, 'error');
      setConfirmDelete(false);
      setBusy('');
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your profile and preferences." />
      <div className="stack narrow">
        <Card title="Profile">
          <form className="stack" onSubmit={saveProfile}>
            <Field label="Full name"><input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></Field>
            <Field label="Email"><input value={user.email} disabled /></Field>
            <Field label="Currency" hint="Used to display all amounts">
              <select value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <div><button className="btn btn-primary" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save changes'}</button></div>
          </form>
        </Card>

        <Card title="Change password">
          <form className="stack" onSubmit={savePassword}>
            <Field label="Current password"><input type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <Field label="New password" hint="At least 8 characters"><input type="password" required minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <div><button className="btn btn-primary" disabled={busy === 'pw'}>{busy === 'pw' ? 'Updating…' : 'Update password'}</button></div>
          </form>
        </Card>

        {user.role !== 'admin' && (
          <Card title="Danger zone" className="danger-card">
            <p className="muted">Permanently delete your account and all your transactions and categories.</p>
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete my account</button>
          </Card>
        )}
      </div>
      {confirmDelete && <ConfirmModal title="Delete your account?" message="All your data will be permanently erased. This cannot be undone." confirmLabel="Yes, delete everything" onConfirm={deleteAccount} onClose={() => setConfirmDelete(false)} busy={busy === 'del'} />}
    </>
  );
}
