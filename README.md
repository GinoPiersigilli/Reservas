# Sistema de Reservas de Aulas

Esta aplicación permite reservar aulas de forma simple y segura: un usuario puede crear y gestionar sus propias solicitudes, y un administrador puede aprobar, rechazar o cancelar reservas desde una interfaz clara.

Está construida con:
- Backend: Node.js + Express + Sequelize + SQLite
- Frontend: React + Vite + React Router
- Autenticación: Keycloak + JWT
- Contenedores: Docker Compose

---

## Cómo correr el proyecto

### 1) Levantar Keycloak

Desde la raíz del proyecto:

```bash
docker compose up -d
```

Luego abrí:
- http://localhost:8081

### 2) Configurar Keycloak (muy importante)

Ingresá con:
- Usuario: admin
- Contraseña: admin123

Creá un realm llamado:
- reservas-aulas

Dentro de ese realm, crea estos roles:
- admin
- usuario

Luego crea un cliente público con estas opciones:
- Client ID: frontend
- Client type: OpenID Connect
- Standard flow: ON
- Client authentication: OFF
- Valid redirect URIs: http://localhost:5173/callback
- Web origins: http://localhost:5173

Después crea dos usuarios de prueba y asignales el rol correspondiente:

| Usuario | Email | Rol | Contraseña |
|---|---|---|---|
| admin01 | admin@utnfrc.edu.ar | admin | admin123 |
| usuario01 | david@utnfrc.edu.ar | usuario | user123 |

> Si querés usar los valores por defecto del proyecto, el realm debe llamarse `reservas-aulas` y el cliente `frontend`.

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

## Usuarios de prueba

Estos usuarios están pensados para probar el flujo real con Keycloak:

- admin01 / admin123
  - Tiene permisos de administrador
  - Puede aprobar, rechazar, editar y ver todas las reservas

- usuario01 / user123
  - Puede crear reservas y gestionar sus propias solicitudes
  - No puede acceder al panel admin

---

## Endpoints principales del backend

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/auth/login | Devuelve la URL de login de Keycloak |
| POST | /api/auth/token | Intercambia el código OAuth por un access token |

### Aulas
| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/aulas | Lista las aulas disponibles |

### Reservas
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | /api/reservas | Listado de reservas con filtros | Usuario autenticado |
| GET | /api/reservas/resumen | Resumen administrativo | Solo admin |
| GET | /api/reservas/:id | Detalle de una reserva | Usuario autenticado |
| GET | /api/reservas/:id/historial | Historial de cambios | Usuario autenticado |
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
| /callback | Procesa el callback de Keycloak | Pública |
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

## JWT, roles y permisos

La autenticación no se maneja con un login propio del backend. En cambio, el flujo es:

1. El usuario hace clic en “Iniciar sesión”.
2. El frontend lo redirige a Keycloak.
3. Keycloak devuelve un código de autorización.
4. El backend lo intercambia por un access token JWT.
5. El frontend guarda ese token en localStorage.
6. Cada request manda el token en el header Authorization: Bearer ...
7. El backend valida la firma y el issuer usando las claves públicas de Keycloak.

### Qué significa esto en la práctica

- usuario
  - puede crear reservas
  - puede ver sus reservas
  - puede cancelar sus propias solicitudes

- admin
  - puede ver todas las reservas
  - puede aprobar o rechazar reservas
  - puede editar reservas
  - puede entrar al panel de resumen

Los permisos se derivan del claim `realm_access.roles` del token JWT emitido por Keycloak.

---

## Cómo ejecutar las pruebas

### Backend

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
npm test
```

---

## Limitaciones conocidas

- La configuración de Keycloak (realm, roles, usuarios y cliente) se hace manualmente en cada entorno.
- El historial de ejemplo usa un placeholder como `usuarioId: 'sistema'` porque los usuarios reales viven en Keycloak.
- Los tokens de Keycloak tienen expiración corta en desarrollo; si vencen, hay que volver a iniciar sesión.
- El frontend no implementa refresh token automático.
- El modelo local de usuario existe por compatibilidad técnica, pero la autenticación real está delegada a Keycloak.
