// models/reserva.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Aula from './aula.model.js';
import Usuario from './usuario.model.js';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const Reserva = sequelize.define('Reserva', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Identificador único de la reserva [cite: 48]
  },
  aulaId: {
    type: DataTypes.INTEGER,
    allowNull: false, // Aula solicitada. Debe existir en aulas [cite: 48]
    references: {
      model: 'aulas',
      key: 'id'
    }
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false, // Usuario que solicita la reserva [cite: 48]
    references: {
      model: 'usuarios',
      key: 'id'
    }
  },
  fecha: {
    type: DataTypes.DATEONLY, // Guarda solo la fecha (ej: "2026-06-18") [cite: 48]
    allowNull: false
  },
  horaInicio: {
    type: DataTypes.TIME,
    allowNull: false, // Inicio de la franja horaria, ej: "09:00"
    get() {
      const rawValue = this.getDataValue('horaInicio');
      return typeof rawValue === 'string' ? rawValue.slice(0, 5) : rawValue;
    },
    validate: {
      is: HORA_REGEX
    }
  },
  horaFin: {
    type: DataTypes.TIME,
    allowNull: false, // Fin de la franja horaria, ej: "11:00"
    get() {
      const rawValue = this.getDataValue('horaFin');
      return typeof rawValue === 'string' ? rawValue.slice(0, 5) : rawValue;
    },
    validate: {
      is: HORA_REGEX
    }
  },
  cantidadPersonas: {
    type: DataTypes.INTEGER,
    allowNull: false, // Cantidad prevista de asistentes
    validate: {
      min: 1
    }
  },
  motivo: {
    type: DataTypes.STRING,
    allowNull: false // Motivo de la reserva
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pendiente', // Estado actual del flujo
    validate: {
      isIn: [['pendiente', 'aprobada', 'cancelada', 'rechazada']]
    }
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW // Fecha y hora de creación
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'reservas',
  timestamps: true
});

Aula.hasMany(Reserva, { foreignKey: 'aulaId', onDelete: 'RESTRICT' });
Reserva.belongsTo(Aula, { foreignKey: 'aulaId', onDelete: 'RESTRICT' });

Usuario.hasMany(Reserva, { foreignKey: 'usuarioId', onDelete: 'RESTRICT' });
Reserva.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario', onDelete: 'RESTRICT' });

export default Reserva;
