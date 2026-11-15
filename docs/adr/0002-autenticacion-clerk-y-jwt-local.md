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
  contraseña, ninguno de los cuales está implementado localmente. El formulario
  de alta habla con el SDK de Clerk (`signUp.create`) y, si la instancia exige
  confirmar el correo, muestra un segundo paso para el código. Hasta el
  14/11/2026 ese formulario llamaba a `POST /api/auth/register`, una ruta que
  nunca existió: el registro con correo y contraseña devolvía `404` desde el
  primer día, y solo funcionaba el botón de Google.
- **El JWT local** lo usan las pruebas (los casos de API y los 20 de extremo a
  extremo firman sus propios tokens), el modo de desarrollo sin red, y las
  cuentas sembradas por los seeders. No hay ruta de registro local: el alta de
  cuentas pasa siempre por Clerk o por un seeder.

### El ingreso no dice por qué no entró (15/11/2026)

`POST /api/auth/login` responde `401` con el mismo mensaje en los tres casos que
no son un ingreso válido: el correo no existe, la contraseña no coincide, o la
cuenta está desactivada. Antes el tercero devolvía `403` con «el usuario está
desactivado», y eso le confirma a quien prueba correos que esa cuenta existe. El
motivo real queda en el log, que es donde hace falta.

Por la misma razón, la comparación con bcrypt se hace siempre, aun cuando no
haya contraseña contra qué compararla. Sin eso, un correo sin cuenta contestaba
en un milisegundo y uno con cuenta en unos ochenta, y esa diferencia se mide
desde afuera: la respuesta callaba lo que el reloj contaba.

### A Clerk se le pregunta lo menos posible (15/11/2026)

Al llegar un token de Clerk, primero se busca la fila por `clerkId` en esta
base. Si existe y está completa, se usa. Solo se llama a
`clerkClient.users.getUser` cuando no existe todavía o le faltan datos que solo
Clerk tiene —las cuentas migradas entraron con correo y nombre de relleno—.

Antes esa llamada iba en **cada** petición, antes de mirar la base: una ida y
vuelta por red en cada `GET`, y cupo de la API de Clerk gastado para releer algo
que ya estaba acá.

**Consecuencia que conviene tener presente:** un cambio de `publicMetadata.rol`
en Clerk ya no se refleja solo en la petición siguiente. Es coherente con la
regla de arriba —el rol efectivo es el de esta base— y deja a ese metadato como
lo que siempre debió ser: el rol con el que nace la cuenta, no su fuente de
verdad. Para cambiar el rol de alguien se cambia la fila en `usuarios`, y eso
tiene efecto en la petición siguiente, como siempre.

El primer ingreso dispara varias peticiones en paralelo y todas encuentran la
fila inexistente. Una la crea y las demás chocan contra la restricción de
unicidad; ese choque salía como «token inválido» y deslogueaba a quien acababa
de entrar. Ahora se relee la fila que creó la que ganó.

### El frontend también lee la identidad de la base (15/11/2026)

`GET /api/auth/me` devuelve la fila de `usuarios` que corresponde al token, sea
cual sea su origen. El frontend la pide al abrir una sesión de Clerk, y de ahí
salen el identificador y el rol con los que opera.

Antes los tomaba del SDK, y eso rompía dos cosas que este documento ya
prometía. El identificador era la cadena `user_2…` de Clerk mientras que las
reservas guardan la clave primaria entera de `usuarios`: compararlas no da
error, da `false` siempre, así que **nadie que entrara por Clerk veía el botón
para cancelar su propia reserva**. Y el rol salía de `publicMetadata`, una copia
que puede quedar vieja, cuando la regla de arriba dice que el rol se lee de la
base en cada petición. El backend la cumplía; el frontend decidía qué mostrar
mirando la copia.

No era un agujero de permisos —el backend revalida todo— pero sí un error
visible: la aplicación le escondía a la gente una acción que tenía permitida.
Ninguna prueba lo detectó porque todas las cuentas de prueba, incluidas las de
extremo a extremo, son locales y su identificador ya es el entero correcto.

### Recuperar la contraseña (15/11/2026)

`/recuperar` usa `signIn.create({ strategy: 'reset_password_email_code' })` y
después `attemptFirstFactor` con el código y la contraseña nueva. Queda del lado
del frontend, igual que el alta, porque la contraseña que cambia vive en Clerk y
el backend no la ve nunca.

