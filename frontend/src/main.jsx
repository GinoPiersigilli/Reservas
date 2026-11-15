import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/source-serif-4/latin-600.css';
import '@fontsource/public-sans/latin-400.css';
import '@fontsource/public-sans/latin-500.css';
import '@fontsource/public-sans/latin-600.css';
import './styles/tokens.css';
import './styles/base.css';
import Raiz from './Raiz.jsx';
import LimiteDeError from './components/LimiteDeError.jsx';

/**
 * El límite de error va por fuera de todo lo demás: cualquier excepción durante
 * el render, venga de donde venga, tiene que terminar en una pantalla con una
 * salida y no en un documento vacío.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LimiteDeError>
      <Raiz />
    </LimiteDeError>
  </StrictMode>
);
