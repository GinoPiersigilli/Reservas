# Sistema de Reservas de Aulas

Esta aplicación permite reservar aulas de forma simple y segura: un usuario puede crear y gestionar sus propias solicitudes, y un administrador puede aprobar, rechazar o cancelar reservas desde una interfaz clara.

Está construida con:
- Backend: Node.js + Express + Sequelize + PostgreSQL
- Frontend: React + Vite + React Router
- Autenticación: Clerk + JWT local (usuarios de prueba)
- Contenedores: Docker Compose (PostgreSQL 16)

---

## Cómo correr el proyecto

### 1) Configurar variables de entorno

Copiá los archivos `.env.example` en la raíz, en `backend/` y en `frontend/`:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Revisá que las credenciales de PostgreSQL (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` en `.env`) coincidan con `DATABASE_URL` y `DATABASE_URL_TEST` en `backend/.env`.

### 2) Levantar la base de datos PostgreSQL

Desde `backend/` (o desde la raíz del proyecto):

```bash
cd backend
npm run db:up
```

Comandos útiles para administrar el contenedor de PostgreSQL:
- `npm run db:up`: levanta el servicio `postgres` en segundo plano (`docker compose up -d postgres`).
- `npm run db:down`: detiene y elimina los contenedores de Docker Compose (`docker compose down`).
- `npm run db:logs`: muestra los logs del contenedor `postgres` en tiempo real (`docker compose logs -f postgres`).

### 3) Ejecutar el backend

```bash
cd backend
npm install
npm run dev
```

El backend queda disponible en:
- http://localhost:3001

### 4) Ejecutar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

El frontend queda disponible en:
- http://localhost:5173

---

## Usuarios de prueba (login local)

| Email | Rol | Contraseña |
|---|---|---|
| admin@utnfrc.edu.ar | admin | admin123 |
| david@utnfrc.edu.ar | usuario | user123 |

- **admin**: Tiene permisos de administrador. Puede aprobar, rechazar, editar y ver todas las reservas y el resumen administrativo.
- **usuario**: Puede crear reservas y consultar/cancelar sus propias solicitudes. No puede acceder al panel admin ni ver reservas ajenas.

---

## Endpoints principales del backend

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/auth/login | Login local con email y contraseña, devuelve un token JWT |

### Aulas
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | /api/aulas | Lista las aulas disponibles | Público |

### Reservas
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | /api/reservas | Listado de reservas con filtros | Usuario autenticado (propias o todas si es admin) |
| GET | /api/reservas/resumen | Resumen administrativo | Solo admin |
| GET | /api/reservas/:id | Detalle de una reserva | Dueño o admin |
| GET | /api/reservas/:id/historial | Historial de cambios | Dueño o admin |
| POST | /api/reservas | Crear una nueva reserva | Usuario autenticado |
| PUT | /api/reservas/:id | Editar una reserva | Solo admin |
| PATCH | /api/reservas/:id/aprobar | Aprobar reserva | Solo admin |
| PATCH | /api/reservas/:id/rechazar | Rechazar reserva | Solo admin |
| PATCH | /api/reservas/:id/cancelar | Cancelar reserva | Dueño o admin |

### Códigos de respuesta comunes
- 200: OK
- 201: Creado
- 400: Datos inválidos o regla de negocio violada
- 401: Token ausente o inválido
- 403: Sin permisos suficientes
- 404: Recurso no encontrado
- 500: Error interno del servidor

---

## Rutas principales del frontend

| Ruta | Qué muestra | Acceso |
|---|---|---|
| /login | Pantalla de inicio de sesión | Pública |
| /reservas | Listado general de reservas | Protegida |
| /reservas/nueva | Formulario para crear reserva | Protegida |
| /reservas/:id | Detalle de una reserva | Protegida |
| /reservas/:id/editar | Edición de reserva | Solo admin |
| /resumen | Panel administrativo | Solo admin |
| * | Página 404 | Pública |

---

## Cómo se valida capacidad y superposición

La validación real está en el backend, dentro del servicio de reservas. El frontend solo envía los datos.

### 1) Capacidad del aula

Antes de crear o editar una reserva, el backend verifica que:
- cantidadPersonas <= capacidad del aula

Si no se cumple, devuelve un error 400 con el mensaje:
- La cantidad de personas supera la capacidad del aula

### 2) Superposición de horarios

También se revisa si el aula ya tiene una reserva activa en ese mismo día y rango horario.

Se consideran conflictos cuando:
- la reserva nueva empieza antes de que termine otra
- y termina después de que empiece otra

La regla aplica sobre reservas con estado:
- pendiente
- aprobada

No bloquean disponibilidad:
- canceladas
- rechazadas

Además, al editar una reserva, la propia reserva no se compara consigo misma.

### 3) Horario laboral

Las reservas están permitidas entre:
- 08:00 y 22:00

Si se intenta reservar fuera de ese rango, el backend responde con error 400.

---

## Cómo ejecutar las pruebas

### Backend

```bash
cd backend
npm test
```

---

## Nota de seguridad sobre el historial del repositorio

En versiones previas a las mejoras de seguridad (Fase 1), el archivo `backend/database.sqlite` estuvo versionado en git con datos de prueba y hashes de contraseñas. El archivo fue retirado del índice de git (`git rm --cached`) y agregado a `.gitignore`, pero permanece en commits antiguos del historial. Si el repositorio se publica o comparte fuera del entorno académico, se recomienda rotar las claves y evaluar limpiar el historial con `git filter-repo`.
