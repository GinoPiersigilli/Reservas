# Sistema de Reservas de Aulas

Aplicación web para la gestión y reserva de aulas universitarias. Permite a docentes y estudiantes solicitar reservas de aulas verificando disponibilidad y capacidad en tiempo real, y a los administradores aprobar, rechazar, editar y auditar el historial de cada solicitud.

## Stack tecnológico

- **Backend:** Node.js (ESM) + Express + Sequelize 6 + PostgreSQL 16
- **Frontend:** React 19 + Vite + React Router + CSS Modules + Tokens de diseño (`tokens.css`) + Tipografía autoalojada (`@fontsource/source-serif-4` y `@fontsource/public-sans`) + `lucide-react`
- **Autenticación:** Clerk (SSO) + JWT local para usuarios de prueba
- **Base de datos:** PostgreSQL 16 en Docker Compose (con *exclusion constraint* `btree_gist` anti-solapamiento)
- **Calidad, Accesibilidad y CI:** ESLint, Jest + Supertest (backend), Vitest + Testing Library + `vitest-axe` (frontend), GitHub Actions

---

## Estructura del proyecto

```
reservas/
├── .github/workflows/ci.yml   # Pipeline de integración continua (Postgres + backend + frontend)
├── docker/postgres/           # Script de inicialización de la base reservas_test
├── docker-compose.yml         # Contenedor PostgreSQL 16 de desarrollo con healthcheck
├── docker-compose.prod.yml    # Stack de producción (Postgres + Backend + Frontend Nginx con CSP)
├── .env.example               # Variables de entorno para Docker Compose
├── docs/                      # Documentación de arquitectura, diseño UX/UI, seguridad y capturas
│   ├── CONTEXTO_PROYECTO.md
│   ├── DEPLOY.md
│   ├── DISENO_UX_UI.md
│   ├── DISENO_PROPUESTA.md
│   ├── SEGURIDAD.md
│   └── img/                   # Capturas de pantalla en escritorio y móvil
├── backend/                   # API REST (Express + Sequelize + PostgreSQL)
│   ├── db/
│   │   ├── config.cjs         # Configuración de sequelize-cli
│   │   ├── migrations/        # Migraciones del esquema y constraints PostgreSQL
│   │   └── seeders/           # Datos iniciales de prueba con fechas relativas a hoy
│   ├── src/                   # Configuración, modelos, rutas, controladores, servicios y middlewares
│   └── tests/                 # Suite de pruebas de integración y concurrencia (Jest)
└── frontend/                  # SPA en React + Vite + CSS Modules
    ├── nginx.conf             # Configuración Nginx con cabeceras de seguridad y CSP
    ├── scripts/
    │   └── verificar-contraste.js # Verificación automática de contraste WCAG 2.1 AA sobre tokens.css
    └── src/
        ├── components/        # AppShell, GrillaDisponibilidad, tablas, filtros y componentes base (ui/)
        ├── config/            # Franjas horarias (08:00–22:00) y apariencia de Clerk
        ├── context/           # AuthContext (Clerk + JWT local)
        ├── pages/             # Pantallas y tests unitarios/accesibilidad (__tests__)
        ├── services/          # Clientes HTTP (Axios)
        ├── styles/            # Sistema de tokens (tokens.css) y estilos base (base.css)
        ├── utils/             # Formateo de fechas (dd/mm/aaaa) y horarios (24 h)
        └── textos.js          # Textos centralizados de la interfaz (español neutro formal)
```

---

## Capturas de pantalla

### Escritorio (`1280 px`)

| Pantalla | Vista |
|---|---|
| **Ingreso (`Login`)** | ![Login escritorio](docs/img/login-escritorio.png) |
| **Listado de reservas (`Administrador`)** | ![Reservas admin escritorio](docs/img/reservas-admin-escritorio.png) |
| **Nueva reserva y grilla de disponibilidad** | ![Nueva reserva grilla escritorio](docs/img/nueva-reserva-grilla-escritorio.png) |
| **Detalle de reserva e historial** | ![Detalle de reserva escritorio](docs/img/detalle-reserva-escritorio.png) |
| **Panel de administración** | ![Panel de administración escritorio](docs/img/panel-admin-escritorio.png) |

### Móvil (`360 px`)

| Login móvil | Mis reservas móvil | Grilla de disponibilidad móvil | Panel móvil |
|---|---|---|---|
| ![Login móvil](docs/img/login-movil.png) | ![Mis reservas móvil](docs/img/reservas-usuario-movil.png) | ![Grilla móvil](docs/img/nueva-reserva-grilla-movil.png) | ![Panel móvil](docs/img/panel-admin-movil.png) |

---

## Instalación y puesta en marcha desde cero

### Requisitos previos
- **Node.js** 20 o superior
- **Docker** y **Docker Compose**

### 1) Configurar variables de entorno

Copiá los archivos `.env.example` en la raíz, en `backend/` y en `frontend/`:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

