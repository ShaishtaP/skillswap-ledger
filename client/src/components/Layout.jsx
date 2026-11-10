import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../hooks/useRealtime.js';
import { api } from '../lib/api.js';
import { formatMinutes } from '../lib/format.js';
import { Avatar, Button, cx } from './ui.jsx';

export function Logo({ className }) {
  return (
    <Link to="/" className={cx('font-display text-[23px] font-bold text-ink', className)}>
      Skill<span className="italic text-gold">/</span>Swap
    </Link>
  );
}

const linkClass = ({ isActive }) => cx('text-[15px] transition-colors hover:text-ox', isActive ? 'text-ox' : 'text-body');

// Links like "/#how" jump to a section of the homepage. NavLink only compares
// the path, so it would mark them all as "active"; use a plain Link instead.
function MenuLink({ to, className, children }) {
  if (to.includes('#')) {
    return (
      <Link to={to} className={typeof className === 'function' ? className({ isActive: false }) : className}>
        {children}
      </Link>
    );
  }
  return (
    <NavLink to={to} end={to === '/'} className={className}>
      {children}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout: endSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useRealtime();

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => api('/wallet'), enabled: Boolean(user) });
  const logout = () => {
    navigate('/');
    endSession();
  };

  useEffect(() => setMenuOpen(false), [location.pathname]);
  // Jump to "#how" etc. when a hash link is followed.
  useEffect(() => {
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  const links = user
    ? [
        ['/', 'Browse'],
        ['/dashboard', 'My desk'],
        ['/teach', 'Teach'],
        ['/history', 'History'],
        ['/wallet', 'Wallet'],
        ...(user.role === 'admin' ? [['/admin', 'Admin']] : []),
      ]
    : [
        ['/', 'Browse'],
        ['/#how', 'How it works'],
        ['/#features', 'Features'],
        ['/#faq', 'Questions'],
      ];

  // The landing page manages its own full-width sections; every other page
  // sits in a centred column.
  const fullBleed = location.pathname === '/';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-ivory/85 backdrop-blur-md">
        <div className="mx-auto flex h-[70px] max-w-6xl items-center justify-between gap-6 px-5 sm:px-7">
          <Logo />
          <nav className="hidden items-center gap-7 lg:flex">
            {links.map(([to, label]) => (
              <MenuLink key={to} to={to} className={linkClass}>
                {label}
              </MenuLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link to="/wallet" className="hidden items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 font-mono text-[13px] text-ink sm:inline-flex" title="Your time-credit balance">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                  {wallet.data ? formatMinutes(wallet.data.balance) : '…'}
                </Link>
                <Link to="/profile" className="hidden sm:block" title="Your profile">
                  <Avatar name={user.name} size="sm" />
                </Link>
                <button onClick={logout} className="hidden text-[15px] text-body hover:text-ox lg:block">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hidden text-[15px] hover:text-ox sm:block">
                  Log in
                </Link>
                <Button to="/signup" size="sm">
                  Get 2 free hours
                </Button>
              </>
            )}
            <button className="rounded-lg p-2 text-ink hover:bg-champagne lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 5h14v1.5H3zM3 9.25h14v1.5H3zM3 13.5h14V15H3z" />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-line bg-ivory px-5 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              {links.map(([to, label]) => (
                <MenuLink key={to} to={to} className={(s) => cx(linkClass(s), 'rounded-lg px-3 py-2.5 hover:bg-champagne')}>
                  {label}
                </MenuLink>
              ))}
              {user ? (
                <>
                  <NavLink to="/profile" className={(s) => cx(linkClass(s), 'rounded-lg px-3 py-2.5 hover:bg-champagne')}>
                    Profile · {wallet.data ? formatMinutes(wallet.data.balance) : '…'}
                  </NavLink>
                  <button onClick={logout} className="rounded-lg px-3 py-2.5 text-left text-[15px] text-body hover:bg-champagne">
                    Log out
                  </button>
                </>
              ) : (
                <NavLink to="/login" className={(s) => cx(linkClass(s), 'rounded-lg px-3 py-2.5 hover:bg-champagne')}>
                  Log in
                </NavLink>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className={cx('flex-1', !fullBleed && 'mx-auto w-full max-w-6xl px-5 py-12 sm:px-7 sm:py-16')}>
        <Outlet />
      </main>

      <footer className="bg-ink text-[#cfc7b6]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-7 font-mono text-xs tracking-wide sm:px-7">
          <span className="font-display text-base tracking-normal text-white">
            Skill<span className="italic text-gold-2">/</span>Swap
          </span>
          <span>Every minute accounted for · credits are never real money</span>
          <span>1 credit = 1 minute of teaching</span>
        </div>
      </footer>
    </div>
  );
}
