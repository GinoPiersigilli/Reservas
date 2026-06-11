// models/reserva.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Tu conexión a SQLite

const Reserva = sequelize.define('Reserva', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Identificador único de la reserva [cite: 48]
  },
  aulaId: {
    type: DataTypes.INTEGER,
    allowNull: false // Aula solicitada. Debe existir en aulas [cite: 48]
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false // Usuario que solicita la reserva [cite: 48]
  },
  fecha: {
    type: DataTypes.DATEONLY, // Guarda solo la fecha (ej: "2026-06-18") [cite: 48]
    allowNull: false 
  },
  horaInicio: {
    type: DataTypes.STRING,
    allowNull: false // Inicio de la franja horaria, ej: "09:00" 
  },
  horaFin: {
    type: DataTypes.STRING,
    allowNull: false // Fin de la franja horaria, ej: "11:00" 
  },
  cantidadPersonas: {
    type: DataTypes.INTEGER,
    allowNull: false // Cantidad prevista de asistentes 
  },
  motivo: {
    type: DataTypes.STRING,
    allowNull: false // Motivo de la reserva 
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pendiente' // Estado actual del flujo 
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW // Fecha y hora de creación 
  }
}, {
  tableName: 'reservas',
  timestamps: false // Como el TP exige un campo createdAt explícito, apagamos los automáticos de Sequelize para no tener duplicados
});

export default Reserva;