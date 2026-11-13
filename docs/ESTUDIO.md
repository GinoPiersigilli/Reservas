# Guía de estudio del proyecto

Este documento no explica el código línea por línea: explica **las decisiones**.
Son unas doce, y cada una tiene una alternativa que se descartó por un motivo
concreto. Poder decir cuál era la alternativa y por qué se descartó es lo que
distingue a quien escribió el sistema de quien lo copió.

Se lee en una hora. Las cifras exactas de pruebas viven en
[CALIDAD.md](CALIDAD.md) y las decisiones formales en [adr/](adr/README.md).

---

## 1. El recorrido de una petición, del clic al `COMMIT`

Lo que pasa cuando alguien aprieta **Reservar aula**:

```
Navegador
  │  POST /api/reservas
  │  Authorization: Bearer <jwt>
  │  Idempotency-Key: <uuid>        ← lo genera el formulario, se renueva con cada cambio
  │  X-Request-Id: <uuid>           ← lo genera axios, viaja a los logs
  ▼
asignarRequestId          req.id = el X-Request-Id entrante si es un UUID, o uno nuevo
registrarPeticiones       arranca el cronómetro; al terminar loguea ruta, estado y duración
helmet / cors             cabeceras de seguridad; CORS valida origen y cabeceras permitidas
limiteGeneral             rate limit por IP
limiteEscrituras          rate limit de escrituras, ANTES de autenticar
verificarToken            JWT local → si falla, Clerk → siempre relee el rol de la base
limiteUsuario             rate limit por usuario autenticado
validar(esquemaZod)       forma y tipos del cuerpo; nada llega al servicio sin validar
  ▼
crearNuevaReserva (servicio)
  1. ¿Esta Idempotency-Key ya se usó?  → si sí, devuelve la respuesta guardada y termina
  2. Reglas de horario                 → fecha pasada, hora ya transcurrida, fuera de 08–22
  3. BEGIN
       SELECT … FROM aulas WHERE id = ? FOR SHARE     ← bloqueo compartido sobre el aula
       ¿existe solapamiento?                          ← chequeo amable, no es la garantía
       INSERT INTO reservas …                         ← acá la base puede decir que no
       INSERT INTO historial_reservas …               ← misma transacción
       INSERT INTO idempotency_keys …                 ← misma transacción
     COMMIT
  ▼
manejadorErrores          traduce 23P01 → 400 "El aula ya está reservada en ese horario"
                          en producción nunca filtra el mensaje de PostgreSQL
  ▼
201 { id, estado: "pendiente", … }
```

**El punto que hay que entender:** el paso que impide la doble reserva no es el
`¿existe solapamiento?`. Ese es cortesía, para dar un mensaje lindo. La garantía
está en el `INSERT`, porque la tabla tiene una restricción que PostgreSQL evalúa
en ese momento, y dos transacciones simultáneas no pueden atravesarla las dos.

---

## 2. Las doce decisiones

### 2.1. La integridad la garantiza la base, no la aplicación

```sql
ALTER TABLE reservas
ADD CONSTRAINT reservas_sin_solapamiento
EXCLUDE USING gist (
  "aulaId" WITH =,
  tsrange(("fecha" + "horaInicio"), ("fecha" + "horaFin"), '[)') WITH &&
) WHERE (estado IN ('pendiente', 'aprobada'));
```

Se lee: _no pueden coexistir dos filas con el mismo `aulaId` cuyos intervalos se
superpongan, considerando solo las pendientes y las aprobadas._

- **`EXCLUDE USING gist`** es como `UNIQUE`, pero con un operador a elección.
  `UNIQUE` compara con `=`; esto compara con `&&` (se superponen).
- **`btree_gist`** es la extensión que hace falta para meter un entero (`aulaId`,
  que se compara con `=`) en un índice GiST junto a un rango.
