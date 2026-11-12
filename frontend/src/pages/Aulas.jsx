import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import {
  getAulas,
  crearAula,
  editarAula,
  desactivarAula,
  reactivarAula
} from '../services/aula.service.js';
import { TEXTOS } from '../textos.js';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  EstadoBadge,
  Field,
  Input,
  Table,
  TablaSkeleton,
  Textarea,
  Toast
} from '../components/ui/index.js';
import styles from './Aulas.module.css';

export default function Aulas() {
  const [aulas, setAulas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todas'); // 'todas' | 'activas' | 'inactivas'

  // Modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('crear'); // 'crear' | 'editar'
  const [aulaEnEdicion, setAulaEnEdicion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    ubicacion: '',
    capacidad: '',
    recursos: ''
  });
  const [erroresForm, setErroresForm] = useState({});

  // Diálogo Desactivar
  const [dialogoDesactivarAbierto, setDialogoDesactivarAbierto] = useState(false);
  const [aulaParaDesactivar, setAulaParaDesactivar] = useState(null);
  const [cancelarReservasFuturas, setCancelarReservasFuturas] = useState(false);
  const [motivoBaja, setMotivoBaja] = useState('');
  const [errorMotivo, setErrorMotivo] = useState(null);
  const [avisoAfectadas, setAvisoAfectadas] = useState(null);
  const [desactivando, setDesactivando] = useState(false);

  // Diálogo Reactivar
  const [dialogoReactivarAbierto, setDialogoReactivarAbierto] = useState(false);
  const [aulaParaReactivar, setAulaParaReactivar] = useState(null);
  const [reactivando, setReactivando] = useState(false);

  // Toast
  const [mensajeToast, setMensajeToast] = useState(null);

  const cargarAulas = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await getAulas(true);
      const lista = Array.isArray(res?.data) ? res.data : [];
      setAulas(lista);
    } catch {
      setErrorCarga(TEXTOS.aulas.errorCarga);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarAulas();
  }, [cargarAulas]);

  const aulasFiltradas = useMemo(() => {
    if (filtroEstado === 'activas') {
      return aulas.filter((a) => a.activa);
    }
    if (filtroEstado === 'inactivas') {
      return aulas.filter((a) => !a.activa);
    }
    return aulas;
  }, [aulas, filtroEstado]);

  // Manejadores Modal Crear/Editar
  const abrirModalCrear = () => {
    setModoModal('crear');
    setAulaEnEdicion(null);
    setFormData({
      nombre: '',
      ubicacion: '',
      capacidad: '',
      recursos: ''
    });
    setErroresForm({});
    setErrorModal(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (aula) => {
    setModoModal('editar');
    setAulaEnEdicion(aula);
    setFormData({
      nombre: aula.nombre || '',
      ubicacion: aula.ubicacion || '',
      capacidad: String(aula.capacidad || ''),
      recursos: aula.recursos || ''
    });
    setErroresForm({});
    setErrorModal(null);
    setModalAbierto(true);
  };

  const validarFormulario = () => {
    const errores = {};
    const nombreTrim = formData.nombre.trim();
    const ubicacionTrim = formData.ubicacion.trim();
    const capacidadNum = Number(formData.capacidad);

    if (!nombreTrim) {
      errores.nombre = 'El nombre del aula es obligatorio';
    } else if (nombreTrim.length > 100) {
      errores.nombre = 'El nombre no puede superar los 100 caracteres';
    }

    if (!ubicacionTrim) {
      errores.ubicacion = 'La ubicación del aula es obligatoria';
    } else if (ubicacionTrim.length > 120) {
      errores.ubicacion = 'La ubicación no puede superar los 120 caracteres';
    }

    if (!formData.capacidad || Number.isNaN(capacidadNum) || !Number.isInteger(capacidadNum) || capacidadNum < 1 || capacidadNum > 1000) {
      errores.capacidad = 'La capacidad debe ser un número entero entre 1 y 1000';
    }

    setErroresForm(errores);
    return Object.keys(errores).length === 0;
  };

  const guardarAula = async () => {
    if (!validarFormulario()) return;

    setGuardando(true);
    setErrorModal(null);

    const payload = {
      nombre: formData.nombre.trim(),
      ubicacion: formData.ubicacion.trim(),
      capacidad: Number(formData.capacidad),
      recursos: formData.recursos.trim() || undefined
    };

    try {
      if (modoModal === 'crear') {
        await crearAula(payload);
        setMensajeToast(TEXTOS.aulas.creadaExito);
      } else {
        await editarAula(aulaEnEdicion.id, payload);
        setMensajeToast(TEXTOS.aulas.actualizadaExito);
      }
      setModalAbierto(false);
      await cargarAulas();
    } catch (err) {
      const mensaje = err.response?.data?.error || 'Ocurrió un error al guardar el aula.';
      setErrorModal(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  // Manejadores Desactivación
  const iniciarDesactivacion = (aula) => {
    setAulaParaDesactivar(aula);
    setCancelarReservasFuturas(false);
    setMotivoBaja('');
    setErrorMotivo(null);
    setAvisoAfectadas(null);
    setDialogoDesactivarAbierto(true);
  };

  const confirmarDesactivacion = async () => {
    if (cancelarReservasFuturas && !motivoBaja.trim()) {
      setErrorMotivo(TEXTOS.aulas.motivoRequerido);
      return;
    }

    setDesactivando(true);
    setErrorMotivo(null);

    try {
      await desactivarAula(aulaParaDesactivar.id, {
        cancelarReservasFuturas,
        motivo: motivoBaja.trim() || undefined
      });
      setDialogoDesactivarAbierto(false);
      setMensajeToast(TEXTOS.aulas.desactivadaExito);
      await cargarAulas();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.reservasAfectadas) {
        const cant = err.response.data.reservasAfectadas;
        setAvisoAfectadas(TEXTOS.aulas.avisoReservasFuturas.replace('{cantidad}', cant));
        setCancelarReservasFuturas(true);
      } else {
        setErrorMotivo(err.response?.data?.error || 'No se pudo desactivar el aula.');
      }
    } finally {
      setDesactivando(false);
    }
  };

  // Manejadores Reactivación
  const iniciarReactivacion = (aula) => {
    setAulaParaReactivar(aula);
    setDialogoReactivarAbierto(true);
  };

  const confirmarReactivacion = async () => {
    setReactivando(true);
    try {
      await reactivarAula(aulaParaReactivar.id);
      setDialogoReactivarAbierto(false);
      setMensajeToast(TEXTOS.aulas.reactivadaExito);
      await cargarAulas();
    } catch (err) {
      setMensajeToast(err.response?.data?.error || 'No se pudo reactivar el aula.');
    } finally {
      setReactivando(false);
    }
  };

  const columnas = [
    {
      clave: 'nombre',
      titulo: TEXTOS.aulas.nombre,
      render: (aula) => <span className={styles.nombreAula}>{aula.nombre}</span>
    },
    {
      clave: 'ubicacion',
      titulo: TEXTOS.aulas.ubicacion
    },
    {
      clave: 'capacidad',
      titulo: TEXTOS.aulas.capacidad,
      alineacion: 'derecha'
    },
    {
      clave: 'recursos',
      titulo: TEXTOS.aulas.recursos,
      render: (aula) => aula.recursos ? aula.recursos : <span className={styles.sinRecursos}>{TEXTOS.aulas.sinRecursos}</span>
    },
    {
      clave: 'estado',
      titulo: TEXTOS.aulas.estado,
      render: (aula) => <EstadoBadge estado={aula.activa ? 'activa' : 'inactiva'} />
    },
    {
      clave: 'acciones',
      titulo: TEXTOS.aulas.acciones,
      alineacion: 'derecha',
      render: (aula) => (
        <div className={styles.accionesCelda}>
          <Button
            variante="secundario"
            onClick={() => abrirModalEditar(aula)}
            aria-label={`Editar ${aula.nombre}`}
          >
            {TEXTOS.acciones.editar}
          </Button>

          {aula.activa ? (
            <Button
              variante="peligro"
              onClick={() => iniciarDesactivacion(aula)}
              aria-label={`Desactivar ${aula.nombre}`}
            >
              {TEXTOS.aulas.desactivar}
            </Button>
          ) : (
            <Button
              variante="secundario"
              onClick={() => iniciarReactivacion(aula)}
              aria-label={`Reactivar ${aula.nombre}`}
            >
              {TEXTOS.aulas.reactivar}
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecera}>
        <div className={styles.titulos}>
          <h1 className={styles.titulo}>{TEXTOS.aulas.titulo}</h1>
          <p className={styles.subtitulo}>{TEXTOS.aulas.subtitulo}</p>
        </div>
        <Button
          variante="primario"
          onClick={abrirModalCrear}
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          <span>{TEXTOS.aulas.nuevaAula}</span>
        </Button>
      </header>

      <div className={styles.barraControles}>
        <div className={styles.filtros} role="group" aria-label="Filtro de aulas por estado">
          <button
            type="button"
            className={[
              styles.botonFiltro,
              filtroEstado === 'todas' ? styles.botonFiltroActivo : ''
            ].filter(Boolean).join(' ')}
            onClick={() => setFiltroEstado('todas')}
            aria-pressed={filtroEstado === 'todas'}
          >
            {TEXTOS.aulas.filtroTodas} ({aulas.length})
          </button>
          <button
            type="button"
            className={[
              styles.botonFiltro,
              filtroEstado === 'activas' ? styles.botonFiltroActivo : ''
            ].filter(Boolean).join(' ')}
            onClick={() => setFiltroEstado('activas')}
            aria-pressed={filtroEstado === 'activas'}
          >
            {TEXTOS.aulas.filtroActivas} ({aulas.filter((a) => a.activa).length})
          </button>
          <button
            type="button"
            className={[
              styles.botonFiltro,
              filtroEstado === 'inactivas' ? styles.botonFiltroActivo : ''
            ].filter(Boolean).join(' ')}
            onClick={() => setFiltroEstado('inactivas')}
            aria-pressed={filtroEstado === 'inactivas'}
          >
            {TEXTOS.aulas.filtroInactivas} ({aulas.filter((a) => !a.activa).length})
          </button>
        </div>
      </div>

      {cargando ? (
        <TablaSkeleton cabeceras={[TEXTOS.aulas.nombre, TEXTOS.aulas.ubicacion, TEXTOS.aulas.capacidad, TEXTOS.aulas.recursos, TEXTOS.aulas.estado, TEXTOS.aulas.acciones]} />
      ) : errorCarga ? (
        <ErrorState
          titulo={TEXTOS.ui.errorTitulo}
          descripcion={errorCarga}
          onReintentar={cargarAulas}
        />
      ) : aulasFiltradas.length === 0 ? (
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
      ) : (
        <Table
          columnas={columnas}
          datos={aulasFiltradas}
          claveFila="id"
          ariaLabel="Listado de aulas institucionales"
        />
      )}

      {/* Modal Crear / Editar */}
      <ConfirmDialog
        abierto={modalAbierto}
        titulo={modoModal === 'crear' ? TEXTOS.aulas.nuevaAula : TEXTOS.aulas.editarAula}
        textoConfirmar={TEXTOS.acciones.guardarCambios}
        textoCancelar={TEXTOS.acciones.cancelar}
        variante="primario"
        cargando={guardando}
        onCancelar={() => setModalAbierto(false)}
        onConfirmar={guardarAula}
      >
        <div className={styles.formModal}>
          {errorModal ? (
            <div role="alert" className={styles.errorModal}>
              {errorModal}
            </div>
          ) : null}

          <Field
            etiqueta={TEXTOS.aulas.nombre}
            obligatorio
            error={erroresForm.nombre}
          >
            <Input
              name="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej. Aula 101 Magna"
              autoFocus
            />
          </Field>

          <Field
            etiqueta={TEXTOS.aulas.ubicacion}
            obligatorio
            error={erroresForm.ubicacion}
          >
            <Input
              name="ubicacion"
              value={formData.ubicacion}
              onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
              placeholder="Ej. Pabellón Central - Piso 1"
            />
          </Field>

          <Field
            etiqueta={TEXTOS.aulas.capacidad}
            obligatorio
            error={erroresForm.capacidad}
          >
            <Input
              type="number"
              min="1"
              max="1000"
              name="capacidad"
              value={formData.capacidad}
              onChange={(e) => setFormData({ ...formData, capacidad: e.target.value })}
              placeholder="Ej. 45"
            />
          </Field>

          <Field
            etiqueta={TEXTOS.aulas.recursos}
            ayuda="Separados por coma (ej. proyector, pizarra, 30 PCs)"
          >
            <Input
              name="recursos"
              value={formData.recursos}
              onChange={(e) => setFormData({ ...formData, recursos: e.target.value })}
              placeholder="Ej. proyector, pizarra, aire acondicionado"
            />
          </Field>
        </div>
      </ConfirmDialog>

      {/* Diálogo Desactivar */}
      <ConfirmDialog
        abierto={dialogoDesactivarAbierto}
        titulo={TEXTOS.aulas.confirmarDesactivarTitulo}
        descripcion={TEXTOS.aulas.confirmarDesactivarDescripcion}
        textoConfirmar={TEXTOS.aulas.desactivar}
        textoCancelar={TEXTOS.acciones.cancelar}
        variante="peligro"
        cargando={desactivando}
        onCancelar={() => setDialogoDesactivarAbierto(false)}
        onConfirmar={confirmarDesactivacion}
      >
        {avisoAfectadas ? (
          <div role="alert" className={styles.alertaAfectadas}>
            {avisoAfectadas}
          </div>
        ) : null}

        <label className={styles.checkboxWrapper}>
          <input
            type="checkbox"
            className={styles.checkboxInput}
            checked={cancelarReservasFuturas}
            onChange={(e) => setCancelarReservasFuturas(e.target.checked)}
          />
          <span>{TEXTOS.aulas.cancelarReservasFuturas}</span>
        </label>

        {cancelarReservasFuturas ? (
          <Field
            etiqueta={TEXTOS.aulas.motivoBaja}
            obligatorio
            error={errorMotivo}
          >
            <Textarea
              rows={3}
              value={motivoBaja}
              onChange={(e) => setMotivoBaja(e.target.value)}
              placeholder="Ingrese el motivo de la baja del aula..."
              autoFocus
            />
          </Field>
        ) : errorMotivo ? (
          <div role="alert" className={styles.errorModal}>
            {errorMotivo}
          </div>
        ) : null}
      </ConfirmDialog>

      {/* Diálogo Reactivar */}
      <ConfirmDialog
        abierto={dialogoReactivarAbierto}
        titulo={TEXTOS.aulas.confirmarReactivarTitulo}
        descripcion={TEXTOS.aulas.confirmarReactivarDescripcion}
        textoConfirmar={TEXTOS.aulas.reactivar}
        textoCancelar={TEXTOS.acciones.cancelar}
        variante="primario"
        cargando={reactivando}
        onCancelar={() => setDialogoReactivarAbierto(false)}
        onConfirmar={confirmarReactivacion}
      />

      {mensajeToast ? (
        <Toast
          mensaje={mensajeToast}
          tipo="exito"
          onCerrar={() => setMensajeToast(null)}
        />
      ) : null}
    </div>
  );
}
