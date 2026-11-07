# Fase 2c — Migración de datos SQLite → PostgreSQL
**Modo sugerido:** Planning. **Rama:** `mejora/fase-2c-datos`. **Riesgo:** alto, son tus datos reales.

## Antes de pegar el prompt
- Confirmá que existe `backend/backups/database.pre-mejoras.sqlite` (Fase 0).
- Hacé `pg_dump` de la base migrada vacía como punto de retorno (el agente lo hace también, pero no sobra).

## Prompt
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 2c — migrar los datos de backend/backups/database.pre-mejoras.sqlite a PostgreSQL. Seguí la "Estrategia de datos" de docs/PLAN_POSTGRESQL.md. Usá el sqlite del backup como ORIGEN, nunca el archivo de trabajo.

Hechos ya verificados sobre el origen: 9 usuarios, 5 aulas, 25 reservas, 58 historiales; 0 solapamientos activos; 0 huérfanos; 11 reservas con usuarioId de texto (ids de Clerk "user_..." y UUID de Keycloak); 1 reserva con más personas que la capacidad del aula.

1. Escribí `backend/scripts/migrar-sqlite-a-postgres.js` con modo `--dry-run` (no escribe nada, solo informa) y modo real. Debe ser idempotente: si se corre dos veces no duplica.
2. Orden: usuarios → aulas → reservas → historial, conservando los ids originales.
3. Mapeo de usuarioId de texto: los que empiezan con "user_" → usuario local con ese clerkId (crearlo si no existe: nombre/email placeholder claramente marcados, sin passwordHash). Los UUID sin equivalente → usuario "Sistema". Informá la tabla de mapeo completa.
4. Todo dentro de UNA transacción. Si falla algo, rollback total.
5. Al final, reiniciar las secuencias de cada tabla con setval(pg_get_serial_sequence(...), MAX(id)).
6. Verificaciones automáticas al final: conteos origen vs destino (reservas 25, historial 58, aulas 5), cero filas con usuarioId sin FK, cero solapamientos, y que todas las constraints estén validadas (`convalidated = true` en pg_constraint).
7. Reportá, sin corregirla, la reserva que supera la capacidad (id, aula, personas, capacidad) para que yo decida.
8. Primero ejecutá `--dry-run` y mostrame el reporte. Esperá mi OK antes de la corrida real.
9. Tras mi OK y la corrida real: levantá el backend y probá GET /api/reservas, el detalle y el historial de 3 reservas con distintos tipos de usuario original.
10. Recién entonces: desinstalar `sqlite3`, borrar toda referencia a sqlite del código y de package.json (el script de migración debe quedar archivado en `backend/scripts/legacy/` con una nota de que requiere sqlite3 instalado temporalmente).

Al terminar: resumen con el mapeo de usuarios y detenete.
```

## Cómo verificar
- `SELECT COUNT(*)` en cada tabla coincide con el reporte.
- Entrá con el login local y con Google/Clerk: cada usuario ve sus reservas históricas.
- `grep -ri sqlite backend/src backend/package.json` no devuelve nada.
