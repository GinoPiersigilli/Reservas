'use strict';

/**
 * Hace `historial_reservas` append-only, como ya lo era `historial_aulas`.
 *
 * El ADR 0004 declaraba que las dos tablas de historial estaban protegidas por
 * un disparador `BEFORE UPDATE OR DELETE`, pero la migración `003` solo creó el
 * de `historial_aulas`. La tabla que faltaba es la de la entidad central: la
 * que registra quién aprobó, rechazó o canceló cada reserva y la que el detalle
 * muestra en pantalla. Cualquier `UPDATE` o `DELETE` —un bug, un script de
 * mantenimiento, una consola SQL— podía reescribirla sin dejar rastro.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        CREATE OR REPLACE FUNCTION impedir_modificacion_historial_reservas()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'historial_reservas es append-only: no se permite UPDATE ni DELETE';
        END;
        $$ LANGUAGE plpgsql;
      `,
        { transaction }
      );

      // DROP previo para que la migración sea reejecutable sobre una base que
      // ya la haya corrido a medias.
      await queryInterface.sequelize.query(
        `
        DROP TRIGGER IF EXISTS trg_historial_reservas_inmutable ON historial_reservas;
      `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        CREATE TRIGGER trg_historial_reservas_inmutable
        BEFORE UPDATE OR DELETE ON historial_reservas
        FOR EACH ROW EXECUTE FUNCTION impedir_modificacion_historial_reservas();
      `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        DROP TRIGGER IF EXISTS trg_historial_reservas_inmutable ON historial_reservas;
      `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        DROP FUNCTION IF EXISTS impedir_modificacion_historial_reservas();
      `,
        { transaction }
      );
    });
  }
};
