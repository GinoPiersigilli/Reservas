import app from './src/app.js';
import sequelize from './src/config/database.js';
import bcrypt from 'bcrypt';
import Usuario from './src/models/usuario.model.js';
import Aula from './src/models/aula.model.js';
import Reserva from './src/models/reserva.model.js';
import HistorialReserva from './src/models/historial.model.js';

const PORT = process.env.PORT || 3000;

async function seedDatabase() {
  const cantidadUsuarios = await Usuario.count();
  if (cantidadUsuarios > 0) {
    console.log('✅ La base de datos ya tiene información. Omitiendo la carga de semillas.');
    return;
  }

  console.log('Base de datos vacía. Cargando datos semilla...');

  const [admin, david, laura] = await Promise.all([
    Usuario.create({
      nombre: 'Administrador Bedelía',
      email: 'admin@utnfrc.edu.ar',
      passwordHash: await bcrypt.hash('admin123', 10),
      rol: 'admin',
      activo: true
    }),
    Usuario.create({
      nombre: 'David Ismael López Rodriguez',
      email: 'david@utnfrc.edu.ar',
      passwordHash: await bcrypt.hash('user123', 10),
      rol: 'usuario',
      activo: true
    }),
    Usuario.create({
      nombre: 'Laura Gómez',
      email: 'laura@utnfrc.edu.ar',
      passwordHash: await bcrypt.hash('user123', 10),
      rol: 'usuario',
      activo: true
    })
  ]);

  const [a1, a2, a3, a4, a5] = await Promise.all([
    Aula.create({ nombre: 'Aula 910',         ubicacion: 'Ed. Possetto - Piso 1',          capacidad: 45,  recursos: 'proyector,pizarra,aire acondicionado', activa: true  }),
    Aula.create({ nombre: 'Laboratorio A6',   ubicacion: 'Ed. Possetto - Planta Baja',     capacidad: 30,  recursos: 'proyector,computadoras,parlantes',      activa: true  }),
    Aula.create({ nombre: 'Aula Magna',       ubicacion: 'Ed. Principal - Planta Baja',    capacidad: 150, recursos: 'proyector,parlantes,micrófono,escenario', activa: true }),
    Aula.create({ nombre: 'A4',               ubicacion: 'Ed. Principal - Piso 2',         capacidad: 60,  recursos: 'pizarra',                               activa: false }),
    Aula.create({ nombre: 'Sala de Reuniones B', ubicacion: 'Ed. Possetto - Piso 2',       capacidad: 15,  recursos: 'televisor,pizarra inteligente',          activa: true  })
  ]);

  const reservas = await Promise.all([
    Reserva.create({ aulaId: a1.id, usuarioId: admin.id,  fecha: '2026-06-18', horaInicio: '09:00', horaFin: '11:00', cantidadPersonas: 40,  motivo: 'Clase de consulta - Análisis Matemático',              estado: 'aprobada',  createdAt: new Date('2026-06-05T08:15:00') }),
    Reserva.create({ aulaId: a1.id, usuarioId: david.id,  fecha: '2026-06-18', horaInicio: '12:00', horaFin: '14:00', cantidadPersonas: 20,  motivo: 'Trabajo práctico de Base de Datos',                     estado: 'pendiente', createdAt: new Date('2026-06-06T10:20:00') }),
    Reserva.create({ aulaId: a2.id, usuarioId: admin.id,  fecha: '2026-06-22', horaInicio: '10:00', horaFin: '12:00', cantidadPersonas: 10,  motivo: 'Taller introductorio de Git y GitLab',                  estado: 'cancelada', createdAt: new Date('2026-06-07T09:00:00') })
  ]);

  await HistorialReserva.bulkCreate([
    { reservaId: reservas[0].id, usuarioId: admin.id, accion: 'creacion',   fechaHora: new Date('2026-06-05T08:15:00'), valorAnterior: null,                    valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[0].id, usuarioId: admin.id, accion: 'aprobacion', fechaHora: new Date('2026-06-05T10:00:00'), valorAnterior: { estado: 'pendiente' },   valorNuevo: { estado: 'aprobada'  } },
    { reservaId: reservas[1].id, usuarioId: david.id, accion: 'creacion',   fechaHora: new Date('2026-06-06T10:20:00'), valorAnterior: null,                    valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[2].id, usuarioId: admin.id, accion: 'creacion',   fechaHora: new Date('2026-06-07T09:00:00'), valorAnterior: null,                    valorNuevo: { estado: 'pendiente' } },
    { reservaId: reservas[2].id, usuarioId: admin.id, accion: 'cancelacion',fechaHora: new Date('2026-06-07T14:30:00'), valorAnterior: { estado: 'pendiente' },   valorNuevo: { estado: 'cancelada' } }
  ]);

  console.log('✅ Datos de prueba cargados correctamente.');
  console.log('   admin@utnfrc.edu.ar  →  admin123');
  console.log('   david@utnfrc.edu.ar  →  user123');
  console.log('   laura@utnfrc.edu.ar  →  user123');
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
