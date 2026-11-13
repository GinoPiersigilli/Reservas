import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Toast } from '../components/ui/index.js';
import GrillaDisponibilidad from '../components/GrillaDisponibilidad.jsx';
import { crearReserva, editarReserva } from '../services/reservas.service.js';
import { TEXTOS } from '../textos.js';
import { useDatosFormulario } from './reserva/useDatosFormulario.js';
import { pasoActual, validarReserva } from './reserva/validarReserva.js';
import PasosReserva from './reserva/PasosReserva.jsx';
import { CamposHorario, CamposPrincipales } from './reserva/CamposReserva.jsx';
import ResumenSolicitud from './reserva/ResumenSolicitud.jsx';
import styles from './FormularioReserva.module.css';

/**
 * Clave de idempotencia de la solicitud. Se renueva con cada cambio del
 * formulario, de modo que reintentar un envío no cree una segunda reserva pero
 * una solicitud distinta sí se cree (ver docs/adr/0003).
 */
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

  const {
    form,
    setForm,
    aulas,
    aulaCargando,
    disponibilidadPorAula,
    cargandoDisponibilidad,
    errorCarga,
    setErrorCarga
  } = useDatosFormulario({ id, esEdicion });

  const [idempotencyKey, setIdempotencyKey] = useState(generarClaveIdempotencia);
  const [erroresCampo, setErroresCampo] = useState({});
  const [enviando, setEnviando] = useState(false);

  const aulaSeleccionada = aulas.find((a) => String(a.id) === String(form.aulaId));

  const handleChange = (evento) => {
    const { name, value } = evento.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setIdempotencyKey(generarClaveIdempotencia());
    setErroresCampo((prev) => ({ ...prev, [name]: undefined }));
    setErrorCarga(null);
  };

  /** Un clic en la grilla completa aula y horario de una sola vez. */
  const handleSeleccionarFranja = ({ aulaId, horaInicio, horaFin }) => {
    setForm((prev) => ({ ...prev, aulaId: String(aulaId), horaInicio, horaFin }));
    setIdempotencyKey(generarClaveIdempotencia());
    setErroresCampo((prev) => ({
      ...prev,
      aulaId: undefined,
      horaInicio: undefined,
      horaFin: undefined
    }));
    setErrorCarga(null);
  };

  const handleSubmit = async (evento) => {
    evento.preventDefault();
    setErrorCarga(null);

    const errores = validarReserva(form, aulaSeleccionada);
    setErroresCampo(errores);

    if (Object.keys(errores).length > 0) {
      // El primer error se repite como aviso general, para que sea visible
      // aunque el campo esté fuera de la pantalla.
      setErrorCarga(Object.values(errores)[0]);
      return;
    }

    setEnviando(true);
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
      setErrorCarga(
        err.response?.data?.error || 'Ocurrió un error al guardar la reserva. Intente de nuevo.'
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecera}>
        <h1>{esEdicion ? TEXTOS.formulario.tituloEditar : TEXTOS.formulario.tituloNueva}</h1>
        <PasosReserva pasoActual={pasoActual(form)} />
      </header>

      {errorCarga ? <Toast tipo="error" mensaje={errorCarga} /> : null}

      <form onSubmit={handleSubmit} className={styles.formulario} noValidate>
        <CamposPrincipales
          form={form}
          aulas={aulas}
          aulaSeleccionada={aulaSeleccionada}
          aulaCargando={aulaCargando}
          errores={erroresCampo}
          onChange={handleChange}
        />

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
          <CamposHorario form={form} errores={erroresCampo} onChange={handleChange} />

          <ResumenSolicitud form={form} aulaSeleccionada={aulaSeleccionada} />

          <div className={styles.acciones}>
            <Button type="submit" variante="primario" cargando={enviando} disabled={enviando}>
              {esEdicion ? TEXTOS.acciones.guardarCambios : TEXTOS.acciones.reservarAula}
            </Button>
            <Button type="button" variante="secundario" onClick={() => navigate('/reservas')}>
              {TEXTOS.acciones.cancelar}
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}
