import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions' },
  { to: '/products', label: 'Products' },
  { to: '/temproles', label: 'Temp Roles' },
  { to: '/emails', label: 'Email Bindings' }
];

export default function Layout({ children }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-semibold">
              Q
            </div>
            <div>
              <div className="font-semibold text-slate-900">QTAssist Admin</div>
              <div className="text-xs text-slate-500">Discord bot dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600">
              {admin ? (
                <>
                  Signed in as <span className="font-medium text-slate-800">{admin.username}</span>
                </>
              ) : null}
            </div>
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-6">
          <ul className="flex flex-wrap gap-1 pb-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'inline-block rounded-md px-3 py-1.5 text-sm font-medium transition',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
