// src/config/database.js
import { Sequelize } from 'sequelize';
import env from './env.js';

const databaseUrl = env.NODE_ENV === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL;

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: env.LOG_SQL ? console.log : false
});

export default sequelize;
