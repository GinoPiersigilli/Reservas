# Fase 2b — Esquema, migraciones y seed
**Modo sugerido:** Planning (revisá el plan antes de aprobar). **Rama:** `mejora/fase-2b-esquema`. **Riesgo:** alto, define la base.

## Prompt
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 2b — esquema definitivo con migraciones. Seguí la sección 3 de docs/PLAN_POSTGRESQL.md al pie de la letra. Antes de escribir código, mostrame tu plan de archivos y esperá mi OK.

1. Instalá sequelize-cli. Creá `.sequelizerc` y la estructura `backend/db/{migrations,seeders}`. Como el proyecto es ESM, las migraciones van en archivos `.cjs`. Scripts: migrate, migrate:undo, migrate:undo:all, seed.
2. Migración 001-baseline: crea las 4 tablas tal como están hoy (para tener punto de partida reproducible).
3. Migración 002-esquema-definitivo, reversible (up y down completos):
   - CREATE EXTENSION IF NOT EXISTS btree_gist.
   - usuarios: agregar clerkId (unique, nullable), createdAt; passwordHash nullable; CHECK de rol.
   - aulas: CHECK capacidad > 0.
   - reservas: horaInicio/horaFin a TIME, fecha DATE, usuarioId INTEGER con FK, aulaId con FK, CHECKs (horaInicio < horaFin, cantidadPersonas > 0, estado válido), updatedAt, índices indicados, y la constraint de exclusión reservas_sin_solapamiento.
   - historial_reservas: FKs a reservas y usuarios, valorAnterior/valorNuevo a JSONB, CHECK de accion, índice (reservaId, fechaHora).
   Esta migración debe correr sobre una base VACÍA. La migración de datos reales es la Fase 2c, no mezclar.
4. Modelos Sequelize: actualizar tipos, agregar asociaciones (Aula.hasMany(Reserva), Usuario.hasMany(Reserva), Reserva.hasMany(HistorialReserva), y los belongsTo inversos). En Reserva, getters para horaInicio/horaFin que devuelvan "HH:MM" (sin segundos) para no cambiar el contrato de la API. Validaciones de modelo para formato de hora y estado.
5. Eliminar `sync()` del arranque (index.js). El esquema solo se crea con migraciones.
6. Seed nuevo en `db/seeders`, idempotente, NO se ejecuta al arrancar el servidor: usuario "Sistema" real (sin login), admin@utnfrc.edu.ar / admin123, david@utnfrc.edu.ar / user123, las 5 aulas actuales, y ~10 reservas con fechas RELATIVAS a hoy en estados variados (con su historial coherente). Sin referencias a Keycloak ni ids "0".
7. Adaptar los tests: usar la base reservas_test, globalSetup que corre las migraciones, y limpieza entre tests con TRUNCATE ... RESTART IDENTITY CASCADE. Que pasen todos los existentes.
8. Test nuevo de la constraint directamente contra la base: solapamiento rechazado; borde exacto 10:00-11:00 / 11:00-12:00 permitido; una reserva cancelada no bloquea.

Verificá: `migrate` desde cero, `migrate:undo:all`, y `migrate` otra vez, sin errores. Al terminar: resumen y detenete.
```

## Cómo verificar
- `psql ... -c '\d reservas'` muestra FKs, CHECKs y `reservas_sin_solapamiento`.
- Intentá a mano insertar dos reservas solapadas en la misma aula: la segunda debe fallar.
