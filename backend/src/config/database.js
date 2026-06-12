// src/config/database.js
import { Sequelize } from 'sequelize';

// Creamos la instancia de conexión indicando el motor (dialect) y la ubicación del archivo
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.NODE_ENV === 'test' ? ':memory:' : './database.sqlite',
  logging: false // Apagamos el logging de SQL para que no te llene la consola de texto cada vez que hacés una consulta
});

export default sequelize;