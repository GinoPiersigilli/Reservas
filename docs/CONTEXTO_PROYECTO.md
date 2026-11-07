# Contexto completo — Sistema de Reservas de Aulas

---

## Stack tecnológico

- **Frontend:** React 19 + Vite + React Router (`react-router-dom`)
- **Backend:** Node.js (ESM) + Express + Sequelize 6 + PostgreSQL 16 (`pg` + `pg-hstore`)
- **Migraciones y Seed:** `sequelize-cli` (`backend/db/migrations/` y `backend/db/seeders/`)
- **Autenticación:** Clerk (`@clerk/backend` / `@clerk/clerk-react`) con aprovisionamiento local (JIT) + JWT local para usuarios de prueba
- **Seguridad:** `helmet`, `express-rate-limit` en `/api/auth/login`, CORS configurable por `CORS_ORIGINS`, validación de entorno en arranque (`src/config/env.js`)
- **Contenedores:** Docker Compose (PostgreSQL 16 con creación automática de `reservas` y `reservas_test`)
- **Testing:** Jest + Supertest en backend (`backend/tests/`); Vitest + Testing Library en frontend (`frontend/src/pages/__tests__/`)
- **CI:** GitHub Actions (`.github/workflows/ci.yml`)

---

## Estructura de carpetas

```
reservas/
├── .github/
│   └── workflows/
│       └── ci.yml                        ← Pipeline CI (Postgres + migraciones + lint + tests)
├── docker/
│   └── postgres/
│       └── init-test-db.sql              ← Crea la base reservas_test al inicializar el contenedor
├── docker-compose.yml                    ← Servicio PostgreSQL 16 con healthcheck
├── .env.example                          ← Variables de entorno para Docker Compose
├── README.md
├── docs/
│   ├── CONTEXTO_PROYECTO.md              ← Este documento
│   ├── PLAN_MEJORAS_ANTIGRAVITY.md
│   └── PLAN_POSTGRESQL.md
├── backend/
│   ├── index.js                          ← Entry point (authenticate BD + listen)
│   ├── package.json
│   ├── eslint.config.js
│   ├── jest.config.cjs
│   ├── .sequelizerc
│   ├── .env.example
│   ├── db/
│   │   ├── config.cjs                    ← Configuración de sequelize-cli por entorno
│   │   ├── migrations/
│   │   │   ├── 001-baseline.cjs
│   │   │   └── 002-esquema-definitivo.cjs
│   │   └── seeders/
│   │       └── 001-demo-data.cjs         ← Seed idempotente con fechas relativas a hoy
│   ├── scripts/
│   │   └── legacy/
│   │       └── migrar-sqlite-a-postgres.js
│   ├── src/
│   │   ├── app.js                        ← Express app, helmet, CORS, rutas, error handler
│   │   ├── config/
│   │   │   ├── env.js                    ← Validación estricta de variables de entorno
│   │   │   └── database.js               ← Instancia Sequelize (PostgreSQL)
│   │   ├── utils/
│   │   │   └── fecha.js                  ← Helpers en zona America/Argentina/Cordoba
│   │   ├── models/
│   │   │   ├── index.js                  ← Export central de modelos y asociaciones
│   │   │   ├── usuario.model.js
│   │   │   ├── aula.model.js
│   │   │   ├── reserva.model.js
│   │   │   └── historial.model.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── aulas.routes.js
│   │   │   └── reservas.routes.js
│   │   ├── controllers/
│   │   │   ├── aulas.controllers.js
│   │   │   └── reservas.controller.js
│   │   ├── services/
│   │   │   ├── auth.services.js
│   │   │   ├── aulas.services.js
│   │   │   ├── reservas.services.js
│   │   │   └── historial.services.js
│   │   └── middleware/
│   │       ├── auth.middleware.js        ← verificarToken, sincronizarUsuarioClerk, soloAdmin
│   │       ├── validacion.middleware.js
│   │       └── error.middleware.js
│   └── tests/
│       ├── setup/
│       │   ├── globalSetup.cjs           ← Ejecuta migraciones en reservas_test
│       │   └── dbHelpers.js              ← Limpieza con TRUNCATE ... RESTART IDENTITY CASCADE
│       ├── auth.test.js
│       ├── reservas.test.js
│       └── esquema-constraint.test.js
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── eslint.config.js
    ├── .env.example
    └── src/
        ├── main.jsx                      ← ClerkProvider + BrowserRouter
        ├── App.jsx                       ← AuthProvider + Routes
        ├── index.css
        ├── test-utils.jsx                ← Setup de Vitest + Testing Library
        ├── context/
        │   └── AuthContext.jsx           ← usuario, iniciarSesionLocal, cerrarSesion
        ├── components/
        │   ├── RutaProtegida.jsx
        │   ├── RutaSoloAdmin.jsx
        │   ├── FiltrosReservas.jsx
        │   ├── TablaReservas.jsx
        │   ├── AccionesReserva.jsx
        │   └── HistorialReserva.jsx
        ├── pages/
        │   ├── Login.jsx                 ← Login local + SignIn de Clerk
        │   ├── Register.jsx
        │   ├── Reservas.jsx
        │   ├── DetalleReserva.jsx
        │   ├── FormularioReserva.jsx
        │   ├── Resumen.jsx
        │   ├── NotFound.jsx
        │   └── __tests__/
        │       ├── Login.test.jsx
        │       ├── Register.test.jsx
        │       ├── Reservas.test.jsx
        │       └── FormularioReserva.test.jsx
        └── services/
            ├── axios.js                  ← Instancia Axios + interceptor Bearer token
            ├── auth.service.js
            ├── reservas.service.js
            ├── aula.service.js
            └── aulas.service.js
```

