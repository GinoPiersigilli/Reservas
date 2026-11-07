# Fase 1 — Seguridad
**Modo sugerido:** Planning. **Rama:** `mejora/fase-1-seguridad`. **Riesgo:** medio (toca autenticación).

## Prompt
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 1 — seguridad. Implementá las tareas S1 a S6 y L5 del plan, en este orden, un commit por tarea:

S1. En `backend/src/middleware/auth.middleware.js` reemplazá la decodificación manual del token de Clerk por verificación real de firma con `verifyToken` de `@clerk/backend` (usa CLERK_SECRET_KEY). Mantené el mismo shape de `req.usuario` ({ id, nombre, email, rol }). Si la verificación falla → 401.
S2. Creá `backend/src/config/env.js` que valide las variables al arrancar. Sacá el valor por defecto de JWT_SECRET en auth.middleware.js y auth.services.js. Si NODE_ENV=production y falta una variable obligatoria, el servidor debe abortar con un mensaje claro. En desarrollo, si falta JWT_SECRET, abortar también (no inventar uno). Todo el código lee la config desde ese módulo.
S3. `git rm --cached backend/database.sqlite` y confirmá que el .gitignore lo cubre. No reescribas el historial de git; solo avisame que el historial conserva la base.
S4. Autorización por propiedad: un usuario común solo puede listar, ver y consultar el historial de SUS reservas (404 si la reserva es de otro, para no revelar su existencia); admin ve todo. Aplicalo en servicio + controlador de GET /reservas, GET /reservas/:id y GET /reservas/:id/historial.
S5. En obtenerReservas: limit máximo 100 (default 10); sortBy con lista blanca (createdAt, fecha, horaInicio, estado, aulaId, id); order solo ASC/DESC, case-insensitive. Valores inválidos → usar el default, no devolver 500.
S6. Agregar helmet, express-rate-limit en POST /api/auth/login (10 intentos por 15 min por IP), y CORS leyendo la lista de orígenes de CORS_ORIGINS (separada por comas, default http://localhost:5173).
L5. En cancelarReserva, la autorización debe ser por lista explícita: pasa si el rol es 'admin' o si es el dueño. Cualquier otro caso → 403.

Tests nuevos obligatorios (jest + supertest): token Clerk/JWT con firma inválida → 401; usuario A pidiendo reserva de B → 404; usuario común no ve reservas ajenas en el listado; limit=100000 se recorta a 100; sortBy inválido no rompe; servidor sin JWT_SECRET no arranca.

No cambies rutas ni formas de respuesta. Al terminar: resumen, cómo probarlo manualmente, y detenete.
```

## Cómo verificar
- Probá en Postman/curl un token inventado (cualquier JWT mal firmado) → debe dar 401.
- Logueate como `david@utnfrc.edu.ar` y confirmá que el listado muestra solo sus reservas.
- Logueate como admin y confirmá que sigue viendo todo.
