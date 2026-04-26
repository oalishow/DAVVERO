import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { SettingsProvider } from './context/SettingsContext';
import { DialogProvider } from './context/DialogContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </SettingsProvider>
  </StrictMode>,
);