---

## Variables de entorno

Nunca commitear archivos `.env` con secretos reales. Usar los `.env.example` como plantilla:

### Raíz `.env` (Docker Compose)
```env
POSTGRES_USER=reservas
POSTGRES_PASSWORD=<tu_password_postgres>
POSTGRES_DB=reservas
POSTGRES_PORT=5432
```

### Backend `backend/.env`
```env
PORT=3001
NODE_ENV=development
JWT_SECRET=<tu_clave_secreta_jwt>
CLERK_SECRET_KEY=sk_test_...
CORS_ORIGINS=http://localhost:5173
WORK_HOUR_START=08:00
WORK_HOUR_END=22:00
DATABASE_URL=postgres://reservas:<tu_password_postgres>@localhost:5432/reservas
DATABASE_URL_TEST=postgres://reservas:<tu_password_postgres>@localhost:5432/reservas_test
LOG_SQL=false
```
> En `src/config/env.js`: si falta `JWT_SECRET` o `DATABASE_URL` (y en `production` también `CLERK_SECRET_KEY`), el servidor aborta el arranque inmediatamente con un error descriptivo.

### Frontend `frontend/.env`
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE_URL=http://localhost:3001/api
```

---

## Esquema de base de datos y modelos (PostgreSQL)

El esquema se gestiona mediante migraciones de `sequelize-cli` en `backend/db/migrations/`:
- `001-baseline.cjs`: creación inicial de tablas `usuarios`, `aulas`, `reservas` e `historial_reservas`.
- `002-esquema-definitivo.cjs`: extensión `btree_gist`, claves foráneas (`ON DELETE RESTRICT`), restricciones `CHECK`, índices y constraint de exclusión `reservas_sin_solapamiento`.

### `Usuario` (`usuarios`)
```js
{
  id: INTEGER (PK, autoincrement),
  nombre: STRING (NOT NULL),
  email: STRING (NOT NULL, UNIQUE),
  passwordHash: STRING (NULLABLE — null para usuarios Clerk o Sistema),
  clerkId: STRING (NULLABLE, UNIQUE),
  rol: STRING (NOT NULL, default: 'usuario', CHECK IN ('usuario', 'admin')),
  activo: BOOLEAN (NOT NULL, default: true),
  createdAt: TIMESTAMPTZ (NOT NULL, default: NOW)
}
```

### `Aula` (`aulas`)
```js
{
  id: INTEGER (PK, autoincrement),
  nombre: STRING (NOT NULL),
  ubicacion: STRING (NOT NULL),
  capacidad: INTEGER (NOT NULL, CHECK (capacidad > 0)),
  recursos: STRING (NULLABLE, separado por comas),
  activa: BOOLEAN (NOT NULL, default: true)
}
```

### `Reserva` (`reservas`)
```js
{
  id: INTEGER (PK, autoincrement),
  aulaId: INTEGER (NOT NULL, FK → aulas.id ON DELETE RESTRICT),
  usuarioId: INTEGER (NOT NULL, FK → usuarios.id ON DELETE RESTRICT),
  fecha: DATEONLY ('YYYY-MM-DD', NOT NULL),
  horaInicio: TIME (NOT NULL, getter devuelve 'HH:MM'),
  horaFin: TIME (NOT NULL, getter devuelve 'HH:MM', CHECK ("horaInicio" < "horaFin")),
  cantidadPersonas: INTEGER (NOT NULL, CHECK ("cantidadPersonas" > 0)),
  motivo: STRING (NOT NULL, máx. 255 caracteres),
  estado: STRING (NOT NULL, default: 'pendiente', CHECK IN ('pendiente','aprobada','cancelada','rechazada')),
  createdAt: TIMESTAMPTZ (NOT NULL),
  updatedAt: TIMESTAMPTZ (NOT NULL)
}
```
- **Constraint de exclusión en PostgreSQL (`reservas_sin_solapamiento`):**
  ```sql
  EXCLUDE USING gist (
    "aulaId" WITH =,
    tsrange(("fecha" + "horaInicio"), ("fecha" + "horaFin"), '[)') WITH &&
  ) WHERE (estado IN ('pendiente', 'aprobada'))
  ```
  Garantiza a nivel motor de base de datos que jamás existan dos reservas `pendiente` o `aprobada` superpuestas en la misma aula y fecha, incluso ante peticiones concurrentes. El intervalo semiabierto `'[)'` permite reservas contiguas que comparten el borde exacto (ej. `10:00–11:00` y `11:00–12:00`).

### `HistorialReserva` (`historial_reservas`)
```js
{
  id: INTEGER (PK, autoincrement),
  reservaId: INTEGER (NOT NULL, FK → reservas.id ON DELETE RESTRICT),
  usuarioId: INTEGER (NOT NULL, FK → usuarios.id ON DELETE RESTRICT),
  accion: STRING (NOT NULL, CHECK IN ('creacion','edicion','aprobacion','rechazo','cancelacion')),
  fechaHora: TIMESTAMPTZ (NOT NULL, default: NOW),
  valorAnterior: JSONB (NULLABLE),
  valorNuevo: JSONB (NULLABLE)
}
```

---

## Reglas de negocio (`reservas.services.js` y `validacion.middleware.js`)

### Al crear una reserva (`POST /api/reservas`):
1. Campos obligatorios (`aulaId`, `fecha`, `horaInicio`, `horaFin`, `cantidadPersonas`, `motivo`) y validación de formato:
   - `aulaId`: entero positivo → 400 si es inválido.
   - `fecha`: formato `YYYY-MM-DD` válido y no pasada respecto de `America/Argentina/Cordoba` → 400 `"No se permiten reservas en una fecha pasada"`.
   - `horaInicio` y `horaFin`: formato `HH:MM` (`^([01]\d|2[0-3]):[0-5]\d$`) → 400.
   - `cantidadPersonas`: entero `> 0` → 400.
   - `motivo`: string no vacío de hasta 255 caracteres → 400.
2. `horaInicio < horaFin` → si no: 400 `"La hora de inicio debe ser menor a la hora de fin"`.
3. Horario laboral (`08:00` a `22:00`) → si no: 400 `"Las reservas solo se permiten entre las 08:00 y las 22:00"`.
4. El `aulaId` debe existir en la BD → si no: 404 `"El aula solicitada no existe"`.
5. El aula debe estar activa (`activa: true`) → si no: 400 `"El aula no está activa para nuevas reservas"`.
6. `cantidadPersonas <= aula.capacidad` → si no: 400 `"La cantidad de personas supera la capacidad del aula"`.
7. No debe solaparse con otra reserva `pendiente` o `aprobada` de la misma aula y fecha (validado dentro de transacción y garantizado por la constraint `reservas_sin_solapamiento` código `23P01`) → si hay conflicto: 400 `"El aula ya está reservada en ese horario"`.
8. Se crea con `estado: 'pendiente'` y registra en historial `accion: 'creacion'`, `valorAnterior: null`, `valorNuevo: { estado: 'pendiente' }` en la misma transacción.

### Al editar una reserva (`PUT /api/reservas/:id`):
- Solo `admin` puede editar (403 si es usuario común).
- No se puede editar una reserva `cancelada` o `rechazada` → 400 `"No se puede editar una reserva cancelada o rechazada"`.
- Usa comparación estricta `!== undefined` para cada campo modificado y re-valida que el aula exista (404), esté activa (400), cumpla capacidad, horario laboral, fecha no pasada y no se solape con otras reservas (`id != reservaId`).
- Registra en historial `accion: 'edicion'` con `valorAnterior` y `valorNuevo` dentro de la misma transacción.

### Flujo de estados:
```
pendiente → aprobada    (solo admin)
pendiente → rechazada   (solo admin)
pendiente → cancelada   (admin o propietario de la reserva)
aprobada  → cancelada   (admin o propietario de la reserva)

