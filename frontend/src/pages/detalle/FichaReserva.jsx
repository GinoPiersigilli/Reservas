import {
  calcularDuracionTexto,
  etiquetaRelativa,
  formatearFechaHora,
  formatearJornada
} from '../../utils/formato.js';
import styles from '../DetalleReserva.module.css';

function Dato({ etiqueta, children, destacado = false }) {
  return (
    <div className={styles.filaDato}>
      <dt className={styles.etiquetaDato}>{etiqueta}</dt>
      <dd
        className={[styles.valorDato, destacado ? styles.valorDestacado : '']
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </dd>
    </div>
  );
}

/** El nombre del aula puede venir en la reserva o resolverse por su id. */
const nombreDelAula = (reserva, nombresAulas) =>
  reserva.aula?.nombre ||
  reserva.aulaNombre ||
  nombresAulas[reserva.aulaId] ||
  `Aula ${reserva.aulaId}`;

const nombreDelSolicitante = (reserva) =>
  reserva.usuario?.nombre || reserva.usuarioNombre || `Usuario #${reserva.usuarioId}`;

/** La fecha con día de la semana, y «hoy» o «mañana» cuando corresponde. */
function FechaDeReserva({ fecha }) {
  const relativa = etiquetaRelativa(fecha);

  return (
    <>
      <time dateTime={String(fecha || '').slice(0, 10)}>{formatearJornada(fecha)}</time>
      {relativa ? <span className={styles.valorSecundario}>({relativa})</span> : null}
    </>
  );
}

/** Datos de la reserva. El solicitante solo se muestra si corresponde verlo. */
export default function FichaReserva({ reserva, nombresAulas, puedeVerSolicitante, children }) {
  const duracion = calcularDuracionTexto(reserva.horaInicio, reserva.horaFin);
  const horaInicio = String(reserva.horaInicio).slice(0, 5);
  const horaFin = String(reserva.horaFin).slice(0, 5);
  const seActualizo = reserva.updatedAt && reserva.updatedAt !== reserva.createdAt;

  return (
    <section className={styles.ficha} aria-labelledby="titulo-ficha-reserva">
      <h2 id="titulo-ficha-reserva" className={styles.subtituloFicha}>
        Datos de la reserva
      </h2>

      <dl className={styles.listaDatos}>
        <Dato etiqueta="Aula" destacado>
          {nombreDelAula(reserva, nombresAulas)}
        </Dato>

        <Dato etiqueta="Fecha">
          <FechaDeReserva fecha={reserva.fecha} />
        </Dato>

        <Dato etiqueta="Horario">
          <span>
            {horaInicio}–{horaFin}
          </span>
          {duracion ? <span className={styles.valorSecundario}>({duracion})</span> : null}
        </Dato>

        <Dato etiqueta="Cantidad de personas">{reserva.cantidadPersonas} personas</Dato>

        <Dato etiqueta="Motivo">{reserva.motivo}</Dato>

        {puedeVerSolicitante ? (
          <Dato etiqueta="Solicitante">
            <span title={reserva.usuario?.email || nombreDelSolicitante(reserva)}>
              {nombreDelSolicitante(reserva)}
            </span>
          </Dato>
        ) : null}

        <Dato etiqueta="Fecha de solicitud">{formatearFechaHora(reserva.createdAt)}</Dato>

        {seActualizo ? (
          <Dato etiqueta="Última actualización">{formatearFechaHora(reserva.updatedAt)}</Dato>
        ) : null}
      </dl>

      {children}
    </section>
  );
}
