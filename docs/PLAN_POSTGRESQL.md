# Plan de migración a PostgreSQL

Complementa a `PLAN_MEJORAS_ANTIGRAVITY.md`. Reemplaza lo que ese plan decía de la base de datos (Fase 2) y adelanta la *exclusion constraint* (antes opcional, en la Fase 5) porque ahora es el eje del diseño.

## 1. Dónde va cada archivo

```
reservas/
├── .agent/rules/reservas.md          ← reglas permanentes (se aplican en todas las sesiones)
├── docs/
│   ├── CONTEXTO_PROYECTO.md          ← mover desde la raíz
│   ├── PLAN_MEJORAS_ANTIGRAVITY.md   ← mover desde donde lo guardaste
│   ├── PLAN_POSTGRESQL.md            ← este archivo
│   └── prompts/
│       ├── 00-preparacion.md
│       ├── 01-seguridad.md
│       ├── 02a-postgres-infra.md
│       ├── 02b-esquema-migraciones.md
│       ├── 02c-migracion-datos.md
│       ├── 03-logica-negocio.md
│       ├── 04-calidad-estructura.md
│       └── 05-deploy.md
```
Descomprimí el zip en la raíz de `reservas/` y listo. Los `.md` de `docs/` son para vos y para que el agente los lea; `.agent/rules/` es lo que Antigravity carga solo.

Sobre `.agent/rules/`: es la convención de reglas de workspace de Antigravity según lo que conozco, pero la herramienta cambia rápido. Verificá en su panel de Rules/Customizations que la tome; si no, pegá el contenido ahí como regla del workspace. Los prompts funcionan igual porque cada uno le pide leer los documentos.

## 2. Decisiones de diseño

| Tema | Decisión | Por qué |
|---|---|---|
| Motor | PostgreSQL 16 en Docker, para desarrollo, test y producción | Un solo motor evita que los tests pasen en uno y fallen en otro |
| SQLite | Se elimina al final de la Fase 2 (`sqlite3` fuera de `package.json`) | Sin dialectos duplicados |
| ORM | Se mantiene Sequelize 6 + `pg` + `pg-hstore` | Cambio mínimo, el código de servicios casi no se toca |
| Migraciones | `sequelize-cli`, archivos `.cjs` (el proyecto es ESM) | Reemplaza `sync()` |
| Estados, roles, acciones | `VARCHAR` + `CHECK` (no tipos ENUM nativos) | Agregar un valor a un ENUM nativo es incómodo en migraciones |
| `horaInicio`/`horaFin` | `TIME` (con getter en el modelo que devuelve `HH:MM`) | El texto no sirve para la constraint de exclusión; el getter conserva el contrato de la API |
| `fecha` | `DATE` | Igual que hoy |
| Historial | `valorAnterior`/`valorNuevo` como `JSONB` | Consultable e indexable |
| Fechas de auditoría | `TIMESTAMPTZ` | Sin ambigüedad de zona |
| "Hoy" | Calculado en la app con `America/Argentina/Cordoba` | Arregla el bug de UTC del resumen |
| Anti-doble-reserva | Constraint de exclusión en la base | La garantía vive donde no se puede saltear |

## 3. Esquema objetivo

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- usuarios: + clerkId unico nullable, passwordHash nullable, + createdAt
-- aulas:    + CHECK (capacidad > 0)
-- reservas:
--   aulaId     INTEGER NOT NULL REFERENCES aulas(id)    ON DELETE RESTRICT
--   usuarioId  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT
--   fecha DATE, horaInicio TIME, horaFin TIME
--   CHECK ("horaInicio" < "horaFin")
--   CHECK ("cantidadPersonas" > 0)
--   CHECK (estado IN ('pendiente','aprobada','cancelada','rechazada'))
--   updatedAt TIMESTAMPTZ

ALTER TABLE reservas ADD CONSTRAINT reservas_sin_solapamiento
  EXCLUDE USING gist (
    "aulaId" WITH =,
    tsrange(("fecha" + "horaInicio"), ("fecha" + "horaFin"), '[)') WITH &&
  ) WHERE (estado IN ('pendiente','aprobada'));
