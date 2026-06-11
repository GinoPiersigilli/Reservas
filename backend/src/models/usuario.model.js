// models/usuario.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegurate de que la ruta a tu conexión sea correcta

const Usuario = sequelize.define('Usuario', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Identificador único del usuario [cite: 44]
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false // Nombre visible del usuario [cite: 44]
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true // Credencial de acceso y dato de contacto. Debe ser único 
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false // Contraseña almacenada de forma segura 
  },
  rol: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'usuario' // Define permisos dentro del sistema (usuario, admin) 
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true // Permite bloquear accesos sin borrar el usuario 
  }
}, {
  tableName: 'usuarios',
  timestamps: false // Podés cambiarlo a true si querés que Sequelize maneje createdAt/updatedAt automáticamente
});

export default Usuario;