'use strict';

const bcrypt = require('bcrypt');

function fechaRelativa(diasOffset) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  const fecha = new Date(Date.UTC(Number(mapa.year), Number(mapa.month) - 1, Number(mapa.day)));
  fecha.setUTCDate(fecha.getUTCDate() + diasOffset);
  const yyyy = fecha.getUTCFullYear();
  const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [existingReservas] = await queryInterface.sequelize.query(
        'SELECT COUNT(*)::int AS count FROM reservas;',
        { transaction }
      );
      if (existingReservas[0].count > 0) {
        return;
      }

      const now = new Date();
      const hashAdmin = await bcrypt.hash('admin123', 10);
      const hashDavid = await bcrypt.hash('user123', 10);
      const hashLaura = await bcrypt.hash('usuario123', 10);
      const hashPedro = await bcrypt.hash('usuario456', 10);

      const usuariosSeed = [
        {
          nombre: 'Sistema',
          email: 'sistema@utnfrc.edu.ar',
          passwordHash: null,
          clerkId: null,
          rol: 'admin',
          activo: false,
          createdAt: now
        },
        {
          nombre: 'Administrador Bedelía',
          email: 'admin@utnfrc.edu.ar',
          passwordHash: hashAdmin,
          clerkId: null,
          rol: 'admin',
          activo: true,
          createdAt: now
        },
        {
          nombre: 'David López',
          email: 'david@utnfrc.edu.ar',
          passwordHash: hashDavid,
          clerkId: null,
          rol: 'usuario',
          activo: true,
          createdAt: now
        },
        {
          nombre: 'Laura Pérez',
          email: 'laura.perez@dds.edu.ar',
          passwordHash: hashLaura,
          clerkId: null,
          rol: 'usuario',
          activo: true,
          createdAt: now
        },
        {
          nombre: 'Pedro Gómez',
          email: 'pedro.gomez@dds.edu.ar',
          passwordHash: hashPedro,
          clerkId: null,
          rol: 'usuario',
          activo: true,
          createdAt: now
        }
      ];

      for (const u of usuariosSeed) {
        await queryInterface.sequelize.query(
          `INSERT INTO usuarios (nombre, email, "passwordHash", "clerkId", rol, activo, "createdAt")
           VALUES (:nombre, :email, :passwordHash, :clerkId, :rol, :activo, :createdAt)
           ON CONFLICT (email) DO NOTHING;`,
          { replacements: u, transaction }
        );
      }

      const [usuariosRows] = await queryInterface.sequelize.query(
        'SELECT id, email FROM usuarios;',
        { transaction }
      );
      const userByEmail = Object.fromEntries(usuariosRows.map((u) => [u.email, u.id]));

      const sistemaId = userByEmail['sistema@utnfrc.edu.ar'];
      const adminId = userByEmail['admin@utnfrc.edu.ar'];
      const davidId = userByEmail['david@utnfrc.edu.ar'];
      const lauraId = userByEmail['laura.perez@dds.edu.ar'];
      const pedroId = userByEmail['pedro.gomez@dds.edu.ar'];

      const [existingAulas] = await queryInterface.sequelize.query(
        'SELECT id, nombre FROM aulas;',
        { transaction }
      );

      if (existingAulas.length === 0) {
        await queryInterface.bulkInsert('aulas', [
          { nombre: 'Aula 910',            ubicacion: 'Ed. Possetto - Piso 1',       capacidad: 45,  recursos: 'proyector,pizarra,aire acondicionado',   activa: true  },
          { nombre: 'Laboratorio A6',      ubicacion: 'Ed. Possetto - Planta Baja',  capacidad: 30,  recursos: 'proyector,computadoras,parlantes',        activa: true  },
          { nombre: 'Aula Magna',          ubicacion: 'Ed. Principal - Planta Baja', capacidad: 150, recursos: 'proyector,parlantes,micrófono,escenario',  activa: true  },
          { nombre: 'A4',                  ubicacion: 'Ed. Principal - Piso 2',      capacidad: 60,  recursos: 'pizarra',                                 activa: false },
          { nombre: 'Sala de Reuniones B', ubicacion: 'Ed. Possetto - Piso 2',       capacidad: 15,  recursos: 'televisor,pizarra inteligente',            activa: true  }
        ], { transaction });
      }

      const [aulasRows] = await queryInterface.sequelize.query(
        'SELECT id, nombre FROM aulas ORDER BY id ASC;',
        { transaction }
      );
      const aulaByNombre = Object.fromEntries(aulasRows.map((a) => [a.nombre, a.id]));

      const a1 = aulaByNombre['Aula 910'];
      const a2 = aulaByNombre['Laboratorio A6'];
      const a3 = aulaByNombre['Aula Magna'];
      const a4 = aulaByNombre['A4'];
      const a5 = aulaByNombre['Sala de Reuniones B'];

      const reservasData = [
        { aulaId: a1, usuarioId: lauraId,   fecha: fechaRelativa(0),  horaInicio: '09:00', horaFin: '11:00', cantidadPersonas: 40,  motivo: 'Clase de consulta - Análisis Matemático',                estado: 'aprobada',  createdAt: now, updatedAt: now },
        { aulaId: a3, usuarioId: pedroId,   fecha: fechaRelativa(1),  horaInicio: '14:00', horaFin: '18:00', cantidadPersonas: 120, motivo: 'Primer Parcial - Sistemas de Representación',             estado: 'pendiente', createdAt: now, updatedAt: now },
        { aulaId: a2, usuarioId: lauraId,   fecha: fechaRelativa(2),  horaInicio: '10:00', horaFin: '12:00', cantidadPersonas: 20,  motivo: 'Taller introductorio de Git y GitLab',                    estado: 'cancelada', createdAt: now, updatedAt: now },
        { aulaId: a5, usuarioId: pedroId,   fecha: fechaRelativa(-2), horaInicio: '08:00', horaFin: '10:00', cantidadPersonas: 12,  motivo: 'Reunión de grupo de estudio',                             estado: 'rechazada', createdAt: now, updatedAt: now },
        { aulaId: a2, usuarioId: adminId,   fecha: fechaRelativa(3),  horaInicio: '16:00', horaFin: '18:00', cantidadPersonas: 25,  motivo: 'Clase teórica - Bases de Datos',                          estado: 'aprobada',  createdAt: now, updatedAt: now },
        { aulaId: a1, usuarioId: davidId,   fecha: fechaRelativa(4),  horaInicio: '18:00', horaFin: '20:30', cantidadPersonas: 35,  motivo: 'Preparación para el final de Probabilidad y Estadística',  estado: 'pendiente', createdAt: now, updatedAt: now },
        { aulaId: a5, usuarioId: davidId,   fecha: fechaRelativa(5),  horaInicio: '11:00', horaFin: '13:00', cantidadPersonas: 10,  motivo: 'Defensa de Proyecto Final',                               estado: 'aprobada',  createdAt: now, updatedAt: now },
        { aulaId: a3, usuarioId: sistemaId, fecha: fechaRelativa(6),  horaInicio: '08:00', horaFin: '12:00', cantidadPersonas: 100, motivo: 'Charla abierta sobre cultura DevOps',                     estado: 'cancelada', createdAt: now, updatedAt: now },
        { aulaId: a4, usuarioId: sistemaId, fecha: fechaRelativa(-1), horaInicio: '15:00', horaFin: '17:00', cantidadPersonas: 40,  motivo: 'Clase especial de recuperación',                          estado: 'rechazada', createdAt: now, updatedAt: now },
        { aulaId: a1, usuarioId: davidId,   fecha: fechaRelativa(0),  horaInicio: '14:00', horaFin: '16:00', cantidadPersonas: 40,  motivo: 'Simulacro de parcial',                                    estado: 'aprobada',  createdAt: now, updatedAt: now }
      ];

      const insertedReservas = await queryInterface.bulkInsert('reservas', reservasData, {
        returning: ['id', 'usuarioId', 'estado'],
        transaction
      });

      const historialEntries = [];
      for (const r of insertedReservas) {
        historialEntries.push({
          reservaId: r.id,
          usuarioId: r.usuarioId,
          accion: 'creacion',
          fechaHora: now,
          valorAnterior: null,
          valorNuevo: JSON.stringify({ estado: 'pendiente' })
        });

        if (r.estado === 'aprobada') {
          historialEntries.push({
            reservaId: r.id,
            usuarioId: adminId,
            accion: 'aprobacion',
            fechaHora: new Date(now.getTime() + 60000),
            valorAnterior: JSON.stringify({ estado: 'pendiente' }),
            valorNuevo: JSON.stringify({ estado: 'aprobada' })
          });
        } else if (r.estado === 'cancelada') {
          historialEntries.push({
            reservaId: r.id,
            usuarioId: r.usuarioId,
            accion: 'cancelacion',
            fechaHora: new Date(now.getTime() + 60000),
            valorAnterior: JSON.stringify({ estado: 'pendiente' }),
            valorNuevo: JSON.stringify({ estado: 'cancelada' })
          });
        } else if (r.estado === 'rechazada') {
          historialEntries.push({
            reservaId: r.id,
            usuarioId: adminId,
            accion: 'rechazo',
            fechaHora: new Date(now.getTime() + 60000),
            valorAnterior: JSON.stringify({ estado: 'pendiente' }),
            valorNuevo: JSON.stringify({ estado: 'rechazada' })
          });
        }
      }

      for (const h of historialEntries) {
        await queryInterface.sequelize.query(
          `INSERT INTO historial_reservas ("reservaId", "usuarioId", accion, "fechaHora", "valorAnterior", "valorNuevo")
           VALUES (:reservaId, :usuarioId, :accion, :fechaHora, :valorAnterior::jsonb, :valorNuevo::jsonb);`,
          { replacements: h, transaction }
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete('historial_reservas', null, { transaction });
      await queryInterface.bulkDelete('reservas', null, { transaction });
      await queryInterface.bulkDelete('aulas', null, { transaction });
      await queryInterface.bulkDelete('usuarios', null, { transaction });
    });
  }
};
