import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { TooltipProvider } from './components/ui/Tooltip.jsx';
import { AuthProvider } from './auth.jsx';
import { RealtimeProvider } from './lib/realtime.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <RealtimeProvider>
                <App />
              </RealtimeProvider>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>
);
