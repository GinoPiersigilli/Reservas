import app from './src/app.js';
import sequelize from './src/config/database.js';
import Aula from './src/models/aula.model.js';
import Reserva from './src/models/reserva.model.js';
import HistorialReserva from './src/models/historial.model.js';

const PORT = 3001;

// ID fijo para representar acciones del sistema en el historial
// (ya no hay usuarios locales, la auth la maneja Keycloak)
const SISTEMA_ID = 'sistema';

async function seedDatabase() {
  const cantidadAulas = await Aula.count();

  if (cantidadAulas > 0) {
    console.log('✅ La base de datos ya tiene información. Omitiendo la carga de semillas.');
    return;
  }

  console.log('Base de datos vacía. Cargando datos semilla...');

  // --- Aulas ---
  const [a1, a2, a3, a4, a5] = await Promise.all([
    Aula.create({ nombre: 'Aula 910',            ubicacion: 'Ed. Possetto - Piso 1',       capacidad: 45,  recursos: 'proyector,pizarra,aire acondicionado',  activa: true  }),
    Aula.create({ nombre: 'Laboratorio A6',      ubicacion: 'Ed. Possetto - Planta Baja',  capacidad: 30,  recursos: 'proyector,computadoras,parlantes',       activa: true  }),
    Aula.create({ nombre: 'Aula Magna',          ubicacion: 'Ed. Principal - Planta Baja', capacidad: 150, recursos: 'proyector,parlantes,micrófono,escenario', activa: true }),
    Aula.create({ nombre: 'A4',                  ubicacion: 'Ed. Principal - Piso 2',      capacidad: 60,  recursos: 'pizarra',                                activa: false }),
    Aula.create({ nombre: 'Sala de Reuniones B', ubicacion: 'Ed. Possetto - Piso 2',       capacidad: 15,  recursos: 'televisor,pizarra inteligente',           activa: true  })
  ]);

  // --- Reservas ---
  // usuarioId ahora es el sub de Keycloak (string UUID), usamos SISTEMA_ID como placeholder
  const reservas = await Promise.all([
    Reserva.create({ aulaId: a1.id, usuarioId: SISTEMA_ID, fecha: '2026-06-18', horaInicio: '09:00', horaFin: '11:00', cantidadPersonas: 40,  motivo: 'Clase de consulta - Análisis Matemático',               estado: 'aprobada',  createdAt: new Date('2026-06-05T08:15:00') }),
    Reserva.create({ aulaId: a3.id, usuarioId: SISTEMA_ID, fecha: '2026-06-20', horaInicio: '14:00', horaFin: '18:00', cantidadPersonas: 120, motivo: 'Primer Parcial - Sistemas de Representación',            estado: 'pendiente', createdAt: new Date('2026-06-06T10:20:00') }),
    Reserva.create({ aulaId: a2.id, usuarioId: SISTEMA_ID, fecha: '2026-06-22', horaInicio: '10:00', horaFin: '12:00', cantidadPersonas: 20,  motivo: 'Taller introductorio de Git y GitLab',                   estado: 'cancelada', createdAt: new Date('2026-06-07T09:00:00') }),
    Reserva.create({ aulaId: a5.id, usuarioId: SISTEMA_ID, fecha: '2026-06-15', horaInicio: '08:00', horaFin: '10:00', cantidadPersonas: 12,  motivo: 'Reunión de grupo de estudio',                            estado: 'rechazada', createdAt: new Date('2026-06-07T11:45:00') }),
    Reserva.create({ aulaId: a2.id, usuarioId: SISTEMA_ID, fecha: '2026-06-25', horaInicio: '16:00', horaFin: '18:00', cantidadPersonas: 25,  motivo: 'Clase teórica - Bases de Datos',                         estado: 'aprobada',  createdAt: new Date('2026-06-08T14:10:00') }),
    Reserva.create({ aulaId: a1.id, usuarioId: SISTEMA_ID, fecha: '2026-06-26', horaInicio: '18:00', horaFin: '20:30', cantidadPersonas: 35,  motivo: 'Preparación para el final de Probabilidad y Estadística', estado: 'pendiente', createdAt: new Date('2026-06-08T16:30:00') }),
    Reserva.create({ aulaId: a5.id, usuarioId: SISTEMA_ID, fecha: '2026-06-28', horaInicio: '11:00', horaFin: '13:00', cantidadPersonas: 10,  motivo: 'Defensa de Proyecto Final',                              estado: 'aprobada',  createdAt: new Date('2026-06-09T08:00:00') }),
    Reserva.create({ aulaId: a3.id, usuarioId: SISTEMA_ID, fecha: '2026-06-29', horaInicio: '08:00', horaFin: '12:00', cantidadPersonas: 100, motivo: 'Charla abierta sobre cultura DevOps',                    estado: 'cancelada', createdAt: new Date('2026-06-09T09:15:00') }),
    Reserva.create({ aulaId: a4.id, usuarioId: SISTEMA_ID, fecha: '2026-06-30', horaInicio: '15:00', horaFin: '17:00', cantidadPersonas: 40,  motivo: 'Clase especial de recuperación',                         estado: 'rechazada', createdAt: new Date('2026-06-09T10:05:00') }),
    Reserva.create({ aulaId: a1.id, usuarioId: SISTEMA_ID, fecha: '2026-06-18', horaInicio: '14:00', horaFin: '16:00', cantidadPersonas: 40,  motivo: 'Simulacro de parcial',                                   estado: 'aprobada',  createdAt: new Date('2026-06-09T11:30:00') }),
  ]);

  // --- Historial ---
  await HistorialReserva.bulkCreate([
    { reservaId: reservas[0].id, usuarioId: SISTEMA_ID, accion: 'creacion',    fechaHora: new Date('2026-06-05T08:15:00'), valorAnterior: null,                   valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[0].id, usuarioId: SISTEMA_ID, accion: 'aprobacion',  fechaHora: new Date('2026-06-05T10:00:00'), valorAnterior: { estado: 'pendiente' }, valorNuevo: { estado: 'aprobada'  } },
    { reservaId: reservas[1].id, usuarioId: SISTEMA_ID, accion: 'creacion',    fechaHora: new Date('2026-06-06T10:20:00'), valorAnterior: null,                   valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[2].id, usuarioId: SISTEMA_ID, accion: 'creacion',    fechaHora: new Date('2026-06-07T09:00:00'), valorAnterior: null,                   valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[2].id, usuarioId: SISTEMA_ID, accion: 'cancelacion', fechaHora: new Date('2026-06-07T14:30:00'), valorAnterior: { estado: 'pendiente' }, valorNuevo: { estado: 'cancelada' } },
    { reservaId: reservas[3].id, usuarioId: SISTEMA_ID, accion: 'creacion',    fechaHora: new Date('2026-06-07T11:45:00'), valorAnterior: null,                   valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[3].id, usuarioId: SISTEMA_ID, accion: 'rechazo',     fechaHora: new Date('2026-06-08T09:00:00'), valorAnterior: { estado: 'pendiente' }, valorNuevo: { estado: 'rechazada' } },
    { reservaId: reservas[4].id, usuarioId: SISTEMA_ID, accion: 'creacion',    fechaHora: new Date('2026-06-08T14:10:00'), valorAnterior: null,                   valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[4].id, usuarioId: SISTEMA_ID, accion: 'aprobacion',  fechaHora: new Date('2026-06-08T15:00:00'), valorAnterior: { estado: 'pendiente' }, valorNuevo: { estado: 'aprobada'  } },
    { reservaId: reservas[5].id, usuarioId: SISTEMA_ID, accion: 'creacion',    fechaHora: new Date('2026-06-08T16:30:00'), valorAnterior: null,                   valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[6].id, usuarioId: SISTEMA_ID, accion: 'creacion',    fechaHora: new Date('2026-06-09T08:00:00'), valorAnterior: null,                   valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[6].id, usuarioId: SISTEMA_ID, accion: 'aprobacion',  fechaHora: new Date('2026-06-09T08:30:00'), valorAnterior: { estado: 'pendiente' }, valorNuevo: { estado: 'aprobada'  } },
    { reservaId: reservas[7].id, usuarioId: SISTEMA_ID, accion: 'creacion',    fechaHora: new Date('2026-06-09T09:15:00'), valorAnterior: null,                   valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[8].id, usuarioId: SISTEMA_ID, accion: 'creacion',    fechaHora: new Date('2026-06-09T10:05:00'), valorAnterior: null,                   valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[9].id, usuarioId: SISTEMA_ID, accion: 'creacion',    fechaHora: new Date('2026-06-09T11:30:00'), valorAnterior: null,                   valorNuevo: { estado: 'pendiente' } },
  ]);

  console.log('✅ Datos de prueba cargados correctamente.');
  console.log('   Usuarios: gestionados por Keycloak (http://localhost:8081)');
}

if (process.env.NODE_ENV !== 'test') {
  sequelize.sync()
    .then(async () => {
      console.log('Tablas creadas y base de datos sincronizada correctamente.');
      await seedDatabase();
      app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Error al conectar con la base de datos:', error);
    });
}

export default app;