- **`tsrange(..., '[)')`** es el intervalo semiabierto: incluye el inicio, excluye
  el fin. Es lo que permite que una reserva de 10:00 a 12:00 y otra de 12:00 a
  14:00 convivan. Con `'[]'` se tocarían en el punto 12:00 y la segunda sería
  rechazada.
- **El `WHERE`** la convierte en una restricción parcial: una reserva cancelada o
  rechazada deja de ocupar la franja, sin borrarla.

**La alternativa descartada:** consultar si hay solapamiento y después insertar.
Entre las dos sentencias hay una ventana, y dos pedidos simultáneos pueden
atravesarla los dos. No se arregla con `SERIALIZABLE` sin pagar reintentos, ni
con un bloqueo de tabla sin serializar toda la aplicación.

### 2.2. La prueba que lo demuestra

`tests/concurrencia.test.js` dispara **100 peticiones simultáneas** de 100
usuarios distintos por la misma aula y el mismo horario, y espera **exactamente
un 201, noventa y nueve 400 y ningún 5xx**.

El "exactamente" es lo importante. Dos 201 significaría que la restricción no
sirve; un 500 significaría que el error de PostgreSQL se escapó sin traducirse.

Hay una segunda prueba con 100 pedidos repartidos en 10 franjas distintas, que
espera exactamente 10 creadas: comprueba que la restricción no rechaza de más.

### 2.3. El código de error `23P01`

Es el `SQLSTATE` de `exclusion_violation`. Llega envuelto en un error de
Sequelize y el manejador lo traduce a un 400 con un mensaje para una persona.

Vale la pena saber dos más, porque están en el mismo archivo: **`23505`** es
violación de unicidad (email repetido, nombre de aula repetido) y **`23503`**
es violación de clave foránea (aula o usuario inexistente).

### 2.4. `FOR SHARE` sobre el aula

`Aula.findByPk(aulaId, { lock: transaction.LOCK.SHARE })` toma un bloqueo
compartido. No es para el solapamiento —de eso se encarga la restricción— sino
para una carrera distinta: que alguien dé de baja el aula justo entre la
verificación de que está activa y el `INSERT`.

Compartido y no exclusivo porque varias reservas de la misma aula pueden
crearse a la vez sin molestarse; lo que no puede pasar es que el aula cambie
debajo.

### 2.5. Idempotencia: qué resuelve y qué no

El formulario manda una cabecera `Idempotency-Key` con un UUID. El servidor
guarda, junto a la respuesta, un hash SHA-256 del cuerpo. Ante un segundo
pedido con la misma clave:

- **misma clave, mismo cuerpo** → devuelve la respuesta guardada con
  `Idempotent-Replay: true`. No crea nada.
- **misma clave, cuerpo distinto** → 422. La clave identifica una operación
  concreta, no un permiso para pisarla con otra.
- **clave vencida** (más de 24 h) → se renueva y la operación se ejecuta de nuevo.

**Qué resuelve:** el doble clic, el reintento del navegador, el usuario que
pierde la conexión y reenvía sin saber si el primer pedido llegó.

**Qué NO resuelve:** dos personas distintas pidiendo la misma franja. Esas
tienen claves distintas y es correcto que una falle. La idempotencia protege
contra el _mismo_ pedido repetido, no contra pedidos en conflicto.

La clave se guarda **dentro de la misma transacción** que la reserva. Si se
guardara antes, un fallo posterior dejaría una clave usada sin reserva; si se
guardara después, una caída entre ambas dejaría la reserva sin clave y el
reintento crearía una segunda.

### 2.6. Auditoría dentro de la transacción

Cada creación, edición y cambio de estado escribe una fila en
`historial_reservas` **en la misma transacción**. No hay forma de que exista un
cambio sin su registro: o entran los dos o no entra ninguno.

Para `historial_aulas` hay además un trigger `BEFORE UPDATE OR DELETE` que
impide modificar o borrar filas: el historial es de solo agregado incluso para
alguien con acceso a la base.

