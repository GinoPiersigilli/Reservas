import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button, EstadoBadge, Table } from './ui/index.js';
import { TEXTOS } from '../textos.js';
import { formatearFecha } from '../utils/formato.js';
import styles from './TablaReservas.module.css';

export default function TablaReservas({
  reservas = [],
  esAdmin = false,
  mapaAulas = {},
  sortBy = 'createdAt',
  order = 'DESC',
  onOrdenar
}) {
  const navigate = useNavigate();

  const renderCabeceraOrdenable = (etiqueta, campo) => {
    if (!onOrdenar) return etiqueta;
    const activo = sortBy === campo;
    const Icono = !activo ? ArrowUpDown : order === 'ASC' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        className={styles.botonOrden}
        onClick={() => onOrdenar(campo)}
      >
        <span>{etiqueta}</span>
        <Icono size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    );
  };

  const obtenerAriaSort = (campo) => {
    if (sortBy !== campo) return 'none';
    return order === 'ASC' ? 'ascending' : 'descending';
  };

  const obtenerNombreAula = (r) => {
    if (r.aula?.nombre) return r.aula.nombre;
    if (mapaAulas[r.aulaId]) return mapaAulas[r.aulaId];
    return `Aula ${r.aulaId}`;
  };

  const obtenerSolicitante = (r) => {
    if (r.usuario?.nombre) return r.usuario.nombre;
    if (r.usuarioNombre) return r.usuarioNombre;
    if (r.usuarioId) return `Usuario #${r.usuarioId}`;
    return '—';
  };

  return (
    <Table ariaLabel="Listado de reservas">
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell aria-sort={obtenerAriaSort('id')}>
            {renderCabeceraOrdenable('#', 'id')}
          </Table.HeaderCell>
          <Table.HeaderCell aria-sort={obtenerAriaSort('aulaId')}>
            {renderCabeceraOrdenable('Aula', 'aulaId')}
          </Table.HeaderCell>
          <Table.HeaderCell aria-sort={obtenerAriaSort('fecha')}>
            {renderCabeceraOrdenable('Fecha', 'fecha')}
          </Table.HeaderCell>
          <Table.HeaderCell aria-sort={obtenerAriaSort('horaInicio')}>
            {renderCabeceraOrdenable('Horario', 'horaInicio')}
          </Table.HeaderCell>
          {esAdmin ? <Table.HeaderCell>Solicitante</Table.HeaderCell> : null}
          <Table.HeaderCell>Motivo</Table.HeaderCell>
          <Table.HeaderCell aria-sort={obtenerAriaSort('estado')}>
            {renderCabeceraOrdenable('Estado', 'estado')}
          </Table.HeaderCell>
          <Table.HeaderCell className={styles.accionesCelda}>
            <span className="sr-only">Acciones</span>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {reservas.map((r) => (
          <Table.Row key={r.id}>
            <Table.Cell className={styles.idCelda}>#{r.id}</Table.Cell>
            <Table.Cell>{obtenerNombreAula(r)}</Table.Cell>
            <Table.Cell>{formatearFecha(r.fecha)}</Table.Cell>
            <Table.Cell className={styles.horarioCelda}>
              {r.horaInicio}–{r.horaFin}
            </Table.Cell>
            {esAdmin ? (
              <Table.Cell
                className={styles.solicitanteCelda}
                title={obtenerSolicitante(r)}
              >
                <span
                  className={styles.nombreSolicitante}
                  title={r.usuario?.email || obtenerSolicitante(r)}
                >
                  {obtenerSolicitante(r)}
                </span>
              </Table.Cell>
            ) : null}
            <Table.Cell>{r.motivo}</Table.Cell>
            <Table.Cell>
              <EstadoBadge estado={r.estado} />
            </Table.Cell>
            <Table.Cell className={styles.accionesCelda}>
              <Button
                variante="secundario"
                tamano="sm"
                onClick={() => navigate(`/reservas/${r.id}`)}
              >
                {TEXTOS.acciones.ver}
              </Button>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
