# Fase 4 — Calidad y estructura
**Modo sugerido:** Planning. **Rama:** `mejora/fase-4-calidad`. **Riesgo:** bajo.

## Prompt
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 4 — limpieza, calidad y documentación.

1. Con la lista de la Fase 0 y mi confirmación explícita, borrá los restos duplicados de la raíz (src/, index.html, package.json, public/ vacíos o repetidos). Antes de borrar, mostrame la lista final y esperá mi OK.
2. Tests: revisá la cobertura contra cada regla de negocio de docs/CONTEXTO_PROYECTO.md y agregá lo que falte (permisos por rol, propiedad, flujo de estados completo, filtros y paginación, resumen). Informá el porcentaje de cobertura del backend (jest --coverage).
3. Frontend: hacé que los tests existentes en frontend/src/pages/__tests__ corran de verdad (hoy varios son stubs de pocas líneas) y agregá al menos: login local, listado de reservas, crear reserva con error de solapamiento.
4. Lint: que `npm run lint` pase en backend y frontend, con script en cada package.json. Corregí solo lo que reporte, sin refactors grandes.
5. CI mínimo (.github/workflows/ci.yml o el equivalente de GitLab si el remoto es el de la facultad: revisá `git remote -v`): levantar un servicio postgres, correr migraciones, lint y tests del backend; lint y tests del frontend.
6. Actualizá docs/CONTEXTO_PROYECTO.md para que refleje el código real: Postgres, esquema nuevo, migraciones, endpoints (incluida disponibilidad), ubicación de tests, usuarios de prueba, y sacá cualquier secreto. Aplicá la lista de correcciones de la sección 3 del plan de mejoras.
7. Actualizá README.md con instalación, variables, migraciones, seed, tests y estructura.

Al terminar: resumen y detenete.
```

## Cómo verificar
- Clonar el repo en una carpeta limpia y seguir solo el README debe dejarlo funcionando.
- El pipeline de CI queda en verde.
