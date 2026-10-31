# Plan de mejoras — Sistema de Reservas de Aulas

> Para usar con Antigravity: abrí la carpeta `reservas/` como workspace, usá el Agent Manager en modo **Planning** y pegá este archivo como instrucción (o dejalo en la raíz y pedile que lo siga fase por fase).
> Basado en una lectura del código real, no solo de `CONTEXTO_PROYECTO.md`. Donde difieren, **manda el código**.

---

## 0. Reglas para el agente

1. Trabajá en una rama por fase (`mejora/fase-1-seguridad`, etc.). Un commit por tarea.
2. Antes de tocar la base: copiá `backend/database.sqlite` a `backend/backups/` (carpeta ignorada por git).
3. No cambies los contratos de la API (rutas, status HTTP, forma de las respuestas) salvo que la tarea lo diga. El frontend los usa.
4. Cada tarea termina con tests pasando (`cd backend && npm test`). Si agregás comportamiento, agregá test.
5. Nunca imprimas ni commitees valores de `.env`.
6. Al terminar cada fase, listá qué cambió y qué quedó pendiente. No sigas a la siguiente sin confirmación.

---

## 1. Diagnóstico (lo que se encontró)

### Seguridad — crítico
| # | Problema | Dónde |
|---|---|---|
| S1 | **El token de Clerk no se verifica.** Se decodifica el payload con `Buffer.from(...)` y se confía en `sub`. Cualquiera puede fabricar un token con el `sub` de un admin y entrar como admin. | `auth.middleware.js` |
| S2 | `JWT_SECRET` tiene un valor por defecto escrito en el código (y también está en `CONTEXTO_PROYECTO.md`). Si falta la variable, cualquiera puede firmar tokens válidos. | `auth.middleware.js`, `auth.services.js` |
| S3 | `database.sqlite` está **versionada en git** (con hashes de contraseñas y datos reales). Queda en el historial. | `git ls-files` |
| S4 | Cualquier usuario autenticado puede ver **todas** las reservas, el detalle y el historial de otros. | `reservas.routes.js` |
| S5 | `GET /reservas` acepta `limit` sin tope y `sortBy` sin lista blanca (un valor inválido da 500). | `reservas.services.js` |
| S6 | Sin rate limit en `/auth/login`, sin `helmet`, CORS fijo a localhost. | `app.js` |

> Nota: el zip incluía `backend/.env` con la `CLERK_SECRET_KEY`. Si ese zip se compartió fuera de tu máquina, **rotá la clave** desde el dashboard de Clerk.

### Base de datos
| # | Problema |
|---|---|
| D1 | **Identidad partida en dos.** `reservas.usuarioId` está declarado `INTEGER` pero la base tiene mezcla: 14 filas con id numérico y 11 con strings de Clerk (`user_...` y UUID de Keycloak). SQLite lo tolera, pero rompe en cualquier otro motor y hace frágil la comparación `usuarioId !== usuario.id`. |
| D2 | Los usuarios de Clerk **no existen** en la tabla `usuarios`: no se puede mostrar quién reservó, ni listar, ni bloquear. |
| D3 | Sin claves foráneas (la base no tiene ni una) ni asociaciones de Sequelize. Se puede reservar un aula inexistente a nivel BD, y el historial no se enlaza con nada. |
| D4 | Sin índices salvo el unique de email. La consulta de solapamiento filtra por `aulaId + fecha + estado` sin índice. |
| D5 | `estado`, `rol` y `accion` son `STRING` libre (el contexto dice ENUM, el código no). Sin `CHECK`. |
| D6 | Horas guardadas como texto `HH:MM` sin validar formato. Con `"9:00"` la comparación de strings da resultados incorrectos. |
| D7 | Esquema creado con `sequelize.sync()`: sin migraciones, sin forma de evolucionar el esquema sin perder datos. |
| D8 | Sin `updatedAt`. Sin borrado lógico de aulas. |
| D9 | Seed con fechas de junio 2026 (ya pasadas), usuarios que quedan duplicados entre las dos secciones del seed, comentarios de Keycloak obsoletos. Ids "sistema" = `0` sin usuario real. |