cancelada  → ❌ no puede cambiar a ningún estado
rechazada  → ❌ no puede cambiar a ningún estado
```
Todas las transiciones de estado y su registro en `historial_reservas` (`'aprobacion'`, `'rechazo'`, `'cancelacion'`) se ejecutan dentro de una transacción.

### Autorización por propiedad y listado (`GET /api/reservas`):
- Un usuario con rol `'usuario'` solo lista sus propias reservas (`where.usuarioId = usuario.id`). Si solicita `GET /api/reservas/:id` o `GET /api/reservas/:id/historial` de otro usuario, recibe `404 "La reserva no existe"`.
- Un usuario `'admin'` puede listar y consultar todas las reservas.
- Filtros combinables: `fecha`, `estado`, `aulaId`, `q` (búsqueda en `motivo`), `page` (default 1), `limit` (default 10, tope máximo 100), `sortBy` (lista blanca: `createdAt`, `fecha`, `horaInicio`, `estado`, `aulaId`, `id`), `order` (`ASC` o `DESC`, default `DESC`).

### Resumen administrativo (`GET /api/reservas/resumen`):
- Calcula la fecha de hoy y la hora actual en la zona horaria `America/Argentina/Cordoba` (`src/utils/fecha.js`).
- Devuelve `{ porEstado, porAula, proximasHoy }`.

---

## Endpoints del backend

### Auth
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Login local con email/password (con rate limit), devuelve `{ token, usuario }` | No (Público) |

### Aulas
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/api/aulas` | Lista las aulas activas ordenadas por nombre | No (Público) |
| GET | `/api/aulas/:id/disponibilidad?fecha=YYYY-MM-DD` | Devuelve franjas ocupadas (`[{ horaInicio, horaFin, estado }]`) para esa aula y fecha | Token |

