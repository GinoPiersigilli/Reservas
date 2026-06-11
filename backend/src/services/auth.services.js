// services/auth.service.js
import Usuario from '../models/usuario.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// En un proyecto real esto va en un archivo .env, pero lo dejamos acá para simplificar
const JWT_SECRET = 'mi_clave_secreta_super_segura_dds_2026'; 

export const registrarUsuario = async (datos) => {
  const { nombre, email, password, rol } = datos;

  // 1. Verificar si el email ya existe en la base de datos
  const usuarioExistente = await Usuario.findOne({ where: { email } });
  if (usuarioExistente) {
    throw new Error('El email ya está registrado');
  }

  // 2. Hashear la contraseña (Requisito estricto del TP)
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 3. Crear el usuario
  const nuevoUsuario = await Usuario.create({
    nombre,
    email,
    passwordHash, // Guardamos el hash de forma segura, nunca la clave plana
    rol: rol || 'usuario', // Si no envían rol, por defecto es 'usuario'
    activo: true
  });

  // 4. Le sacamos la contraseña antes de devolver los datos para no exponerla
  const usuarioCreado = nuevoUsuario.toJSON();
  delete usuarioCreado.passwordHash;

  return usuarioCreado;
};

export const loginUsuario = async (email, password) => {
  // 1. Buscar al usuario por email
  const usuario = await Usuario.findOne({ where: { email } });
  if (!usuario) {
    throw new Error('Credenciales inválidas');
  }

  // 2. Verificar si la cuenta está activa
  if (!usuario.activo) {
    throw new Error('El usuario está desactivado o bloqueado');
  }

  // 3. Comparar la contraseña enviada con el hash guardado en la BD
  const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValida) {
    throw new Error('Credenciales inválidas');
  }

  // 4. Armar el payload del JWT (Sin incluir la contraseña)
  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol
  };

  // 5. Generar el token que expira en 2 horas
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });

  // Devolvemos el token y los datos limpios para que el frontend los use
  return {
    token,
    usuario: payload
  };
};