### 2.7. El rol se lee de la base en cada petición

El token lleva el rol, pero `verificarToken` **lo ignora** y relee el usuario:

```js
const usuarioLocal = await Usuario.findByPk(payload.id);
if (!usuarioLocal || !usuarioLocal.activo) return res.status(401)...
req.usuario = { id, nombre, email, rol: usuarioLocal.rol };  // el rol de la base
```

Si el token llevara el rol y a alguien se le quitara el permiso de
administrador, seguiría siendo administrador durante las dos horas de vida del
token. El costo es una consulta por petición, resuelta por clave primaria.

### 2.8. Dos esquemas de autenticación en el mismo middleware

Primero se intenta el JWT local (HS256, issuer `reservas-api`, 2 horas). Si
falla, se intenta Clerk. El orden importa: el local es síncrono y barato, el de
Clerk implica red.

El alta automática desde Clerk (_JIT provisioning_) solo ocurre si
`verification.status === 'verified'` en el correo. Sin esa condición,
cualquiera podría registrarse con un correo institucional ajeno y obtener una
cuenta.

### 2.9. Rate limiting en cuatro capas

- **Por IP sobre `/api`** — el techo general.
- **Sobre escrituras, antes de autenticar** — importa el orden: si el límite
  estuviera después del middleware de autenticación, un atacante podría gastar
  trabajo de verificación de tokens sin límite. Es lo que pide CodeQL.
- **Por usuario autenticado** — para que una cuenta no agote la cuota de toda su
  oficina, que sale por la misma IP.
- **Sobre el login** — con su propio umbral, configurable por entorno (las
  pruebas E2E inician sesión cientos de veces desde la misma IP).

### 2.10. `liveness` y `readiness` son cosas distintas

- **`/api/health/live`** responde sin tocar la base. Contesta "el proceso está
  vivo". Si consultara la base, una base caída haría que el orquestador
  reiniciara un proceso sano en loop, sin arreglar nada.
- **`/api/health/ready`** sí consulta la base, con un tope de 2 segundos.
  Contesta "puedo atender pedidos". Un `ready` en rojo saca la instancia del
  balanceador; un `live` en rojo la reinicia.

Ambas rutas se montan **antes** del rate limit general: un sondeo cada pocos
segundos no debe consumir la cuota de nadie ni empezar a fallar por 429.

### 2.11. El `requestId` conecta la pantalla con el log

El frontend manda `X-Request-Id` en cada petición. El servidor lo acepta solo si
es un UUID válido —si no, genera uno— y lo usa en todas las líneas de log de esa
petición. Cuando algo falla, el usuario ve un `correlationId` en pantalla y ese
mismo valor se busca en los logs.

Esta cabecera nueva causó un error instructivo: no estaba en los
`allowedHeaders` de CORS. Las 198 pruebas de API seguían pasando, porque
supertest no aplica CORS. En el navegador, **todas** las peticiones fallaban. Lo
detectó una prueba de extremo a extremo. Moraleja: una prueba de API no prueba
el navegador.

### 2.12. La documentación que no se puede desactualizar

`openapi.js` describe los endpoints a mano, y una prueba recorre
`app._router.stack` comparando las rutas reales de Express contra las
documentadas. Agregar un endpoint sin documentarlo **rompe la prueba**.

La especificación se sirve solo fuera de producción: un mapa completo de la
superficie de la API es información útil para quien la va a atacar.

---

## 3. Los archivos que hay que conocer

