# Fase 3 — Lógica de negocio
**Modo sugerido:** Planning. **Rama:** `mejora/fase-3-logica`. **Riesgo:** medio.

## Prompt
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 3 — lógica de negocio sobre PostgreSQL. Tareas L1 a L4 del plan más la disponibilidad, adaptadas a que ahora existe la constraint `reservas_sin_solapamiento`.

L1. La base es la fuente de verdad contra dobles reservas. En crearNuevaReserva y editarReserva: mantené el chequeo previo (da el mensaje amable) pero envolvé validación + escritura + historial en UNA transacción de Sequelize, y capturá el error de exclusión (SequelizeExclusionConstraintError / código 23P01) para devolver 400 "El aula ya está reservada en ese horario". Hacé lo mismo en aprobar, rechazar y cancelar (transacción para cambio de estado + historial; si falla el historial, no debe quedar el cambio de estado). En aprobar NO hace falta re-chequear solapamiento: documentalo en un comentario.
    Mapeá también errores de FK (aula/usuario inexistente → 404 o 400 con mensaje claro) y de unique (email repetido → 400) en error.middleware.js.
L2. Creá `backend/src/utils/fecha.js` con helpers hoyArgentina() y horaActualArgentina() usando la zona America/Argentina/Cordoba. Usalos en obtenerResumen y en cualquier otro lugar que use new Date().toISOString() para "hoy".
L3. Validaciones en validacion.middleware.js (mismo estilo de mensajes de error): fecha YYYY-MM-DD válida y no pasada; horas HH:MM válidas (regex ^([01]\d|2[0-3]):[0-5]\d$); cantidadPersonas entero > 0; motivo con largo máximo 255; aulaId entero. Validar también el body de PUT /reservas/:id (campos opcionales pero con el mismo formato).
L4. En editarReserva reemplazá los `valor || actual` por `!== undefined`, y verificá que el aula siga activa.
Nuevo: GET /api/aulas/:id/disponibilidad?fecha=YYYY-MM-DD (requiere token) → devuelve las franjas ocupadas { horaInicio, horaFin, estado } de pendientes/aprobadas ese día. 404 si el aula no existe, 400 si la fecha es inválida. Agregá la función en aulas.service.js del frontend, SIN modificar pantallas todavía.

Tests obligatorios: 10 POST simultáneos al mismo horario → exactamente un 201 y nueve 400; editar para pisar otra reserva → 400; cancelada no bloquea; borde 10:00/10:00 permitido; "hoy" correcto simulando las 22:00 hora Argentina; fecha pasada rechazada; rollback del cambio de estado si falla el historial.

Al terminar: resumen y detenete.
```

## Cómo verificar
- Abrí dos pestañas y mandá la misma reserva a la vez: solo una debe crearse.
- El resumen de admin muestra las reservas de hoy aunque sean más de las 21:00.
