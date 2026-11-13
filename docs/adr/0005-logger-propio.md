# 0005 — Logger JSON propio en vez de pino o winston

- **Estado:** aceptada
- **Fecha:** 2026-11
- **Contexto de implementación:** `src/utils/logger.js`

## Problema

Hasta esta fase los registros eran `console.log` y `console.error` con texto
libre. Con eso no se puede responder a la pregunta que importa cuando algo
falla en producción: _¿qué pasó en la petición de esta persona?_ No había forma
de unir las líneas de una misma operación ni de filtrar por nivel, y el
identificador de correlación que devolvía un error 500 no aparecía en ningún
log, así que no servía para buscar nada.

## Opciones consideradas

1. **Seguir con `console`.** Sin costo, pero sin estructura: no se puede
   filtrar, ni correlacionar, ni evitar que un secreto termine en el log.
2. **pino.** Es el estándar de hecho en Node: rápido, JSON, transportes,
   redacción de campos. Cuesta una dependencia de producción y su configuración
   de serializadores y transportes.
3. **winston.** Más configurable y más pesado; aporta transportes que este
   proyecto no necesita (los logs los recoge el runtime del contenedor).
4. **Un módulo propio de unas 60 líneas.**

## Decisión

Un logger propio que escribe una línea JSON por evento en stdout (o stderr para
`warn` y `error`), con niveles controlados por `LOG_LEVEL` y un método `hijo()`
para derivar un logger con campos fijos —el id de la petición— que arrastra a
todo lo que se registre en ella.

El motivo de no usar pino no es evitar dependencias por principio, sino que las
dos cosas que este proyecto sí necesita las resuelve mejor el código propio:

- **Saneado obligatorio.** Todo lo que se registra pasa por el sanitizador de
  secretos de `SEC-CFG-03` y por una lista de claves que nunca se escriben
  (`password`, `authorization`, `token`…). Con pino habría que configurar
  `redact` y recordar mantenerlo; acá no hay forma de saltearlo.
- **Sin transportes.** El destino siempre es la salida estándar, porque la
  recolección y la rotación las hace Docker. La parte de pino que justifica su
  peso —transportes, workers— no se usaría.

## Consecuencias

**A favor**

- Cada línea es JSON indexable por cualquier recolector, sin configuración.
- Una petición se puede seguir completa por su `requestId`, y el
  `correlationId` que ve el usuario en un error 500 es ese mismo id.
- No agrega dependencias de producción, en un proyecto donde cada una hay que
  auditar (hay un job de `npm audit` en CI).

**En contra**

- Es código propio que hay que mantener y probar (está cubierto por pruebas de
  formato, niveles y saneado).
- No tiene lo que pino trae gratis: muestreo, serializadores por campo,
  rendimiento optimizado con workers.
- **Punto de quiebre explícito:** si el proyecto necesitara enviar logs a varios
  destinos, muestrear por volumen o medir que el logger es un cuello de botella,
  la decisión correcta pasa a ser pino y este ADR queda superado.
