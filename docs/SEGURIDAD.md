# Seguridad, Auditoría y Content-Security-Policy (CSP)

Este documento centraliza el estado de seguridad, los hallazgos de auditoría automatizada y estática, las matrices de autorización y las políticas de endurecimiento del **Sistema de Reservas de Aulas**.

---

## Resumen Ejecutivo de la Auditoría 6a y Endurecimiento 6b

En la **Fase 6a** se llevó a cabo una auditoría automatizada y exhaustiva del sistema completo (backend, frontend, base de datos, dependencias, historial de control de versiones y contenedores Docker), ejecutando herramientas estándar de la industria bajo la regla de **solo medir y reportar sin aplicar modificaciones de código aún**.

Posteriormente, en las **Fases 6b1 y 6b2**, se implementó el plan de mitigación y endurecimiento de seguridad mediante commits individuales verificados con tests automatizados:
- **Fase 6b1 (Configuración e Infraestructura):** Corrección de vulnerabilidades en dependencias (`SEC-DEP-01` a `04`), configuración de `trust proxy` para proxies reversos (`SEC-CFG-01`), limitación de cuerpos HTTP a 10kb con respuesta 413 (`SEC-CFG-02`), manejo seguro de excepciones sin volcados de trazas en producción (`SEC-CFG-03`), ejecución de Nginx como usuario sin privilegios `nginx` UID 101 (`SEC-CNT-01`), actualización de parches del sistema operativo base en contenedores (`SEC-CNT-02`), y prevención de inyección de Host en proxy inverso (`SEC-SAST-01`).
- **Fase 6b2 (Autenticación, Validación y Autorización):** Fijación estricta de algoritmo `HS256` e issuer `reservas-api` en JWT local, junto con la consulta en base de datos del estado (`activo === true`) y rol del usuario en cada petición (`SEC-AUTH-02`); validación de `authorizedParties` (`azp`) en tokens de Clerk (`SEC-AUTH-03`); bloqueo de asignación masiva de roles en `registrarUsuario` (`SEC-AUTH-04`); vinculación de cuentas Clerk a cuentas locales restringida a emails verificados (`SEC-AUTH-05`); salvaguarda contra destrucción de bases de datos de desarrollo/producción en tests y exclusión de carreras con advisory locks (`SEC-TEST-01`); validación tipada con esquemas Zod en todas las entradas críticas (`SEC-VAL-01`); protección de la ruta de aulas con autenticación (`SEC-INV-01`); documentación formal del riesgo aceptado de `localStorage` (`SEC-AUTH-01`); y catalogación de hallazgos SAST (`SEC-SAST-02`, `SEC-SAST-03`).

Toda la evidencia cruda generada por las herramientas se encuentra preservada en el directorio `docs/seguridad/evidencia/`:
- **Dependencias:** `npm audit` y `npm outdated` (en backend y frontend, diferenciando dependencias globales y exclusivas de producción con `--omit=dev`).
- **Secretos e Historial Git:** Análisis completo de los 83 commits del repositorio con `gitleaks` y `trufflehog`, además de inspección de objetos blob en historial (`git log --full-history`).
- **SAST (Static Application Security Testing):** Escaneo con `semgrep` aplicando los rulesets oficiales `p/javascript`, `p/nodejs`, `p/react` y `p/owasp-top-ten` (170 archivos analizados, 115 reglas), y análisis con `eslint` y `eslint-plugin-security`.
- **Contenedores Docker:** Análisis de Dockerfiles, imágenes construidas (`reservas-backend:latest`, `reservas-frontend:latest`) y configuración de compose con `trivy`.
- **Inventario de Rutas:** Matriz completa de los 14 endpoints del backend detallando métodos, autenticación, roles permitidos, mecanismos de validación de entrada y control de propiedad (IDOR).

---

## Tabla Maestra de Hallazgos (Fase 6a / 6b)

