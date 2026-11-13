import { Link } from 'react-router-dom';
import EstadoBadge from '../../components/ui/EstadoBadge.jsx';
import { TEXTOS } from '../../textos.js';
import { nombreDeAula, nombreDeSolicitante } from './metricasPanel.js';
import styles from '../Resumen.module.css';

function Separador() {
  return (
    <span className={styles.separadorHoy} aria-hidden="true">
      ·
    </span>
  );
}

/** Próximas reservas del día, en orden de horario. */
export default function ReservasDeHoy({ reservas, nombresAulas }) {
  return (
    <section className={styles.seccion} aria-labelledby="titulo-hoy">
      <div className={styles.cabeceraSeccion}>
        <h2 id="titulo-hoy" className={styles.tituloSeccion}>
          {TEXTOS.panel.hoyTitulo}
        </h2>
      </div>

      {reservas.length === 0 ? (
        <p className={styles.lineaVacia}>{TEXTOS.panel.sinReservasHoy}</p>
      ) : (
        <ul className={styles.listaHoy}>
          {reservas.map((r) => (
            <li key={r.id} className={styles.itemHoy}>
              <div className={styles.infoHoy}>
                <span className={styles.horarioHoy}>
                  {String(r.horaInicio).slice(0, 5)}–{String(r.horaFin).slice(0, 5)}
                </span>
                <Separador />
                <span className={styles.nombreAula}>{nombreDeAula(r, nombresAulas)}</span>
                <Separador />
                <span className={styles.solicitanteHoy} title={r.usuario?.email || undefined}>
                  {nombreDeSolicitante(r)}
                </span>
                {r.motivo ? (
                  <>
                    <Separador />
                    <span className={styles.motivoHoy}>{r.motivo}</span>
                  </>
                ) : null}
              </div>
              <div className={styles.metaHoy}>
                <EstadoBadge estado={r.estado} />
                <Link to={`/reservas/${r.id}`} className={styles.enlaceVer}>
                  {TEXTOS.acciones.ver}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
