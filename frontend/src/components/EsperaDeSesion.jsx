import { useNavigate } from 'react-router-dom';
import { useLimiteDeEspera } from '../hooks/useLimiteDeEspera.js';
import { TEXTOS } from '../textos.js';
import PantallaDeError from './PantallaDeError.jsx';
import Button from './ui/Button.jsx';
import styles from './EsperaDeSesion.module.css';

/**
 * Lo que se ve mientras Clerk todavía no dijo si hay sesión.
 *
 * Antes era un `<p>Cargando…</p>` sin límite de tiempo en cada ruta protegida:
 * con la conexión cortada esa pantalla se quedaba así para siempre, sin un solo
 * enlace ni botón. Ahora la espera vence y ofrece las dos salidas que tienen
 * sentido: reintentar, o ir al ingreso —que sigue sirviendo, porque el
 * formulario de correo y contraseña no depende de que Clerk responda—.
 *
 * Recargar y no solo reintentar el render: el SDK ya quedó en un estado del que
 * no se recupera volviendo a montar el mismo árbol.
 */
export default function EsperaDeSesion() {
  const navigate = useNavigate();
  const vencido = useLimiteDeEspera();

  if (!vencido) {
    return (
      <p className={styles.esperando} role="status" aria-live="polite">
        {TEXTOS.sesion.verificando}
      </p>
    );
  }

  return (
    <PantallaDeError
      titulo={TEXTOS.sesion.sinRespuestaTitulo}
      descripcion={TEXTOS.sesion.sinRespuestaDescripcion}
      acciones={
        <>
          <Button variante="primario" onClick={() => window.location.reload()}>
            {TEXTOS.sesion.reintentar}
          </Button>
          <Button variante="secundario" onClick={() => navigate('/login')}>
            {TEXTOS.sesion.irAlIngreso}
          </Button>
        </>
      }
    />
  );
}