| ID | Severidad | Componente / Dónde | Hallazgo / Descripción | Evidencia | Estado |
|---|---|---|---|---|---|
| `SEC-DEP-01` | **Crítica\*** | Backend (`proxy-addr@2.0.7`) | Dependencia de red vulnerable a suplantación de IP (*IP spoofing*) mediante subredes de confianza IPv4 mapeadas en IPv6 ([GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)). | `docs/seguridad/evidencia/npm-audit-backend.txt` | **Cerrado** (Actualizado a `proxy-addr@2.0.8` vía `npm audit fix`) |
| `SEC-DEP-02` | **Alta** | Backend (`body-parser@1.20.3`) | Dependencia vulnerable a Denegación de Servicio (DoS) por valores de límite inválidos y por bytes sobrantes en peticiones comprimidas ([GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6), [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)). | `docs/seguridad/evidencia/npm-audit-backend-prod.txt` | **Cerrado** (Actualizado a `body-parser@1.20.9` vía `npm audit fix`) |
| `SEC-DEP-03` | **Alta** | Frontend (`axios@1.7.9`, `react-router@7.1.5`) | Múltiples vulnerabilidades en runtime: bypass de cabeceras sensibles en `follow-redirects` ([GHSA-q3jh-wrc6-jgq8](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8)) y redirección abierta / vulnerabilidades DoS en `react-router` ([GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [GHSA-chx6-hx7r-mcp5](https://github.com/advisories/GHSA-chx6-hx7r-mcp5)). | `docs/seguridad/evidencia/npm-audit-frontend-prod.txt` | **Cerrado** (Actualizado vía `npm audit fix`; 0 vulnerabilidades en producción) |
| `SEC-DEP-04` | **Media** | Backend & Frontend (`package.json`) | Dependencias fijadas con rangos flexibles (`^`), versiones obsoletas en paquetes críticos (`@clerk/backend`, `express`, `express-rate-limit`, `jose`, `react-router-dom`) y paquete sin mantenimiento upstream (`cross-env`). | `docs/seguridad/evidencia/npm-outdated-backend.txt`, `npm-outdated-frontend.txt` | **Cerrado / Riesgo Aceptado** (`save-exact=true` en `.npmrc`, `@clerk/backend@3.27.0`, `express@4.22.3`; riesgo aceptado documentado para `uuid`/`js-beautify`) |
| `SEC-SEC-01` | **Baja / Informativa** | Git History (`docs/CONTEXTO_PROYECTO.md:146`) | Cadena `CLERK_SECRET_KEY=sk_test_...` detectada por Gitleaks en commit `f07ef07345415ced7e05c92da4aa6f4a44889858`. Se verificó en los 83 commits que se trata literalmente del texto de ejemplo con puntos suspensivos y ninguna clave de Clerk con longitud real fue versionada. | `docs/seguridad/evidencia/gitleaks-report.json` | **No confirmado: placeholder** |
| `SEC-SEC-02` | **Alta** | Git History (`database.sqlite`, `auth.services.js`) | Clave `JWT_SECRET` por defecto ('mi_clave_secreta_super_segura_dds_2026') en commit `20077a02`, y archivo binario `backend/database.sqlite` (con contraseñas hasheadas y datos reales de usuarios) presente en el historial histórico de git previo a su desvinculación en Fase 1 (`c8e094c6`). | `docs/seguridad/evidencia/trufflehog-report.json`, `git log` | **Abierto** |
| `SEC-AUTH-04` | **Baja** | Backend (`auth.services.js:8,27`) | `registrarUsuario` aceptaba el campo `rol` directamente del cuerpo de la función. | `backend/src/services/auth.services.js` | **Cerrado** (Rol forzado a `'usuario'`, ignorando cualquier parámetro entrante; commit `fded8bf`) |
| `SEC-AUTH-05` | **Alta** | Backend (`auth.middleware.js:44-52`) | En el aprovisionamiento JIT (`sincronizarUsuarioClerk`), si el usuario no existía por `clerkId`, se vinculaba automáticamente por email a una cuenta local sin comprobar si el email estaba verificado en Clerk. | `backend/src/middleware/auth.middleware.js` | **Cerrado** (Exige `primaryEmailObj?.verification?.status === 'verified'`; responde 403 con mensaje en español si no está verificado sin mutar la BD; commit `45451e0`) |
| `SEC-CFG-01` | **Alta** | Backend (`backend/src/app.js`) | Falta configuración de `app.set('trust proxy', ...)` detrás de Nginx: `req.ip` tomaba la IP interna de Nginx y compartía el limitador de login globalmente. | Inspección de `backend/src/app.js` y `frontend/nginx.conf` | **Cerrado** (Configurado `app.set('trust proxy', N)` con `TRUST_PROXY_HOPS=1`; validado con tests de contadores separados) |
| `SEC-CFG-02` | **Media** | Backend (`backend/src/app.js:22`) | `app.use(express.json())` no definía límite explícito de payload, permitiendo saturación de memoria DoS. | Inspección de `backend/src/app.js:22` | **Cerrado** (Configurado `{ limit: '10kb' }` en `json` y `urlencoded`; respuesta 413 JSON en español) |
| `SEC-CFG-03` | **Media** | Backend (`error.middleware.js:5-7,56`) | En producción se ejecutaba `console.error(err.stack)` y `err.message` se devolvía sin filtrar en excepciones no controladas. | Inspección de `backend/src/middleware/error.middleware.js` | **Cerrado** (En producción no loguea stack ni body; responde 500 genérico con correlationId y sanitiza credenciales) |
| `SEC-CNT-01` | **Alta** | Contenedor (`frontend/Dockerfile`) | La etapa de producción de Nginx no especificaba directiva `USER` y se ejecutaba como `root`. | `docs/seguridad/evidencia/trivy-frontend-dockerfile.txt` | **Cerrado** (Migrado a `nginxinc/nginx-unprivileged:1.27-alpine`, ejecuta como `nginx` UID 101) |
| `SEC-CNT-02` | **Media** | Imágenes Docker (`reservas-backend`, `reservas-frontend`) | Vulnerabilidades heredadas en paquetes base del sistema operativo Alpine Linux. | `docs/seguridad/evidencia/trivy-image-backend.txt`, `trivy-image-frontend.txt` | **Cerrado** (`apk upgrade --no-cache` en ambos Dockerfile; Trivy reporta 0 vulnerabilidades en OS) |
| `SEC-SAST-01` | **Media** | Nginx (`frontend/nginx.conf:20`) | Uso de la variable `$host` en `proxy_set_header Host $host` susceptible a *Host Header Injection*. | `docs/seguridad/evidencia/semgrep-report.json` | **Cerrado** (Fijado `proxy_set_header Host backend;` en proxy inverso) |
| `SEC-SAST-02` | **Baja** | CI/CD (`.github/workflows/ci.yml:45,48,76,79`) | Pasos de GitHub Actions (`actions/checkout`, `actions/setup-node`) utilizando etiquetas de versión mutables (`@v4`, `@v5`) en vez de fijar commit SHAs inmutables. | `docs/seguridad/evidencia/semgrep-report.json` | **Abierto** (Planificado fijar commit SHAs en futuro commit de mantenimiento de CI/CD) |
| `SEC-SAST-03` | **Baja** | Backend (`backend/src/config/env.js:16`) | Acceso dinámico a variables de entorno (`process.env[variable]`) señalado por `eslint-plugin-security` (`detect-object-injection`). | `docs/seguridad/evidencia/eslint-security-backend.txt` | **Falso Positivo** (Itera array inmutable estático `obligatorias`; sin entrada no confiable ni vector de inyección) |
| `SEC-AUTH-01` | **Media** | Frontend (`AuthContext.jsx:51`) | Token JWT de autenticación local almacenado en `localStorage`. Aunque el frontend no posee inyecciones HTML y la CSP es estricta, un XSS permitiría la extracción del token. | Inspección de `frontend/src/context/AuthContext.jsx` | **Riesgo Aceptado** (Mitigaciones activas: CSP estricta sin `'unsafe-inline'`, 0 usos de `innerHTML`, expiración 2h; recomendación futura: cookies httpOnly) |
| `SEC-AUTH-02` | **Media** | Backend (`auth.middleware.js:78`) | `jwt.verify(token, env.JWT_SECRET)` no fijaba algoritmos permitidos (`algorithms: ['HS256']`), ni issuer, ni validaba si el usuario local continuaba activo en la BD (`activo === true`) antes de autorizar la sesión. | Inspección de `backend/src/middleware/auth.middleware.js` | **Cerrado** (Fijado `HS256`, `issuer: 'reservas-api'`, consulta obligatoria de `activo === true` y rol en Postgres en cada petición; commits `ff107dc`, `81a53b8`) |
| `SEC-AUTH-03` | **Media** | Backend (`auth.middleware.js:90`) | La verificación de tokens de Clerk mediante `verifyToken` no validaba el claim `authorizedParties` (`azp`), omitiendo restringir qué orígenes de cliente son válidos. | Inspección de `backend/src/middleware/auth.middleware.js` | **Cerrado** (Pasado `authorizedParties: env.CORS_ORIGINS` a `verifyToken`; commit `21069d1`) |
| `SEC-VAL-01` | **Media** | Backend (`routes/*.routes.js`) | Ausencia de validación con esquema formal tipado (como Zod) para los parámetros de ruta `:id`, parámetros de query y cuerpos de creación/edición de reservas. | Inspección de `backend/src/routes/` | **Cerrado** (Integrado `zod@4.6.7` y middleware `validar`: login, id entero positivo, query params con límite y orden, cuerpos de creación y edición; commits `11427ef`, `0b4ed1c`, `bf28d0a`, `b1b42fc`) |
| `SEC-TEST-01` | **Media** | Backend Tests (`globalSetup.cjs:17`) | `globalSetup` ejecutaba `DROP SCHEMA public CASCADE;` sobre `DATABASE_URL_TEST` sin verificar mediante una guarda de seguridad que el nombre de la base de datos terminara obligatoriamente en `_test` ni que fuera distinta a `DATABASE_URL`. | `backend/tests/setup/globalSetup.cjs` | **Cerrado** (Guarda de aborto por nombre/igualdad, `pg_advisory_lock(987654321)` y terminación de conexiones concurrentes; commit `0e6cff2`) |
| `SEC-HIST-01` | **Baja** | Git History (commit `32838b48`) | Rutas personales absolutas del entorno local de desarrollo (`<ruta-local>/...`) versionadas en scripts auxiliares (`capturar-pantallas.mjs`) antes de su saneamiento en commit `0b1c7ac2`. | `git log` | **Abierto** |
| `SEC-INV-01` | **Baja** | Backend (`aulas.routes.js:8`) | `GET /api/aulas` no requería autenticación. | Inspección de `backend/src/routes/aulas.routes.js` | **Cerrado** (Exige autenticación mediante `verificarToken`; frontend solo accede desde páginas autenticadas; commit `19949d9`) |

---

## 1. Auditoría Automatizada de Dependencias

Se ejecutaron auditorías en backend y frontend evaluando vulnerabilidades conocidas (CVEs), paquetes desactualizados y paquetes en estado de abandono.

### 1.1. Backend
- **Salida cruda completa:** `docs/seguridad/evidencia/npm-audit-backend.txt`
- **Salida cruda producción (`--omit=dev`):** `docs/seguridad/evidencia/npm-audit-backend-prod.txt`
- **Total vulnerabilidades:** 26 (1 Crítica, 5 Altas, 14 Moderadas, 6 Bajas).
- **Vulnerabilidades en producción:** 11 (1 Crítica, 1 Alta, 9 Moderadas).
  - **Crítica:** `proxy-addr` (1.1.0 - 2.0.7) — *IP spoofing via IPv4-mapped IPv6 trust subnet* ([GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)).
    > **Aclaración de severidad:** La severidad real de esta vulnerabilidad depende directamente de la directiva `trust proxy`. En el estado actual, dado que `app.set('trust proxy', ...)` **aún no está configurado** en Express, la aplicación rechaza las cabeceras `X-Forwarded-For` y lee la IP directa del socket (la IP interna de Nginx), por lo cual un cliente externo no puede explotar este bypass. Sin embargo, al habilitar `trust proxy` para corregir `SEC-CFG-01`, deviene crítica de inmediato si no se actualiza a la versión corregida.
  - **Alta:** `body-parser` (<=1.20.8) — DoS por límite inválido y DoS en descompresión ([GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6), [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)).
  - **Moderadas:** `minimatch`, `glob`, `moment`, `qs`, `uuid` en árbol de dependencias.
- **Paquetes desactualizados (`npm-outdated-backend.txt`):**
  - `@clerk/backend`: instalado `3.8.4` (desactualizado frente a `3.27.0`).
  - `express`: instalado `4.22.2` (desactualizado frente a `4.22.3` / `5.3.0`).
  - `express-rate-limit`: instalado `8.7.2` (desactualizado frente a `8.7.3`).
  - `jose`: instalado `6.2.3` (desactualizado frente a `6.2.16`).
- **Paquetes obsoletos / sin mantenimiento:** `cross-env` (en mantenimiento congelado / deprecado por su autor upstream).
- **Correcciones y mitigaciones aplicadas (Fase 6b1):**
  - `proxy-addr` y `body-parser` corregidos mediante `npm audit fix` sin `--force` (`SEC-DEP-01`, `SEC-DEP-02`).
  - `qs` corregido actualizando `express` a `4.22.3`.
  - `@clerk/backend` actualizado a `3.27.0` (última versión de la rama v3).
  - Configurado `save-exact=true` en `.npmrc` del backend.
  - **Evaluación de no alcanzabilidad y Justificación de Riesgo Aceptado (`SEC-DEP-04`):**
    - `uuid` (<11.1.1, [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)): Falta de validación de límites de buffer en `uuid.v3/v5/v6`. Justificación: El modelo de datos de la aplicación utiliza identificadores numéricos enteros autoincrementales (`id SERIAL PRIMARY KEY`), y ninguna ruta ni servicio expone generación de UUIDs donde los clientes puedan inyectar buffers arbitrarios. La vulnerabilidad no es alcanzable a través de entradas no confiables.
    - `js-beautify` -> `glob`/`minimatch` ([GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)): `js-beautify` es una dependencia de desarrollo de `sequelize-cli` utilizada exclusivamente para formatear código en scripts de migración. No interviene en tiempo de ejecución de peticiones HTTP en Express. Las migraciones se ejecutan durante el despliegue con archivos locales de migración controlados por el equipo, sin entradas externas no confiables. Se acepta el riesgo para no forzar actualizaciones mayores incompatibles de Sequelize.

### 1.2. Frontend
- **Salida cruda completa:** `docs/seguridad/evidencia/npm-audit-frontend.txt`
- **Salida cruda producción (`--omit=dev`):** `docs/seguridad/evidencia/npm-audit-frontend-prod.txt`
- **Total vulnerabilidades:** 22 (2 Críticas, 12 Altas, 8 Moderadas).
- **Vulnerabilidades en producción (antes de Fase 6b1):** 5 (4 Altas, 1 Moderada).
  - **Alta:** `axios` (1.0.0 - 1.19.0) — Prototype pollution y DoS en deserialización de formularios ([GHSA-mmx7-hfxf-jppx](https://github.com/advisories/GHSA-mmx7-hfxf-jppx), [GHSA-pmv8-rq9r-6j72](https://github.com/advisories/GHSA-pmv8-rq9r-6j72)).
  - **Alta:** `follow-redirects` (1.16.0 - 1.16.1) — Fuga de cabeceras de autorización entre dominios redirigidos ([GHSA-q3jh-wrc6-jgq8](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8)).
  - **Alta:** `react-router` / `react-router-dom` (6.0.0 - 7.18.1) — Redirección abierta en `<Link>` y `useNavigate` ([GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6)).
- **Correcciones y mitigaciones aplicadas (Fase 6b1):**
  - `axios`, `follow-redirects` y `react-router` / `react-router-dom` corregidos mediante `npm audit fix` sin `--force` (`SEC-DEP-03`).
  - Configurado `save-exact=true` en `.npmrc` del frontend.
  - El escaneo de dependencias en producción (`npm audit --omit=dev --prefix frontend`) arroja actualmente **0 vulnerabilidades** en producción.
- **Paquetes desactualizados (`npm-outdated-frontend.txt`):**
  - `@clerk/clerk-react`: `5.61.8` (requerido `5.61.11`).
  - `react-router-dom`: `7.17.0` (requerido `7.18.5`).
  - `axios`: `1.17.0` (requerido `1.21.0`).

---

## 2. Auditoría de Secretos y Repositorio Git

Se ejecutaron escaneos de fuga de secretos y claves criptográficas sobre el árbol de trabajo y sobre la totalidad del historial de Git (83 commits).

### 2.1. Escaneo con Gitleaks y Trufflehog
- **Evidencia Gitleaks:** `docs/seguridad/evidencia/gitleaks-report.json` (valores sensibles redactados).
- **Evidencia Trufflehog:** `docs/seguridad/evidencia/trufflehog-report.json` (valores sensibles redactados).
- **Análisis de Hallazgo Gitleaks (`SEC-SEC-01`):**
  - Archivo: `docs/CONTEXTO_PROYECTO.md:146` (Commit `f07ef07345415ced7e05c92da4aa6f4a44889858`).
  - Diagnóstico: Se constató en el historial completo que el texto introducido es literalmente la cadena de ejemplo `CLERK_SECRET_KEY=sk_test_...` con puntos suspensivos. No existe en el historial ninguna clave de Clerk de longitud real (`sk_test_[A-Za-z0-9]{20,}`). El estado se clasifica como **No confirmado: placeholder**.

### 2.2. Secretos y Archivos Sensibles en el Historial Git
- **Base de datos SQLite:** En commit `4935a92ac275cbbb5a993a386f6a0123b379c840` se incorporó el binario `backend/database.sqlite`. Dicho archivo permaneció versionado a lo largo de 11 commits hasta que fue removido del árbol en la Fase 1 (`c8e094c6f7faca9e4515c8e67c11edfe3c8a12ad`). El archivo contenía hashes reales de contraseñas de usuarios creados en la etapa previa.
- **`JWT_SECRET` hardcodeado:** En el commit inicial `20077a029bf3cb4927b0e1688ee4a2647a69ba4e`, el archivo `backend/src/services/auth.services.js` contenía el valor `'mi_clave_secreta_super_segura_dds_2026'`.
- **Rutas personales en historial (`SEC-HIST-01`):** En el commit `32838b489221ec35e648e644e29fdc0ae8064719` quedaron registradas rutas personales absolutas (`<ruta-local>/...`) en scripts auxiliares de captura, antes de ser saneadas en el commit `0b1c7ac26d5048624e5f7848e6510b380984865c`.

---

## 3. Análisis Estático de Código (SAST)

### 3.1. Resumen de Hallazgos Semgrep
- **Evidencia:** `docs/seguridad/evidencia/semgrep-report.json`
- **Configuración:** Rulesets comunitarios oficiales `p/javascript`, `p/nodejs`, `p/react`, `p/owasp-top-ten`.
- **Alcance:** 170 archivos rastreados por git, 115 reglas aplicadas.
- **Distribución por Severidad:**
  - **ERROR (2 hallazgos):**
    - `typescript.react.security.react-insecure-request` en `frontend/scripts/capturar-pantallas.mjs` y `verificar-csp-clerk.mjs` por peticiones no cifradas sobre `http://localhost` contra servidores locales de prueba.
  - **WARNING (5 hallazgos):**
    - 4 hallazgos `yaml.github-actions.security.github-actions-mutable-action-tag` en `.github/workflows/ci.yml:45,48,76,79` por uso de tags mutables (`actions/checkout@v4`, `actions/setup-node@v5`) en lugar de fijar commit SHAs inmutables (`SEC-SAST-02`).
      - **Estado:** **Abierto**. Planificado para mitigar en un commit futuro de mantenimiento de infraestructura CI/CD, fijando los hashes SHA completos (ej. `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11`) con comentarios aclaratorios del número de versión para prevenir ataques de suplantación en la cadena de suministro de GitHub Marketplace.
    - 1 hallazgo `generic.nginx.security.request-host-used.request-host-used` en `frontend/nginx.conf:20` por uso de la variable `$host` en `proxy_set_header Host $host`. Cerrado en Fase 6b1 fijando el host estático interno `backend` (`SEC-SAST-01`).
  - **INFO:** 0 hallazgos.

### 3.2. Resumen de Hallazgos ESLint y `eslint-plugin-security`
- **Evidencia estándar:** `docs/seguridad/evidencia/eslint-backend.txt`, `docs/seguridad/evidencia/eslint-frontend.txt` (0 errores y 0 warnings con las reglas de proyecto).
- **Evidencia reglas de seguridad:** `docs/seguridad/evidencia/eslint-security-backend.txt`.
- **Distribución por Severidad:**
  - **ERROR de seguridad:** 0 errores.
  - **WARNING de seguridad (5 hallazgos):**
    - 4 advertencias `security/detect-object-injection`: 2 en `backend/src/config/env.js:16` por acceso dinámico a `process.env[variable]` (`SEC-SAST-03`), y 2 en `backend/scripts/legacy/migrar-sqlite-a-postgres.js:169-170`.
      - **Justificación de Falso Positivo (`SEC-SAST-03`):** En `backend/src/config/env.js:16`, el código ejecuta:
        ```javascript
        const obligatorias = [
          'JWT_SECRET',
          'DATABASE_URL',
          'CLERK_SECRET_KEY',
          'FRONTEND_URL'
        ];
        for (const variable of obligatorias) {
          if (!process.env[variable]) { ... }
        }
        ```
        La variable iterada proviene exclusivamente de una lista blanca fija, cerrada e inmutable declarada en el código fuente. Ningún valor procede de entradas de red, parámetros HTTP ni fuentes no confiables controladas por un atacante. Por consiguiente, no existe posibilidad de *Prototype Pollution* ni manipulación de propiedades de objetos. Queda clasificado como **Falso Positivo**.
    - 1 advertencia `security/detect-non-literal-fs-filename`: en `backend/scripts/legacy/migrar-sqlite-a-postgres.js:87` por llamada a `fs.existsSync` con argumento dinámico proveniente de rutas de backup en script administrativo fuera del ciclo de vida de la aplicación web.

---

## 4. Auditoría de Contenedores y Configuración

Se ejecutó escaneo de vulnerabilidades y malas prácticas de configuración sobre los Dockerfiles y las imágenes generadas mediante `aquasec/trivy`.

### 4.1. Análisis de Dockerfiles con Trivy
- **Backend Dockerfile (`backend/Dockerfile`):**
  - **Evidencia:** `docs/seguridad/evidencia/trivy-backend-dockerfile.txt`.
  - **Resultado:** **0 misconfiguraciones**. Construcción multi-etapa, `USER node` (ejecución como usuario no root), `npm ci --omit=dev`, `HEALTHCHECK` configurado con endpoint HTTP. En Fase 6b1 se incorporó `RUN apk upgrade --no-cache` para garantizar que los paquetes base de Alpine Linux permanezcan sin CVEs (`trivy-image-backend.txt`: 0 vulnerabilidades en OS).
- **Frontend Dockerfile (`frontend/Dockerfile`):**
  - **Evidencia:** `docs/seguridad/evidencia/trivy-frontend-dockerfile.txt`.
  - **Resultado (Fase 6a):** Falla Alta (`DS-0002`) por omisión de `USER` en imagen oficial de Nginx.
  - **Resolución (Fase 6b1 - `SEC-CNT-01`, `SEC-CNT-02`):** Migrado a `nginxinc/nginx-unprivileged:1.27-alpine`, operando bajo el usuario no root `nginx` (UID 101). Se incorporó `apk upgrade --no-cache` en la etapa final (`trivy-image-frontend.txt`: 0 vulnerabilidades en OS).

### 4.2. Análisis de Docker Compose y Exposición de Puertos
- **Compose Productivo (`docker-compose.prod.yml`):**
  - `postgres`: No expone puertos hacia el exterior (no tiene directiva `ports:` mapeada al host); se comunica exclusivamente a través de la red aislada `reservas-net`.
  - `backend`: Expone `127.0.0.1:${BACKEND_PORT:-3001}:3001` fijado a localhost (no expuesto a interfaces externas).
  - `frontend`: Expone `${FRONTEND_PORT:-80}:8080` mapeando el puerto web estándar hacia el puerto sin privilegios `8080` de Nginx.
  - Secretos: No existen contraseñas hardcodeadas en los archivos compose; todas se inyectan a través del archivo de entorno `.env.production`.

### 4.3. Resolución de Proxy Inverso y `trust proxy` (SEC-CFG-01, SEC-SAST-01)
- **Diagnóstico original (Fase 6a):** Nginx reenviaba las peticiones a la API pero `backend/src/app.js` no configuraba `trust proxy`, haciendo que `req.ip` tomara la IP interna de Nginx y compartiera el limitador de login globalmente. Además, `proxy_set_header Host $host` permitía spoofing del host.
- **Resolución (Fase 6b1):**
  - En `frontend/nginx.conf`, se fijó `proxy_set_header Host backend;` (`SEC-SAST-01`).
  - En `backend/src/app.js` y `backend/src/config/env.js`, se configuró `app.set('trust proxy', N)` tomando `N` de la variable `TRUST_PROXY_HOPS` (por defecto `1` en producción, `0`/falso en desarrollo y test).
  - Validado en `backend/tests/trust-proxy.test.js` comprobando que dos IPs distintas en `X-Forwarded-For` mantienen contadores independientes en `loginLimiter`.
  - Documentado en `docs/DEPLOY.md` que si se coloca otro proxy delante de Nginx (Cloudflare, AWS ALB, Nginx de host) se debe incrementar el valor.

---

## 5. Inventario de Rutas y Matriz de Control de Acceso (Backend)

Inventario exhaustivo de todos los endpoints registrados en Express, indicando método, middleware de autenticación, roles permitidos, validación de entrada y control de propiedad de recursos (prevención de IDOR).

| Método | Ruta | Middleware Auth | Roles Permitidos | Validación de Entrada Aplicada | Control de Propiedad (IDOR) | Evaluación de Seguridad |
|---|---|---|---|---|---|---|
| `GET` | `/` | Ninguno | Público | Ninguna | N/A | Endpoint informativo raíz. |
| `GET` | `/api/health` | Ninguno | Público (Healthcheck) | Ninguna | N/A | Verifica estado de conexión a PostgreSQL. |
| `POST` | `/api/auth/login` | Ninguno (Público) | Anónimo | `validar(loginSchema)` (email válido y password obligatorio) + `loginLimiter` (10 intentos / 15 min) | N/A | Protegido con límite de tasa por IP real tras `trust proxy`. |
| `GET` | `/api/aulas` | `verificarToken` | `admin`, `usuario` | Ninguna | N/A | Lista aulas activas protegida por token JWT / Clerk (`SEC-INV-01`). |
| `GET` | `/api/aulas/:id/disponibilidad` | `verificarToken` | `admin`, `usuario` | `validar(idParamSchema)` (`id` entero positivo) + validación de fecha | No aplica (datos agregados de disponibilidad horaria) | Endpoint técnico. Solo devuelve rangos horarios y estado sin datos de solicitantes. |
| `GET` | `/api/reservas/resumen` | `verificarToken`, `soloAdmin` | `admin` | Ninguna | Solo admin | Métricas globales de reservas. |
| `GET` | `/api/reservas` | `verificarToken` | `admin`, `usuario` | `validar(queryReservasSchema)` (`limit` max 100, `page` > 0, `sortBy` lista blanca, `order` ASC/DESC) | **Sí (Garantizado)**: Usuarios comunes filtrados estrictamente por `where.usuarioId = req.usuario.id`. | Admin recibe datos del solicitante; usuarios comunes solo sus propias reservas sin datos personales de terceros. |
| `POST` | `/api/reservas` | `verificarToken` | `admin`, `usuario` | `validar(crearReservaBodySchema)` (fecha, turnos, aulaId, motivo) + reglas de negocio | **Sí (Garantizado)**: El servidor sobreescribe `datosReserva.usuarioId = req.usuario.id`. | No permite asignación masiva de usuario ni estado. |
| `GET` | `/api/reservas/:id` | `verificarToken` | `admin`, `usuario` | `validar(idParamSchema)` (`id` entero positivo) | **Sí (Garantizado)**: Si `rol !== 'admin'` y `reserva.usuarioId !== req.usuario.id`, devuelve `404`. | Protegido contra IDOR. |
| `GET` | `/api/reservas/:id/historial` | `verificarToken` | `admin`, `usuario` | `validar(idParamSchema)` (`id` entero positivo) | **Sí (Garantizado)**: Invoca internamente `obtenerReservaPorId` exigiendo propiedad o rol admin. | Historial auditado con control estricto de propiedad. |
| `PUT` | `/api/reservas/:id` | `verificarToken`, `soloAdmin` | `admin` | `validar(idParamSchema)` + `validar(editarReservaBodySchema)` + validaciones de negocio | Solo admin | Edición integral de reserva reservada a administradores. |
| `PATCH` | `/api/reservas/:id/aprobar` | `verificarToken`, `soloAdmin` | `admin` | `validar(idParamSchema)` (`id` entero positivo) | Solo admin | Aprobación restringida a rol administrador. |
| `PATCH` | `/api/reservas/:id/rechazar` | `verificarToken`, `soloAdmin` | `admin` | `validar(idParamSchema)` (`id` entero positivo) | Solo admin | Rechazo restringido a rol administrador. |
| `PATCH` | `/api/reservas/:id/cancelar` | `verificarToken` | `admin`, `usuario` | `validar(idParamSchema)` (`id` entero positivo) | **Sí (Garantizado)**: Validación explícita `esAdmin || String(reserva.usuarioId) === String(usuario.id)`. Devuelve `403` si no es dueño. | Cancelación lógica controlada. |

---

## 6. Verificación de Puntos Previos a las Mejoras

Revisión punto por punto del estado y resolución de los problemas identificados:

1. **Token JWT guardado en `localStorage` (un XSS permitiría robarlo) — `SEC-AUTH-01`:**
   - **Estado:** **Riesgo Aceptado**.
   - **Vector de ataque:** *Cross-Site Scripting* (XSS). Si un script malicioso lograra ejecutarse en el contexto del navegador, tendría acceso a `localStorage.getItem('token')` y podría exfiltrar el token local.
   - **Mitigaciones activas en el sistema:**
     1. **Content Security Policy (CSP) estricta sin `'unsafe-inline'` para scripts:** La directiva `script-src` en Nginx (`frontend/nginx.conf`) restringe la ejecución de scripts exclusivamente a `'self'` y a los endpoints autorizados de Clerk y Cloudflare Turnstile. Se bloquea cualquier script embebido o inyección de scripts externos.
     2. **Cero inyecciones HTML en frontend:** El código del cliente React fue auditado rigurosamente y posee estrictamente **0 usos de `innerHTML` y 0 usos de `dangerouslySetInnerHTML`**, minimizando la superficie de vulnerabilidades XSS basadas en DOM.
     3. **Expiración de tokens reducida:** El token JWT local posee una vida útil acotada de 2 horas (`expiresIn: '2h'`). Para usuarios autenticados mediante Google/Clerk, la sesión no se guarda en `localStorage` sino que reside en memoria y se refresca automáticamente con tokens de 60 segundos de Clerk.
   - **Recomendación futura:** Migrar a cookies `httpOnly` con flags `SameSite=Strict` y `Secure`, acompañadas de protección CSRF (tokens de sincronización o doble submit cookie), si en el futuro la arquitectura evoluciona hacia un esquema monolítico o *Backend For Frontend* (BFF).

2. **`jwt.verify` sin fijar algoritmos permitidos; estado de usuario desactualizado — `SEC-AUTH-02`:**
   - **Estado:** **Cerrado** (Commits `ff107dc`, `81a53b8`).
   - `jwt.sign` fija explícitamente `algorithm: 'HS256'` e `issuer: 'reservas-api'`.
   - `jwt.verify` exige `algorithms: ['HS256']` e `issuer: 'reservas-api'`, bloqueando ataques de manipulación de cabeceras (`alg: 'none'` o firmas con clave asimétrica/HS512).
   - En cada petición autenticada con JWT local, el middleware `verificarToken` consulta la base de datos PostgreSQL (`Usuario.findByPk`) y comprueba `usuario.activo === true`. Si el usuario no existe o fue desactivado, se responde `401 Unauthorized` de inmediato sin esperar a que expire el token. Asimismo, el rol se toma directamente del registro actualizado en la base de datos y no del token, garantizando revocación inmediata de permisos de administrador.

3. **`express.json()` sin límite de tamaño — `SEC-CFG-02`:**
   - **Estado:** **Cerrado** (Fase 6b1). Configurado `express.json({ limit: '10kb' })` y `express.urlencoded({ extended: true, limit: '10kb' })`. Manejador responde `413 Payload Too Large` con mensaje JSON en español ante excesos de tamaño.

4. **`console.error(err.stack)` volcando trazas completas — `SEC-CFG-03`:**
   - **Estado:** **Cerrado** (Fase 6b1). En producción no se vuelca `err.stack` ni `req.body`; se genera un `correlationId` aleatorio (UUIDv4), se sanitizan credenciales y se devuelve respuesta genérica `500` con el identificador de correlación.

5. **Dependencias con rangos `^` y sin escaneo — `SEC-DEP-01` a `04`:**
   - **Estado:** **Cerrado / Riesgo Aceptado** (Fase 6b1). Configurado `save-exact=true` en `.npmrc` de backend y frontend; paquetes vulnerables corregidos con `npm audit fix` sin `--force` (0 vulnerabilidades en producción de frontend); fijadas versiones seguras de `@clerk/backend@3.27.0` y `express@4.22.3`. Documentado riesgo aceptado de `uuid` y `js-beautify`. CI y Dockerfiles emplean `npm ci`.

6. **Verificación del token de Clerk sin validar firma ni audiencia — `SEC-AUTH-03`:**
   - **Estado:** **Cerrado** (Commit `21069d1`).
   - Se pasa explícitamente el parámetro `authorizedParties: env.CORS_ORIGINS` a la función `verifyToken` de `@clerk/backend`, validando que el claim `azp` coincida con los orígenes permitidos. Tokens sin `azp` o con orígenes no autorizados son rechazados con `401 Unauthorized`.

7. **Reservas e historial visibles para cualquier usuario autenticado:**
   - **Estado:** **Cerrado** (Fases 1 a 3). Aislamiento estricto por `usuarioId` y censura de datos del solicitante para usuarios comunes.

8. **Asignación masiva en registro — `SEC-AUTH-04`:**
   - **Estado:** **Cerrado** (Commit `fded8bf`).
   - `registrarUsuario` en `backend/src/services/auth.services.js` ignora cualquier campo `rol` provisto en el objeto de entrada y fuerza invariablemente `'usuario'`, impidiendo asignación indebida de privilegios.

9. **Vinculación por email no verificado en Clerk — `SEC-AUTH-05`:**
   - **Estado:** **Cerrado** (Commit `45451e0`).
   - En el aprovisionamiento JIT (`sincronizarUsuarioClerk`), la vinculación con cuentas locales por email solo se efectúa si el correo principal posee `verification.status === 'verified'`. Si no está verificado en Clerk, se rechaza la solicitud con `403 Forbidden` (`"El correo de la cuenta de Clerk no se encuentra verificado."`), sin realizar mutaciones en la base de datos, y se emite un registro de auditoría en consola sin datos sensibles (`console.log('[AUTH] Cuenta local vinculada a cuenta Clerk (usuarioId: ...)')`).

10. **Seguridad en tests y guardas de base de datos — `SEC-TEST-01`:**
    - **Estado:** **Cerrado** (Commit `0e6cff2`).
    - En `backend/tests/setup/globalSetup.cjs`, se incorporó la función de guarda `validarDatabaseUrlTest` que aborta el proceso si `DATABASE_URL_TEST` no termina en `_test` o si es idéntica a `DATABASE_URL`. Asimismo, se implementó `pg_advisory_lock(987654321)` para prevenir carreras de destrucción entre suites concurrentes y se finalizan conexiones activas con `pg_terminate_backend` antes de ejecutar `DROP SCHEMA public CASCADE;`.

11. **Validación tipada de entradas con esquemas Zod — `SEC-VAL-01`:**
    - **Estado:** **Cerrado** (Commits `11427ef`, `0b4ed1c`, `bf28d0a`, `b1b42fc`).
    - Se integró `zod@4.6.7` con versión exacta y el middleware genérico `validar(schema)` en `backend/src/middleware/validacion.middleware.js`, estandarizando respuestas 400 y mensajes en español ante inconsistencias de validación:
      - `loginSchema`: validación de email con formato válido y password obligatorio.
      - `idParamSchema`: validación de parámetro de ruta `:id` como entero positivo para `/reservas/:id`, `/reservas/:id/historial`, `PUT /reservas/:id`, `/aprobar`, `/rechazar`, `/cancelar`, y `/aulas/:id/disponibilidad`.
      - `queryReservasSchema`: validación de `page` y `limit` enteros positivos (límite máximo 100), `sortBy` sobre lista blanca cerrada, y `order` ('ASC'|'DESC').
      - `crearReservaBodySchema` y `editarReservaBodySchema`: fechas en formato YYYY-MM-DD, turnos laborales válidos ('manana', 'tarde', 'noche'), `aulaId` entero positivo y motivo no vacío.

12. **Aulas públicas protegidas — `SEC-INV-01`:**
    - **Estado:** **Cerrado** (Commit `19949d9`).
    - Se constató que en el frontend las aulas solo se consumen dentro de rutas autenticadas. Se incorporó `verificarToken` a `GET /api/aulas`, impidiendo consultas no autenticadas al inventario de aulas.

---

## 7. Políticas Content-Security-Policy (CSP) y Privacidad de Datos

### 7.1. Higiene del código propio (Frontend)
1. **Cero estilos en línea (`style=`)**: Todos los bloques de estilos en línea fueron migrados íntegramente a CSS Modules (`*.module.css`) respaldados por tokens semánticos en `src/styles/tokens.css`.
2. **Cero scripts en línea**: `index.html` carga exclusivamente el punto de entrada empaquetado `/src/main.jsx`.
3. **Tipografías autoalojadas (`'self'`)**: Fuentes **Source Serif 4** y **Public Sans** autoalojadas mediante `@fontsource`.
4. **Íconos e imágenes locales**: Íconos de `lucide-react` servidos como SVG en el bundle local (`'self'`).

### 7.2. Política CSP configurada en `frontend/nginx.conf`
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com; connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com https://*.protect.clerk.com:*; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://img.clerk.com; font-src 'self'; worker-src 'self' blob:; frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.protect.clerk.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';" always;
```

### 7.3. Protección de Privacidad de Datos del Solicitante (Fase 3b-6)
1. **Exposición exclusiva a administradores:** Los atributos `nombre` y `email` del solicitante solo se proyectan (`attributes: ['id', 'nombre', 'email']`) si `req.usuario.rol === 'admin'`.
2. **Prohibición de exposición de hashes:** Queda prohibido consultar el modelo `Usuario` sin exclusión estricta de `passwordHash`.
3. **Inmunidad en disponibilidad:** El endpoint `GET /api/aulas/:id/disponibilidad` no vincula identidades de usuarios con franjas horarias ocupadas.
