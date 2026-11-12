import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button, Field, Input, Select, Toast } from '../components/ui/index.js';
import GrillaDisponibilidad from '../components/GrillaDisponibilidad.jsx';
import {
  HORA_FIN_JORNADA,
  HORA_INICIO_JORNADA,
  obtenerHoyArgentina
} from '../config/horarios.js';
import * as aulaService from '../services/aula.service.js';
import { getReserva, crearReserva, editarReserva } from '../services/reservas.service.js';
import { TEXTOS } from '../textos.js';
import { calcularDuracionTexto, formatearFecha } from '../utils/formato.js';
import styles from './FormularioReserva.module.css';

const generarClaveIdempotencia = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return null;
};

export default function FormularioReserva() {
  const { id } = useParams();
  const navigate = useNavigate();
  const esEdicion = Boolean(id);

  const [idempotencyKey, setIdempotencyKey] = useState(generarClaveIdempotencia);

  const [form, setForm] = useState({
    aulaId: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    cantidadPersonas: '',
    motivo: ''
  });
  const [aulas, setAulas] = useState([]);
  const [disponibilidadPorAula, setDisponibilidadPorAula] = useState({});
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [erroresCampo, setErroresCampo] = useState({});
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [aulaCargando, setAulaCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    const cargarAulas = async () => {
      try {
        const res = await aulaService.getAulas();
        if (!cancelado) {
          setAulas(res.data.filter((a) => a.activa));
        }
      } catch {
        if (!cancelado) {
          setError(TEXTOS.aulas.errorCarga);
        }
      } finally {
        if (!cancelado) {
          setAulaCargando(false);
        }
      }
    };
    cargarAulas();

    if (esEdicion) {
      const cargarReserva = async () => {
        try {
          const res = await getReserva(id);
          const r = res.data;
          if (!cancelado) {
            setForm({
              aulaId: String(r.aulaId),
              fecha: r.fecha,
              horaInicio: r.horaInicio,
              horaFin: r.horaFin,
              cantidadPersonas: String(r.cantidadPersonas),
              motivo: r.motivo
            });
          }
        } catch {
          if (!cancelado) {
            setError('No se pudo cargar la reserva. Intente de nuevo.');
          }
        }
      };
      cargarReserva();
    }

    return () => {
      cancelado = true;
    };
  }, [id, esEdicion]);

  useEffect(() => {
    let cancelado = false;
    if (
      !form.fecha ||
      !/^\d{4}-\d{2}-\d{2}$/.test(form.fecha) ||
      aulas.length === 0 ||
      typeof aulaService.getDisponibilidadAula !== 'function'
    ) {
      return undefined;
    }

    const cargarDisponibilidadDia = async () => {
      setCargandoDisponibilidad(true);
      try {
        const resultados = await Promise.all(
          aulas.map((aula) =>
            Promise.resolve(aulaService.getDisponibilidadAula(aula.id, form.fecha))
              .then((res) => ({
                aulaId: aula.id,
                franjas: Array.isArray(res?.data) ? res.data : []
              }))
              .catch(() => ({ aulaId: aula.id, franjas: [] }))
          )
        );
        if (!cancelado) {
          const mapa = {};
          resultados.forEach(({ aulaId, franjas }) => {
            mapa[aulaId] = franjas;
          });
          setDisponibilidadPorAula(mapa);
        }
      } finally {
        if (!cancelado) {
          setCargandoDisponibilidad(false);
        }
      }
    };

    cargarDisponibilidadDia();

    return () => {
      cancelado = true;
    };
  }, [form.fecha, aulas]);

  const handleChange = (evento) => {
    const { name, value } = evento.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setIdempotencyKey(generarClaveIdempotencia());
    if (erroresCampo[name]) {
      setErroresCampo((prev) => ({ ...prev, [name]: undefined }));
    }
    if (error) {
      setError(null);
    }
  };

  const handleSeleccionarFranja = ({ aulaId, horaInicio, horaFin }) => {
    setForm((prev) => ({
      ...prev,
      aulaId: String(aulaId),
      horaInicio,
      horaFin
    }));
    setIdempotencyKey(generarClaveIdempotencia());
    setErroresCampo((prev) => ({
      ...prev,
      aulaId: undefined,
      horaInicio: undefined,
      horaFin: undefined
    }));
    setError(null);
  };

  const aulaSeleccionada = aulas.find((a) => String(a.id) === String(form.aulaId));

  const validar = () => {
    const nuevosErrores = {};
    const hoy = obtenerHoyArgentina();

    if (!form.aulaId) {
      nuevosErrores.aulaId = 'Elija un aula.';
    }
    if (!form.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(form.fecha)) {
      nuevosErrores.fecha = 'Ingrese una fecha válida.';
    } else if (form.fecha < hoy) {
      nuevosErrores.fecha = 'No se permiten reservas en una fecha pasada.';
    }
    if (!form.horaInicio) {
      nuevosErrores.horaInicio = 'Indique la hora de inicio.';
    }
    if (!form.horaFin) {
      nuevosErrores.horaFin = 'Indique la hora de fin.';
    }
    if (form.horaInicio && form.horaFin) {
      if (form.horaInicio >= form.horaFin) {
        nuevosErrores.horaFin = 'La hora de inicio debe ser menor a la hora de fin.';
      } else if (
        form.horaInicio < HORA_INICIO_JORNADA ||
        form.horaFin > HORA_FIN_JORNADA
      ) {
        nuevosErrores.horaFin = `Las reservas solo se permiten entre las ${HORA_INICIO_JORNADA} y las ${HORA_FIN_JORNADA}.`;
      }
    }

    const numPersonas = Number(form.cantidadPersonas);
    if (!form.cantidadPersonas || !Number.isInteger(numPersonas) || numPersonas < 1) {
      nuevosErrores.cantidadPersonas = 'Indique una cantidad entera mayor a 0.';
    } else if (aulaSeleccionada && numPersonas > aulaSeleccionada.capacidad) {
      nuevosErrores.cantidadPersonas = `La cantidad de personas supera la capacidad del aula (máx. ${aulaSeleccionada.capacidad}).`;
    }

    if (!form.motivo || !form.motivo.trim()) {
      nuevosErrores.motivo = 'Ingrese el motivo de la reserva.';
    }

    setErroresCampo(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      const primerMensaje = Object.values(nuevosErrores)[0];
      setError(primerMensaje);
      return false;
    }
    return true;
  };

  const handleSubmit = async (evento) => {
    evento.preventDefault();
    setError(null);

    if (!validar()) return;

    setCargando(true);
    try {
      if (esEdicion) {
        await editarReserva(id, form);
        navigate(`/reservas/${id}`);
      } else {
        const res = await crearReserva(form, { idempotencyKey });
        setIdempotencyKey(generarClaveIdempotencia());
        navigate(`/reservas/${res.data.id}`);
      }
    } catch (err) {
      const mensajeServidor = err.response?.data?.error;
      setError(
        mensajeServidor ||
          'Ocurrió un error al guardar la reserva. Intente de nuevo.'
      );
    } finally {
      setCargando(false);
    }
  };

  const pasoActual = !form.fecha || !form.aulaId
    ? 1
    : !form.horaInicio || !form.horaFin
      ? 2
      : 3;

  const duracionTexto = calcularDuracionTexto(form.horaInicio, form.horaFin);

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecera}>
        <h1>
          {esEdicion ? TEXTOS.formulario.tituloEditar : TEXTOS.formulario.tituloNueva}
        </h1>
        <ol className={styles.pasos} aria-label="Pasos para reservar">
          <li
            className={[
              styles.pasoItem,
              pasoActual === 1 ? styles.pasoActivo : '',
              pasoActual > 1 ? styles.pasoCompletado : ''
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={pasoActual === 1 ? 'step' : undefined}
          >
            <span className={styles.numeroPaso}>
              {pasoActual > 1 ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                '1'
              )}
            </span>
            <span>{TEXTOS.formulario.paso1}</span>
          </li>
          <li
            className={[
              styles.pasoItem,
              pasoActual === 2 ? styles.pasoActivo : '',
              pasoActual > 2 ? styles.pasoCompletado : ''
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={pasoActual === 2 ? 'step' : undefined}
          >
            <span className={styles.numeroPaso}>
              {pasoActual > 2 ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                '2'
              )}
            </span>
            <span>{TEXTOS.formulario.paso2}</span>
          </li>
          <li
            className={[
              styles.pasoItem,
              pasoActual === 3 ? styles.pasoActivo : ''
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={pasoActual === 3 ? 'step' : undefined}
          >
            <span className={styles.numeroPaso}>3</span>
            <span>{TEXTOS.formulario.paso3}</span>
          </li>
        </ol>
      </header>

      {error ? <Toast tipo="error" mensaje={error} /> : null}

      <form onSubmit={handleSubmit} className={styles.formulario} noValidate>
        <section className={styles.panelSeccion}>
          <div className={styles.grillaCampos}>
            <Field
              id="fecha"
              etiqueta={TEXTOS.formulario.fecha}
              error={erroresCampo.fecha}
              obligatorio
            >
              <Input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
              />
            </Field>

            <Field
              id="aulaId"
              etiqueta={TEXTOS.formulario.aula}
              ayuda={
                aulaSeleccionada
                  ? `${aulaSeleccionada.ubicacion ? `${aulaSeleccionada.ubicacion} · ` : ''}Capacidad: ${aulaSeleccionada.capacidad} personas.`
                  : 'Elija un aula para consultar ubicación y capacidad.'
              }
              error={erroresCampo.aulaId}
              obligatorio
            >
              <Select
                name="aulaId"
                value={form.aulaId}
                onChange={handleChange}
                disabled={aulaCargando}
              >
                <option value="">
                  {aulaCargando ? 'Cargando aulas…' : 'Elija un aula'}
                </option>
                {aulas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              id="cantidadPersonas"
              etiqueta={TEXTOS.formulario.cantidadPersonas}
              ayuda={
                aulaSeleccionada
                  ? `Capacidad máxima: ${aulaSeleccionada.capacidad} personas.`
                  : undefined
              }
              error={erroresCampo.cantidadPersonas}
              obligatorio
            >
              <Input
                type="number"
                name="cantidadPersonas"
                min="1"
                value={form.cantidadPersonas}
                onChange={handleChange}
              />
            </Field>
          </div>
        </section>

        <GrillaDisponibilidad
          aulas={aulas}
          fecha={form.fecha}
          disponibilidadPorAula={disponibilidadPorAula}
          cargando={cargandoDisponibilidad}
          aulaIdSeleccionada={form.aulaId}
          horaInicioSeleccionada={form.horaInicio}
          horaFinSeleccionada={form.horaFin}
          onSeleccionarFranja={handleSeleccionarFranja}
        />

        <section className={styles.panelSeccion}>
          <div className={styles.grillaHoras}>
            <Field
              id="horaInicio"
              etiqueta={TEXTOS.formulario.horaInicio}
              ayuda={`Desde las ${HORA_INICIO_JORNADA}.`}
              error={erroresCampo.horaInicio}
              obligatorio
            >
              <Input
                type="time"
                name="horaInicio"
                min={HORA_INICIO_JORNADA}
                max={HORA_FIN_JORNADA}
                value={form.horaInicio}
                onChange={handleChange}
              />
            </Field>

            <Field
              id="horaFin"
              etiqueta={TEXTOS.formulario.horaFin}
              ayuda={`Hasta las ${HORA_FIN_JORNADA}.`}
              error={erroresCampo.horaFin}
              obligatorio
            >
              <Input
                type="time"
                name="horaFin"
                min={HORA_INICIO_JORNADA}
                max={HORA_FIN_JORNADA}
                value={form.horaFin}
                onChange={handleChange}
              />
            </Field>
          </div>

          <Field
            id="motivo"
            etiqueta={TEXTOS.formulario.motivo}
            ayuda="Indique cátedra, examen o reunión académica (máximo 255 caracteres)."
            error={erroresCampo.motivo}
            obligatorio
          >
            <Input
              type="text"
              name="motivo"
              maxLength={255}
              placeholder="Ej: Parcial de Física II"
              value={form.motivo}
              onChange={handleChange}
            />
          </Field>

          <div className={styles.resumenSeleccion} aria-live="polite">
            <span className={styles.tituloResumen}>Resumen de la solicitud</span>
            <p className={styles.lineaResumen}>
              Seleccionado:{' '}
              {aulaSeleccionada ? aulaSeleccionada.nombre : 'Sin aula elegida'} ·{' '}
              {form.fecha ? formatearFecha(form.fecha) : 'Sin fecha'} ·{' '}
              {form.horaInicio && form.horaFin
                ? `${form.horaInicio} a ${form.horaFin}${
                    duracionTexto ? ` (${duracionTexto})` : ''
                  }`
                : 'Sin franja horaria'}
            </p>
            {form.cantidadPersonas || form.motivo ? (
              <p className={styles.detalleResumen}>
                {form.cantidadPersonas
                  ? `${form.cantidadPersonas} personas`
                  : ''}
                {form.cantidadPersonas && form.motivo ? ' · ' : ''}
                {form.motivo ? form.motivo : ''}
              </p>
            ) : null}
          </div>

          <div className={styles.acciones}>
            <Button type="submit" variante="primario" cargando={cargando} disabled={cargando}>
              {esEdicion
                ? TEXTOS.acciones.guardarCambios
                : TEXTOS.acciones.reservarAula}
            </Button>
            <Button
              type="button"
              variante="secundario"
              onClick={() => navigate('/reservas')}
            >
              {TEXTOS.acciones.cancelar}
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}
