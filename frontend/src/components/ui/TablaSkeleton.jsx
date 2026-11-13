import { TEXTOS } from '../../textos.js';
import styles from './TablaSkeleton.module.css';

export default function TablaSkeleton({
  filas = 5,
  columnas = 5,
  cabeceras,
  etiqueta = TEXTOS.ui.tablaCargando,
  className = ''
}) {
  const numColumnas = Array.isArray(cabeceras) ? cabeceras.length : columnas;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={etiqueta}
      className={[styles.wrapper, className].filter(Boolean).join(' ')}
    >
      <span className="sr-only">{etiqueta}</span>
      <table className={styles.tabla} aria-hidden="true">
        <thead className={styles.cabecera}>
          <tr>
            {Array.from({ length: numColumnas }).map((_, colIdx) => (
              <th key={colIdx} className={styles.th}>
                {Array.isArray(cabeceras) && cabeceras[colIdx] ? (
                  cabeceras[colIdx]
                ) : (
                  <span className={styles.barraCabecera} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: filas }).map((_, filaIdx) => (
            <tr key={filaIdx}>
              {Array.from({ length: numColumnas }).map((__, colIdx) => (
                <td key={colIdx} className={styles.td}>
                  <span className={styles.barra} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
