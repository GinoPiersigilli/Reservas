# Decisiones de arquitectura (ADR)

Cada documento registra **una** decisión: el problema, las opciones que se
consideraron, qué se eligió y qué se pierde con esa elección. No se reescriben
cuando el proyecto cambia: si una decisión se reemplaza, se agrega un ADR nuevo
que la supera y se marca la anterior.

| #                                               | Decisión                                                             | Estado   |
| ----------------------------------------------- | -------------------------------------------------------------------- | -------- |
| [0001](0001-integridad-en-postgresql.md)        | La integridad de los horarios la garantiza PostgreSQL, no el backend | Aceptada |
| [0002](0002-autenticacion-clerk-y-jwt-local.md) | Autenticación con Clerk y JWT local propio                           | Aceptada |
| [0003](0003-idempotencia-por-clave.md)          | Idempotencia por clave en la creación de reservas                    | Aceptada |
| [0004](0004-auditoria-append-only.md)           | Auditoría de solo agregado, garantizada por un disparador            | Aceptada |
| [0005](0005-logger-propio.md)                   | Logger JSON propio en vez de pino o winston                          | Aceptada |
