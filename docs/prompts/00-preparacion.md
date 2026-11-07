# Fase 0 — Preparación
**Modo sugerido:** Planning. **Rama:** `mejora/fase-0-preparacion`. **Tiempo:** corto.

## Antes de pegar el prompt (lo hacés vos)
- Copiá `docs/` y `.agent/` a la raíz del proyecto y abrí `reservas/` como workspace.
- Si el zip salió de tu máquina o del repo compartido, **rotá la `CLERK_SECRET_KEY`** en el dashboard de Clerk.

## Prompt
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 0 — preparación. Hacé SOLO esto:

1. Mover `CONTEXTO_PROYECTO.md` de la raíz a `docs/` si todavía no está ahí.
2. Crear `backend/backups/` con un `.gitkeep` y agregar al `.gitignore` de la raíz: `*.sqlite`, `backend/backups/*` (excepto .gitkeep), `*.dump`.
3. Copiar `backend/database.sqlite` a `backend/backups/database.pre-mejoras.sqlite`.
4. Crear `backend/.env.example` y `frontend/.env.example` con TODAS las variables que usa el código (buscalas con grep: `process.env`, `import.meta.env`) y valores placeholder. No leas ni copies valores reales de los `.env`.
5. Ejecutar los tests actuales del backend y del frontend y reportar cuáles pasan y cuáles fallan HOY, sin arreglar nada. Esa es la línea base.
6. Listar (sin borrar) los archivos sobrantes de la raíz: `src/`, `index.html`, `package.json`, `public/` y cualquier otro duplicado de `frontend/`. Decime cuáles están vacíos y cuáles tienen contenido distinto al de `frontend/`.

No toques código de aplicación. Al terminar mostrame el resumen y detenete.
```

## Cómo verificar
- `git status` muestra solo los archivos nuevos/movidos.
- Tenés anotada la línea base de tests (cuántos pasan hoy).
