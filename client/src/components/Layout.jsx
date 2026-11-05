import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../hooks/useRealtime.js';
import { api } from '../lib/api.js';
import { formatMinutes } from '../lib/format.js';
import { Avatar, Button } from './ui.jsx';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
      <img src="/favicon.svg" alt="" className="h-7 w-7" />
      <span>
        SkillSwap <span className="font-normal text-slate-400">Ledger</span>
      </span>
    </Link>
  );
}

function navClass({ isActive }) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;
}

export default function Layout() {
  const { user, logout: endSession } = useAuth();
  const navigate = useNavigate();
  const logout = () => {
    navigate('/');
    endSession();
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useRealtime(user);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => api('/wallet'), enabled: Boolean(user) });

  const links = user
    ? [
        ['/', 'Browse'],
        ['/dashboard', 'Dashboard'],
        ['/teach', 'Teach'],
        ['/history', 'History'],
        ['/wallet', 'Wallet'],
        ...(user.role === 'admin' ? [['/admin', 'Admin']] : []),
      ]
    : [['/', 'Browse']];

  // Close the mobile menu whenever the page changes.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              {links.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/'} className={navClass}>
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/wallet"
                  className="hidden rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700 ring-1 ring-teal-600/20 sm:inline-block"
                  title="Your time-credit balance"
                >
                  {wallet.data ? formatMinutes(wallet.data.balance) : '…'}
                </Link>
                <Link to="/profile" className="hidden items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100 sm:flex">
                  <Avatar name={user.name} size="sm" />
                  <span className="text-sm font-medium text-slate-700">{user.name.split(' ')[0]}</span>
                </Link>
                <span className="hidden md:block">
                  <Button variant="ghost" size="sm" onClick={logout}>
                    Log out
                  </Button>
                </span>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" to="/login">
                  Log in
                </Button>
                <Button size="sm" to="/signup">
                  Sign up
                </Button>
              </>
            )}
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 5h14v2H3zM3 9h14v2H3zM3 13h14v2H3z" />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-slate-200 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {links.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/'} className={navClass}>
                  {label}
                </NavLink>
              ))}
              {user && (
                <>
                  <NavLink to="/profile" className={navClass}>
                    Profile · {wallet.data ? formatMinutes(wallet.data.balance) : '…'}
                  </NavLink>
                  <button onClick={logout} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100">
                    Log out
                  </button>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500">
          <p>SkillSwap Ledger · time credits are fictional and never real money.</p>
          <p>1 credit = 1 minute of teaching</p>
        </div>
      </footer>
    </div>
  );
}
