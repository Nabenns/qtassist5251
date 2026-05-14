import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Products from './pages/Products.jsx';
import TempRoles from './pages/TempRoles.jsx';
import Emails from './pages/Emails.jsx';

function FullPageMessage({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
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
    <AuthProvider>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
