'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // 1. Índice único insensible a mayúsculas sobre nombre de aula
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX aulas_nombre_lower_idx ON aulas (LOWER(nombre));
      `, { transaction });

      // 2. Capacidad en rango 1 a 1000 y longitud máxima de ubicación en aulas
      await queryInterface.sequelize.query(`
        ALTER TABLE aulas
        DROP CONSTRAINT IF EXISTS aulas_capacidad_check;
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE aulas
        ADD CONSTRAINT aulas_capacidad_check
        CHECK (capacidad >= 1 AND capacidad <= 1000);
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE aulas
        ALTER COLUMN ubicacion TYPE VARCHAR(120);
      `, { transaction });

      // 3. Crear tabla historial_aulas con FK RESTRICT
      await queryInterface.createTable('historial_aulas', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        aulaId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'aulas',
            key: 'id'
          },
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE'
        },
        usuarioId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'usuarios',
            key: 'id'
          },
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE'
        },
        accion: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        valorAnterior: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        valorNuevo: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        fechaHora: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE historial_aulas
        ADD CONSTRAINT historial_aulas_accion_check
        CHECK (accion IN ('creacion', 'edicion', 'desactivacion', 'reactivacion'));
      `, { transaction });

      await queryInterface.addIndex('historial_aulas', ['aulaId', 'fechaHora'], {
        name: 'historial_aulas_aula_id_fecha_hora_idx',
        transaction
      });

      // 4. Trigger append-only para historial_aulas (rechaza UPDATE y DELETE)
      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION impedir_modificacion_historial_aulas()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'historial_aulas es append-only: no se permite UPDATE ni DELETE';
        END;
        $$ LANGUAGE plpgsql;
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE TRIGGER trg_historial_aulas_inmutable
        BEFORE UPDATE OR DELETE ON historial_aulas
        FOR EACH ROW EXECUTE FUNCTION impedir_modificacion_historial_aulas();
      `, { transaction });

      // 5. Permitir 'cancelada' además de 'cancelacion' en historial_reservas
      await queryInterface.sequelize.query(`
        ALTER TABLE historial_reservas
        DROP CONSTRAINT IF EXISTS historial_reservas_accion_check;
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE historial_reservas
        ADD CONSTRAINT historial_reservas_accion_check
        CHECK (accion IN ('creacion', 'edicion', 'aprobacion', 'rechazo', 'cancelacion', 'cancelada'));
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // 5. Revertir constraint en historial_reservas
      await queryInterface.sequelize.query(`
        ALTER TABLE historial_reservas
        DROP CONSTRAINT IF EXISTS historial_reservas_accion_check;
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE historial_reservas
        ADD CONSTRAINT historial_reservas_accion_check
        CHECK (accion IN ('creacion', 'edicion', 'aprobacion', 'rechazo', 'cancelacion'));
      `, { transaction });

      // 4. Eliminar trigger y función de historial_aulas
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS trg_historial_aulas_inmutable ON historial_aulas;
      `, { transaction });

      await queryInterface.sequelize.query(`
        DROP FUNCTION IF EXISTS impedir_modificacion_historial_aulas();
      `, { transaction });

      // 3. Eliminar tabla historial_aulas
      await queryInterface.dropTable('historial_aulas', { transaction });

      // 2. Revertir capacidad y ubicación en aulas
      await queryInterface.sequelize.query(`
        ALTER TABLE aulas
        DROP CONSTRAINT IF EXISTS aulas_capacidad_check;
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE aulas
        ADD CONSTRAINT aulas_capacidad_check
        CHECK (capacidad > 0);
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE aulas
        ALTER COLUMN ubicacion TYPE VARCHAR(255);
      `, { transaction });

      // 1. Eliminar índice de nombre único en aulas
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS aulas_nombre_lower_idx;
      `, { transaction });
    });
  }
};
