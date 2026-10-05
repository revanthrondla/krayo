import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const hash = window.location.hash;
if (hash.includes('type=recovery') && window.location.pathname !== '/reset-password' && window.location.pathname !== '/verify-email') {
  window.location.replace('/reset-password' + hash);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