```
- `'[)'` hace que 10:00–11:00 y 11:00–12:00 **no** se consideren solapadas (regla de negocio vigente).
- Cancelada/rechazada quedan fuera por el `WHERE`, así que no bloquean horario.
- Índices extra: `reservas("usuarioId")`, `reservas("fecha")`, `reservas(estado)`, `historial_reservas("reservaId","fechaHora")`.
- Con la constraint no hace falta re-chequear solapamiento al aprobar: pendiente y aprobada ya compiten por el mismo horario.
- Error de Postgres `23P01` (Sequelize: `ExclusionConstraintError`) se traduce a `400 "El aula ya está reservada en ese horario"`. Mantener el chequeo previo en el servicio solo para dar un mensaje temprano.
- `CREATE EXTENSION` requiere privilegios. En el contenedor oficial no hay problema; en un Postgres gestionado, confirmar que el proveedor permite `btree_gist`.

## 4. Estado de los datos actuales (verificado)

| Chequeo sobre `database.sqlite` | Resultado |
|---|---|
| Solapamientos entre reservas pendientes/aprobadas | 0 (la constraint no va a rechazar la carga) |
| Reservas con aula inexistente | 0 |
| Historial sin reserva | 0 |
| `usuarioId` numérico sin usuario | 0 |
| `usuarioId` tipo texto (Clerk/Keycloak) | 11 reservas → hay que mapearlos a usuarios locales |
| Reservas que superan la capacidad del aula | **1** → ningún `CHECK` lo detecta (cruza tablas). Se reporta y se decide a mano si se corrige |
| Totales | 9 usuarios, 5 aulas, 25 reservas, 58 historiales |

## 5. Fases

Mapa respecto del plan original: Fase 1 sigue igual; la Fase 2 se divide en 2a/2b/2c; la 3 incorpora la constraint; la 4 y la 5 se ajustan a Postgres.

| Fase | Contenido | Depende de | Riesgo |
|---|---|---|---|
| 0 | Preparación: rama, backup, `.env.example`, mover docs | — | Bajo |
| 1 | Seguridad (verificar token Clerk, secretos, `.gitignore`, autorización por dueño) | 0 | Medio: toca auth |
| 2a | Postgres en Docker, `pg`, conexión por `DATABASE_URL`, base de test | 1 | Bajo |
| 2b | Migraciones, esquema nuevo, asociaciones, seed nuevo | 2a | Alto: define el esquema |
| 2c | Migración de datos SQLite → Postgres, mapeo de usuarios, retiro de SQLite | 2b | **Alto: datos reales** |
| 3 | Lógica: constraint como fuente de verdad, errores, validaciones, zona horaria, disponibilidad | 2c | Medio |
| 4 | Limpieza, tests, lint, CI, actualizar contexto | 3 | Bajo |
| 5 | Deploy y backups | 4 | Medio |

Podés frenar después de la 4 si es un trabajo académico.

### Estrategia de datos (Fase 2c)
1. `pg_dump` de la base vacía recién migrada (punto de retorno) y copia del `.sqlite` original en `backend/backups/`.
2. Script `backend/scripts/migrar-sqlite-a-postgres.js`, **idempotente** y con modo `--dry-run`.
3. Orden: usuarios → aulas → reservas → historial. **Conservar los ids** originales.
4. Mapeo de identidad: cada `usuarioId` de texto se resuelve a un usuario local (por `clerkId` si empieza con `user_`; los UUID de Keycloak sin equivalente van al usuario "Sistema"). Los usuarios nuevos se crean con `clerkId` y sin contraseña.
5. Todo en **una sola transacción**: si algo falla, no queda nada a medias.
6. Al final: reiniciar secuencias (`setval(pg_get_serial_sequence(...), MAX(id))`) y comparar conteos origen/destino.
7. Reporte final: filas migradas, usuarios creados, la reserva que excede capacidad.

### Tests (cambio importante)
- Los tests dejan de usar `:memory:` y pasan a una base `reservas_test` en el mismo contenedor.
- `globalSetup` corre las migraciones; entre tests se limpian las tablas (`TRUNCATE ... RESTART IDENTITY CASCADE`).
- Casos nuevos: la constraint rechaza solapamientos; el borde exacto (11:00/11:00) se permite; una cancelada no bloquea; 10 `POST` simultáneos al mismo horario → exactamente un `201`.

## 6. Criterios de "terminado" para la migración
- [ ] `docker compose up -d` levanta Postgres sano (healthcheck verde).
- [ ] `npm run migrate` desde cero crea el esquema completo; `npm run migrate:undo:all` lo desarma.
- [ ] `npm run seed` carga datos de demo con fechas relativas a hoy.
- [ ] El script de datos migra 25 reservas y 58 historiales sin pérdida; `usuarioId` es 100 % entero con FK.
- [ ] No queda ninguna referencia a `sqlite` en el código ni en `package.json`.
- [ ] Todos los tests pasan contra Postgres, incluido el de concurrencia.
- [ ] La app funciona de punta a punta (login local, login Clerk, crear/aprobar/cancelar) con el frontend sin cambios.