### Lógica de negocio
| # | Problema |
|---|---|
| L1 | **Condición de carrera:** el chequeo de solapamiento y el `INSERT` no están en una transacción. Dos requests simultáneos pueden crear dos reservas que se pisan. |
| L2 | `obtenerResumen` calcula "hoy" con `toISOString()` (UTC) pero la hora con hora local: en Argentina, después de las 21:00 "hoy" pasa a ser mañana. |
| L3 | Se pueden crear reservas en fechas **pasadas**. No se valida formato de fecha/hora ni `cantidadPersonas > 0`. |
| L4 | `editarReserva` usa `valor \|\| actual` (un valor `0` o vacío se ignora) y no re-valida que el aula siga activa. |
| L5 | `cancelarReserva` solo chequea propiedad si `rol === 'usuario'`; cualquier otro valor de rol se salta el control. |

### Estructura / deuda
- Restos de una migración anterior: `reservas/src/`, `reservas/index.html`, `reservas/package.json`, `reservas/public/` en la raíz (archivos de 0 bytes o duplicados de `frontend/`).
- `docker-compose.yml` solo levanta Keycloak, que ya no se usa.
- Tests: 14 casos en total (`auth.test.js` 4, `reservas.test.js` 10). Sin tests de permisos ni de concurrencia. El contexto dice `src/tests/`, están en `backend/tests/`.
- Sin deploy ni CI.

---

## 2. Fases

### Fase 1 — Seguridad (hacer primero)
**Objetivo:** que nadie pueda suplantar a otro usuario ni leer datos ajenos.

- [ ] **S1** Reemplazar la decodificación manual por verificación real con `verifyToken` de `@clerk/backend` (usa `CLERK_SECRET_KEY`, valida firma, expiración y `azp`). Mantener el mismo shape de `req.usuario`.
- [ ] **S2** Quitar el valor por defecto de `JWT_SECRET`. Si falta en producción, el servidor **no arranca** (falla explícita). Un único módulo `config/env.js` valida todas las variables al inicio.
- [ ] **S3** `git rm --cached backend/database.sqlite`, agregar `*.sqlite` y `backups/` a `.gitignore`. Documentar en el README que el historial anterior contiene la base (y, si el repo es privado de la facultad, evaluar si hace falta reescribirlo).
- [ ] **S4** Autorización por propiedad: usuario común solo ve/lista **sus** reservas e historial; admin ve todo. Respuesta `403` (o `404` para no revelar existencia).
- [ ] **S5** `limit` máximo 100; `sortBy` con lista blanca (`createdAt`, `fecha`, `horaInicio`, `estado`, `aulaId`); `order` solo `ASC|DESC`.
- [ ] **S6** `helmet`, `express-rate-limit` en `/api/auth/login` (ej. 10 intentos / 15 min), CORS desde variable `CORS_ORIGINS`.
- [ ] **L5** Autorización por lista explícita de roles, no por exclusión.

**Aceptación:** test que demuestra que un token con firma inválida → 401; usuario A no puede leer reserva de usuario B → 403/404; servidor sin `JWT_SECRET` en `NODE_ENV=production` no arranca.

### Fase 2 — Base de datos
**Objetivo:** esquema consistente, con integridad garantizada por la BD y evolucionable.

- [ ] **D7** Introducir migraciones (`sequelize-cli` o `umzug`) y dejar de usar `sync()` en arranque. Migración `000-baseline` que refleje el esquema actual.
- [ ] **D1/D2** Unificar identidad:
  - `usuarios`: agregar `clerkId` (STRING, unique, nullable) y hacer `passwordHash` nullable.
  - Al primer request autenticado con Clerk, **crear o vincular** el usuario local (por `clerkId`, luego por email) — "just-in-time provisioning".
  - `reservas.usuarioId` y `historial_reservas.usuarioId` pasan a ser `INTEGER` FK a `usuarios.id`.
  - Script de migración de datos: mapear los `usuarioId` string existentes a usuarios locales (crear los que falten con el `clerkId`); los UUID de Keycloak sin equivalente van a un usuario "Sistema" real (reemplaza el `0`). Reportar cuántas filas se migraron y verificar con `SELECT` que no queden strings.
