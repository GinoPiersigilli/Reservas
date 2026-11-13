import { TEXTOS } from '../../textos.js';
import styles from './TablaSkeleton.module.css';

export default function TablaSkeleton({
  filas = 5,
  rows,
  columnas = 5,
  columns,
  cabeceras,
  headers,
  etiqueta = TEXTOS.ui.tablaCargando,
  className = ''
}) {
  const numFilas = rows ?? filas;
  const listaCabeceras = headers || cabeceras;
  const numColumnas = Array.isArray(listaCabeceras) ? listaCabeceras.length : (columns ?? columnas);

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
                {Array.isArray(listaCabeceras) && listaCabeceras[colIdx] ? (
                  listaCabeceras[colIdx]
                ) : (
                  <span className={styles.barraCabecera} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: numFilas }).map((_, filaIdx) => (
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
