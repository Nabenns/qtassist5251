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

function FullPageMessage({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-muted-fg">
      {children}
    </div>
  );
}

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

function RedirectIfAuthed({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageMessage>Loading...</FullPageMessage>;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return children;
}

function ProtectedShell({ children }) {
  return (
    <RequireAuth>
      <Layout>{children}</Layout>
    </RequireAuth>
  );
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
      <Route path="/" element={<ProtectedShell><Dashboard /></ProtectedShell>} />
      <Route path="/transactions" element={<ProtectedShell><Transactions /></ProtectedShell>} />
      <Route path="/products" element={<ProtectedShell><Products /></ProtectedShell>} />
      <Route path="/temproles" element={<ProtectedShell><TempRoles /></ProtectedShell>} />
      <Route path="/emails" element={<ProtectedShell><Emails /></ProtectedShell>} />
      <Route path="/users" element={<ProtectedShell><UserLookup /></ProtectedShell>} />
      <Route path="/users/:userId" element={<ProtectedShell><UserLookup /></ProtectedShell>} />
      <Route path="/audit" element={<ProtectedShell><AuditLog /></ProtectedShell>} />
      <Route path="/discord-post" element={<ProtectedShell><DiscordPost /></ProtectedShell>} />
      <Route path="/bot-status" element={<ProtectedShell><BotStatus /></ProtectedShell>} />
      <Route path="/backups" element={<ProtectedShell><Backups /></ProtectedShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
