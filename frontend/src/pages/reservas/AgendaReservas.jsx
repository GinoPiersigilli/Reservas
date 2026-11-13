import { Link } from 'react-router-dom';
import EstadoBadge from '../../components/ui/EstadoBadge.jsx';
import { TEXTOS } from '../../textos.js';
import { agruparPorJornada } from './agruparPorJornada.js';
import styles from './AgendaReservas.module.css';

const hora = (valor) => String(valor || '').slice(0, 5);

const nombreDeAula = (reserva, mapaAulas) =>
  reserva.aula?.nombre || mapaAulas[reserva.aulaId] || `Aula ${reserva.aulaId}`;

const nombreDeSolicitante = (reserva) =>
  reserva.usuario?.nombre ||
  reserva.usuarioNombre ||
  (reserva.usuarioId ? `Usuario #${reserva.usuarioId}` : null);

/**
 * Una reserva como tramo de horario: las horas de inicio y fin unidas por un
 * trazo vertical que toma el color del estado. Toda la fila es el enlace al
 * detalle.
 */
function ItemReserva({ reserva, esAdmin, mapaAulas }) {
  const aula = nombreDeAula(reserva, mapaAulas);
  const solicitante = esAdmin ? nombreDeSolicitante(reserva) : null;
  const estado = String(reserva.estado || 'pendiente').toLowerCase();
  const descripcion = `Reserva #${reserva.id}, ${aula}, de ${hora(reserva.horaInicio)} a ${hora(
    reserva.horaFin
  )}, ${TEXTOS.estados[estado] || estado}`;

  return (
    <li className={styles.item}>
      <Link to={`/reservas/${reserva.id}`} className={styles.enlace} aria-label={descripcion}>
        <span className={styles.tramo} data-estado={estado} aria-hidden="true">
          <span className={styles.hora}>{hora(reserva.horaInicio)}</span>
          <span className={styles.trazo} />
          <span className={styles.hora}>{hora(reserva.horaFin)}</span>
        </span>

        <span className={styles.cuerpo}>
          <span className={styles.aula}>{aula}</span>
          <span className={styles.motivo}>{reserva.motivo}</span>
          {solicitante ? (
            <span className={styles.solicitante} title={reserva.usuario?.email || undefined}>
              {solicitante}
            </span>
          ) : null}
        </span>

        <span className={styles.lateral}>
          <EstadoBadge estado={reserva.estado} />
        </span>
      </Link>
    </li>
  );
}

/** Reservas de la página agrupadas por jornada, en orden de horario. */
export default function AgendaReservas({ reservas = [], esAdmin = false, mapaAulas = {} }) {
  const jornadas = agruparPorJornada(reservas);

  return (
    <section className={styles.agenda} aria-label="Agenda de reservas">
      {jornadas.map((jornada) => (
        <article key={jornada.fecha} className={styles.jornada}>
          <h2 className={styles.encabezado}>
            <time dateTime={jornada.fecha}>{jornada.titulo}</time>
            {jornada.relativa ? <span className={styles.relativa}>{jornada.relativa}</span> : null}
          </h2>

          <ul className={styles.lista}>
            {jornada.reservas.map((reserva) => (
              <ItemReserva
                key={reserva.id}
                reserva={reserva}
                esAdmin={esAdmin}
                mapaAulas={mapaAulas}
              />
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
