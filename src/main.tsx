import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import './spartacus.css';
import { definirEscritorio } from './marca';
import { iniciarNuvem } from './nuvem';

// Cores Spartacus desde o primeiro quadro; com escritório, a marca dele substitui
definirEscritorio(null);
iniciarNuvem();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
