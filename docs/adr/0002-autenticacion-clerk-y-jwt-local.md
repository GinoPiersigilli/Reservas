# 0002 — Autenticación con Clerk y JWT local propio

- **Estado:** aceptada
- **Fecha:** 2026-10
- **Contexto de implementación:** `src/middleware/auth.middleware.js`

## Problema

El sistema necesita inicio de sesión con Google (lo piden los usuarios de la
facultad) y, a la vez, cuentas locales con contraseña para administración y
para poder probar el sistema sin depender de un servicio externo.

## Opciones consideradas

1. **Solo cuentas locales.** Menos dependencias, pero implica implementar a
   mano el flujo de OAuth con Google, la verificación de correos y la
   recuperación de contraseñas: mucha superficie de seguridad propia.
2. **Solo Clerk.** Resuelve Google y la gestión de usuarios, pero deja el
   sistema sin forma de autenticar en un entorno sin red, complica las pruebas
   automatizadas y ata todo el acceso a un proveedor comercial.
3. **Las dos vías, con autorización propia.** Clerk emite la identidad cuando
   se entra con Google; para las cuentas locales el backend emite su propio JWT.
   En los dos casos, el rol y los permisos los decide la base de datos local.

## Decisión

Se aceptan dos tipos de token en el mismo middleware:

- **Token de Clerk**: se verifica con `verifyToken` del SDK, con
  `authorizedParties` fijado a los orígenes permitidos por CORS.
- **JWT local**: HS256, emisor `reservas-api`, dos horas de validez.

Reglas comunes a las dos vías:

- **El rol nunca viene del token.** En cada petición se lee el usuario de la
  base: si se desactiva una cuenta o se le quita el rol de administrador, el
  cambio tiene efecto en la petición siguiente, sin esperar a que expire ningún
  token.
- **Vinculación por correo solo si está verificado.** Al entrar por Clerk con
  un correo que ya existe como cuenta local, las cuentas se vinculan únicamente
  si Clerk informa `verification.status === 'verified'`. Sin esa comprobación,
  cualquiera que registre en Clerk el correo de un administrador heredaría su
  cuenta (hallazgo SEC-AUTH-05).

### Quién usa cada vía

- **Clerk** lo usan las personas reales en la aplicación desplegada: es la vía
  del registro, del inicio de sesión con Google y de la recuperación de
  contraseña, ninguno de los cuales está implementado localmente.
- **El JWT local** lo usan las pruebas (los 206 casos de API y los 20 de
  extremo a extremo firman sus propios tokens), el modo de desarrollo sin red,
  y las cuentas sembradas por los seeders. No hay ruta de registro local: el
  alta de cuentas pasa siempre por Clerk o por un seeder.

### Qué pasa en cada situación

| Situación                                               | Qué ocurre                                                                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La cuenta se desactiva (`activo = false`)               | La petición siguiente responde `401`, aunque el token siga vigente: el middleware relee el usuario en cada petición.                                            |
| Se le quita el rol de administrador                     | Lo mismo: el rol efectivo sale de la base, no del token, así que el cambio vale desde la petición siguiente.                                                    |
| El token local vence (2 h)                              | `jsonwebtoken` lo rechaza y la respuesta es `401`. El frontend borra la sesión y lleva al login.                                                                |
| El token de Clerk vence                                 | Lo rechaza `verifyToken`; el SDK del frontend lo renueva solo mientras la sesión de Clerk siga viva.                                                            |
| El usuario existe en Clerk pero no localmente           | Se crea la cuenta local en el momento (JIT), siempre con rol `usuario` salvo que `publicMetadata.rol` —escribible solo desde el backend de Clerk— diga `admin`. |
| El usuario de Clerk tiene el correo de una cuenta local | Se vinculan **solo** si Clerk informa el correo como verificado.                                                                                                |

### Por qué las dos vías no pueden dar privilegios distintos

Porque ninguna de las dos decide privilegios. El middleware las usa únicamente
para **establecer de qué usuario se trata**; a partir de ahí lee `rol` y
`activo` de la base y arma `req.usuario` con esos valores. Un token local y uno
de Clerk que identifiquen a la misma persona producen exactamente el mismo
`req.usuario`, porque los dos terminan en la misma fila de `usuarios`.

El precio es una consulta por petición, resuelta por clave primaria. Es el
intercambio deliberado: revocación inmediata a cambio de una lectura indexada.

## Consecuencias

**A favor**

- Google funciona sin escribir un flujo de OAuth propio.
- El sistema sigue siendo usable y probable sin conexión ni claves de Clerk: las
  pruebas E2E usan el inicio de sesión local y reemplazan el SDK por un doble.
- La autorización es propia y auditable: está en la base, no en el proveedor.

**En contra**

- Dos caminos de autenticación que mantener y probar, con el riesgo de que una
  regla de seguridad se aplique en uno y se olvide en el otro.
- El token se guarda en `localStorage`, expuesto a XSS. Es un riesgo aceptado y
  documentado: mitigarlo requiere cookies `HttpOnly` con protección CSRF, que
  es el paso natural siguiente y está anotado como pendiente en
  `docs/SEGURIDAD.md`.
- Dependencia de un servicio comercial para una parte del acceso.
