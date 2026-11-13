# Estrategia de pruebas y calidad de código

Qué se prueba, con qué herramienta y por qué. Las métricas de esta página se
obtienen ejecutando los comandos indicados, no de estimaciones.

---

## 1. Pirámide de pruebas

| Nivel              | Herramienta                    | Cantidad               | Qué cubre                                                                                                 | Dónde corre                        |
| ------------------ | ------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Integración de API | Jest + Supertest               | 172 pruebas            | Reglas de negocio, autorización, concurrencia, idempotencia, límites de peticiones, errores de PostgreSQL | CI (job `backend`)                 |
| Componentes        | Vitest + Testing Library + axe | 77 pruebas             | Render, interacción, accesibilidad, contrato con la API                                                   | CI (job `frontend`)                |
| Extremo a extremo  | Playwright                     | 19 pruebas en 7 flujos | Los recorridos completos del usuario sobre la aplicación compilada                                        | CI (job `e2e`)                     |
| Carga              | k6                             | 1 escenario            | Latencia, throughput y tasa de errores                                                                    | Manual (ver `carga/README.md`)     |
| Volumen de datos   | Script propio                  | 1 benchmark            | Planes de consulta con 200.000 reservas                                                                   | Manual (ver `docs/RENDIMIENTO.md`) |

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
cambiar su comportamiento (las 172 pruebas del backend siguen pasando):

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

En el frontend se aplica `max-depth` (4), que es el límite que detecta errores
reales. La complejidad ciclomática está medida pero **no** forzada: en los
componentes de presentación la domina la API de props duplicada en español e
inglés (`titulo || title`, `abierto || open`, …), cuya mitad inglesa no usa
ningún componente de la aplicación. Valores actuales:

| Componente             | Complejidad | Líneas |
| ---------------------- | ----------- | ------ |
| `Field`                | 27          | 79     |
| `ConfirmDialog`        | 23          | 153    |
| `Table`                | 23          | 110    |
| `GrillaDisponibilidad` | 22          | 551    |
| `Button`               | 21          | 95     |

Eliminar esa API duplicada y dividir `GrillaDisponibilidad`, `Aulas` y
`FormularioReserva` (más de 400 líneas cada uno) queda pendiente; recién
entonces tiene sentido forzar un límite de complejidad en el frontend, en lugar
de fijar uno a la medida del código actual.

---

## 5. Errores que estas pruebas encontraron

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
3. **El límite de intentos de inicio de sesión estaba fijo en el código.** Los
   demás límites se configuran por variables de entorno desde la fase 10;
   este no, lo que además impedía automatizar los flujos. Ahora usa
   `RATE_LIMIT_LOGIN_MAX` (10 por defecto, como antes) y el mismo helper que
   los otros limitadores.
