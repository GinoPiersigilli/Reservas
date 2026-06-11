// src/config/database.js
import { Sequelize } from 'sequelize';

// Creamos la instancia de conexión indicando el motor (dialect) y la ubicación del archivo
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite', // Este archivo se va a crear solo en la carpeta de tu backend
  logging: false // Apagamos el logging de SQL para que no te llene la consola de texto cada vez que hacés una consulta
});

export default sequelize;