### Reservas
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/api/reservas` | Listado con filtros y paginación (propias o todas si es admin) | Token |
| GET | `/api/reservas/resumen` | Resumen administrativo | Admin |
| GET | `/api/reservas/:id` | Detalle de una reserva | Token (propietario o admin) |
| GET | `/api/reservas/:id/historial` | Historial de cambios de la reserva | Token (propietario o admin) |
| POST | `/api/reservas` | Crear reserva | Token |
| PUT | `/api/reservas/:id` | Editar reserva | Admin |
| PATCH | `/api/reservas/:id/aprobar` | Aprobar reserva pendiente | Admin |
| PATCH | `/api/reservas/:id/rechazar` | Rechazar reserva pendiente | Admin |
| PATCH | `/api/reservas/:id/cancelar` | Cancelar reserva pendiente o aprobada | Token (propietario o admin) |

---

## Seed de datos (`backend/db/seeders/001-demo-data.cjs`)

Se ejecuta con `npm run seed` desde `backend/` (idempotente):
- **5 usuarios locales:**
  - `sistema@utnfrc.edu.ar` (usuario técnico inactivo para registros históricos del sistema)
  - `admin@utnfrc.edu.ar` / `admin123` (rol `admin`)
  - `david@utnfrc.edu.ar` / `user123` (rol `usuario`)
  - `laura.perez@dds.edu.ar` / `usuario123` (rol `usuario`)
  - `pedro.gomez@dds.edu.ar` / `usuario456` (rol `usuario`)
- **5 aulas:** Aula 910 (cap. 45), Laboratorio A6 (cap. 30), Aula Magna (cap. 150), A4 (cap. 60, inactiva), Sala de Reuniones B (cap. 15).
- **10 reservas** distribuidas en fechas relativas a hoy (`America/Argentina/Cordoba`) y en distintos estados (`pendiente`, `aprobada`, `cancelada`, `rechazada`), con sus entradas correspondientes en `historial_reservas`.

---

## Tests y calidad

- **Backend (`backend/tests/`):**
  - `auth.test.js`: login local, credenciales inválidas, rechazo de tokens con firma inválida (401), validación de variables de entorno en arranque, aprovisionamiento y vinculación de usuarios Clerk (`sincronizarUsuarioClerk`), registro de usuarios.
  - `reservas.test.js`: permisos por rol y propiedad, validaciones de creación y edición, flujo completo de estados e historial, rollback transaccional ante fallos, concurrencia (10 `POST` simultáneos al mismo horario → exactamente un `201`), zona horaria `America/Argentina/Cordoba`, filtros, paginación, resumen y endpoint de disponibilidad.
  - `esquema-constraint.test.js`: verificación directa de la exclusion constraint `reservas_sin_solapamiento` en PostgreSQL.
- **Frontend (`frontend/src/pages/__tests__/`):**
  - `Login.test.jsx`: renderizado y login local guardando token y usuario.
  - `Reservas.test.jsx`: listado de reservas, estado vacío y manejo de error de carga.
  - `FormularioReserva.test.jsx`: creación exitosa de reserva y mensaje de error ante solapamiento horario.
  - `Register.test.jsx`: renderizado, envío del formulario y error por email duplicado.
