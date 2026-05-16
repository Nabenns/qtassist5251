import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Products from './pages/Products.jsx';
import TempRoles from './pages/TempRoles.jsx';
import Emails from './pages/Emails.jsx';
import AuditLog from './pages/AuditLog.jsx';
import UserLookup from './pages/UserLookup.jsx';
import DiscordPost from './pages/DiscordPost.jsx';
import BotStatus from './pages/BotStatus.jsx';
import Backups from './pages/Backups.jsx';
import IbSettings from './pages/IbSettings.jsx';
import IbAccounts from './pages/IbAccounts.jsx';
import AdminRoles from './pages/AdminRoles.jsx';
import DaftarIb from './pages/DaftarIb.jsx';

function FullPageMessage({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-muted-fg">
      {children}
    </div>
  );
}

/**
 * Require any logged-in user. Renders children inside Layout.
 */
function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return <FullPageMessage>Loading...</FullPageMessage>;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

/**
 * Require admin status. Logged-in non-admins are bounced to /daftar-ib.
 */
function RequireAdmin({ children }) {
  const { status, isAdmin } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return <FullPageMessage>Loading...</FullPageMessage>;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!isAdmin) {
    return <Navigate to="/daftar-ib" replace />;
  }
  return children;
}

function RedirectIfAuthed({ children }) {
  const { status, isAdmin } = useAuth();
  if (status === 'loading') return <FullPageMessage>Loading...</FullPageMessage>;
  if (status === 'authenticated') {
    return <Navigate to={isAdmin ? '/' : '/daftar-ib'} replace />;
  }
  return children;
}

function AdminShell({ children }) {
  return (
    <RequireAdmin>
      <Layout>{children}</Layout>
    </RequireAdmin>
  );
}

function UserShell({ children }) {
  return (
    <RequireAuth>
      <Layout>{children}</Layout>
    </RequireAuth>
  );
}

/**
 * Index route: send admins to the dashboard, users to /daftar-ib.
 */
function Home() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Dashboard /> : <Navigate to="/daftar-ib" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />

      {/* User-accessible route (admin can also see it) */}
      <Route path="/daftar-ib" element={<UserShell><DaftarIb /></UserShell>} />

      {/* Admin-only routes */}
      <Route path="/" element={<AdminShell><Home /></AdminShell>} />
      <Route path="/transactions" element={<AdminShell><Transactions /></AdminShell>} />
      <Route path="/products" element={<AdminShell><Products /></AdminShell>} />
      <Route path="/temproles" element={<AdminShell><TempRoles /></AdminShell>} />
      <Route path="/emails" element={<AdminShell><Emails /></AdminShell>} />
      <Route path="/users" element={<AdminShell><UserLookup /></AdminShell>} />
      <Route path="/users/:userId" element={<AdminShell><UserLookup /></AdminShell>} />
      <Route path="/audit" element={<AdminShell><AuditLog /></AdminShell>} />
      <Route path="/discord-post" element={<AdminShell><DiscordPost /></AdminShell>} />
      <Route path="/bot-status" element={<AdminShell><BotStatus /></AdminShell>} />
      <Route path="/backups" element={<AdminShell><Backups /></AdminShell>} />
      <Route path="/ib-settings" element={<AdminShell><IbSettings /></AdminShell>} />
      <Route path="/ib-accounts" element={<AdminShell><IbAccounts /></AdminShell>} />
      <Route path="/admin-roles" element={<AdminShell><AdminRoles /></AdminShell>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
