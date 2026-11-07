# Contexto completo — Sistema de Reservas de Aulas
## Para Claude Code / chat nuevo

---

## Stack tecnológico

- **Frontend:** React + Vite + React Router v6
- **Backend:** Node.js + Express + Sequelize + SQLite
- **Autenticación:** Clerk (OAuth / Google) + JWT local para usuarios de prueba
- **Contenedores:** Docker Compose (Keycloak legacy, ya no en uso activo)
- **CSS:** CSS puro con variables custom (tema oscuro tipo SaaS)
- **Fuente:** Inter (Google Fonts)

---

## Estructura de carpetas

```
reservas/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── index.js                  ← entry point, sync BD + seed + listen
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── app.js                ← Express app, CORS, rutas, error handler
│       ├── config/
│       │   └── database.js       ← Sequelize + SQLite config
│       ├── models/
│       │   ├── usuario.model.js
│       │   ├── aula.model.js
│       │   ├── reserva.model.js
│       │   └── historial.model.js
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── aulas.routes.js
│       │   └── reservas.routes.js
│       ├── controllers/
│       │   ├── aulas.controllers.js
│       │   └── reservas.controller.js
│       ├── services/
│       │   ├── auth.services.js
│       │   ├── aulas.services.js
│       │   ├── reservas.services.js
│       │   └── historial.services.js
│       ├── middleware/
│       │   ├── auth.middleware.js      ← verificarToken, soloAdmin
│       │   ├── validacion.middleware.js
│       │   └── error.middleware.js
│       └── tests/
│           └── auth.test.js
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── .env                      ← VITE_CLERK_PUBLISHABLE_KEY, VITE_API_BASE_URL
    └── src/
        ├── main.jsx              ← ClerkProvider + BrowserRouter + AuthProvider
        ├── App.jsx               ← Routes
        ├── index.css             ← tema oscuro, variables CSS
        ├── context/
        │   └── AuthContext.jsx   ← usuario, iniciarSesionLocal, cerrarSesion
        ├── components/
        │   ├── RutaProtegida.jsx
        │   ├── RutaSoloAdmin.jsx
        │   ├── FiltrosReservas.jsx
        │   ├── TablaReservas.jsx
        │   ├── AccionesReserva.jsx
        │   └── HistorialReserva.jsx
        ├── pages/
        │   ├── Login.jsx         ← SignIn de Clerk + login local
        │   ├── Reservas.jsx
        │   ├── DetalleReserva.jsx
        │   ├── FormularioReserva.jsx
        │   ├── Resumen.jsx
        │   └── NotFound.jsx
        └── services/
            ├── axios.js          ← instancia base + interceptor token
            ├── auth.service.js
            ├── reservas.service.js
            └── aulas.service.js
```

---

## Variables de entorno

### Backend `.env`
```
CLERK_SECRET_KEY=sk_test_...
JWT_SECRET=mi_clave_secreta_super_segura_dds_2026
PORT=3001
NODE_ENV=development
```

