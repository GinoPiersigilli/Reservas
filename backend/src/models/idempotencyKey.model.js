// src/models/idempotencyKey.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Usuario from './usuario.model.js';

const IdempotencyKey = sequelize.define(
  'IdempotencyKey',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuarios',
        key: 'id'
      }
    },
    clave: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    cuerpoHash: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    estadoRespuesta: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    cuerpoRespuesta: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  },
  {
    tableName: 'idempotency_keys',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['usuarioId', 'clave']
      },
      {
        fields: ['expiresAt']
      }
    ]
  }
);

IdempotencyKey.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
Usuario.hasMany(IdempotencyKey, { foreignKey: 'usuarioId', as: 'idempotencyKeys' });

export default IdempotencyKey;
