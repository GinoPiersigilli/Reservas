/**
 * Métricas del panel administrativo.
 *
 * El backend ya las calcula, pero puede devolverlas incompletas (por ejemplo,
 * sin la distribución por estado): estas funciones las reconstruyen a partir de
 * lo que sí llegó, para que el panel no quede en blanco.
 */
export const ORDEN_ESTADOS = ['aprobada', 'pendiente', 'rechazada', 'cancelada'];

export const ETIQUETAS_ESTADO = {
  aprobada: 'Aprobadas',
  pendiente: 'Pendientes',
  rechazada: 'Rechazadas',
  cancelada: 'Canceladas'
};

/** Nombre del aula, venga en la reserva o haya que resolverlo por su id. */
export const nombreDeAula = (item, nombresAulas = {}) =>
  item.aula?.nombre ||
  item.nombre ||
  item.aulaNombre ||
  nombresAulas[item.aulaId] ||
  `Aula ${item.aulaId}`;

/** Nombre de quien solicitó, con un guion cuando no hay dato. */
export const nombreDeSolicitante = (reserva) =>
  reserva.usuario?.nombre ||
  reserva.usuarioNombre ||
  (reserva.usuarioId ? `Usuario #${reserva.usuarioId}` : '—');

export const calcularMetricas = (resumen, colaPendientes) => {
  const porEstado = new Map(
    (resumen.porEstado || []).map((item) => [item.estado, Number(item.total) || 0])
  );

  const totalReservas =
    resumen.totalReservas ??
    Array.from(porEstado.values()).reduce((acc, actual) => acc + actual, 0);

  const distribucionEstados =
    Array.isArray(resumen.distribucionEstados) && resumen.distribucionEstados.length > 0
      ? resumen.distribucionEstados
      : ORDEN_ESTADOS.map((estado) => {
          const cantidad = porEstado.get(estado) || 0;
          return {
            estado,
            cantidad,
            porcentaje: totalReservas > 0 ? Math.round((cantidad / totalReservas) * 100) : 0
          };
        });

  return {
    totalReservas,
    // La cola es más precisa que el agregado, porque trae las reservas en sí.
    cantidadPendientes:
      colaPendientes.length > 0 ? colaPendientes.length : porEstado.get('pendiente') || 0,
    distribucionEstados,
    tasaOcupacion: Array.isArray(resumen.tasaOcupacionAulas) ? resumen.tasaOcupacionAulas : [],
    aulasMasReservadas:
      resumen.aulasMayorDemanda && resumen.aulasMayorDemanda.length > 0
        ? resumen.aulasMayorDemanda
        : resumen.porAula || []
  };
};

/** El listado paginado cambió de forma entre versiones de la API. */
export const extraerListado = (respuesta) => {
  if (Array.isArray(respuesta?.data?.datos)) return respuesta.data.datos;
  if (Array.isArray(respuesta?.data?.data)) return respuesta.data.data;
  if (Array.isArray(respuesta?.data)) return respuesta.data;
  return [];
};
