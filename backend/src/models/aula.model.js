// models/aula.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Aula = sequelize.define('Aula', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false // Obligatorio
  },
  ubicacion: {
    type: DataTypes.STRING(120),
    allowNull: false,
    validate: {
      len: [1, 120]
    }
  },
  capacidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 1000
    }
  },
  recursos: {
    type: DataTypes.STRING, // Puedes guardarlo como string separado por comas
    allowNull: true // No es obligatorio
  },
  activa: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true // Obligatorio
  }
}, {
  tableName: 'aulas',
  timestamps: false // Si no necesitas createdAt/updatedAt automáticos en esta tabla
});

export default Aula;
