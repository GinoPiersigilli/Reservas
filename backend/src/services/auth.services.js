// services/auth.service.js
//
// El alta de cuentas la resuelve Clerk: no hay ruta de registro local, así que
// este módulo solo verifica credenciales contra la base para el JWT propio.
import Usuario from '../models/usuario.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

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
  const passwordValida = usuario.passwordHash
    ? await bcrypt.compare(password, usuario.passwordHash)
    : false;
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

  // 5. Generar el token que expira en 2 horas con algoritmo HS256 e issuer institucional
  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '2h',
    algorithm: 'HS256',
    issuer: 'reservas-api'
  });

  // Devolvemos el token y los datos limpios para que el frontend los use
  return {
    token,
    usuario: payload
  };
};
