# 0003 — Idempotencia por clave en la creación de reservas

- **Estado:** aceptada
- **Fecha:** 2026-11
- **Contexto de implementación:** `src/services/reservas.services.js`, migración `004-idempotencia`

## Problema

Crear una reserva no es idempotente: si la misma petición llega dos veces, se
crean dos reservas. Y llega dos veces más a menudo de lo que parece: doble clic
en el botón, el usuario reintenta porque la red se cortó justo antes de recibir
la respuesta, o un proxy repite la petición.

La restricción de exclusión (ADR 0001) no alcanza acá: dos peticiones idénticas
del mismo usuario para la misma franja son _solapadas_, así que la segunda
falla con un 409 "el aula ya está reservada" — un mensaje confuso, porque la
reserva que ocupa la franja es la suya, creada un instante antes.

## Opciones consideradas

1. **Deshabilitar el botón en el frontend.** Ayuda con el doble clic y con nada
   más: no cubre un reintento tras un corte de red ni una petición repetida por
   un intermediario.
2. **Deduplicar por contenido.** Rechazar una reserva idéntica a otra creada en
   los últimos segundos. Es adivinar la intención: dos reservas iguales podrían
   ser legítimas, y el umbral de tiempo sería arbitrario.
3. **Clave de idempotencia provista por el cliente**, como hacen las APIs de
   pagos.

## Decisión

El cliente puede enviar la cabecera `Idempotency-Key` con un UUID. El servidor
guarda, en la tabla `idempotency_keys`, la clave junto con un hash del cuerpo y
la respuesta que emitió:

- **Misma clave y mismo cuerpo** → se devuelve la respuesta original, con la
  cabecera `Idempotent-Replay: true`. No se crea una segunda reserva.
- **Misma clave y cuerpo distinto** → 422: la clave identifica una operación,
  no un reintento cualquiera.
- **Sin cabecera** → comportamiento normal, sin deduplicación.

Dos detalles que hacen que funcione:

- **La clave se guarda en la misma transacción que la reserva.** Si la
  transacción falla, no queda una clave registrada sin su reserva; si se
  confirma, la respuesta queda disponible para el reintento.
- **Las claves vencen a las 24 horas** y se purgan al arrancar. Una clave
  vencida que se reutiliza se renueva, para que no quede una clave inservible
  ocupando el par (usuario, clave).

Si dos peticiones con la misma clave llegan realmente a la vez, una gana y la
otra recibe un conflicto de la base; en ese caso el servicio busca la respuesta
que dejó la ganadora, con reintentos cortos y acotados (hasta 140 ms). Esos
reintentos solo se intentan ante un conflicto de solapamiento o de unicidad:
cualquier otro error se propaga de inmediato, para no demorar la respuesta.

## Consecuencias

**A favor**

- Un reintento no duplica una reserva, venga de un doble clic, de un corte de
  red o de un intermediario.
- El frontend genera una clave por formulario y la renueva al cambiar los datos:
  la protección es automática para el usuario.

**En contra**

- Una tabla más, con su migración y su purga.
- La semántica hay que documentarla bien, porque el 422 por "misma clave, otro
  cuerpo" sorprende a quien no conoce el patrón (está en el OpenAPI).
- Solo protege la creación de reservas: los otros endpoints de escritura siguen
  sin idempotencia, y se decidió no agregarla donde el daño de un reintento es
  nulo (aprobar dos veces la misma reserva no cambia el resultado).
