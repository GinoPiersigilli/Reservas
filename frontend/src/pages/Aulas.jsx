import { useState } from 'react';
import { Plus } from 'lucide-react';
import { crearAula, desactivarAula, editarAula, reactivarAula } from '../services/aula.service.js';
import { TEXTOS } from '../textos.js';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Table,
  TablaSkeleton,
  Toast
} from '../components/ui/index.js';
import { useAulas } from './aulas/useAulas.js';
import { CABECERAS_AULAS, columnasAulas } from './aulas/columnasAulas.jsx';
import FiltrosAulas from './aulas/FiltrosAulas.jsx';
import DialogoAula from './aulas/DialogoAula.jsx';
import DialogoDesactivar from './aulas/DialogoDesactivar.jsx';
import { FORM_VACIO, aulaParaEnviar, formDesdeAula, validarAula } from './aulas/validarAula.js';
import styles from './Aulas.module.css';

/**
 * Administración de aulas (solo administradores): alta, edición, baja lógica y
 * reactivación. Las aulas dadas de baja se conservan para no perder el
 * historial de sus reservas.
 */
export default function Aulas() {
  const { aulasFiltradas, conteos, cargando, errorCarga, recargar, filtroEstado, setFiltroEstado } =
    useAulas();

  const [mensajeToast, setMensajeToast] = useState(null);

  // Alta y edición
  const [formulario, setFormulario] = useState({
    abierto: false,
    modo: 'crear',
    aula: null,
    datos: FORM_VACIO,
    errores: {},
    errorGeneral: null,
    guardando: false
  });

  // Baja
  const [baja, setBaja] = useState({
    abierto: false,
    aula: null,
    cancelarReservasFuturas: false,
    motivo: '',
    error: null,
    avisoAfectadas: null,
    procesando: false
  });

  // Reactivación
  const [reactivacion, setReactivacion] = useState({
    abierto: false,
    aula: null,
    procesando: false
  });

  const abrirFormulario = (aula) =>
    setFormulario({
      abierto: true,
      modo: aula ? 'editar' : 'crear',
      aula,
      datos: aula ? formDesdeAula(aula) : FORM_VACIO,
      errores: {},
      errorGeneral: null,
      guardando: false
    });

  const guardarAula = async () => {
    const errores = validarAula(formulario.datos);
    if (Object.keys(errores).length > 0) {
      setFormulario((f) => ({ ...f, errores }));
      return;
    }

    setFormulario((f) => ({ ...f, errores: {}, errorGeneral: null, guardando: true }));

    try {
      const datos = aulaParaEnviar(formulario.datos);
      if (formulario.modo === 'crear') {
        await crearAula(datos);
        setMensajeToast(TEXTOS.aulas.creadaExito);
      } else {
        await editarAula(formulario.aula.id, datos);
        setMensajeToast(TEXTOS.aulas.actualizadaExito);
      }
      setFormulario((f) => ({ ...f, abierto: false, guardando: false }));
      await recargar();
    } catch (err) {
      setFormulario((f) => ({
        ...f,
        guardando: false,
        errorGeneral: err.response?.data?.error || 'Ocurrió un error al guardar el aula.'
      }));
    }
  };

  const confirmarBaja = async () => {
    if (baja.cancelarReservasFuturas && !baja.motivo.trim()) {
      setBaja((b) => ({ ...b, error: TEXTOS.aulas.motivoRequerido }));
      return;
    }

    setBaja((b) => ({ ...b, error: null, procesando: true }));

    try {
      await desactivarAula(baja.aula.id, {
        cancelarReservasFuturas: baja.cancelarReservasFuturas,
        motivo: baja.motivo.trim() || undefined
      });
      setBaja((b) => ({ ...b, abierto: false, procesando: false }));
      setMensajeToast(TEXTOS.aulas.desactivadaExito);
      await recargar();
    } catch (err) {
      setBaja((b) => ({ ...b, procesando: false, ...errorDeBaja(err) }));
    }
  };

  const confirmarReactivacion = async () => {
    setReactivacion((r) => ({ ...r, procesando: true }));
    try {
      await reactivarAula(reactivacion.aula.id);
      setMensajeToast(TEXTOS.aulas.reactivadaExito);
      await recargar();
    } catch (err) {
      setMensajeToast(err.response?.data?.error || 'No se pudo reactivar el aula.');
    } finally {
      setReactivacion({ abierto: false, aula: null, procesando: false });
    }
  };

  const columnas = columnasAulas({
    onEditar: abrirFormulario,
    onDesactivar: (aula) =>
      setBaja({
        abierto: true,
        aula,
        cancelarReservasFuturas: false,
        motivo: '',
        error: null,
        avisoAfectadas: null,
        procesando: false
      }),
    onReactivar: (aula) => setReactivacion({ abierto: true, aula, procesando: false })
  });

  const renderListado = () => {
    if (cargando) return <TablaSkeleton cabeceras={CABECERAS_AULAS} />;

    if (errorCarga) {
      return (
        <ErrorState
          titulo={TEXTOS.ui.errorTitulo}
          descripcion={errorCarga}
          onReintentar={recargar}
        />
      );
    }

    if (aulasFiltradas.length === 0) {
      return (
        <EmptyState
          titulo={TEXTOS.aulas.vacioTitulo}
          descripcion={TEXTOS.aulas.vacioDescripcion}
          accion={
            filtroEstado !== 'todas' ? (
              <Button variante="secundario" onClick={() => setFiltroEstado('todas')}>
                {TEXTOS.acciones.limpiarFiltros}
              </Button>
            ) : undefined
          }
        />
      );
    }

    return (
      <Table
        columnas={columnas}
        datos={aulasFiltradas}
        claveFila="id"
        ariaLabel="Listado de aulas institucionales"
      />
    );
  };

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecera}>
        <div className={styles.titulos}>
          <h1 className={styles.titulo}>{TEXTOS.aulas.titulo}</h1>
          <p className={styles.subtitulo}>{TEXTOS.aulas.subtitulo}</p>
        </div>
        <Button variante="primario" onClick={() => abrirFormulario(null)}>
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          <span>{TEXTOS.aulas.nuevaAula}</span>
        </Button>
      </header>

      <FiltrosAulas filtroEstado={filtroEstado} conteos={conteos} onCambiar={setFiltroEstado} />

      {renderListado()}

      <DialogoAula
        abierto={formulario.abierto}
        modo={formulario.modo}
        formData={formulario.datos}
        errores={formulario.errores}
        errorGeneral={formulario.errorGeneral}
        guardando={formulario.guardando}
        onCambiarCampo={(campo, valor) =>
          setFormulario((f) => ({ ...f, datos: { ...f.datos, [campo]: valor } }))
        }
        onCancelar={() => setFormulario((f) => ({ ...f, abierto: false }))}
        onConfirmar={guardarAula}
      />

      <DialogoDesactivar
        abierto={baja.abierto}
        cancelarReservasFuturas={baja.cancelarReservasFuturas}
        motivo={baja.motivo}
        error={baja.error}
        avisoAfectadas={baja.avisoAfectadas}
        desactivando={baja.procesando}
        onCambiarCancelar={(valor) => setBaja((b) => ({ ...b, cancelarReservasFuturas: valor }))}
        onCambiarMotivo={(valor) => setBaja((b) => ({ ...b, motivo: valor }))}
        onCancelar={() => setBaja((b) => ({ ...b, abierto: false }))}
        onConfirmar={confirmarBaja}
      />

      <ConfirmDialog
        abierto={reactivacion.abierto}
        titulo={TEXTOS.aulas.confirmarReactivarTitulo}
        descripcion={TEXTOS.aulas.confirmarReactivarDescripcion}
        textoConfirmar={TEXTOS.aulas.reactivar}
        textoCancelar={TEXTOS.acciones.cancelar}
        variante="primario"
        cargando={reactivacion.procesando}
        onCancelar={() => setReactivacion({ abierto: false, aula: null, procesando: false })}
        onConfirmar={confirmarReactivacion}
      />

      {mensajeToast ? (
        <Toast mensaje={mensajeToast} tipo="exito" onCerrar={() => setMensajeToast(null)} />
      ) : null}
    </div>
  );
}

/**
 * Un 409 con `reservasAfectadas` no es un error a mostrar y olvidar: significa
 * que el aula tiene reservas futuras y hay que ofrecer cancelarlas.
 */
function errorDeBaja(err) {
  const afectadas = err.response?.data?.reservasAfectadas;

  if (err.response?.status === 409 && afectadas) {
    return {
      avisoAfectadas: TEXTOS.aulas.avisoReservasFuturas.replace('{cantidad}', afectadas),
      cancelarReservasFuturas: true
    };
  }

  return { error: err.response?.data?.error || 'No se pudo desactivar el aula.' };
}