- [ ] **D3** Asociaciones Sequelize (`Aula.hasMany(Reserva)`, `Usuario.hasMany(Reserva)`, `Reserva.hasMany(HistorialReserva)`) y FKs reales con `ON DELETE RESTRICT`. Activar `PRAGMA foreign_keys = ON` en la conexión SQLite.
- [ ] **D4** Índices: `reservas(aulaId, fecha, estado)`, `reservas(usuarioId)`, `reservas(estado)`, `historial_reservas(reservaId, fechaHora)`.
- [ ] **D5** `CHECK` en `estado`, `rol`, `accion`, `capacidad > 0`, `cantidadPersonas > 0`, `horaInicio < horaFin`. Pasar los campos a `DataTypes.ENUM` o `STRING` + validación de modelo.
- [ ] **D6** Validar formato `HH:MM` (regex `^([01]\d|2[0-3]):[0-5]\d$`) en modelo y en middleware. Mantener texto `HH:MM` (cambio mínimo) pero con `CHECK` de formato.
- [ ] **D8** `updatedAt` en `reservas`; `aulas.activa` ya sirve como baja lógica, agregar `deletedAt` solo si se necesita borrar.
- [ ] **D9** Reescribir el seed: una sola sección, idempotente, fechas **relativas a hoy** (ej. hoy+1, hoy+3), usuario "Sistema" real, sin referencias a Keycloak. Mantener los 2 usuarios de prueba documentados.

**Aceptación:** `npm run migrate` sobre una copia de la base actual termina sin errores y sin filas huérfanas; `PRAGMA foreign_key_check` vacío; todos los tests pasan; base nueva + seed reproducible desde cero.

### Fase 3 — Lógica de negocio
- [ ] **L1** Envolver "validar solapamiento + crear + historial" en **una transacción** (en SQLite, `IMMEDIATE`) para que sea atómico. Hacer lo mismo en `editarReserva`, `aprobarReserva` y `cancelarReserva`. Test de concurrencia: lanzar 10 `POST` simultáneos al mismo horario → exactamente 1 devuelve 201.
- [ ] **L2** Calcular "hoy" y "hora actual" con una única zona horaria (`America/Argentina/Cordoba`), centralizado en un helper.
- [ ] **L3** Validar: fecha con formato `YYYY-MM-DD` y no pasada, `cantidadPersonas` entero > 0, `motivo` con largo máximo. Mensajes de error iguales al estilo actual.
- [ ] **L4** En `editarReserva` usar `!== undefined` en vez de `||`, y re-validar que el aula esté activa.
- [ ] Al aprobar, volver a chequear solapamiento (por si una edición posterior generó conflicto).
- [ ] Endpoint de disponibilidad: `GET /api/aulas/:id/disponibilidad?fecha=YYYY-MM-DD` que devuelva franjas ocupadas, para que el frontend las muestre antes de enviar.

### Fase 4 — Calidad y estructura
- [ ] Borrar restos de la raíz (`src/`, `index.html`, `package.json`, `public/` vacíos o duplicados). **Listar primero lo que se va a borrar y esperar confirmación.**
- [ ] Reemplazar Keycloak en `docker-compose.yml` por lo que realmente se usa (backend + frontend, y Postgres si se elige la Fase 5).
- [ ] Tests: permisos por rol, propiedad, concurrencia, migraciones, validaciones de formato. Meta: cubrir cada regla de negocio de `CONTEXTO_PROYECTO.md`.
- [ ] ESLint pasando en backend y frontend; script `npm run lint`.
- [ ] CI mínimo (GitHub Actions o el GitLab de la facultad): lint + test en cada push.
- [ ] Actualizar `CONTEXTO_PROYECTO.md` para que refleje el código real (ver sección 3).

### Fase 5 — Opcional: PostgreSQL y deploy
Solo si van a desplegar en serio. Con PostgreSQL el anti-solapamiento puede garantizarse **en la propia base** con una *exclusion constraint* (`btree_gist` + `tstzrange(aulaId, fecha+horaInicio, fecha+horaFin)`), lo que elimina la carrera de raíz.
- [ ] Parametrizar el dialecto por `DATABASE_URL`; SQLite queda para dev/test.
- [ ] Servicio `postgres` en `docker-compose.yml`.
- [ ] Constraint de exclusión en una migración específica de Postgres.
- [ ] Dockerfile del backend, variables de entorno de producción, guía de deploy.

---

## 3. Correcciones al `CONTEXTO_PROYECTO.md`
Para que el próximo chat/agente no parta de datos falsos:
- `usuarioId` figura como STRING; en el código es INTEGER (y la BD tiene mezcla). Se resuelve en Fase 2.
- `estado` figura como ENUM; en el código es STRING.
- Los tests están en `backend/tests/`, no `backend/src/tests/`.
- Hay 14 tests, no "solo `auth.test.js` parcial".
- Lista de endpoints: falta aclarar que `GET /api/aulas` no requiere token.
- El seed real crea 5 usuarios y 5 aulas (no 2 usuarios), y las fechas están vencidas.
- Quitar `JWT_SECRET` real del documento.
