import { Button, ConfirmDialog, Toast } from '../../components/ui/index.js';
import { Trash2 } from 'lucide-react';
import { TEXTOS } from '../../textos.js';
import styles from '../GuiaEstilos.module.css';

export default function SeccionNotificaciones({
  toastActivo,
  onCerrarToast,
  onMostrarToast,
  dialogoAbierto,
  onAbrirDialogo,
  onCerrarDialogo
}) {
  return (
    <section className={styles.seccion} aria-labelledby="sec-notificaciones">
      <div className={styles.cabeceraSeccion}>
        <h2 id="sec-notificaciones">Notificaciones y diálogo accesible (Toast, ConfirmDialog)</h2>
        <p className={styles.descripcionSeccion}>
          Avisos breves y diálogo modal que atrapa el foco, cierra con Escape y devuelve el foco.
        </p>
      </div>
      <div className={styles.grillaDos}>
        <div className={styles.pila}>
          <Toast tipo="exito" titulo="Operación completada" mensaje={TEXTOS.reservas.creadaExito} />
          <Toast
            tipo="advertencia"
            titulo="Solicitud pendiente"
            mensaje="La reserva requiere aprobación del administrador."
          />
          <Toast
            tipo="error"
            titulo="Conflicto de horario"
            mensaje="El aula 910 ya está reservada de 10:00 a 12:00. Elija otra franja."
          />
          {toastActivo ? (
            <Toast
              tipo="info"
              titulo="Aviso descartable"
              mensaje="Puede cerrar esta notificación con su botón."
              onCerrar={() => onCerrarToast()}
            />
          ) : (
            <div>
              <Button variante="secundario" tamano="sm" onClick={() => onMostrarToast()}>
                Mostrar notificación nuevamente
              </Button>
            </div>
          )}
        </div>

        <div className={styles.pila}>
          <p className={styles.descripcionSeccion}>
            Pruebe abrir el diálogo con teclado: el foco queda atrapado entre sus botones, la tecla
            Escape lo cierra y el foco regresa al botón disparador.
          </p>
          <div>
            <Button variante="peligro" icono={Trash2} onClick={() => onAbrirDialogo()}>
              Abrir diálogo de confirmación
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        abierto={dialogoAbierto}
        titulo={TEXTOS.dialogos.cancelarTitulo}
        descripcion={TEXTOS.dialogos.cancelarDescripcion}
        textoConfirmar={TEXTOS.acciones.cancelarReserva}
        textoCancelar={TEXTOS.acciones.cancelar}
        variante="peligro"
        onConfirmar={() => onCerrarDialogo()}
        onCancelar={() => onCerrarDialogo()}
      />
    </section>
  );
}
