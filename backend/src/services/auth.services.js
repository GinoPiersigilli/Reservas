// services/auth.service.js
//
// El alta de cuentas la resuelve Clerk: no hay ruta de registro local, así que
// este módulo solo verifica credenciales contra la base para el JWT propio.
import Usuario from '../models/usuario.model.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Hash de descarte, para gastar el mismo tiempo cuando no hay con qué comparar.
 *
 * Sin esto, un correo sin cuenta responde en un milisegundo y uno con cuenta en
 * unos ochenta, porque el segundo pasa por bcrypt. Esa diferencia es medible
 * desde afuera y alcanza para averiguar qué correos tienen contraseña local,
 * que es justo lo que el resto de los mensajes se cuidan de no decir.
 *
 * El contenido no importa mientras sea un hash válido del mismo costo: lo único
 * que se busca es que la comparación tarde lo que tarda.
 */
const HASH_DE_DESCARTE = bcrypt.hashSync('contraseña que no es de nadie', 10);

/** Mismo mensaje y mismo código para todo lo que no sea un ingreso válido. */
const credencialesInvalidas = () => {
  const error = new Error('Credenciales inválidas');
  error.status = 401;
  return error;
};

export const loginUsuario = async (email, password) => {
  // 1. Buscar al usuario por email
  const usuario = await Usuario.findOne({ where: { email } });

  // 2. Comparar siempre, haya o no contra qué: ver HASH_DE_DESCARTE.
  const hashAComparar = usuario?.passwordHash || HASH_DE_DESCARTE;
  const passwordValida = await bcrypt.compare(password, hashAComparar);

  if (!usuario || !usuario.passwordHash || !passwordValida) {
    throw credencialesInvalidas();
  }

  // 3. Una cuenta desactivada responde como cualquier credencial que no entra.
  //    Decir «está desactivada» sería confirmarle a quien prueba correos que
  //    ese existe. El motivo real queda en el log, que es donde hace falta.
  if (!usuario.activo) {
    logger.warn('intento de ingreso de una cuenta desactivada', { usuarioId: usuario.id });
    throw credencialesInvalidas();
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
