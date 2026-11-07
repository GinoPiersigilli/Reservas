'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist;', { transaction });

      // --- 1. Tabla usuarios ---
      await queryInterface.addColumn('usuarios', 'clerkId', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      }, { transaction });

      await queryInterface.changeColumn('usuarios', 'passwordHash', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('usuarios', 'createdAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE usuarios
        ADD CONSTRAINT usuarios_rol_check
        CHECK (rol IN ('usuario', 'admin'));
      `, { transaction });

      // --- 2. Tabla aulas ---
      await queryInterface.sequelize.query(`
        ALTER TABLE aulas
        ADD CONSTRAINT aulas_capacidad_check
        CHECK (capacidad > 0);
      `, { transaction });

      // --- 3. Tabla reservas ---
      await queryInterface.sequelize.query(`
        ALTER TABLE reservas
        ALTER COLUMN "fecha" TYPE DATE USING "fecha"::date,
        ALTER COLUMN "horaInicio" TYPE TIME USING "horaInicio"::time,
        ALTER COLUMN "horaFin" TYPE TIME USING "horaFin"::time;
      `, { transaction });

      await queryInterface.addColumn('reservas', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }, { transaction });

      await queryInterface.addConstraint('reservas', {
        fields: ['aulaId'],
        type: 'foreign key',
        name: 'reservas_aulaId_fkey',
        references: {
          table: 'aulas',
          field: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
        transaction
      });

      await queryInterface.addConstraint('reservas', {
        fields: ['usuarioId'],
        type: 'foreign key',
        name: 'reservas_usuarioId_fkey',
        references: {
          table: 'usuarios',
          field: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
        transaction
      });

      await queryInterface.sequelize.query(`
        ALTER TABLE reservas
        ADD CONSTRAINT reservas_horario_valido_check
        CHECK ("horaInicio" < "horaFin");
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE reservas
        ADD CONSTRAINT reservas_cantidad_personas_check
        CHECK ("cantidadPersonas" > 0);
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE reservas
        ADD CONSTRAINT reservas_estado_check
        CHECK (estado IN ('pendiente', 'aprobada', 'cancelada', 'rechazada'));
      `, { transaction });

      await queryInterface.addIndex('reservas', ['usuarioId'], {
        name: 'reservas_usuario_id_idx',
        transaction
      });

      await queryInterface.addIndex('reservas', ['fecha'], {
        name: 'reservas_fecha_idx',
        transaction
      });

      await queryInterface.addIndex('reservas', ['estado'], {
        name: 'reservas_estado_idx',
        transaction
      });

      await queryInterface.sequelize.query(`
        ALTER TABLE reservas
        ADD CONSTRAINT reservas_sin_solapamiento
        EXCLUDE USING gist (
          "aulaId" WITH =,
          tsrange(("fecha" + "horaInicio"), ("fecha" + "horaFin"), '[)') WITH &&
        ) WHERE (estado IN ('pendiente', 'aprobada'));
      `, { transaction });

      // --- 4. Tabla historial_reservas ---
      await queryInterface.addConstraint('historial_reservas', {
        fields: ['reservaId'],
        type: 'foreign key',
        name: 'historial_reservas_reservaId_fkey',
        references: {
          table: 'reservas',
          field: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
        transaction
      });

      await queryInterface.addConstraint('historial_reservas', {
        fields: ['usuarioId'],
        type: 'foreign key',
        name: 'historial_reservas_usuarioId_fkey',
        references: {
          table: 'usuarios',
          field: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
        transaction
      });

      await queryInterface.sequelize.query(`
        ALTER TABLE historial_reservas
        ALTER COLUMN "valorAnterior" TYPE JSONB USING "valorAnterior"::jsonb,
        ALTER COLUMN "valorNuevo" TYPE JSONB USING "valorNuevo"::jsonb;
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE historial_reservas
        ADD CONSTRAINT historial_reservas_accion_check
        CHECK (accion IN ('creacion', 'edicion', 'aprobacion', 'rechazo', 'cancelacion'));
      `, { transaction });

      await queryInterface.addIndex('historial_reservas', ['reservaId', 'fechaHora'], {
        name: 'historial_reservas_reserva_id_fecha_hora_idx',
        transaction
      });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // --- 4. Revertir historial_reservas ---
      await queryInterface.removeIndex('historial_reservas', 'historial_reservas_reserva_id_fecha_hora_idx', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE historial_reservas DROP CONSTRAINT IF EXISTS historial_reservas_accion_check;', { transaction });
      await queryInterface.sequelize.query(`
        ALTER TABLE historial_reservas
        ALTER COLUMN "valorAnterior" TYPE JSON USING "valorAnterior"::json,
        ALTER COLUMN "valorNuevo" TYPE JSON USING "valorNuevo"::json;
      `, { transaction });
      await queryInterface.removeConstraint('historial_reservas', 'historial_reservas_usuarioId_fkey', { transaction });
      await queryInterface.removeConstraint('historial_reservas', 'historial_reservas_reservaId_fkey', { transaction });

      // --- 3. Revertir reservas ---
      await queryInterface.sequelize.query('ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_sin_solapamiento;', { transaction });
      await queryInterface.removeIndex('reservas', 'reservas_estado_idx', { transaction });
      await queryInterface.removeIndex('reservas', 'reservas_fecha_idx', { transaction });
      await queryInterface.removeIndex('reservas', 'reservas_usuario_id_idx', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_estado_check;', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_cantidad_personas_check;', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_horario_valido_check;', { transaction });
      await queryInterface.removeConstraint('reservas', 'reservas_usuarioId_fkey', { transaction });
      await queryInterface.removeConstraint('reservas', 'reservas_aulaId_fkey', { transaction });
      await queryInterface.removeColumn('reservas', 'updatedAt', { transaction });
      await queryInterface.sequelize.query(`
        ALTER TABLE reservas
        ALTER COLUMN "horaInicio" TYPE VARCHAR(255) USING to_char("horaInicio", 'HH24:MI'),
        ALTER COLUMN "horaFin" TYPE VARCHAR(255) USING to_char("horaFin", 'HH24:MI');
      `, { transaction });

      // --- 2. Revertir aulas ---
      await queryInterface.sequelize.query('ALTER TABLE aulas DROP CONSTRAINT IF EXISTS aulas_capacidad_check;', { transaction });

      // --- 1. Revertir usuarios ---
      await queryInterface.sequelize.query('ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;', { transaction });
      await queryInterface.removeColumn('usuarios', 'createdAt', { transaction });
      await queryInterface.sequelize.query(
        'UPDATE usuarios SET "passwordHash" = \'\' WHERE "passwordHash" IS NULL;',
        { transaction }
      );
      await queryInterface.changeColumn('usuarios', 'passwordHash', {
        type: Sequelize.STRING,
        allowNull: false
      }, { transaction });
      await queryInterface.removeColumn('usuarios', 'clerkId', { transaction });

      await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS btree_gist;', { transaction });
    });
  }
};
