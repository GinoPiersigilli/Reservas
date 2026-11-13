# 0004 — Auditoría de solo agregado, garantizada por un disparador

- **Estado:** aceptada
- **Fecha:** 2026-10
- **Contexto de implementación:** migraciones `002-esquema-definitivo`, `003-aulas-mejoras` y `005-historial-reservas-inmutable`

## Problema

Toda operación sobre una reserva o un aula tiene que quedar registrada: quién
la hizo, cuándo, qué había antes y qué quedó después. Un registro de auditoría
que se puede editar o borrar no sirve como evidencia: su valor depende de que
nadie, ni el código de la aplicación, pueda alterarlo.

## Opciones consideradas

1. **Registrar desde el servicio y confiar en el código.** Es lo más simple,
   pero cualquier `UPDATE` o `DELETE` posterior —un bug, un script de
   mantenimiento, una consola SQL— puede reescribir la historia sin dejar
   rastro.
2. **Quitar permisos de `UPDATE`/`DELETE` al usuario de la aplicación.**
   Efectivo, pero se configura fuera del repositorio: un despliegue nuevo con
   otro usuario de base queda sin la protección, y no se ve en el código.
3. **Disparador en la base que rechace modificar o borrar.** La regla viaja con
   el esquema, se aplica a cualquier usuario y queda versionada en una
   migración.

## Decisión

Las tablas `historial_reservas` y `historial_aulas` guardan una fila por acción,
con `usuarioId`, `fechaHora`, `accion`, `valorAnterior` y `valorNuevo` en JSONB.
Un disparador `BEFORE UPDATE OR DELETE` lanza una excepción en cada una, de modo
que las filas solo se pueden insertar.

> **Corrección (13/11/2026).** Esta decisión estuvo a medias durante tres
> semanas: la migración `003` creó el disparador de `historial_aulas` y este
> documento afirmaba que las dos tablas estaban protegidas, pero el de
> `historial_reservas` no existía. Faltaba justamente en la tabla de la entidad
> central: la que registra quién aprobó, rechazó o canceló cada reserva y la
> que el detalle muestra en pantalla. La migración `005` lo agrega, y tres
> pruebas nuevas en `reservas.test.js` lo verifican. Se deja asentado acá
> porque el hueco no lo detectó ninguna prueba: las que decían verificar la
> inmutabilidad cubrían solo `historial_aulas`.

El registro se escribe **en la misma transacción** que la operación auditada:
no puede existir una aprobación sin su entrada de historial, ni una entrada de
historial de algo que no ocurrió.

## Consecuencias

**A favor**

- El historial es confiable por construcción, no por disciplina del equipo.
- Guardar el estado anterior y el posterior permite reconstruir qué cambió en
  cada paso, no solo que "hubo una edición".
- Está verificado por pruebas que intentan modificar y borrar filas de **las
  dos** tablas y esperan que la base lo rechace, incluida una que aprueba una
  reserva y después intenta borrar el rastro de esa aprobación.

**En contra**

- Las correcciones legítimas son incómodas: un dato mal registrado no se
  "arregla", se compensa con una entrada nueva.
- Las tablas crecen sin límite. No hay política de archivado; con el volumen
  esperado de una facultad no es un problema a corto plazo, pero es una deuda
  consciente.
- Un `TRUNCATE` sí puede vaciarlas (no pasa por el disparador), así que la
  protección cubre modificaciones y borrados fila por fila, no un vaciado
  administrativo.
