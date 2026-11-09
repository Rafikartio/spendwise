import { useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { initials } from '../utils';

const Icon = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  dashboard: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  tx: 'M7 7h13M7 12h13M7 17h13M3 7h.01M3 12h.01M3 17h.01',
  cat: 'M20 12l-8 8-9-9V3h8l9 9zM7.5 7.5h.01',
  report: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  admin: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
};

const TITLES = { '/': 'Dashboard', '/transactions': 'Transactions', '/categories': 'Categories', '/reports': 'Reports', '/settings': 'Settings', '/admin': 'Admin' };

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('sw_theme', next);
    setTheme(next);
  };

  const link = (to, label, icon) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}>
      <Icon d={ICONS[icon]} /> {label}
    </NavLink>
  );

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link to="/" className="brand">
          <span className="logo">S</span> Spendwise
        </Link>
        <nav>
          <span className="nav-section">Main</span>
          {link('/', 'Dashboard', 'dashboard')}
          {link('/transactions', 'Transactions', 'tx')}
          {link('/categories', 'Categories', 'cat')}
          {link('/reports', 'Reports', 'report')}
          <span className="nav-section">Account</span>
          {link('/settings', 'Settings', 'settings')}
          {user.role === 'admin' && (
            <>
              <span className="nav-section">Administration</span>
              {link('/admin', 'Admin panel', 'admin')}
            </>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{initials(user.name)}</div>
          <div className="who">
            <strong>{user.name}</strong>
            <small>{user.role === 'admin' ? 'Administrator' : 'Free plan'}</small>
          </div>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <div className="crumb">{TITLES[pathname] || ''}</div>
          <div className="topbar-right">
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="menu-wrap">
              <button className="user-chip" onClick={() => setMenu((m) => !m)}>
                <span className="avatar sm">{initials(user.name)}</span>
                <span className="hide-sm">{user.name}</span> ▾
              </button>
              {menu && (
                <div className="dropdown" onMouseLeave={() => setMenu(false)}>
                  <div className="dd-head">
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                  <Link to="/settings" onClick={() => setMenu(false)}>Account settings</Link>
                  <button onClick={logout}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
