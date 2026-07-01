import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initMonitoring } from './monitoring/init';
import { bootstrapModules } from './modules-system';
import { installGlobalErrorHandlers } from './error-handling';
import './i18n'; // i18n 初始化（在 installGlobalErrorHandlers 之後、bootstrapModules 之前）
import './styles/globals.css';

initMonitoring();
installGlobalErrorHandlers();
bootstrapModules();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
