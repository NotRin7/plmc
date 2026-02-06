import React from 'react';
import ReactDOM from 'react-dom/client';
import { Buffer } from 'buffer';
import process from 'process';
import App from './App.jsx';
import AppThemeProvider from './Theme.jsx';
import './index.css';

window.Buffer = window.Buffer || Buffer;
window.process = window.process || process;
window.global = window.global || window;

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppThemeProvider>
    <App />
  </AppThemeProvider>
);
