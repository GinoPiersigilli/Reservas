# Arquitectura Técnica — Sistema de Reservas de Aulas

Este documento describe la arquitectura técnica, modelo de datos, reglas de negocio y diseño de endpoints del sistema de reservas de aulas, orientado a la evaluación técnica del proyecto.

---

## 1. Visión General de la Arquitectura

El sistema está diseñado bajo una arquitectura multicapa desacoplada y contenerizada:
- **Frontend SPA:** Desarrollado en React 19 con Vite, modularizado mediante CSS Modules y tokens CSS (`tokens.css`). Implementa autenticación híbrida (Clerk y JWT local) y comunicación REST mediante Axios con interceptores de autorización.
- **Reverse Proxy y Servidor Web:** Nginx 1.27 en contenedor Alpine, encargado del servicio de estáticos, terminación de proxy hacia la API backend y endurecimiento de cabeceras HTTP con una Content-Security-Policy (CSP) estricta.
- **Backend API:** Servidor Node.js (ESM) con Express, ORM Sequelize 6 y validación de esquemas Zod en middleware. Todas las operaciones críticas de escritura se ejecutan dentro de transacciones de base de datos gestionadas.
- **Motor de Base de Datos:** PostgreSQL 16 con extensión `btree_gist`, configurado con restricciones de integridad referencial, checks y una restricción de exclusión a nivel de motor contra solapamientos horarios.

---

## 2. Estructura del Repositorio

```
reservas/
├── .github/
│   ├── dependabot.yml           # Configuración de actualización mensual de dependencias
│   └── workflows/
│       ├── ci.yml               # Pipeline de integración continua (tests, lint, trivy, semgrep, gitleaks)
│       └── codeql.yml           # Análisis estático de seguridad SAST con CodeQL
├── docker/
│   └── postgres/
│       └── init-test-db.sql     # Script de inicialización de la base de datos de pruebas
├── docker-compose.yml           # Infraestructura PostgreSQL 16 para desarrollo
├── docker-compose.prod.yml      # Entorno de despliegue completo de producción
├── docs/                        # Documentación técnica (Arquitectura, Seguridad, Diseño, Despliegue)
│   ├── ARQUITECTURA.md
│   ├── DEPLOY.md
│   ├── DISENO.md
│   ├── SEGURIDAD.md
│   ├── evidencia/               # Reportes y logs de auditorías de seguridad
│   └── img/                     # Capturas de pantalla del sistema (modo claro y oscuro)
├── backend/
│   ├── index.js                 # Punto de entrada del servidor API
│   ├── db/
│   │   ├── config.cjs           # Configuración de conexiones por entorno
│   │   ├── migrations/          # Migraciones versionadas de esquema PostgreSQL
│   │   └── seeders/             # Semillero de datos de demostración
│   ├── src/
│   │   ├── app.js               # Configuración de Express, middlewares y rutas
│   │   ├── config/              # Variables de entorno y cliente Sequelize
│   │   ├── controllers/         # Controladores de peticiones HTTP
│   │   ├── middleware/          # Autenticación, validación Zod, rate limiting y manejo de errores
│   │   ├── models/              # Definición de modelos Sequelize y asociaciones
│   │   ├── routes/              # Definición de rutas y mapeo de endpoints
│   │   ├── services/            # Lógica de negocio y transacciones de base de datos
│   │   └── utils/               # Utilidades de cálculo horario en zona horaria local
│   └── tests/                   # Pruebas unitarias, de integración, contrato y concurrencia
└── frontend/
    ├── Dockerfile               # Compilación multi-etapa (Node → Nginx Alpine)
    ├── nginx.conf               # Servidor web de producción y proxy API
    ├── public/
    │   └── tema-init.js         # Script estático de inicialización de tema anti-flicker
    ├── scripts/
    │   ├── capturar-pantallas.mjs # Automatización CDP para capturas responsive
    │   └── verificar-contraste.js # Validación de contrastes WCAG 2.1 AA en tokens CSS
    └── src/
        ├── components/          # Componentes de layout, grilla interactiva y vistas de reservas
        ├── context/             # Contexto de autenticación y sesión
        ├── hooks/               # Custom hooks (gestión de tema, OAuth)
        ├── pages/               # Páginas de la aplicación (Reservas, Formulario, Panel, Login)
        ├── services/            # Clientes de servicios API con Axios
        └── styles/              # Variables tokens.css y reset base.css
```

---

## 3. Modelo de Datos y Restricciones de PostgreSQL

El esquema de base de datos se administra mediante migraciones versionadas con Sequelize CLI.

### 3.1. Entidades Principales
- **`usuarios`:** Gestiona cuentas locales y vinculación JIT con Clerk.
  - `id`: Entero, clave primaria autoincremental.
  - `nombre`, `email` (único), `passwordHash` (nulo para usuarios SSO Clerk), `clerkId` (único, nulo para locales), `rol` (`'usuario'` o `'admin'`), `activo` (booleano).
- **`aulas`:** Aulas disponibles para asignación.
  - `id`: Entero, clave primaria.
  - `nombre`, `ubicacion`, `capacidad` (check `> 0`), `recursos`, `activa` (booleano).
- **`reservas`:** Solicitudes y reservas asignadas.
  - `id`: Entero, clave primaria.
  - `aulaId`: FK hacia `aulas.id` (`ON DELETE RESTRICT`).
  - `usuarioId`: FK hacia `usuarios.id` (`ON DELETE RESTRICT`).
  - `fecha`: `DATE` (`YYYY-MM-DD`).
  - `horaInicio`, `horaFin`: `TIME` (check `horaInicio < horaFin`).
  - `cantidadPersonas`: Entero (check `cantidadPersonas > 0`).
  - `motivo`: Cadena de texto (máx. 255 caracteres).
  - `estado`: Enum textual (`'pendiente'`, `'aprobada'`, `'rechazada'`, `'cancelada'`).
