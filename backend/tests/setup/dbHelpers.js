import sequelize from '../../src/config/database.js';

export const limpiarBaseDeDatos = async () => {
  await sequelize.query(
    'TRUNCATE TABLE idempotency_keys, historial_aulas, historial_reservas, reservas, aulas, usuarios RESTART IDENTITY CASCADE;'
  );
};
