# Estrategia de pruebas y calidad de código

Qué se prueba, con qué herramienta y por qué. Las métricas de esta página se
obtienen ejecutando los comandos indicados, no de estimaciones.

---

## 1. Pirámide de pruebas

| Nivel              | Herramienta                    | Cantidad               | Qué cubre                                                                                                           | Dónde corre                        |
| ------------------ | ------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Integración de API | Jest + Supertest               | 198 pruebas            | Negocio, autorización, concurrencia, idempotencia, límites, errores de PostgreSQL, observabilidad, contrato OpenAPI | CI (job `backend`)                 |
| Componentes        | Vitest + Testing Library + axe | 112 pruebas            | Render, interacción, accesibilidad, contrato con la API                                                             | CI (job `frontend`)                |
| Extremo a extremo  | Playwright                     | 20 pruebas en 7 flujos | Los recorridos completos del usuario sobre la aplicación compilada                                                  | CI (job `e2e`)                     |
| Carga              | k6                             | 1 escenario            | Latencia, throughput y tasa de errores                                                                              | Manual (ver `carga/README.md`)     |
| Volumen de datos   | Script propio                  | 1 benchmark            | Planes de consulta con 200.000 reservas                                                                             | Manual (ver `docs/RENDIMIENTO.md`) |

No se persigue un porcentaje de cobertura: las pruebas se eligen por el error
que detectan. Las tres que motivaron correcciones reales están al final de esta
página.

---

## 2. Pruebas de extremo a extremo (Playwright)

Los siete flujos exigidos por el roadmap, en `e2e/tests/`:

| Archivo                           | Flujo                      | Casos                                                                                                                             |
| --------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `01-login.spec.js`                | Inicio de sesión           | Credenciales válidas, credenciales inválidas, destinos según rol, cierre de sesión                                                |
| `02-disponibilidad.spec.js`       | Consulta de disponibilidad | Franjas ocupadas en la grilla, filtros del listado                                                                                |
| `03-solicitud.spec.js`            | Solicitud de reserva       | Alta eligiendo franja en la grilla, exceso de capacidad, franja ya ocupada                                                        |
| `04-aprobacion.spec.js`           | Aprobación administrativa  | Aprobación desde el detalle, rechazo desde el panel                                                                               |
| `05-historial.spec.js`            | Consulta del historial     | Registro de creación y de aprobación                                                                                              |
| `06-cancelacion.spec.js`          | Cancelación                | Cancelación por el solicitante, liberación de la franja                                                                           |
| `07-acceso-no-autorizado.spec.js` | Accesos indebidos          | Rutas privadas sin sesión, vistas de administración con rol usuario, API sin token, escalamiento por API, reserva de otra persona |

### Cómo se ejecutan

```bash
cd e2e
npm ci
npx playwright install --with-deps chromium
DATABASE_URL_E2E=postgres://usuario:clave@localhost:5432/reservas_e2e npm test
```

Playwright levanta por sí mismo la API (puerto 3101) y el frontend compilado
(puerto 4173), así que no hace falta tener nada corriendo de antemano.

### Decisiones de diseño

- **Base de datos exclusiva.** El script `backend/scripts/preparar-db-e2e.js`
  aplica migraciones, vacía las tablas y carga las semillas antes de cada
  corrida. Aborta si el nombre de la base no termina en `_e2e`, de modo que no
  pueda vaciar una base de desarrollo o de producción.
- **Clerk sustituido por un doble.** El build `vite --mode e2e` reemplaza
  `@clerk/clerk-react` por `e2e/soporte/clerk-stub.jsx`, que simula el SDK
  cargado y sin sesión. Así las pruebas no dependen de la red ni de claves
  reales, y ejercitan el inicio de sesión local. El build de producción no
  incluye ese archivo.
- **Se prueba contra el build, no contra el servidor de desarrollo.** Es lo que
  se despliega; además detecta problemas que solo aparecen compilado.