- **`historial_reservas`:** Registro inmutable de trazabilidad y auditoría cronológica.
  - `id`: Entero, clave primaria.
  - `reservaId`: FK hacia `reservas.id` (`ON DELETE RESTRICT`).
  - `usuarioId`: FK hacia `usuarios.id` (`ON DELETE RESTRICT`).
  - `accion`: Enum textual (`'creacion'`, `'edicion'`, `'aprobacion'`, `'rechazo'`, `'cancelacion'`).
  - `fechaHora`: Marca temporal con zona horaria (`TIMESTAMPTZ`).
  - `valorAnterior`, `valorNuevo`: Campos `JSONB` que preservan el estado del cambio.

### 3.2. Restricción de Exclusión contra la Doble Reserva (`reservas_sin_solapamiento`)
Para garantizar la inmunidad ante condiciones de carrera (race conditions) en reservas concurrentes, se utiliza la extensión `btree_gist` de PostgreSQL:

```sql
ALTER TABLE reservas ADD CONSTRAINT reservas_sin_solapamiento
EXCLUDE USING gist (
  "aulaId" WITH =,
  tsrange(("fecha" + "horaInicio"), ("fecha" + "horaFin"), '[)') WITH &&
) WHERE (estado IN ('pendiente', 'aprobada'));
```
- **Garantía física:** El motor rechaza físicamente cualquier intento de superposición temporal en la misma aula para reservas activas (`pendiente` o `aprobada`) con el código de error `23P01` (`exclusion_violation`).
- **Intervalo semiabierto `[)`:** Permite reservas consecutivas que comparten el borde exacto (por ejemplo, una reserva de 10:00 a 11:00 y otra de 11:00 a 12:00 en la misma aula).

---

## 4. Endpoints y Control de Acceso (RBAC)

Todos los endpoints bajo `/api/reservas` y `/api/aulas/:id/disponibilidad` requieren cabecera `Authorization: Bearer <token>`.

| Método | Endpoint | Roles Permitidos | Descripción |
|---|---|---|---|
| `GET` | `/api/health` | Público | Verificación de estado del servicio y conexión a PostgreSQL |
| `POST` | `/api/auth/login` | Público | Inicio de sesión local con tasa limitada (rate limit) |
| `GET` | `/api/aulas` | Público | Lista de aulas activas ordenadas alfabéticamente |
| `GET` | `/api/aulas/:id/disponibilidad` | Usuario, Admin | Franjas horarias ocupadas para una fecha determinada |
| `GET` | `/api/reservas` | Usuario, Admin | Listado paginado y filtrable (usuario ve solo suyas; admin ve todas con solicitante) |
| `POST` | `/api/reservas` | Usuario, Admin | Creación de una nueva solicitud de reserva en estado pendiente |
| `GET` | `/api/reservas/:id` | Propietario, Admin | Detalle completo de una reserva |
| `GET` | `/api/reservas/:id/historial` | Propietario, Admin | Historial de auditoría cronológico del ciclo de vida de la reserva |
| `PUT` | `/api/reservas/:id` | Solo Admin | Edición integral de horario, aula, fecha o motivo de una reserva |
| `PATCH` | `/api/reservas/:id/aprobar` | Solo Admin | Aprobación de una reserva pendiente |
| `PATCH` | `/api/reservas/:id/rechazar` | Solo Admin | Rechazo de una reserva pendiente |
| `PATCH` | `/api/reservas/:id/cancelar` | Propietario, Admin | Cancelación de una reserva activa |
| `GET` | `/api/reservas/resumen` | Solo Admin | Métricas agregadas, solicitudes pendientes de aprobación y reservas del día |

---

## 5. Reglas de Negocio e Integridad Transaccional

1. **Horario Operativo Institucional:** Las reservas deben estar comprendidas estrictamente entre las `08:00` y las `22:00`.
2. **Control Temporal:** No se admiten reservas con fechas pasadas respecto al huso horario oficial (`America/Argentina/Cordoba`).
3. **Capacidad y Estado del Aula:** La cantidad de personas no puede superar la capacidad máxima del aula y el aula debe estar en estado activo (`activa: true`).
4. **Ciclo de Vida de Estados:**
   - De `pendiente` se puede transicionar a `aprobada` (admin), `rechazada` (admin) o `cancelada` (propietario/admin).
   - De `aprobada` solo se puede transicionar a `cancelada`.
   - Las reservas en estado `rechazada` o `cancelada` son terminales y no pueden modificarse.
5. **Atomicidad con Transacciones:** Toda modificación de estado o creación de reserva se realiza dentro de transacciones de base de datos (`sequelize.transaction`), asegurando que la escritura en la tabla `reservas` y su registro en `historial_reservas` se completen de manera atómica, aplicando rollback inmediato ante cualquier inconsistencia.

---

## 6. Variables de Entorno

El sistema parametriza su configuración exclusivamente a través de variables de entorno, sin valores sensibles en el repositorio:

### Raíz (`.env` para Docker Compose)
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_PORT`

### Backend (`backend/.env`)
- `PORT`
- `NODE_ENV`
- `DATABASE_URL`
- `DATABASE_URL_TEST`
- `JWT_SECRET`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CORS_ORIGINS`
- `WORK_HOUR_START`
- `WORK_HOUR_END`
- `LOG_SQL`
- `DATABASE_SSL`

### Frontend (`frontend/.env`)
- `VITE_API_BASE_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