| Archivo                                            | Por qué importa                                              | Pregunta que puede salir                                     |
| -------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `backend/db/migrations/002-esquema-definitivo.cjs` | Acá vive la restricción de exclusión                         | ¿Por qué `'[)'` y no `'[]'`?                                 |
| `backend/src/services/reservas.services.js`        | Toda la lógica de negocio y las transacciones                | ¿Qué pasa si dos pedidos llegan en el mismo milisegundo?     |
| `backend/src/middleware/auth.middleware.js`        | Los dos esquemas de token y la relectura del rol             | ¿Por qué no confiar en el rol del token?                     |
| `backend/src/middleware/error.middleware.js`       | Traduce errores de PostgreSQL a respuestas HTTP              | ¿Qué devuelve en producción ante un error inesperado?        |
| `backend/src/middleware/validacion.middleware.js`  | Validación con Zod antes de llegar al servicio               | ¿Dónde se valida, y por qué ahí?                             |
| `backend/src/app.js`                               | El orden de los middlewares, que es una decisión en sí mismo | ¿Por qué el rate limit de escrituras va antes de autenticar? |
| `frontend/src/components/grillaCalculos.js`        | Toda la matemática de la grilla, sin React                   | ¿Por qué está separado del componente?                       |
| `backend/tests/concurrencia.test.js`               | La prueba que justifica la decisión central                  | ¿Por qué espera exactamente un 201?                          |

El de `grillaCalculos.js` tiene una respuesta corta y buena: porque los cálculos
puros se prueban sin montar nada, y quedaron 15 pruebas que corren en
milisegundos.

---

## 4. Banco de preguntas

**¿Qué pasa si dos pedidos idénticos llegan en el mismo milisegundo?**
Ambos pasan la verificación previa de solapamiento, porque ninguno ve al otro
sin confirmar. Ambos llegan al `INSERT`. PostgreSQL serializa el segundo contra
la restricción de exclusión: uno confirma, el otro recibe `23P01` y el
manejador lo convierte en 400. Nunca hay dos reservas.

**¿Y si son el mismo pedido reintentado?**
Si trae la misma `Idempotency-Key`, el segundo devuelve la respuesta guardada
del primero. Si el primero todavía no confirmó, el segundo choca contra la
restricción, reintenta la búsqueda de la clave cuatro veces con esperas de 0,
20, 40 y 80 ms, y devuelve la respuesta del que ganó.

**¿Por qué `tsrange` y no dos columnas `timestamp`?**
Porque `&&` (se superponen) es un operador sobre rangos, y es lo que el índice
GiST sabe indexar. Con dos columnas sueltas habría que escribir la condición a
mano en cada consulta, y la base no podría imponerla como restricción.

**¿La restricción no hace lenta la escritura?**
Mantiene un índice GiST, así que sí cuesta algo. Medido sobre 200.000
registros, la verificación tarda unos 50 microsegundos. A cambio evita una
consulta previa por cada inserción y, sobre todo, hace imposible el error.

**¿Por qué el chequeo previo de solapamiento, si la restricción ya lo garantiza?**
Por el mensaje. Sin él, el usuario vería el error de la restricción traducido
igual, pero se perdería la posibilidad de dar un mensaje específico antes de
abrir la transacción pesada. Es cortesía, no corrección: si se borrara, el
sistema seguiría siendo correcto.

**¿Qué pasa si se borra la restricción de exclusión?**
Vale la pena hacerlo en una base de prueba y mirar. Las pruebas de negocio
siguen pasando, porque el chequeo previo las cubre. La que se cae es la de
concurrencia: aparecen dos o más 201. Es el experimento que mejor demuestra por
qué la decisión está donde está.

**¿Por qué `liveness` no consulta la base?**
Porque responde una pregunta distinta. Ver 2.10.

**¿Cómo se sabe que la documentación de la API es cierta?**
Una prueba compara las rutas registradas en Express contra las de la
especificación. Si no coinciden, falla.

**¿Qué pasa con una reserva cancelada?**
Deja de ocupar la franja, porque la restricción es parcial
(`WHERE estado IN ('pendiente','aprobada')`), pero la fila no se borra: queda en
la tabla y su cancelación queda en el historial. Hay una prueba E2E que
comprueba que la franja se libera.