### Frontend `.env`
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE_URL=http://localhost:3001/api
```

---

## Entidades y modelos

### Usuario
```js
{
  id: INTEGER (PK, autoincrement),
  nombre: STRING,
  email: STRING (unique),
  passwordHash: STRING,
  rol: ENUM('usuario', 'admin'),
  activo: BOOLEAN (default: true)
}
```

### Aula
```js
{
  id: INTEGER (PK, autoincrement),
  nombre: STRING,
  ubicacion: STRING,
  capacidad: INTEGER,
  recursos: STRING,   // separado por comas: "proyector,pizarra"
  activa: BOOLEAN
}
```

### Reserva
```js
{
  id: INTEGER (PK, autoincrement),
  aulaId: INTEGER (FK → Aula),
  usuarioId: STRING,  // puede ser UUID de Clerk o ID numérico local
  fecha: STRING,      // formato: 'YYYY-MM-DD'
  horaInicio: STRING, // formato: 'HH:MM'
  horaFin: STRING,    // formato: 'HH:MM'
  cantidadPersonas: INTEGER,
  motivo: STRING,
  estado: ENUM('pendiente','aprobada','cancelada','rechazada'),
  createdAt: DATE
}
```

### HistorialReserva
```js
{
  id: INTEGER (PK, autoincrement),
  reservaId: INTEGER (FK → Reserva),
  usuarioId: STRING,
  accion: STRING,       // 'creacion','aprobacion','rechazo','cancelacion','edicion'
  fechaHora: DATE,
  valorAnterior: JSON,  // ej: { estado: 'pendiente' }
  valorNuevo: JSON      // ej: { estado: 'aprobada' }
}
```

---

## Reglas de negocio (implementadas en `reservas.services.js`)

### Al crear una reserva:
1. El `aulaId` debe existir en la BD → si no: error 404 "El aula solicitada no existe"
2. El aula debe estar activa (`activa: true`) → si no: error 400 "El aula no está activa"
3. `horaInicio` debe ser menor que `horaFin` → si no: error 400 "La hora de inicio debe ser menor a la hora de fin"
4. Horario laboral: `horaInicio >= '08:00'` y `horaFin <= '22:00'` → si no: error 400 "Las reservas solo se permiten entre las 08:00 y las 22:00"
5. `cantidadPersonas <= aula.capacidad` → si no: error 400 "La cantidad de personas supera la capacidad del aula"
6. No debe existir otra reserva del mismo aula y fecha con estado `pendiente` o `aprobada` cuyo horario se solape:
   - Condición de solapamiento: `horaInicio_existente < horaFin_nueva AND horaFin_existente > horaInicio_nueva`
   - Dos reservas que se tocan en el límite exacto (ej: una termina 10:00 y otra empieza 10:00) **NO** se consideran solapadas
   - Las reservas `cancelada` y `rechazada` **no** bloquean disponibilidad
   - → si hay solapamiento: error 400 "El aula ya está reservada en ese horario"
7. Se crea con `estado: 'pendiente'`
8. Se registra en historial: accion `'creacion'`, valorAnterior: null, valorNuevo: `{ estado: 'pendiente' }`

### Al editar una reserva:
- Solo admin puede editar
- No se puede editar una reserva `cancelada` o `rechazada`
- Se aplican las mismas validaciones de capacidad, horario laboral y solapamiento
- Para el chequeo de solapamiento se **excluye la propia reserva** (`id != reservaId`)
- Se registra en historial: accion `'edicion'`, valorAnterior con datos anteriores, valorNuevo con datos nuevos

### Flujo de estados:
```
pendiente → aprobada    (solo admin)
pendiente → rechazada   (solo admin)
pendiente → cancelada   (admin o propietario de la reserva)
aprobada  → cancelada   (admin o propietario de la reserva)

cancelada  → ❌ no puede cambiar a ningún estado
rechazada  → ❌ no puede cambiar a ningún estado
```

Al aprobar: se registra historial accion `'aprobacion'`
Al rechazar: se registra historial accion `'rechazo'`
Al cancelar: se registra historial accion `'cancelacion'`

### Listado de reservas:
Acepta query params combinables:
- `fecha` → filtra por fecha exacta
- `estado` → filtra por estado
- `aulaId` → filtra por aula
- `q` → busca texto en el campo motivo (LIKE)
- `page` → página (default: 1)
- `limit` → resultados por página (default: 10)
- `sortBy` → columna para ordenar (default: 'createdAt')
- `order` → 'ASC' o 'DESC' (default: 'DESC')

### Resumen administrativo (`GET /api/reservas/resumen`):
Devuelve:
```js
{
  porEstado: [{ estado, total }],   // COUNT por cada estado
  porAula: [{ aulaId, total }],     // TOP 5 aulas más reservadas
  proximasHoy: [...]                // reservas pendientes o aprobadas con fecha >= hoy, ordenadas ASC, limit 10
}
```

---

## Endpoints del backend

### Auth
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Login local con email/password, devuelve JWT | No |

### Aulas
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/api/aulas` | Lista todas las aulas | No |

