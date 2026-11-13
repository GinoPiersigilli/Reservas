// src/models/historialAula.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Aula from './aula.model.js';
import Usuario from './usuario.model.js';

const HistorialAula = sequelize.define(
  'HistorialAula',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    aulaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'aulas',
        key: 'id'
      }
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuarios',
        key: 'id'
      }
    },
    accion: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['creacion', 'edicion', 'desactivacion', 'reactivacion']]
      }
    },
    valorAnterior: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    valorNuevo: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    fechaHora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'historial_aulas',
    timestamps: false
  }
);

Aula.hasMany(HistorialAula, { foreignKey: 'aulaId', onDelete: 'RESTRICT' });
HistorialAula.belongsTo(Aula, { foreignKey: 'aulaId', onDelete: 'RESTRICT' });

Usuario.hasMany(HistorialAula, { foreignKey: 'usuarioId', onDelete: 'RESTRICT' });
HistorialAula.belongsTo(Usuario, { foreignKey: 'usuarioId', onDelete: 'RESTRICT' });

export default HistorialAula;