- **Ejecución en serie.** Los flujos comparten una base de datos y cada archivo
  reserva sus propios días (`datosReserva({ dia })`), por lo que ninguna prueba
  compite por la misma franja con otra.
- **Selectores por rol accesible.** `getByRole`, `getByLabel` y nombres
  accesibles en lugar de clases CSS: las pruebas sobreviven a cambios de estilo
  y verifican de paso que la interfaz sea navegable por lectores de pantalla.
- **Precondiciones por API.** Cuando una prueba necesita una reserva previa, la
  crea por API y no por la interfaz: el flujo bajo prueba queda aislado y la
  corrida es más rápida.

### Las capturas de la documentación salen del mismo arnés

`npm run capturas --prefix e2e` levanta el entorno de `e2e/soporte/entorno.js`
—la API real contra la base sembrada y el frontend compilado— y regenera
`docs/img` desde la aplicación tal cual es. No hay un backend simulado que se
desactualice en silencio: si una pantalla cambia, la captura cambia con ella.

De paso verifica lo que no se debe ver. Cada ruta se mide a 360, 768 y 1280 px
comprobando que `scrollWidth` no supere `clientWidth`, de modo que un desborde
horizontal rompe la generación en lugar de quedar documentado en una imagen.

Se corre aparte de `npm test` porque escribe archivos en el repositorio: es la
generación de un artefacto, no una verificación que deba correr en CI.

---

## 3. Pruebas de carga (k6)

Un único escenario (`carga/disponibilidad.js`) sobre los dos caminos más
usados: consulta de disponibilidad y alta de reserva. Umbrales, parámetros y
forma de ejecución en [`carga/README.md`](../carga/README.md).

No corre en CI: necesita el binario de k6 y una base con datos reales, y sus
números dependen del hardware, por lo que un umbral fijo en CI daría falsos
negativos. Se ejecuta a mano al cambiar algo sensible al rendimiento.

Un 400 por franja ocupada no se cuenta como error: es la respuesta correcta
cuando dos usuarios virtuales piden la misma franja, y se registra en la métrica
`franjas_ya_ocupadas`.

---

## 4. Formato y análisis estático

| Herramienta                      | Alcance                     | Verificación                           |
| -------------------------------- | --------------------------- | -------------------------------------- |
| Prettier 3.6.2                   | Todo el repositorio         | `npm run format:check` (job `formato`) |
| ESLint                           | Backend, frontend y pruebas | `npm run lint` en cada paquete         |
| `npm audit --omit=dev`           | Dependencias de producción  | Jobs `backend` y `frontend`            |
| Semgrep, CodeQL, Gitleaks, Trivy | Código, secretos e imágenes | Jobs propios                           |

El formato se aplica con `npm run format` desde la raíz. Las migraciones y las
semillas quedan excluidas en `.prettierignore`: sus columnas alineadas a mano
documentan el esquema.

### Límites de complejidad

En el backend, donde vive la lógica de negocio, ESLint falla si el código de
`src/` excede estos límites:

| Regla                    | Límite | Por qué                                                       |
| ------------------------ | ------ | ------------------------------------------------------------- |
| `complexity`             | 12     | Una función con más caminos es difícil de probar por completo |
| `max-lines-per-function` | 80     | Señala funciones que hacen varias cosas                       |
| `max-depth`              | 4      | El anidamiento profundo esconde errores de condición          |

Activar estos límites obligó a dividir seis funciones que los excedían, sin
cambiar su comportamiento (las pruebas del backend siguen pasando):

