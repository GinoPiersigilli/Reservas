// src/models/historial.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajustá esta ruta según dónde tengas tu conexión

const HistorialReserva = sequelize.define('HistorialReserva', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reservaId: {
    type: DataTypes.INTEGER, // O DataTypes.STRING si usaste UUIDs en Reserva
    allowNull: false
  },
  usuarioId: {
    type: DataTypes.INTEGER, // O DataTypes.STRING si usaste UUIDs en Usuario
    allowNull: false
  },
  accion: {
    type: DataTypes.STRING,
    allowNull: false,
    // Podrías usar un ENUM si querés restringir exactamente las palabras:
    // type: DataTypes.ENUM('creacion', 'edicion', 'aprobacion', 'rechazo', 'cancelacion')
  },
  fechaHora: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW // Sequelize captura automáticamente el momento exacto
  },
  valorAnterior: {
    type: DataTypes.JSON, // Guardar objetos JSON es ideal para historiales
    allowNull: true
  },
  valorNuevo: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'historial_reservas',
  timestamps: false // Como ya definimos fechaHora manualmente, apagamos los automáticos
});

export default HistorialReserva;