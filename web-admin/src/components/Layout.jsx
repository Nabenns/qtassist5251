import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  Database,
  Handshake,
  Users as UsersIcon,
  Shield,
  IdCard,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  Bell,
  BellOff,
  Wifi,
  WifiOff
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../lib/theme.jsx';
import { useRealtime, useRealtimeEvent } from '../lib/realtime.jsx';
import { useDesktopNotifications } from '../lib/notifications.js';
import { useToast } from './ui/Toast.jsx';
import { cn } from '../lib/cn.js';
import { Tooltip } from './ui/Tooltip.jsx';
import { Button } from './ui/Button.jsx';
import { HazardStripe } from './ui/brutalist/HazardStripe.jsx';

/**
 * Build the sidebar nav for the current viewer. Admins see the full
 * dashboard; non-admin users see only the IB submission page.
 */
function getNavSections({ isAdmin }) {
  if (!isAdmin) {
    return [
      {
        label: 'Akun Saya',
        items: [
          { to: '/daftar-ib', label: 'Daftar IB', icon: IdCard, end: true },
          { to: '/my-email', label: 'Email Saya', icon: Mail }
        ]
      }
    ];
  }

  return [
    {
      label: 'Ringkasan',
      items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }]
    },
    {
      label: 'Operasional',
      items: [
        { to: '/transactions', label: 'Transaksi', icon: Receipt },
        { to: '/temproles', label: 'Role Sementara', icon: Clock },
        { to: '/products', label: 'Produk', icon: Package },
        { to: '/emails', label: 'Daftar Email', icon: Mail },
        { to: '/ib-accounts', label: 'Akun IB', icon: UsersIcon }
      ]
    },
    {
      label: 'Tools',
      items: [
        { to: '/users', label: 'Cari User', icon: Search },
        { to: '/audit', label: 'Audit Log', icon: ListChecks },
        { to: '/discord-post', label: 'Posting Discord', icon: Send },
        { to: '/bot-status', label: 'Status Bot', icon: Activity },
        { to: '/backups', label: 'Backup Database', icon: Database },
        { to: '/ib-settings', label: 'Pengaturan IB', icon: Handshake },
        { to: '/admin-roles', label: 'Pengaturan Admin', icon: Shield },
        { to: '/email-roles', label: 'Pengaturan Email', icon: Mail }
      ]
    }
  ];
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const notifications = useDesktopNotifications();
  const { isAdmin } = useAuth();

  // Close the sheet whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Wire realtime events to toasts + browser notifications. Admins only —
  // non-admins on /daftar-ib don't need transaction toasts.
  useRealtimeEvent(['transaction.pending_review'], (evt) => {
    if (!isAdmin) return;
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(evt.amount || 0);
    const description = `${formatted} · ${evt.productName || 'Produk tidak diketahui'}`;
    toast.info('Bukti pembayaran baru', {
      description,
      duration: 9000,
      actionLabel: 'Buka',
      onAction: () => navigate('/transactions')
    });
    notifications.notify('Bukti pembayaran baru', {
      body: `${evt.orderId} · ${description}`,
      onClick: () => navigate('/transactions')
    });
  });

  useRealtimeEvent(['transaction.approved', 'transaction.rejected'], (evt) => {
    if (!isAdmin) return;
    const isApprove = evt.type === 'transaction.approved';
    if (isApprove) {
      toast.success('Transaksi disetujui', { description: evt.orderId, duration: 4000 });
    } else {
      toast.warning('Transaksi ditolak', { description: evt.orderId, duration: 4000 });
    }
  });

  return (
    <div className="min-h-screen bg-bg text-fg">
      <HazardStripe height={4} density={10} className="fixed top-0 left-0 right-0 z-40" />
      {/* Sidebar (desktop) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:flex lg:flex-col',
          'transition-colors'
        )}
      >
        <SidebarContent isAdmin={isAdmin} />
      </aside>

      {/* Mobile sheet */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface shadow-floating">
            <SidebarContent isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
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

function SidebarContent({ isAdmin, onNavigate }) {
  const navSections = getNavSections({ isAdmin });
  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center bg-primary p-1">
            <img
              src="/qtrades-logo.webp"
              alt="QTrades"
              className="h-full w-full object-contain"
              loading="eager"
            />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold uppercase tracking-wider text-fg leading-tight">
              QTASSIST
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-fg leading-tight">
              {isAdmin ? 'admin · ops desk' : 'user · daftar ib'}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="px-3 pb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-fg">
              § {section.label}
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
                          'group flex items-center gap-2.5 px-3 py-2 text-sm font-mono uppercase tracking-wider transition-colors duration-75',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                          isActive
                            ? 'bg-primary text-primary-fg'
                            : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                        )
                      }
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate text-[11px]">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-fg space-y-0.5">
        <div className="flex items-center justify-between">
          <span>system</span>
          <span className="text-primary">v1.0.0</span>
        </div>
        <div className="flex items-center justify-between">
          <span>build</span>
          <span>{import.meta.env.MODE}</span>
        </div>
      </div>
    </>
  );
}

