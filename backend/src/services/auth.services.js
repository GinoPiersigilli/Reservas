// services/auth.service.js
import Usuario from '../models/usuario.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const registrarUsuario = async (datos) => {
  const { nombre, email, password, rol } = datos;

  // 1. Verificar si el email ya existe en la base de datos
  const usuarioExistente = await Usuario.findOne({ where: { email } });
  if (usuarioExistente) {
    const error = new Error('El email ya está registrado');
    error.status = 400;
    throw error;
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
    const error = new Error('Credenciales inválidas');
    error.status = 400;
    throw error;
  }

  // 2. Verificar si la cuenta está activa
  if (!usuario.activo) {
    const error = new Error('El usuario está desactivado o bloqueado');
    error.status = 403;
    throw error;
  }

  // 3. Comparar la contraseña enviada con el hash guardado en la BD
  const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValida) {
    const error = new Error('Credenciales inválidas');
    error.status = 400;
    throw error;
  }

  // 4. Armar el payload del JWT (Sin incluir la contraseña)
  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol
  };

  // 5. Generar el token que expira en 2 horas
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '2h' });

  // Devolvemos el token y los datos limpios para que el frontend los use
  return {
    token,
    usuario: payload
  };
};
