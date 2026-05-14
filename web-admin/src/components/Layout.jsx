import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Package,
  Clock,
  Mail,
  Search,
  ListChecks,
  Send,
  Activity,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../lib/theme.jsx';
import { cn } from '../lib/cn.js';
import { Button } from './ui/Button.jsx';

const navSections = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }]
  },
  {
    label: 'Operations',
    items: [
      { to: '/transactions', label: 'Transactions', icon: Receipt },
      { to: '/temproles', label: 'Temp Roles', icon: Clock },
      { to: '/products', label: 'Products', icon: Package },
      { to: '/emails', label: 'Email Bindings', icon: Mail }
    ]
  },
  {
    label: 'Tools',
    items: [
      { to: '/users', label: 'User Lookup', icon: Search },
      { to: '/audit', label: 'Audit Log', icon: ListChecks },
      { to: '/discord-post', label: 'Discord Posts', icon: Send },
      { to: '/bot-status', label: 'Bot Status', icon: Activity }
    ]
  }
];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the sheet whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [children]);

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Sidebar (desktop) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:flex lg:flex-col',
          'transition-colors'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sheet */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface shadow-floating">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <Topbar onMenu={() => setMobileOpen((v) => !v)} mobileOpen={mobileOpen} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-fg font-semibold shadow-sm">
          Q
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg">QTAssist</div>
          <div className="truncate text-xs text-muted-fg">Admin Dashboard</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-fg/80">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => onNavigate?.()}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                          isActive
                            ? 'bg-primary-soft text-primary'
                            : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3 text-[10px] text-muted-fg">
        QTrades · v1
      </div>
    </>
  );
}

function Topbar({ onMenu, mobileOpen }) {
  const { theme, toggle } = useTheme();
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={toggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-fg hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-fg text-xs font-semibold">
                {admin?.username?.[0]?.toUpperCase() || 'A'}
              </div>
              <span className="hidden sm:inline">{admin?.username || 'admin'}</span>
              <ChevronDown className="h-4 w-4 text-muted-fg" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className={cn(
                'z-30 min-w-[12rem] rounded-lg border border-border bg-surface p-1 shadow-floating',
                'animate-in'
              )}
            >
              <div className="px-2 py-1.5 text-xs text-muted-fg">
                Signed in as <span className="font-medium text-fg">{admin?.username}</span>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg outline-none hover:bg-surface-2 focus:bg-surface-2"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