**Solo alcanza a las cuentas de Clerk.** Las sembradas tienen su contraseña en
esta base y Clerk no sabe nada de ellas, así que para esas no hay recuperación
posible. La pantalla lo dice antes del formulario y no después de intentarlo,
para que nadie quede esperando un correo que no va a llegar.

La pantalla **no informa si el correo tiene cuenta**: responde lo mismo en los
dos casos y avanza igual al paso del código. Si la respuesta cambiara, pedir
códigos para direcciones cualesquiera sería una forma cómoda de averiguar quién
está dado de alta en el sistema. El precio es que un correo mal escrito no
avisa, y se paga con gusto.

### El formulario de ingreso consulta las dos (15/11/2026)

Hay dos lugares donde puede vivir una contraseña, así que el formulario de
correo y contraseña pregunta a los dos: primero a Clerk con
`signIn.create({ identifier, password })` y, si esa vía no abre sesión, al
ingreso local.

Antes preguntaba solo al segundo, y eso dejaba afuera a cualquiera que se
hubiera dado de alta desde la aplicación: su fila en `usuarios` existe —la crea
el aprovisionamiento al vuelo— pero con `passwordHash` nulo, y `loginUsuario`
rechaza explícitamente ese caso. El resultado era que alguien se registraba,
verificaba su correo, entraba, cerraba sesión, y al volver con las mismas
credenciales recibía «credenciales inválidas». Sin Google no había otra puerta.

El orden tiene una consecuencia práctica: solo la vía local llega a
`POST /api/auth/login`, así que un ingreso correcto por Clerk no consume cupo
del limitador de intentos. Y si Clerk no responde —o ni siquiera cargó—, se va
derecho a la vía local, que es lo que mantiene la demostración en pie sin
conexión.

### Qué pasa en cada situación

| Situación                                               | Qué ocurre                                                                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La cuenta se desactiva (`activo = false`)               | La petición siguiente responde `401` por las dos vías, aunque el token siga vigente: el middleware relee el usuario en cada petición.                           |
| Se le quita el rol de administrador                     | Lo mismo: el rol efectivo sale de la base, no del token, así que el cambio vale desde la petición siguiente.                                                    |
| El token local vence (2 h)                              | `jsonwebtoken` lo rechaza y la respuesta es `401`. El frontend borra la sesión y lleva al login.                                                                |
| El token de Clerk vence                                 | Lo rechaza `verifyToken`; el SDK del frontend lo renueva solo mientras la sesión de Clerk siga viva.                                                            |
| El usuario existe en Clerk pero no localmente           | Se crea la cuenta local en el momento (JIT), siempre con rol `usuario` salvo que `publicMetadata.rol` —escribible solo desde el backend de Clerk— diga `admin`. |
| El usuario de Clerk tiene el correo de una cuenta local | Se vinculan **solo** si Clerk informa el correo como verificado.                                                                                                |
| Una cuenta de Clerk ingresa por correo y contraseña     | Clerk verifica la contraseña y abre la sesión; la vía local no llega a intentarse, y es mejor así: esa fila tiene `passwordHash` nulo y la rechazaría.          |
| Una cuenta semilla ingresa y Clerk no responde          | Clerk no abre sesión, el formulario pasa a la vía local y la cuenta entra igual: la demostración no depende de que el proveedor esté en pie.                    |

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
  regla de seguridad se aplique en uno y se olvide en el otro. **Ese riesgo se
  materializó**, aunque no por una regla de seguridad sino por una de acceso: el
  alta se mudó a Clerk y el formulario de ingreso siguió preguntando solo a la
  base propia, así que durante un tiempo nadie que se registrara desde la
  aplicación podía volver a entrar. Lo corrigió la fase 15; la lección es que
  cada vez que se mueve una de las dos vías hay que revisar la otra.
- El token se guarda en `localStorage`, expuesto a XSS. Es un riesgo aceptado y
  documentado: mitigarlo requiere cookies `HttpOnly` con protección CSRF, que
  es el paso natural siguiente y está anotado como pendiente en
  `docs/SEGURIDAD.md`.
- Dependencia de un servicio comercial para una parte del acceso.