**¿Por qué el frontend genera la `Idempotency-Key` y no el backend?**
Porque la clave tiene que sobrevivir al reintento. Si la generara el servidor,
cada reintento traería una clave nueva y no habría nada que comparar. Se renueva
con cada cambio del formulario, para que modificar un dato y reenviar sí cree
una solicitud distinta.

---

## 5. Lo que el proyecto no hace

Conviene decirlo antes de que lo pregunten:

- **La identidad está delegada a Clerk.** No hay implementación propia de
  registro, recuperación de contraseña, rotación de sesiones ni 2FA. El JWT
  local existe para pruebas y para el modo sin red.
- **No hay usuarios reales.** Todo el comportamiento bajo carga es simulado: 100
  pedidos concurrentes en una prueba y un escenario de k6, no tráfico real.
- **El token vive en `localStorage`.** Es vulnerable a XSS. Está mitigado con una
  CSP estricta sin `'unsafe-inline'` en `script-src`, pero la solución correcta
  son cookies `HttpOnly` con protección CSRF, y está documentada como pendiente.
- **No hay notificaciones.** Aprobar una reserva no avisa a nadie: hay que entrar
  a verlo.
- **No hay reservas periódicas** ("todos los martes del cuatrimestre"), que es lo
  primero que pediría una bedelía real.
- **No hay multi-institución.** Las aulas son una lista plana, sin sedes ni
  facultades.
- **El despliegue está documentado pero no hay un entorno vivo.** Hay
  `docker-compose.prod.yml` y una guía, no una URL funcionando.

---

## 6. Guion de dos minutos

> Es un sistema de reservas de aulas para una bedelía universitaria. El problema
> central es que dos personas no puedan reservar la misma aula en el mismo
> horario, y lo resolví en la base de datos y no en el código de la aplicación:
> PostgreSQL tiene una restricción de exclusión sobre un índice GiST que hace
> imposible insertar dos reservas superpuestas para la misma aula. Elegí eso
> porque la alternativa —consultar y después insertar— tiene una ventana de
> carrera entre las dos sentencias, y tengo una prueba que dispara cien pedidos
> simultáneos por la misma franja y verifica que entre exactamente uno.
>
> Encima de eso hay dos cosas que me parecen las más interesantes. Una es la
> idempotencia: el formulario manda una `Idempotency-Key`, el servidor guarda la
> respuesta junto a un hash del cuerpo, y un doble clic o un reintento devuelven
> la misma reserva en lugar de crear una segunda. La otra es la auditoría: cada
> cambio de estado se escribe en una tabla de historial dentro de la misma
> transacción, así que no puede existir un cambio sin su registro.
>
> Del lado del frontend, lo que resuelve el problema real del usuario es la
> grilla de disponibilidad: media hora por celda, de ocho a diez de la noche, con
> los estados diferenciados por patrón además de por color, así que funciona sin
> distinguir colores. Y el listado está organizado como una agenda por jornada,
> porque el tema del sistema es cuándo está ocupada cada aula.
>
> Lo que me faltó y lo sé: no hay usuarios reales, la identidad está delegada a
> Clerk en vez de implementada, y el token vive en `localStorage` con una CSP
> estricta como mitigación en lugar de cookies `HttpOnly`, que es lo correcto.

---

## 7. Cómo prepararse, en orden

1. Leer este documento entero, una vez.
2. Leer los cinco [ADRs](adr/README.md). Son cortos y cada uno dice qué se
   descartó.
3. Abrir `crearNuevaReserva` en `reservas.services.js` y seguir el recorrido de
   la sección 1 con el código a la vista.
4. Correr `npm test --prefix backend` y mirar los nombres de las pruebas de
   concurrencia e idempotencia: están escritos como afirmaciones.
5. **El ejercicio que más rinde:** borrar la restricción de exclusión en una base
   de prueba, correr las pruebas y ver cuáles se caen y cuáles no.
6. Responder en voz alta las preguntas de la sección 4, sin leer.
