/**
 * Textos centralizados de la interfaz — Español neutro formal (Sección 9 de DISENO_PROPUESTA.md).
 * Reglas:
 * - Mayúscula solo al inicio de la oración o en nombres propios.
 * - Verbos en infinitivo en botones de acción ("Reservar aula", "Guardar cambios", "Cancelar reserva").
 * - Trato formal neutro ("Ingrese", "Elija", "Intente").
 * - Sin emojis ni flechas de texto.
 */

export const TEXTOS = {
  app: {
    titulo: 'Reservas de aulas',
    subtituloLogin: 'Ingrese con su cuenta',
    descripcion: 'Sistema institucional de reservas de aulas y consulta de disponibilidad horaria.'
  },
  navegacion: {
    reservasAdmin: 'Reservas',
    reservasUsuario: 'Mis reservas',
    nuevaReserva: 'Nueva reserva',
    panel: 'Panel',
    cerrarSesion: 'Cerrar sesión',
    abrirMenu: 'Abrir menú de navegación',
    cerrarMenu: 'Cerrar menú de navegación',
    rolAdmin: 'Administrador',
    rolUsuario: 'Usuario'
  },
  estados: {
    pendiente: 'Pendiente',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada'
  },
  acciones: {
    reservarAula: 'Reservar aula',
    guardarCambios: 'Guardar cambios',
    cancelarReserva: 'Cancelar reserva',
    aprobar: 'Aprobar',
    rechazar: 'Rechazar',
    editar: 'Editar',
    ver: 'Ver',
    cancelar: 'Cancelar',
    confirmar: 'Confirmar',
    reintentar: 'Reintentar',
    limpiarFiltros: 'Limpiar filtros',
    cerrar: 'Cerrar',
    ingresar: 'Ingresar',
    crearCuenta: 'Crear cuenta',
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    cargando: 'Procesando…'
  },
  login: {
    titulo: 'Reservas de aulas',
    subtitulo: 'Ingrese con su cuenta',
    correo: 'Correo electrónico',
    contrasena: 'Contraseña',
    ingresar: 'Ingresar',
    separadorO: 'o',
    sinCuenta: '¿No tiene cuenta?',
    crearCuenta: 'Crear cuenta'
  },
  registro: {
    titulo: 'Crear cuenta',
    subtitulo: 'Complete sus datos para registrarse',
    nombre: 'Nombre completo',
    correo: 'Correo electrónico',
    contrasena: 'Contraseña',
    confirmarContrasena: 'Confirmar contraseña',
    registrar: 'Crear cuenta',
    conCuenta: '¿Ya tiene cuenta?',
    ingresar: 'Ingresar'
  },
  reservas: {
    tituloAdmin: 'Reservas',
    tituloUsuario: 'Mis reservas',
    migasRaiz: 'Reservas',
    vacioTitulo: 'Sin reservas para mostrar',
    vacioDescripcion: 'No hay reservas para los filtros elegidos. Limpie los filtros o cree una reserva.',
    errorTitulo: 'Error al cargar las reservas',
    errorDescripcion: 'No se pudieron cargar las reservas. Revise la conexión e intente de nuevo.',
    creadaExito: 'Reserva creada.',
    actualizadaExito: 'Cambios guardados.',
    aprobadaExito: 'Reserva aprobada.',
    rechazadaExito: 'Reserva rechazada.',
    canceladaExito: 'Reserva cancelada.'
  },
  aulas: {
    errorCarga: 'No se pudieron cargar las aulas. Intente de nuevo.'
  },
  formulario: {
    tituloNueva: 'Nueva reserva',
    tituloEditar: 'Editar reserva',
    paso1: 'Fecha y aula',
    paso2: 'Franja horaria',
    paso3: 'Datos y confirmación',
    fecha: 'Fecha',
    aula: 'Aula',
    horaInicio: 'Hora de inicio',
    horaFin: 'Hora de fin',
    cantidadPersonas: 'Cantidad de personas',
    motivo: 'Motivo'
  },
  dialogos: {
    cancelarTitulo: 'Cancelar reserva',
    cancelarDescripcion: '¿Confirma que desea cancelar esta reserva? Esta acción no se puede deshacer.',
    rechazarTitulo: 'Rechazar solicitud',
    rechazarDescripcion: '¿Confirma que desea rechazar esta solicitud de reserva?',
    aprobarTitulo: 'Aprobar solicitud',
    aprobarDescripcion: '¿Confirma que desea aprobar esta solicitud de reserva?'
  },
  panel: {
    titulo: 'Panel',
    pendientesTitulo: 'Pendientes de aprobación',
    sinPendientes: 'No hay solicitudes pendientes de aprobación.',
    hoyTitulo: 'Hoy',
    sinReservasHoy: 'No hay reservas programadas para hoy.',
    totalesEstado: 'Totales por estado',
    aulasMasReservadas: 'Aulas más reservadas',
    errorCarga: 'No se pudo cargar el resumen administrativo. Intente de nuevo.'
  },
  noEncontrado: {
    titulo: 'Página no encontrada',
    descripcion: 'La dirección solicitada no existe o fue movida.',
    volver: 'Ir a Reservas'
  },
  ui: {
    tablaVaciaTitulo: 'Sin resultados',
    tablaVaciaDescripcion: 'No hay registros para mostrar.',
    tablaCargando: 'Cargando datos de la tabla',
    errorTitulo: 'No se pudo completar la carga',
    errorDescripcion: 'Revise la conexión e intente de nuevo.',
    cerrarNotificacion: 'Cerrar notificación',
    cerrarDialogo: 'Cerrar diálogo',
    campoObligatorio: 'Obligatorio'
  }
};

export default TEXTOS;

