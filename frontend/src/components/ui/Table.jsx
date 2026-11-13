import { TEXTOS } from '../../textos.js';
import EmptyState from './EmptyState.jsx';
import TablaSkeleton from './TablaSkeleton.jsx';
import styles from './Table.module.css';

/**
 * Clase de alineación de una columna. Por omisión, a la izquierda.
 */
const claseAlineacion = (alineacion) => {
  if (alineacion === 'derecha') return styles.derecha;
  if (alineacion === 'centro') return styles.centro;
  return '';
};

const claseCelda = (base, alineacion) =>
  [base, claseAlineacion(alineacion)].filter(Boolean).join(' ');

function Cabecera({ columnas }) {
  return (
    <thead className={styles.thead}>
      <tr>
        {columnas.map((col) => (
          <th key={col.clave} scope="col" className={claseCelda(styles.th, col.alineacion)}>
            {col.titulo}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Cuerpo({ columnas, datos, obtenerClave }) {
  return (
    <tbody>
      {datos.map((fila, filaIdx) => (
        <tr key={obtenerClave(fila, filaIdx)} className={styles.tr}>
          {columnas.map((col) => (
            <td key={col.clave} className={claseCelda(styles.td, col.alineacion)}>
              {typeof col.render === 'function' ? col.render(fila, filaIdx) : fila?.[col.clave]}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/**
 * Tabla con dos modos de uso:
 *
 * - **Declarativo:** se le pasan `columnas` y `datos`, y resuelve por su cuenta
 *   la carga (esqueleto) y el estado vacío.
 * - **Compuesto:** se le pasan hijos y se arma la tabla con `Table.Head`,
 *   `Table.Row`, etc., para casos que no encajan en una grilla uniforme.
 *
 * Cada columna es `{ clave, titulo, alineacion?, render? }`; `alineacion`
 * acepta `'derecha'` o `'centro'`.
 */
function Table({
  columnas,
  datos,
  claveFila = 'id',
  cargando = false,
  vacia = false,
  vacioTitulo = TEXTOS.ui.tablaVaciaTitulo,
  vacioDescripcion = TEXTOS.ui.tablaVaciaDescripcion,
  vacioAccion,
  estadoVacio,
  ariaLabel,
  className = '',
  children,
  ...rest
}) {
  const esDeclarativa = Array.isArray(columnas) && Array.isArray(datos);

  if (cargando) {
    return (
      <TablaSkeleton
        cabeceras={Array.isArray(columnas) ? columnas.map((col) => col.titulo ?? '') : undefined}
      />
    );
  }

  const mostrarVacio = vacia || (esDeclarativa && datos.length === 0);
  if (mostrarVacio) {
    return (
      estadoVacio || (
        <EmptyState titulo={vacioTitulo} descripcion={vacioDescripcion} accion={vacioAccion} />
      )
    );
  }

  const obtenerClave = (fila, indice) =>
    typeof claveFila === 'function' ? claveFila(fila, indice) : (fila?.[claveFila] ?? indice);

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <table className={styles.tabla} aria-label={ariaLabel} {...rest}>
        {esDeclarativa ? (
          <>
            <Cabecera columnas={columnas} />
            <Cuerpo columnas={columnas} datos={datos} obtenerClave={obtenerClave} />
          </>
        ) : (
          children
        )}
      </table>
    </div>
  );
}

Table.Head = function TableHead({ className = '', children, ...rest }) {
  return (
    <thead className={[styles.thead, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </thead>
  );
};

Table.Body = function TableBody({ children, ...rest }) {
  return <tbody {...rest}>{children}</tbody>;
};

Table.Row = function TableRow({ className = '', children, ...rest }) {
  return (
    <tr className={[styles.tr, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </tr>
  );
};

Table.HeaderCell = function TableHeaderCell({ className = '', children, ...rest }) {
  return (
    <th scope="col" className={[styles.th, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </th>
  );
};

Table.Cell = function TableCell({ className = '', children, ...rest }) {
  return (
    <td className={[styles.td, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </td>
  );
};

export default Table;
