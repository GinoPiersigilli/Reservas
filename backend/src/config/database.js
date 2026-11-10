// src/config/database.js
import { Sequelize } from 'sequelize';
import env from './env.js';

const databaseUrl = env.NODE_ENV === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL;

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: env.LOG_SQL ? console.log : false,
  pool: {
    max: env.NODE_ENV === 'test' ? 30 : 20,
    min: 2,
    acquire: 30000,
    idle: 10000
  }
});

export default sequelize;