function Topbar({ onMenu, mobileOpen }) {
  const { theme, toggle } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { connected } = useRealtime();
  const notifications = useDesktopNotifications();
  const { toast } = useToast();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function handleNotificationsToggle() {
    if (!notifications.supported) {
      toast.warning('Browser ini tidak support desktop notifications.');
      return;
    }
    if (notifications.permission === 'denied') {
      toast.warning('Notifikasi diblokir', {
        description: 'Aktifkan via setting browser di icon gembok URL bar.'
      });
      return;
    }
    const newState = await notifications.toggle();
    if (newState) {
      toast.success('Notifikasi desktop diaktifkan');
    } else {
      toast.info('Notifikasi desktop dimatikan');
    }
  }

  const notifIcon = !notifications.supported || notifications.permission === 'denied' || !notifications.enabled
    ? BellOff
    : Bell;
  const NotifIcon = notifIcon;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden"
          aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="flex-1" />

        {/* Realtime connection indicator */}
        <Tooltip
          content={connected ? 'Realtime terhubung' : 'Realtime terputus — mencoba reconnect...'}
          side="bottom"
        >
          <span
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg',
              connected ? 'text-success' : 'text-muted-fg'
            )}
            aria-label={connected ? 'Realtime terhubung' : 'Realtime terputus'}
          >
            {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          </span>
        </Tooltip>

        <Tooltip
          content={
            !notifications.supported
              ? 'Notifikasi tidak didukung browser'
              : notifications.permission === 'denied'
              ? 'Notifikasi diblokir browser'
              : notifications.enabled
              ? 'Matikan notifikasi desktop'
              : 'Aktifkan notifikasi desktop'
          }
          side="bottom"
        >
          <button
            type="button"
            onClick={handleNotificationsToggle}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              notifications.enabled ? 'text-primary' : 'text-fg-muted hover:text-fg'
            )}
            aria-label="Toggle notifikasi"
          >
            <NotifIcon className="h-5 w-5" />
          </button>
        </Tooltip>

        <button
          type="button"
          onClick={toggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label={theme === 'dark' ? 'Pakai mode terang' : 'Pakai mode gelap'}
          title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 border border-border bg-surface px-3 py-1.5 text-sm text-fg hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <div className="flex h-6 w-6 items-center justify-center bg-primary text-primary-fg font-display font-black text-xs">
                {user?.username?.[0]?.toUpperCase() || 'Q'}
              </div>
              <span className="hidden sm:inline font-mono text-xs uppercase tracking-wider">
                {user?.globalName || user?.username || 'user'}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-fg" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className={cn(
                'z-30 min-w-[12rem] border border-border bg-surface p-1 shadow-step',
                'animate-in'
              )}
            >
              <div className="px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-fg">
                {isAdmin ? 'admin' : 'user'} · <span className="font-bold text-fg">{user?.username}</span>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
                className="flex cursor-pointer items-center gap-2 px-2 py-1.5 font-mono text-xs uppercase tracking-wider text-fg outline-none hover:bg-surface-2 focus:bg-surface-2"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
