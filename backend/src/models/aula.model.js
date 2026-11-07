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
    type: DataTypes.STRING,
    allowNull: false // Obligatorio
  },
  capacidad: {
    type: DataTypes.INTEGER,
    allowNull: false, // Obligatorio
    validate: {
      min: 1
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