| Función                   | Antes                           | Después                                                     |
| ------------------------- | ------------------------------- | ----------------------------------------------------------- |
| `manejadorErrores`        | complejidad 61, 88 líneas       | Una lista de mapeadores por tipo de error                   |
| `crearNuevaReserva`       | complejidad 28, 182 líneas      | Validación, transacción e idempotencia separadas            |
| `editarReserva`           | complejidad 28, 113 líneas      | Combinación de cambios, validación y verificación separadas |
| `obtenerResumen`          | 109 líneas                      | Una función por métrica del panel                           |
| `validarEnv`              | complejidad 39                  | Lectores `leerEntero` / `leerTexto`                         |
| `sincronizarUsuarioClerk` | complejidad 27                  | Extracción de datos y actualización separadas               |
| `obtenerReservas`         | complejidad 19                  | Filtros, paginación y orden separados                       |
| Validadores de reserva    | complejidad 26 y 27, duplicados | Un validador por campo, compartido entre alta y edición     |

En el frontend los límites se aplican según lo que contiene cada archivo:

| Archivos                                                         | Reglas                                                      | Por qué                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| `src/**/*.js` (lógica: hooks, validaciones, cálculos, servicios) | `complexity` 12, `max-lines-per-function` 80, `max-depth` 4 | Los mismos que el backend: es código con ramas reales |
| `src/**/*.jsx` (componentes)                                     | `max-lines-per-function` 200, `max-depth` 4                 | Ver más abajo                                         |

En un componente, la complejidad ciclomática cuenta **cada condicional del
JSX**: un `{error ? <Toast/> : null}` suma lo mismo que una rama de negocio. Un
umbral bajo ahí no premia código más simple, premia partir el markup en
fragmentos arbitrarios. Lo que sí señala un componente que hace demasiadas
cosas es su tamaño y su anidamiento, y eso es lo que se limita. La lógica se
mueve a archivos `.js`, donde el límite de complejidad sí aplica: por eso la
grilla tiene sus cálculos en `grillaCalculos.js` y los formularios su
validación en `validarAula.js` y `validarReserva.js`.

Activar estos límites obligó a reorganizar el frontend. Los archivos grandes se
dividieron en piezas con una sola responsabilidad, sin cambiar el
comportamiento (las 112 pruebas de componentes y las 20 de extremo a extremo
siguen pasando):