#### Variables principales
- **Raíz (`.env`):**
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`: credenciales e instancia del contenedor PostgreSQL.
- **Backend (`backend/.env`):**
  - `PORT`: puerto del servidor HTTP (por defecto `3001`).
  - `NODE_ENV`: entorno (`development`, `test`, `production`).
  - `JWT_SECRET`: clave secreta obligatoria para firmar tokens JWT locales.
  - `CLERK_SECRET_KEY`: clave secreta de Clerk (obligatoria en producción).
  - `DATABASE_URL`: URL de conexión a la base de desarrollo (`postgres://reservas:...@localhost:5432/reservas`).
  - `DATABASE_URL_TEST`: URL de conexión a la base de pruebas (`postgres://reservas:...@localhost:5432/reservas_test`).
  - `CORS_ORIGINS`: orígenes permitidos separados por coma (ej. `http://localhost:5173`).
  - `WORK_HOUR_START` / `WORK_HOUR_END`: franja horaria permitida (`08:00` a `22:00`).
- **Frontend (`frontend/.env`):**
  - `VITE_CLERK_PUBLISHABLE_KEY`: clave pública de Clerk.
  - `VITE_API_BASE_URL`: URL base del backend (`http://localhost:3001/api`).

### 2) Levantar PostgreSQL con Docker Compose

```bash
cd backend
npm run db:up
```

Esto inicia el contenedor `postgres:16-alpine` y crea automáticamente las bases `reservas` (desarrollo) y `reservas_test` (testing).

Otros comandos útiles en `backend/`:
- `npm run db:down`: detiene y elimina el contenedor.
- `npm run db:logs`: muestra los logs de PostgreSQL en tiempo real.

### 3) Instalar dependencias, correr migraciones y cargar el seed

```bash
cd backend
npm install
npm run migrate
npm run seed
```

- `npm run migrate`: aplica todas las migraciones pendientes (`001-baseline.cjs` y `002-esquema-definitivo.cjs`).
- `npm run migrate:undo` / `npm run migrate:undo:all`: revierte la última o todas las migraciones.
- `npm run seed`: carga de forma idempotente 5 aulas, usuarios de prueba y 10 reservas con fechas relativas al día de hoy.
- `npm run seed:undo:all`: limpia los datos cargados por el seed.

### 4) Iniciar el servidor backend

```bash
cd backend
npm run dev
```
El backend queda escuchando en `http://localhost:3001`.

### 5) Instalar dependencias e iniciar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```
El frontend queda disponible en `http://localhost:5173`.

---

## Usuarios de prueba (login local)

| Email | Contraseña | Rol | Permisos |
|---|---|---|---|
| `admin@utnfrc.edu.ar` | `admin123` | `admin` | Ver todas las reservas, aprobar, rechazar, cancelar, editar y acceder al resumen administrativo |
| `david@utnfrc.edu.ar` | `user123` | `usuario` | Crear reservas y consultar o cancelar únicamente sus propias solicitudes |
| `laura.perez@dds.edu.ar` | `usuario123` | `usuario` | Usuario adicional cargado en el seed |
| `pedro.gomez@dds.edu.ar` | `usuario456` | `usuario` | Usuario adicional cargado en el seed |

---

## Endpoints de la API

### Salud y monitoreo
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| `GET` | `/api/health` | Verifica el estado del servidor y la conexión activa con PostgreSQL | Público |

### Autenticación
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| `POST` | `/api/auth/login` | Login local con email y contraseña (devuelve JWT) | Público |

### Aulas
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| `GET` | `/api/aulas` | Lista las aulas activas | Público |
| `GET` | `/api/aulas/:id/disponibilidad?fecha=YYYY-MM-DD` | Lista las franjas horarias ocupadas (`pendiente` o `aprobada`) de un aula en una fecha | Token |

### Reservas
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| `GET` | `/api/reservas` | Listado con filtros (`fecha`, `estado`, `aulaId`, `q`, `page`, `limit`, `sortBy`, `order`) | Token (propias o todas si es admin) |
| `GET` | `/api/reservas/resumen` | Métricas por estado, top aulas y próximas reservas de hoy | Solo admin |
| `GET` | `/api/reservas/:id` | Detalle de una reserva | Dueño o admin |
| `GET` | `/api/reservas/:id/historial` | Historial de auditoría de una reserva | Dueño o admin |
| `POST` | `/api/reservas` | Crear una nueva reserva | Token |
| `PUT` | `/api/reservas/:id` | Editar una reserva existente | Solo admin |
| `PATCH` | `/api/reservas/:id/aprobar` | Aprobar una reserva pendiente | Solo admin |
| `PATCH` | `/api/reservas/:id/rechazar` | Rechazar una reserva pendiente | Solo admin |
| `PATCH` | `/api/reservas/:id/cancelar` | Cancelar una reserva pendiente o aprobada | Dueño o admin |

---

## Tests y Linter

### Backend
Requiere que el contenedor de PostgreSQL esté corriendo (`npm run db:up`):

```bash
cd backend
npm run lint
npm test
npm test -- --coverage
```

### Frontend
```bash
cd frontend
npm run lint
npm test
node scripts/verificar-contraste.js
```

---

## Nota de seguridad sobre el historial del repositorio

En versiones previas a la Fase 1 de mejoras, el archivo `backend/database.sqlite` estuvo versionado en git. Fue eliminado del seguimiento y reemplazado por PostgreSQL, pero permanece en commits antiguos del historial. Si el repositorio se comparte públicamente, se recomienda rotar las claves de Clerk y limpiar el historial con `git filter-repo`.
