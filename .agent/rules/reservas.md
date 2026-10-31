# Reglas permanentes — Sistema de Reservas de Aulas

Contexto del proyecto: `docs/CONTEXTO_PROYECTO.md`. Plan general: `docs/PLAN_MEJORAS_ANTIGRAVITY.md`. Plan de base de datos: `docs/PLAN_POSTGRESQL.md`. Si el contexto y el código difieren, manda el código.

## Cómo trabajar
1. Una rama por fase (`mejora/fase-N-nombre`). Un commit por tarea, mensaje en español, imperativo.
2. Antes de tocar datos, backup en `backend/backups/` (carpeta ignorada por git).
3. No cambiar contratos de la API (rutas, status HTTP, forma del JSON) salvo que la tarea lo pida. El frontend depende de ellos.
4. Cada tarea termina con `npm test` (backend) y `npm run lint` pasando. Si agregás comportamiento, agregá test.
5. Nunca imprimir ni commitear valores de `.env`. Solo `.env.example` con placeholders.
6. Antes de borrar archivos: listarlos y esperar confirmación.
7. Al terminar una fase: resumen de lo hecho, lo pendiente y cómo probarlo. **Detenerse**; no pasar a la siguiente fase sin confirmación.
8. Si algo del plan no se puede cumplir tal cual, explicar por qué y proponer alternativa antes de improvisar.

## Stack
Backend: Node (ESM) + Express + Sequelize 6. Base: PostgreSQL (SQLite se elimina en la Fase 2). Frontend: React + Vite. Auth: Clerk + JWT local de prueba.