| Antes                               | Después                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GrillaDisponibilidad` (591 líneas) | Orquestador (187) + vista de escritorio (202) + vista compacta (165) + `grillaCalculos.js` (155) + `useNavegacionGrilla` (79) |
| `Resumen` (458)                     | Página (179) + `usePanel` + `metricasPanel.js` + columnas + 3 secciones                                                       |
| `Aulas` (531)                       | Página (273) + `useAulas` + `validarAula.js` + 2 diálogos + filtros + columnas                                                |
| `FormularioReserva` (448)           | Página (149) + `useDatosFormulario` + `validarReserva.js` + pasos + campos + resumen                                          |
| `GuiaEstilos` (339)                 | Página (49) + 7 secciones + datos de demostración                                                                             |
| `DetalleReserva` (199)              | Página (84) + `useReservaDetalle` + ficha + migas                                                                             |

Además se eliminó la **API de props duplicada** de los componentes base. Cada
uno aceptaba el mismo dato con dos nombres (`titulo` y `title`, `abierto` y
`open`, `cargando` y `loading`, …) y la mitad inglesa no la usaba ningún
componente de la aplicación: era superficie muerta que inflaba la complejidad y
obligaba a elegir entre dos convenciones en cada uso. Quedó una sola, en
español, igual que el resto del código. La complejidad de los componentes base
bajó en consecuencia (`Field` 27 → 11, `Table` 23 → 11, `ConfirmDialog` 23 → 6,
`Button` 21 → 7), y el manejo de foco de las ventanas modales quedó en un hook
reutilizable (`useTrampaDeFoco`).

Las definiciones de columnas de las tablas también usaban dos convenciones a la
vez (`key`/`clave`, `align: 'right'`/`alineacion: 'derecha'`) según la página:
ahora hay una sola.

---------------------- | ----------- | ------ |
| `Field` | 27 | 79 |
| `ConfirmDialog` | 23 | 153 |
| `Table` | 23 | 110 |
| `GrillaDisponibilidad` | 22 | 551 |
| `Button` | 21 | 95 |

Eliminar esa API duplicada y dividir `GrillaDisponibilidad`, `Aulas` y
`FormularioReserva` (más de 400 líneas cada uno) queda pendiente; recién
entonces tiene sentido forzar un límite de complejidad en el frontend, en lugar
de fijar uno a la medida del código actual.

---

## 5. Pruebas de observabilidad y de contrato

Dos conjuntos agregados en la fase 13, que verifican cosas que normalmente no se
prueban y se descubren en producción:

- **`tests/observabilidad.test.js`** (15 casos): que el identificador de
  petición se genere, se respete solo si es un UUID y se devuelva en la
  cabecera; que el `correlationId` de un error 500 sea ese mismo identificador;
  que los registros salgan como JSON con nivel, ruta declarada, estado y
  duración; que **no** contengan secretos ni claves sensibles; que las sondas de
  liveness y readiness respondan lo que corresponde, incluida una base que no
  contesta a tiempo; y que una consulta lenta quede registrada y una rápida no.
- **`tests/openapi.test.js`** (6 casos): valida la especificación con
  `@apidevtools/swagger-parser` y la **compara con las rutas que Express tiene
  registradas**, en los dos sentidos. La prueba falla si se agrega un endpoint
  sin documentarlo o si queda documentado uno que ya no existe, de modo que la
  documentación no pueda desactualizarse en silencio.
- **Contrato de CORS** (en `tests/contrato-frontend.test.js`): el preflight debe
  permitir cada cabecera que el frontend realmente envía. Esta prueba existe
  porque esa falla ya ocurrió (ver más abajo).

---

## 6. Errores que estas pruebas encontraron

Tres correcciones de esta fase salieron de escribir las pruebas, no de leer el
código:

1. **El nombre del usuario se mostraba mal.** La barra lateral decía
   "David LÃ³pez" en lugar de "David López". `atob` devuelve bytes
   interpretados como Latin-1, de modo que el payload del JWT se leía con la
   codificación equivocada. Corregido en `frontend/src/utils/jwt.js`, que
   reinterpreta los bytes como UTF-8, con pruebas unitarias propias.
2. **Aprobar no pedía confirmación.** El panel administrativo confirmaba antes
   de aprobar, pero el detalle de la reserva aprobaba con un solo clic. Los
   textos del diálogo ya existían sin usarse. Unificado en
   `AccionesReserva.jsx`.
3. **Una cabecera nueva rompió toda la aplicación, y solo el E2E lo vio.** Al
   agregar el identificador de petición, el frontend empezó a enviar
   `X-Request-Id`, que no estaba en los `allowedHeaders` de CORS. Las 198
   pruebas de API seguían pasando —supertest no aplica CORS—, pero en el
   navegador el preflight fallaba y **ninguna** pantalla cargaba datos. Lo
   detectaron las pruebas de extremo a extremo, con el diagnóstico mostrando
   "No se pudieron cargar las reservas". Corregido en `app.js`, con una prueba
   de contrato que ahora verifica cada cabecera que el frontend envía.
4. **Dos notificaciones se mostraban con el estilo equivocado.** El detalle de
   una reserva y el panel pasaban `variante="exito"` y `variante={...}` a
   `Toast`, que no tiene esa propiedad: la correcta es `tipo`. El resultado era
   que un aviso de éxito y uno de error se veían como informativos, con el
   icono y el color neutros, y el de error perdía además su `role="alert"`, por
   lo que un lector de pantalla no lo anunciaba con prioridad. Lo hizo evidente
   quitar la API de props duplicada, que hasta entonces tapaba el nombre
   equivocado en silencio.
5. **El límite de intentos de inicio de sesión estaba fijo en el código.** Los
   demás límites se configuran por variables de entorno desde la fase 10;
   este no, lo que además impedía automatizar los flujos. Ahora usa
   `RATE_LIMIT_LOGIN_MAX` (10 por defecto, como antes) y el mismo helper que
   los otros limitadores.
