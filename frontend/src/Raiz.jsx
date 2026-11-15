import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.jsx';
import PantallaDeError from './components/PantallaDeError.jsx';
import Button from './components/ui/Button.jsx';
import { TEXTOS } from './textos.js';

/**
 * Decide si la aplicación puede arrancar.
 *
 * Sin la clave pública, `ClerkProvider` lanza durante el render y —sin un límite
 * de error por encima— la página queda en blanco, con el motivo únicamente en la
 * consola del navegador. Comprobarla antes convierte eso en una pantalla que
 * nombra la variable que falta y el archivo donde va, que es lo que necesita
 * quien recién clona el repositorio.
 *
 * Está separado de `main.jsx` para poder montarlo en una prueba: el punto de
 * entrada llama a `createRoot` y no se deja probar. La variable se lee acá
 * adentro y no en el módulo por la misma razón.
 */
export default function Raiz() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <PantallaDeError
        titulo={TEXTOS.configuracion.titulo}
        descripcion={TEXTOS.configuracion.descripcion}
        detalle={TEXTOS.configuracion.variableFaltante}
        acciones={
          <Button variante="primario" onClick={() => window.location.reload()}>
            {TEXTOS.errorCritico.recargar}
          </Button>
        }
      />
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  );
}
