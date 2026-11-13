# 0006 — 409 para los conflictos con el estado, 400 solo para pedidos mal formados

- **Estado:** aceptada
- **Fecha:** 2026-11
- **Contexto de implementación:** `src/middleware/error.middleware.js`, `src/services/`

## Problema

La API tenía tres situaciones en las que un pedido válido no se puede cumplir
porque choca con algo que ya existe, y respondía con dos códigos distintos:

| Situación                                | Origen              | Código que devolvía |
| ---------------------------------------- | ------------------- | ------------------- |
| El aula ya está reservada en ese horario | `23P01` (exclusión) | `400`               |
| El email ya está registrado              | `23505` (unicidad)  | `400`               |
| Ya existe un aula con ese nombre         | `23505` (unicidad)  | `409`               |

Tres conflictos del mismo tipo, dos respuestas distintas. Quien integra la API
no puede escribir una sola rama de manejo de errores: tiene que leer el texto
del mensaje para saber qué pasó, que es justamente lo que el código de estado
existe para evitar.

Y el `400` es el código equivocado para los tres. `400 Bad Request` significa
que el servidor no puede procesar el pedido por un problema del pedido mismo:
sintaxis inválida, un campo que falta, un tipo que no corresponde. En estos tres
casos el pedido está perfectamente bien formado y es válido. Lo que falla es que
el estado actual del recurso no lo admite — que es, palabra por palabra, la
definición de `409 Conflict` en la RFC 9110 §15.5.10.

La diferencia no es académica: ante un `400`, quien integra revisa el cuerpo del
pedido buscando el error. Ante un `409` sabe que el pedido estaba bien y que lo
que tiene que hacer es ofrecer otra franja, otro nombre u otro correo. Y un
cliente que reintenta automáticamente debe reintentar un `409` (el estado puede
cambiar) y nunca un `400` (el pedido va a seguir siendo inválido).

## Opciones consideradas

1. **Dejar todo en `400` y unificar hacia abajo.** Consistente y barato, pero
   consistentemente incorrecto: borra la distinción entre "tu pedido está mal" y
   "tu pedido está bien pero llegaste tarde", que es la que el cliente necesita
   para decidir si reintentar.
2. **`422 Unprocessable Content` para los tres.** Es para un pedido
   sintácticamente correcto cuyo _contenido_ no se puede procesar. Acá el
   contenido es procesable: lo que lo impide es el estado del servidor, no el
   contenido. Además `422` ya tiene un uso en esta API, para la clave de
   idempotencia reutilizada con otro cuerpo, y duplicarlo lo volvería ambiguo.
3. **`409 Conflict` para los tres (elegida).**

## Decisión

El criterio queda en una sola línea: **`400` cuando el problema está en el
pedido; `409` cuando el pedido está bien y el problema está en el estado.**

Responden `409`:

- solapamiento de reservas (`23P01`),
- nombre de aula duplicado y correo ya registrado (`23505`),
- dar de baja un aula con reservas futuras sin pedir que se cancelen.

Siguen en `400` la validación de esquema (Zod), las reglas de horario (fecha
pasada, franja fuera de la jornada, hora de fin anterior a la de inicio), la
capacidad insuficiente, las transiciones de estado inválidas (aprobar una
reserva que no está pendiente) y las referencias a recursos inexistentes
(`23503`), porque en todos esos casos lo que hay que corregir está en el pedido.

`422` queda reservado para su único caso: una clave de idempotencia reutilizada
con un cuerpo distinto.

## Consecuencias

**A favor**

- Un cliente puede decidir si reintentar mirando solo el código de estado.
- Las tres rutas de conflicto responden igual, así que el manejo es uno solo.
- `contrato-frontend.test.js` fija la convención: si una de las tres vuelve a
  responder `400`, la prueba falla.

**En contra**

- Es un cambio incompatible para cualquier cliente que hubiera discriminado por
  `400`. En este proyecto el frontend distingue por el texto del mensaje y no
  por el código, así que no requirió cambios; en una API con consumidores
  externos habría hecho falta una versión nueva o un período de transición.
- Hubo que actualizar las pruebas que afirmaban `400`, incluida la de
  concurrencia que espera 99 rechazos — el número no cambió, sí el código.
