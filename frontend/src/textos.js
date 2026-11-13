/**
 * Textos centralizados de la interfaz, en español neutro formal.
 * Reglas:
 * - Mayúscula solo al inicio de la oración o en nombres propios.
 * - Verbos en infinitivo en botones de acción ("Reservar aula", "Guardar cambios", "Cancelar reserva").
 * - Trato formal neutro ("Ingrese", "Elija", "Intente").
 * - Sin emojis ni flechas de texto.
 */

export const TEXTOS = {
  app: {
    titulo: 'Reservas de aulas'
  },
  navegacion: {
    reservasAdmin: 'Reservas',
    nuevaReserva: 'Nueva reserva',
    panel: 'Panel',
    aulas: 'Aulas',
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
    cancelada: 'Cancelada',
    activa: 'Activa',
    inactiva: 'Inactiva'
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
    continuarGoogle: 'Continuar con Google',
    errorGoogle: 'No se pudo iniciar sesión con Google. Intente nuevamente.',
    noCompletadoGoogle: 'No se completó el ingreso con Google. Intente de nuevo.',
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
    registrarseGoogle: 'Registrarse con Google',
    errorGoogle: 'No se pudo completar el registro con Google. Intente nuevamente.',
    noCompletadoGoogle: 'No se completó el ingreso con Google. Intente de nuevo.',
    conCuenta: '¿Ya tiene cuenta?',
    ingresar: 'Ingresar'
  },
  reservas: {
    tituloAdmin: 'Reservas',
    tituloUsuario: 'Mis reservas',
    migasRaiz: 'Reservas',
    vacioTitulo: 'Sin reservas para mostrar',
    vacioDescripcion:
      'No hay reservas para los filtros elegidos. Limpie los filtros o cree una reserva.',
    errorTitulo: 'Error al cargar las reservas',
    errorDescripcion: 'No se pudieron cargar las reservas. Revise la conexión e intente de nuevo.',
    creadaExito: 'Reserva creada.',
    aprobadaExito: 'Reserva aprobada.',
    rechazadaExito: 'Reserva rechazada.',
    canceladaExito: 'Reserva cancelada.'
  },
  aulas: {
    titulo: 'Aulas',
    subtitulo: 'Administración de aulas y disponibilidad de espacios físicos.',
    nuevaAula: 'Nueva aula',
    editarAula: 'Editar aula',
    nombre: 'Nombre',
    ubicacion: 'Ubicación',
    capacidad: 'Capacidad',
    recursos: 'Recursos',
    estado: 'Estado',
    acciones: 'Acciones',
    filtroTodas: 'Todas',
    filtroActivas: 'Activas',
    filtroInactivas: 'Inactivas',
    sinRecursos: 'Sin recursos especificados',
    desactivar: 'Desactivar',
    reactivar: 'Reactivar',
    creadaExito: 'Aula creada.',
    actualizadaExito: 'Cambios guardados.',
    desactivadaExito: 'Aula desactivada.',
    reactivadaExito: 'Aula reactivada.',
    vacioTitulo: 'Sin aulas para mostrar',
    vacioDescripcion: 'No se encontraron aulas con el filtro seleccionado.',
    errorCarga: 'No se pudieron cargar las aulas. Intente de nuevo.',
    confirmarDesactivarTitulo: 'Desactivar aula',
    confirmarDesactivarDescripcion:
      '¿Confirma que desea desactivar esta aula? No estará disponible para nuevas reservas.',
    avisoReservasFuturas: 'El aula tiene {cantidad} reserva(s) futura(s) activa(s).',
    cancelarReservasFuturas: 'Cancelar las reservas futuras',
    motivoBaja: 'Motivo de la baja',
    motivoRequerido: 'Ingrese un motivo para la baja del aula.',
    confirmarReactivarTitulo: 'Reactivar aula',
    confirmarReactivarDescripcion:
      '¿Confirma que desea reactivar esta aula para recibir nuevas reservas?'
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
    cancelarDescripcion:
      '¿Confirma que desea cancelar esta reserva? Esta acción no se puede deshacer.',
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
    cerrarNotificacion: 'Cerrar notificación'
  },
  tema: {
    cambiarOscuro: 'Cambiar a modo oscuro',
    cambiarClaro: 'Cambiar a modo claro'
  }
};

export default TEXTOS;
