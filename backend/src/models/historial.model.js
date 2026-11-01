// src/models/historial.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Reserva from './reserva.model.js';
import Usuario from './usuario.model.js';

const HistorialReserva = sequelize.define('HistorialReserva', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reservaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'reservas',
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
      isIn: [['creacion', 'edicion', 'aprobacion', 'rechazo', 'cancelacion']]
    }
  },
  fechaHora: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW // Sequelize captura automáticamente el momento exacto
  },
  valorAnterior: {
    type: DataTypes.JSONB, // Guardar objetos JSONB consultables e indexables
    allowNull: true
  },
  valorNuevo: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'historial_reservas',
  timestamps: false // Como ya definimos fechaHora manualmente, apagamos los automáticos
});

Reserva.hasMany(HistorialReserva, { foreignKey: 'reservaId', onDelete: 'RESTRICT' });
HistorialReserva.belongsTo(Reserva, { foreignKey: 'reservaId', onDelete: 'RESTRICT' });

Usuario.hasMany(HistorialReserva, { foreignKey: 'usuarioId', onDelete: 'RESTRICT' });
HistorialReserva.belongsTo(Usuario, { foreignKey: 'usuarioId', onDelete: 'RESTRICT' });

export default HistorialReserva;