### Reservas
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/api/reservas` | Listado con filtros y paginación | Token |
| GET | `/api/reservas/resumen` | Resumen administrativo | Admin |
| GET | `/api/reservas/:id` | Detalle de una reserva | Token |
| GET | `/api/reservas/:id/historial` | Historial de cambios | Token |
| POST | `/api/reservas` | Crear reserva | Token |
| PUT | `/api/reservas/:id` | Editar reserva | Admin |
| PATCH | `/api/reservas/:id/aprobar` | Aprobar reserva | Admin |
| PATCH | `/api/reservas/:id/rechazar` | Rechazar reserva | Admin |
| PATCH | `/api/reservas/:id/cancelar` | Cancelar reserva | Token (propietario o admin) |

### Códigos HTTP usados
- `200` OK
- `201` Creado
- `400` Error de validación de negocio
- `401` Sin token o token inválido
- `403` Autenticado pero sin permiso
- `404` Recurso no encontrado
- `500` Error interno

---

## Middlewares del backend

### `verificarToken` (`auth.middleware.js`)
1. Lee el header `Authorization: Bearer <token>`
2. Intenta verificar con `jwt.verify(token, JWT_SECRET)` → si es válido, carga `req.usuario` con `{ id, nombre, email, rol }`
3. Si falla, intenta verificar con Clerk: decodifica el payload, llama a `clerkClient.users.getUser(payload.sub)` y carga `req.usuario` con datos de Clerk
4. Si ambos fallan → 401

### `soloAdmin` (`auth.middleware.js`)
- Verifica que `req.usuario.rol === 'admin'` → si no: 403

### `validarCrearReserva` (`validacion.middleware.js`)
- Verifica campos obligatorios: `aulaId`, `fecha`, `horaInicio`, `horaFin`, `cantidadPersonas`, `motivo`
- Si falta alguno → 400 con lista de campos faltantes

### `validarLogin` (`validacion.middleware.js`)
- Verifica que vengan `email` y `password`

### `manejadorErrores` (`error.middleware.js`)
- Firma: `(err, req, res, next)` — 4 parámetros (requerido por Express)
- Va registrado **después** de todas las rutas en `app.js`
- Devuelve siempre `{ error: mensaje }` con el status del error o 500

---

## Autenticación — flujo completo

### Con Clerk (Google o email)
1. Usuario hace clic → frontend llama a Clerk directamente (el `<SignIn>` de Clerk maneja todo)
2. Clerk autentica y setea la sesión en el browser
3. `AuthContext` detecta el cambio via `useUser()` de `@clerk/clerk-react`
4. `registrarGetToken(getToken)` registra la función en el interceptor de Axios
5. En cada request, el interceptor llama a `getToken()` y agrega `Authorization: Bearer <token>`
6. El backend recibe el token, falla el `jwt.verify` local, intenta con Clerk y obtiene el usuario

### Con usuario local (prueba)
1. Usuario completa formulario en el tab "Usuario de prueba" de `Login.jsx`
2. Frontend hace `POST /api/auth/login` con `{ email, password }`
3. Backend verifica con bcrypt, genera JWT firmado con `JWT_SECRET`, devuelve `{ token }`
4. Frontend guarda el token en `localStorage` y el usuario en `localStorage`
5. `AuthContext` setea `usuarioLocal` y registra en el interceptor: `() => Promise.resolve(localStorage.getItem('token'))`
6. En cada request el interceptor devuelve ese token del localStorage

### Roles
- Los roles de Clerk vienen en `user.publicMetadata.rol` (se asigna desde el dashboard de Clerk)
- Los roles locales vienen en el payload del JWT: `payload.rol`
- Si no hay rol definido → default: `'usuario'`

---

## Rutas del frontend

| Ruta | Componente | Protección |
|---|---|---|
| `/` | redirect → `/reservas` | — |
| `/login/*` | `Login.jsx` | Pública |
| `/register/*` | `<SignUp>` de Clerk | Pública |
| `/reservas` | `Reservas.jsx` | `RutaProtegida` |
| `/reservas/nueva` | `FormularioReserva.jsx` | `RutaProtegida` |
| `/reservas/:id` | `DetalleReserva.jsx` | `RutaProtegida` |
| `/reservas/:id/editar` | `FormularioReserva.jsx` | `RutaSoloAdmin` |
| `/resumen` | `Resumen.jsx` | `RutaSoloAdmin` |
| `*` | `NotFound.jsx` | Pública |

### `RutaProtegida`
- Espera a que Clerk cargue (`isLoaded`)
- Si no hay sesión de Clerk y no hay `usuarioLocal` en contexto → redirige a `/login`

### `RutaSoloAdmin`
- Igual que `RutaProtegida` + verifica que `usuario.rol === 'admin'`
- Si es usuario común → redirige a `/reservas`

---

## Servicios Axios (frontend)

### `axios.js`
```js
const api = axios.create({ baseURL: VITE_API_BASE_URL || 'http://localhost:3001/api' });

let _tokenFn = null;
export const registrarGetToken = (fn) => { _tokenFn = fn; };

api.interceptors.request.use(async (config) => {
  if (_tokenFn) {
    const token = await _tokenFn();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### `reservas.service.js`
```js
getReservas(params)          → GET /reservas?...params
getReserva(id)               → GET /reservas/:id
getHistorial(id)             → GET /reservas/:id/historial
getResumen()                 → GET /reservas/resumen
crearReserva(datos)          → POST /reservas
editarReserva(id, datos)     → PUT /reservas/:id
aprobarReserva(id)           → PATCH /reservas/:id/aprobar
rechazarReserva(id)          → PATCH /reservas/:id/rechazar
cancelarReserva(id)          → PATCH /reservas/:id/cancelar
```

### `aulas.service.js`
```js
getAulas()  → GET /aulas
```

---

## Seed de datos (backend `index.js`)

Al arrancar, si no hay aulas en la BD, crea:
- 5 aulas: Aula 910 (cap 45), Laboratorio A6 (cap 30), Aula Magna (cap 150), A4 (cap 60, inactiva), Sala de Reuniones B (cap 15)
- 2 usuarios locales: `admin@utnfrc.edu.ar` / `admin123` (rol admin), `david@utnfrc.edu.ar` / `user123` (rol usuario)
- 10 reservas en distintos estados (pendiente, aprobada, cancelada, rechazada)
- Historial correspondiente a cada cambio de estado

---

## CSS — variables principales (`index.css`)

```css
:root {
  --bg: #0F172A;
  --surface: #111827;
  --card: #1E293B;
  --primary: #3B82F6;
  --primary-600: #2563EB;
  --secondary: #8B5CF6;
  --muted: #94A3B8;
  --text: #F8FAFC;
  --text-soft: #94A3B8;
  --danger: #FB7185;
  --success: #34D399;
  --radius-xl: 20px;
  --radius-lg: 16px;
  --radius-md: 12px;
  --radius-sm: 8px;
  --shadow-soft: 0 6px 20px rgba(2,6,23,0.6);
  --shadow-subtle: 0 8px 30px rgba(2,6,23,0.45);
}
```

Clases utilitarias disponibles:
- `.auth-container` — centra vertical y horizontalmente, full height
- `.auth-card` — card oscura con borde y sombra, max-width 420px
- `.btn-primary` — botón azul con gradiente
- `.btn-secondary` — botón violeta
- `.btn-ghost` — botón transparente con borde
- `.btn-danger` — botón rojo
- `.form-row` — columna con label + input
- `.form-grid` — grid 2 columnas (responsive a 1)
- `.stack` — flex column con gap
- `.alert`, `.alert--error`, `.alert--success`, `.alert--warning`, `.alert--info`
- `.page-title`, `.page-header`, `.page-sub`
- `.text-muted`, `.small`
- `.table-wrapper`, `.table-actions`
- `.metrics-grid` — grid 3 columnas para el resumen
- `.reserva-badge`, `.reserva-badge--pendiente`, `.reserva-badge--aprobada`, `.reserva-badge--cancelada`

---

## Estado actual del proyecto

### Funcionando:
- Login con Google (Clerk)
- Login con usuarios locales de prueba
- Listado de reservas con filtros y paginación
- Detalle de reserva con historial
- Crear reserva (con todas las validaciones)
- Aprobar / rechazar / cancelar reservas
- Panel resumen para admin
- Rutas protegidas en frontend y backend
- Seed de datos automático

### Pendiente / con problemas conocidos:
- La pantalla de login tiene problemas visuales: el widget de Clerk (`<SignIn>`) no se integra bien con el tema oscuro y desordena el layout
- No hay tests completos (solo `auth.test.js` parcial)
- No hay deploy configurado aún

---

## Comandos para correr el proyecto

```bash
# Docker (Keycloak legacy, opcional)
docker compose up -d

# Backend
cd backend
npm install
node index.js
# corre en http://localhost:3001

# Frontend
cd frontend
npm install
npm run dev
# corre en http://localhost:5173
```

### Usuarios de prueba
| Email | Password | Rol |
|---|---|---|
| admin@utnfrc.edu.ar | admin123 | admin |
| david@utnfrc.edu.ar | user123 | usuario |

Para login con Google: usar Clerk en la pantalla de login.
Para asignar rol admin a un usuario de Clerk: ir al dashboard de Clerk → Users → seleccionar usuario → Public metadata → `{ "rol": "admin" }`.
