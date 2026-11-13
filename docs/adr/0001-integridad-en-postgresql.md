# 0001 — La integridad de los horarios la garantiza PostgreSQL, no el backend

- **Estado:** aceptada
- **Fecha:** 2026-10
- **Contexto de implementación:** migración `002-esquema-definitivo`

## Problema

Dos personas pueden pedir la misma aula, el mismo día y en horarios que se
solapan. El sistema no puede aceptar las dos. Validar la disponibilidad en el
backend antes de insertar parece suficiente, pero no lo es: entre la consulta
que comprueba que la franja está libre y el `INSERT` hay una ventana en la que
otra transacción puede insertar su reserva. Con dos peticiones simultáneas, las
dos consultas ven la franja libre y las dos insertan.

## Opciones consideradas

1. **Validar solo en el backend.** Simple y ya estaba escrito. No resiste
   concurrencia: la ventana entre comprobar e insertar es real y se reproduce
   con dos peticiones a la vez.
2. **Bloquear la tabla o el aula con `SELECT … FOR UPDATE`.** Correcto, pero
   serializa todas las reservas de un aula y depende de que cada camino de
   código recuerde tomar el bloqueo. Un endpoint nuevo que lo olvide reabre el
   problema.
3. **Restricción de exclusión en PostgreSQL.** La base rechaza la segunda
   reserva solapada, sin importar qué código la intente ni cuántas peticiones
   lleguen a la vez.

## Decisión

Se usa una restricción de exclusión sobre un rango temporal:

```sql
ALTER TABLE reservas
  ADD CONSTRAINT reservas_sin_solapamiento
  EXCLUDE USING gist (
    "aulaId" WITH =,
    tsrange(
      ("fecha" + "horaInicio")::timestamp,
      ("fecha" + "horaFin")::timestamp,
      '[)'
    ) WITH &&
  )
  WHERE (estado IN ('pendiente', 'aprobada'));
```

Tres detalles deliberados:

- **`'[)'`**: el rango incluye el inicio y excluye el fin, de modo que una
  reserva de 10:00 a 12:00 y otra de 12:00 a 14:00 no se consideran solapadas.
- **`WHERE estado IN ('pendiente','aprobada')`**: una reserva cancelada o
  rechazada libera su franja.
- **`USING gist`**: requiere la extensión `btree_gist` para poder combinar la
  igualdad de `aulaId` con el solapamiento de rangos en el mismo índice.

El backend conserva una comprobación previa, pero solo para devolver un mensaje
claro: la garantía es de la base. El manejador de errores traduce el código
`23P01` de PostgreSQL a un **409 Conflict** con el texto "El aula ya está
reservada en ese horario". Es 409 y no 400 porque el pedido está bien formado:
lo que falla es que choca con el estado actual del recurso. Un 400 le diría a
quien integra la API que revise el cuerpo del pedido, cuando lo que tiene que
hacer es elegir otra franja.

Cuánto aporta la restricción está medido: al quitarla de la migración y volver a
correr la prueba de concurrencia, **29 de 100 pedidos simultáneos** por la misma
aula y el mismo horario llegan a crear una reserva. La comprobación previa
detiene a los otros 71, pero no cierra la ventana de carrera; la restricción
sí.

## Consecuencias

**A favor**

- La invariante no se puede violar desde ningún camino de código, ni con
  peticiones simultáneas, ni desde una consola SQL, ni desde un script de
  migración de datos.
- Está verificado: la prueba de concurrencia lanza 100 peticiones simultáneas
  por la misma franja y comprueba que queda exactamente una reserva y que las
  otras 99 fallan de forma controlada.

**En contra**

- Ata el proyecto a PostgreSQL: no hay equivalente en MySQL ni en SQLite.
- El error llega como un código de PostgreSQL y hay que traducirlo en un solo
  lugar; si ese mapeo se rompe, el usuario ve un 500 en vez de un 400.
- La restricción exige pensar en zonas horarias: las horas se guardan como
  `time` y la fecha como `date`, y el rango se arma sumándolas, sin huso. Para
  un sistema de una sola sede es correcto; para varias sedes habría que
  revisarlo.
