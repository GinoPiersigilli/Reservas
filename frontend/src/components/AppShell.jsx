import { useEffect, useId, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Calendar, CalendarPlus, DoorOpen, LayoutDashboard, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTema } from '../hooks/useTema.js';
import { TEXTOS } from '../textos.js';
import styles from './AppShell.module.css';

export default function AppShell({ children }) {
  const auth = useAuth();
  const usuario = auth?.usuario;
  const cerrarSesion = auth?.cerrarSesion;
  const esAdmin = usuario?.rol === 'admin';
  const { esOscuro, toggleTema } = useTema();
  const labelTema = esOscuro ? TEXTOS.tema.cambiarClaro : TEXTOS.tema.cambiarOscuro;

  const [menuAbierto, setMenuAbierto] = useState(false);
  const location = useLocation();
  const menuId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuAbierto(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuAbierto) return undefined;
    const manejarKeyDown = (evento) => {
      if (evento.key === 'Escape') {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('keydown', manejarKeyDown);
    return () => document.removeEventListener('keydown', manejarKeyDown);
  }, [menuAbierto]);

  const obtenerClaseEnlace = ({ isActive }) =>
    [styles.enlace, isActive ? styles.enlaceActivo : ''].filter(Boolean).join(' ');

  return (
    <div className={styles.shell}>
      <header className={styles.barraMovil}>
        <button
          type="button"
          className={styles.botonMenuMovil}
          aria-expanded={menuAbierto}
          aria-controls={menuId}
          aria-label={
            menuAbierto ? TEXTOS.navegacion.cerrarMenu : TEXTOS.navegacion.abrirMenu
          }
          onClick={() => setMenuAbierto((prev) => !prev)}
        >
          {menuAbierto ? (
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
        <span className={styles.tituloMovil}>{TEXTOS.app.titulo}</span>
        <button
          type="button"
          className={styles.botonTemaMovil}
          onClick={toggleTema}
          aria-pressed={esOscuro}
          aria-label={labelTema}
          title={labelTema}
        >
          {esOscuro ? (
            <Sun size={20} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Moon size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </header>

      <aside
        id={menuId}
        aria-label="Navegación principal"
        className={[styles.sidebar, menuAbierto ? styles.sidebarAbierto : '']
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.bloqueSuperior}>
          <div className={styles.marca}>{TEXTOS.app.titulo}</div>

          <nav className={styles.nav} aria-label="Destinos principales">
            <NavLink to="/reservas" end className={obtenerClaseEnlace}>
              <Calendar size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{TEXTOS.navegacion.reservasAdmin}</span>
            </NavLink>

            <NavLink to="/reservas/nueva" className={obtenerClaseEnlace}>
              <CalendarPlus size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{TEXTOS.navegacion.nuevaReserva}</span>
            </NavLink>

            {esAdmin ? (
              <>
                <NavLink to="/resumen" className={obtenerClaseEnlace}>
                  <LayoutDashboard size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>{TEXTOS.navegacion.panel}</span>
                </NavLink>

                <NavLink to="/aulas" className={obtenerClaseEnlace}>
                  <DoorOpen size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>{TEXTOS.navegacion.aulas}</span>
                </NavLink>
              </>
            ) : null}
          </nav>
        </div>

        <div className={styles.sesion}>
          <div className={styles.datosUsuario}>
            <span className={styles.nombreUsuario}>
              {usuario?.nombre || usuario?.email || 'Sesión activa'}
            </span>
            <span className={styles.rolUsuario}>
              {esAdmin ? TEXTOS.navegacion.rolAdmin : TEXTOS.navegacion.rolUsuario}
            </span>
          </div>

          <button
            type="button"
            className={styles.botonTema}
            onClick={toggleTema}
            aria-pressed={esOscuro}
            aria-label={labelTema}
            title={labelTema}
          >
            {esOscuro ? (
              <Sun size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Moon size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
            <span>{labelTema}</span>
          </button>

          <button
            type="button"
            className={styles.botonCerrar}
            onClick={() => cerrarSesion?.()}
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{TEXTOS.navegacion.cerrarSesion}</span>
          </button>
        </div>
      </aside>

      <main className={styles.contenido}>
        <div className={styles.contenedorInterior}>{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}

