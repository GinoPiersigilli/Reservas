import { TEXTOS } from '../../textos.js';
import EmptyState from './EmptyState.jsx';
import TablaSkeleton from './TablaSkeleton.jsx';
import styles from './Table.module.css';

function Table({
  columnas,
  columns,
  datos,
  data,
  claveFila = 'id',
  rowKey,
  cargando = false,
  loading = false,
  vacia = false,
  isEmpty = false,
  vacioTitulo = TEXTOS.ui.tablaVaciaTitulo,
  vacioDescripcion = TEXTOS.ui.tablaVaciaDescripcion,
  vacioAccion,
  estadoVacio,
  emptyState,
  ariaLabel,
  className = '',
  children,
  ...rest
}) {
  const listaColumnas = columnas || columns;
  const listaDatos = datos ?? data;
  const estaCargando = Boolean(cargando || loading);

  if (estaCargando) {
    return (
      <TablaSkeleton
        cabeceras={
          Array.isArray(listaColumnas)
            ? listaColumnas.map((col) => col.titulo ?? col.header ?? '')
            : undefined
        }
      />
    );
  }

  const sinDatosDeclarativos = Array.isArray(listaDatos) && listaDatos.length === 0;
  const mostrarVacio = Boolean(vacia || isEmpty || sinDatosDeclarativos);

  if (mostrarVacio) {
    if (estadoVacio || emptyState) {
      return estadoVacio || emptyState;
    }
    return (
      <EmptyState
        titulo={vacioTitulo}
        descripcion={vacioDescripcion}
        accion={vacioAccion}
      />
    );
  }

  const obtenerClaseAlineacion = (alineacion) => {
    if (alineacion === 'right' || alineacion === 'derecha') return styles.derecha;
    if (alineacion === 'center' || alineacion === 'centro') return styles.centro;
    return '';
  };

  const obtenerClave = (fila, indice) => {
    const keyProp = rowKey || claveFila;
    if (typeof keyProp === 'function') return keyProp(fila, indice);
    return fila?.[keyProp] ?? indice;
  };

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <table className={styles.tabla} aria-label={ariaLabel} {...rest}>
        {Array.isArray(listaColumnas) && Array.isArray(listaDatos) ? (
          <>
            <thead className={styles.thead}>
              <tr>
                {listaColumnas.map((col, idx) => {
                  const key = col.key ?? col.clave ?? idx;
                  const titulo = col.titulo ?? col.header ?? '';
                  const alinear = obtenerClaseAlineacion(col.align || col.alineacion);
                  return (
                    <th
                      key={key}
                      scope="col"
                      className={[styles.th, alinear].filter(Boolean).join(' ')}
                    >
                      {titulo}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {listaDatos.map((fila, filaIdx) => (
                <tr key={obtenerClave(fila, filaIdx)} className={styles.tr}>
                  {listaColumnas.map((col, colIdx) => {
                    const key = col.key ?? col.clave ?? colIdx;
                    const alinear = obtenerClaseAlineacion(col.align || col.alineacion);
                    const contenido =
                      typeof col.render === 'function'
                        ? col.render(fila, filaIdx)
                        : fila?.[key];
                    return (
                      <td
                        key={key}
                        className={[styles.td, alinear].filter(Boolean).join(' ')}
                      >
                        {contenido}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
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
    <th
      scope="col"
      className={[styles.th, className].filter(Boolean).join(' ')}
      {...rest}
    >
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

