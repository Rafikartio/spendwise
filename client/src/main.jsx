import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { ToastProvider } from './components/ui';
import './styles.css';

const saved = localStorage.getItem('sw_theme');
document.documentElement.dataset.theme =
  saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
