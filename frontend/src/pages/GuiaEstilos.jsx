import { useState } from 'react';
import SeccionTipografia from './guia/SeccionTipografia.jsx';
import SeccionBotones from './guia/SeccionBotones.jsx';
import SeccionEstados from './guia/SeccionEstados.jsx';
import SeccionFormularios from './guia/SeccionFormularios.jsx';
import SeccionTablas from './guia/SeccionTablas.jsx';
import SeccionBloques from './guia/SeccionBloques.jsx';
import SeccionNotificaciones from './guia/SeccionNotificaciones.jsx';
import styles from './GuiaEstilos.module.css';

/**
 * Catálogo de los componentes base y de las decisiones visuales del sistema.
 *
 * Sirve para revisar tipografía, botones, campos y estados en un solo lugar,
 * sin recorrer la aplicación pantalla por pantalla.
 */
export default function GuiaEstilos() {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [toastActivo, setToastActivo] = useState(true);
  const [contadorReintentos, setContadorReintentos] = useState(0);

  return (
    <main className={styles.pagina}>
      <header className={styles.cabecera}>
        <h1>Guía de estilos y componentes base</h1>
        <p className={styles.subtitulo}>
          Fundaciones visuales de la Fase 3b-2 — Sistema institucional de reservas de aula
        </p>
      </header>

      <SeccionTipografia />
      <SeccionBotones />
      <SeccionEstados />
      <SeccionFormularios />
      <SeccionTablas />
      <SeccionBloques
        contadorReintentos={contadorReintentos}
        onReintentar={() => setContadorReintentos((n) => n + 1)}
      />
      <SeccionNotificaciones
        toastActivo={toastActivo}
        onCerrarToast={() => setToastActivo(false)}
        onMostrarToast={() => setToastActivo(true)}
        dialogoAbierto={dialogoAbierto}
        onAbrirDialogo={() => setDialogoAbierto(true)}
        onCerrarDialogo={() => setDialogoAbierto(false)}
      />
    </main>
  );
}
