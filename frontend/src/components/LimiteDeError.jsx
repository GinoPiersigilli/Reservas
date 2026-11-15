import { Component } from 'react';
import { TEXTOS } from '../textos.js';
import PantallaDeError from './PantallaDeError.jsx';
import Button from './ui/Button.jsx';

/**
 * Límite de error de toda la aplicación.
 *
 * Sin esto, una excepción durante el render desmonta el árbol entero y deja la
 * página en blanco: `#root` vacío, el motivo solo en la consola del navegador y
 * ninguna forma de salir. Pasaba, por ejemplo, cuando faltaba la clave de Clerk.
 *
 * Es una clase porque `getDerivedStateFromError` y `componentDidCatch` no tienen
 * equivalente en hooks; es el único componente de clase del proyecto.
 *
 * Recargar y no solo reintentar el render: cuando el error vino de la
 * configuración o de un módulo que no cargó, volver a montar el mismo árbol
 * falla de nuevo igual.
 */
class LimiteDeError extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Queda en la consola para quien esté depurando; la persona ve la pantalla.
    console.error('Error no controlado en la interfaz:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <PantallaDeError
        titulo={TEXTOS.errorCritico.titulo}
        descripcion={TEXTOS.errorCritico.descripcion}
        detalle={error.message || String(error)}
        acciones={
          <Button variante="primario" onClick={() => window.location.reload()}>
            {TEXTOS.errorCritico.recargar}
          </Button>
        }
      />
    );
  }
}

export default LimiteDeError;
