import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { TooltipProvider } from './components/ui/Tooltip.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>
);
