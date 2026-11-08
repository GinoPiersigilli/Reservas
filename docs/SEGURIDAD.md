# Seguridad, Auditoría y Content-Security-Policy (CSP)

Este documento centraliza el estado de seguridad, los hallazgos de auditoría automatizada y estática, las matrices de autorización y las políticas de endurecimiento del **Sistema de Reservas de Aulas**.

---

## Resumen Ejecutivo de la Auditoría 6a

En la **Fase 6a** se llevó a cabo una auditoría automatizada y exhaustiva del sistema completo (backend, frontend, base de datos, dependencias, historial de control de versiones y contenedores Docker), ejecutando herramientas estándar de la industria bajo la regla de **solo medir y reportar sin aplicar modificaciones de código aún**.

Toda la evidencia cruda generada por las herramientas se encuentra preservada en el directorio `docs/seguridad/evidencia/`:
- **Dependencias:** `npm audit` y `npm outdated` (en backend y frontend, diferenciando dependencias globales y exclusivas de producción con `--omit=dev`).
- **Secretos e Historial Git:** Análisis completo de los 83 commits del repositorio con `gitleaks` y `trufflehog`, además de inspección de objetos blob en historial (`git log --full-history`).
- **SAST (Static Application Security Testing):** Escaneo con `semgrep` aplicando los rulesets oficiales `p/javascript`, `p/nodejs`, `p/react` y `p/owasp-top-ten` (170 archivos analizados, 115 reglas), y análisis con `eslint` y `eslint-plugin-security`.
- **Contenedores Docker:** Análisis de Dockerfiles, imágenes construidas (`reservas-backend:latest`, `reservas-frontend:latest`) y configuración de compose con `trivy`.
- **Inventario de Rutas:** Matriz completa de los 14 endpoints del backend detallando métodos, autenticación, roles permitidos, mecanismos de validación de entrada y control de propiedad (IDOR).

---

## Tabla Maestra de Hallazgos (Fase 6a)

| ID | Severidad | Componente / Dónde | Hallazgo / Descripción | Evidencia | Estado |
|---|---|---|---|---|---|
| `SEC-DEP-01` | **Crítica\*** | Backend (`proxy-addr@2.0.7`) | Dependencia de red vulnerable a suplantación de IP (*IP spoofing*) mediante subredes de confianza IPv4 mapeadas en IPv6 ([GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)). \*Nota: su severidad real depende de la configuración de `trust proxy`; como actualmente Express no confía en proxies, no es explotable externamente de forma directa, pero deviene crítica al activar `trust proxy` si no se actualiza. | `docs/seguridad/evidencia/npm-audit-backend.txt` | **Abierto** |
| `SEC-DEP-02` | **Alta** | Backend (`body-parser@1.20.3`) | Dependencia vulnerable a Denegación de Servicio (DoS) por valores de límite inválidos que desactivan silenciosamente el control de tamaño y por bytes sobrantes en peticiones comprimidas ([GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6), [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)). | `docs/seguridad/evidencia/npm-audit-backend-prod.txt` | **Abierto** |
| `SEC-DEP-03` | **Alta** | Frontend (`axios@1.7.9`, `react-router@7.1.5`) | Múltiples vulnerabilidades en runtime: bypass de cabeceras sensibles en `follow-redirects` ([GHSA-q3jh-wrc6-jgq8](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8)) y redirección abierta / vulnerabilidades DoS en `react-router` ([GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [GHSA-chx6-hx7r-mcp5](https://github.com/advisories/GHSA-chx6-hx7r-mcp5)). | `docs/seguridad/evidencia/npm-audit-frontend-prod.txt` | **Abierto** |
| `SEC-DEP-04` | **Media** | Backend & Frontend (`package.json`) | Dependencias fijadas con rangos flexibles (`^`), versiones obsoletas en paquetes críticos (`@clerk/backend`, `express`, `express-rate-limit`, `jose`, `react-router-dom`) y paquete sin mantenimiento upstream (`cross-env`). | `docs/seguridad/evidencia/npm-outdated-backend.txt`, `npm-outdated-frontend.txt` | **Abierto** |
| `SEC-SEC-01` | **Baja / Informativa** | Git History (`docs/CONTEXTO_PROYECTO.md:146`) | Cadena `CLERK_SECRET_KEY=sk_test_...` detectada por Gitleaks en commit `f07ef07345415ced7e05c92da4aa6f4a44889858`. Se verificó en los 83 commits que se trata literalmente del texto de ejemplo con puntos suspensivos y ninguna clave de Clerk con longitud real fue versionada. | `docs/seguridad/evidencia/gitleaks-report.json` | **No confirmado: placeholder** |
| `SEC-SEC-02` | **Alta** | Git History (`database.sqlite`, `auth.services.js`) | Clave `JWT_SECRET` por defecto ('mi_clave_secreta_super_segura_dds_2026') en commit `20077a02`, y archivo binario `backend/database.sqlite` (con contraseñas hasheadas y datos reales de usuarios) presente en el historial histórico de git previo a su desvinculación en Fase 1 (`c8e094c6`). | `docs/seguridad/evidencia/trufflehog-report.json`, `git log` | **Abierto** |
| `SEC-AUTH-04` | **Baja** | Backend (`auth.services.js:8,27`) | `registrarUsuario` acepta el campo `rol` directamente del cuerpo de la función (`datos.rol || 'usuario'`). Defensa en profundidad: no es explotable hoy porque no existe ninguna ruta HTTP de registro (`auth.routes.js` solo expone `POST /login`) y la función solo se utiliza en `auth.test.js`; riesgo latente si algún día se expone una ruta pública sin saneamiento. | `backend/src/services/auth.services.js` | **Abierto** |
| `SEC-AUTH-05` | **Alta** | Backend (`auth.middleware.js:44-52`) | En el aprovisionamiento JIT (`sincronizarUsuarioClerk`), si el usuario no existe por `clerkId`, se vincula automáticamente por email (`emailClerk`) a una cuenta local existente sin verificar que el email esté validado en Clerk (`verification.status === 'verified'`), posibilitando secuestro de cuenta (*Account Takeover*). | `backend/src/middleware/auth.middleware.js` | **Abierto** |
| `SEC-CFG-01` | **Alta** | Backend (`backend/src/app.js`) | Falta configuración de `app.set('trust proxy', ...)` detrás de Nginx: `req.ip` toma la IP interna del contenedor de Nginx para todas las peticiones entrantes, provocando que el limitador de tasa (`express-rate-limit` en `/api/auth/login`) se comparta globalmente entre todos los usuarios. | Inspección de `backend/src/app.js` y `frontend/nginx.conf` | **Abierto** |
| `SEC-CFG-02` | **Media** | Backend (`backend/src/app.js:22`) | `app.use(express.json())` no define límite explícito de tamaño de payload (ej. `{ limit: '10kb' }`), permitiendo peticiones con cuerpos masivos que saturen la memoria del proceso Node.js. | Inspección de `backend/src/app.js:22` | **Abierto** |
| `SEC-CFG-03` | **Media** | Backend (`error.middleware.js:5-7,56`) | En entornos de producción (`NODE_ENV === 'production'`) se ejecuta `console.error(err.stack)` volcando trazas completas a la salida de errores, y `err.message` se devuelve sin filtrar en excepciones no controladas. | Inspección de `backend/src/middleware/error.middleware.js` | **Abierto** |
| `SEC-CNT-01` | **Alta** | Contenedor (`frontend/Dockerfile`) | La etapa de producción de Nginx no especifica directiva `USER` y se ejecuta por defecto con el superusuario `root`. Misconfiguración detectada por Trivy (`DS-0002`). | `docs/seguridad/evidencia/trivy-frontend-dockerfile.txt` | **Abierto** |
| `SEC-CNT-02` | **Media** | Imágenes Docker (`reservas-backend`, `reservas-frontend`) | Vulnerabilidades heredadas en paquetes base del sistema operativo Alpine Linux (`busybox`, `libcrypto3`, `zlib`, `xz-libs`). | `docs/seguridad/evidencia/trivy-image-backend.txt`, `trivy-image-frontend.txt` | **Abierto** |
| `SEC-SAST-01` | **Media** | Nginx (`frontend/nginx.conf:20`) | Uso de la variable `$host` en `proxy_set_header Host $host` sin validación estricta de dominios permitidos, susceptible a *Host Header Injection / Spoofing*. Detectado por Semgrep (`generic.nginx.security.request-host-used`). | `docs/seguridad/evidencia/semgrep-report.json` | **Abierto** |
| `SEC-SAST-02` | **Baja** | CI/CD (`.github/workflows/ci.yml:45,48,76,79`) | Pasos de GitHub Actions (`actions/checkout`, `actions/setup-node`) utilizando etiquetas de versión mutables (`@v4`, `@v5`) en vez de fijar el commit SHA inmutable. Detectado por Semgrep. | `docs/seguridad/evidencia/semgrep-report.json` | **Abierto** |
| `SEC-SAST-03` | **Baja** | Backend (`backend/src/config/env.js:16`) | Acceso dinámico a variables de entorno (`process.env[variable]`) señalado por `eslint-plugin-security` (`detect-object-injection`). | `docs/seguridad/evidencia/eslint-security-backend.txt` | **Abierto** |
| `SEC-AUTH-01` | **Media** | Frontend (`AuthContext.jsx:51`) | Token JWT de autenticación local almacenado en `localStorage`. Aunque el frontend no posee inyecciones HTML y la CSP es estricta, un XSS permitiría la extracción del token. | Inspección de `frontend/src/context/AuthContext.jsx` | **Abierto** |
| `SEC-AUTH-02` | **Media** | Backend (`auth.middleware.js:78`) | `jwt.verify(token, env.JWT_SECRET)` no fija explícitamente los algoritmos permitidos (`algorithms: ['HS256']`), y no valida si el usuario local continúa activo en la BD (`activo === true`) antes de autorizar la sesión. | Inspección de `backend/src/middleware/auth.middleware.js` | **Abierto** |
| `SEC-AUTH-03` | **Media** | Backend (`auth.middleware.js:90`) | La verificación de tokens de Clerk mediante `verifyToken` no valida el claim `authorizedParties` (`azp`), omitiendo restringir qué orígenes de cliente son válidos. | Inspección de `backend/src/middleware/auth.middleware.js` | **Abierto** |
| `SEC-VAL-01` | **Media** | Backend (`routes/*.routes.js`) | Ausencia de validación con esquema formal tipado (como Zod o Joi) para los parámetros de ruta `:id` (`/reservas/:id`, `/aulas/:id/disponibilidad`) y parámetros de query (`/reservas`, `/aulas`). | Inspección de `backend/src/routes/` | **Abierto** |
| `SEC-TEST-01` | **Media** | Backend Tests (`globalSetup.cjs:17`) | `globalSetup` ejecuta `DROP SCHEMA public CASCADE;` sobre `DATABASE_URL_TEST` sin verificar mediante una guarda de seguridad que el nombre de la base de datos contenga obligatoriamente `_test` o `test`, arriesgando destrucción irreversible de datos en desarrollo o producción ante error de configuración. | `backend/tests/setup/globalSetup.cjs` | **Abierto** |
| `SEC-HIST-01` | **Baja** | Git History (commit `32838b48`) | Rutas personales absolutas del entorno local de desarrollo (`c:\Users\<usuario>\...`) versionadas en scripts auxiliares (`capturar-pantallas.mjs`) antes de su saneamiento en commit `0b1c7ac2`. | `git log` | **Abierto** |
| `SEC-INV-01` | **Baja** | Backend (`aulas.routes.js:8`) | `GET /api/aulas` no requiere autenticación (es público para listar aulas activas). Confirmado y documentado en el inventario como decisión de diseño que requiere validación. | Inspección de `backend/src/routes/aulas.routes.js` | **Abierto** |

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

### 1.2. Frontend
- **Salida cruda completa:** `docs/seguridad/evidencia/npm-audit-frontend.txt`
- **Salida cruda producción (`--omit=dev`):** `docs/seguridad/evidencia/npm-audit-frontend-prod.txt`
- **Total vulnerabilidades:** 22 (2 Críticas, 12 Altas, 8 Moderadas).
- **Vulnerabilidades en producción:** 5 (4 Altas, 1 Moderada).
  - **Alta:** `axios` (1.0.0 - 1.19.0) — Prototype pollution y DoS en deserialización de formularios ([GHSA-mmx7-hfxf-jppx](https://github.com/advisories/GHSA-mmx7-hfxf-jppx), [GHSA-pmv8-rq9r-6j72](https://github.com/advisories/GHSA-pmv8-rq9r-6j72)).
  - **Alta:** `follow-redirects` (1.16.0 - 1.16.1) — Fuga de cabeceras de autorización entre dominios redirigidos ([GHSA-q3jh-wrc6-jgq8](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8)).
  - **Alta:** `react-router` / `react-router-dom` (6.0.0 - 7.18.1) — Redirección abierta en `<Link>` y `useNavigate` ([GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6)).
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
- **Rutas personales en historial (`SEC-HIST-01`):** En el commit `32838b489221ec35e648e644e29fdc0ae8064719` quedaron registradas rutas personales absolutas (`c:\Users\<usuario>\...`) en scripts auxiliares de captura, antes de ser saneadas en el commit `0b1c7ac26d5048624e5f7848e6510b380984865c`.

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
    - 4 hallazgos `yaml.github-actions.security.github-actions-mutable-action-tag` en `.github/workflows/ci.yml:45,48,76,79` por uso de tags mutables (`actions/checkout@v4`, `actions/setup-node@v5`) en lugar de fijar commit SHAs inmutables.
    - 1 hallazgo `generic.nginx.security.request-host-used.request-host-used` en `frontend/nginx.conf:20` por uso de la variable `$host` en `proxy_set_header Host $host` sin validación explícita de dominios permitidos.
  - **INFO:** 0 hallazgos.

### 3.2. Resumen de Hallazgos ESLint y `eslint-plugin-security`
- **Evidencia estándar:** `docs/seguridad/evidencia/eslint-backend.txt`, `docs/seguridad/evidencia/eslint-frontend.txt` (0 errores y 0 warnings con las reglas de proyecto).
- **Evidencia reglas de seguridad:** `docs/seguridad/evidencia/eslint-security-backend.txt`.
- **Distribución por Severidad:**
  - **ERROR de seguridad:** 0 errores.
  - **WARNING de seguridad (5 hallazgos):**
    - 4 advertencias `security/detect-object-injection`: 2 en `backend/src/config/env.js:16` por acceso dinámico a `process.env[variable]`, y 2 en `backend/scripts/legacy/migrar-sqlite-a-postgres.js:169-170`.
    - 1 advertencia `security/detect-non-literal-fs-filename`: en `backend/scripts/legacy/migrar-sqlite-a-postgres.js:87` por llamada a `fs.existsSync` con argumento dinámico proveniente de rutas de backup.

---

## 4. Auditoría de Contenedores y Configuración

Se ejecutó escaneo de vulnerabilidades y malas prácticas de configuración sobre los Dockerfiles y las imágenes generadas mediante `aquasec/trivy`.

### 4.1. Análisis de Dockerfiles con Trivy
- **Backend Dockerfile (`backend/Dockerfile`):**
  - **Evidencia:** `docs/seguridad/evidencia/trivy-backend-dockerfile.txt`.
  - **Resultado:** **0 misconfiguraciones**. Construcción multi-etapa, `USER node` (ejecución como usuario no root), `npm ci --omit=dev`, `HEALTHCHECK` configurado con endpoint HTTP.
- **Frontend Dockerfile (`frontend/Dockerfile`):**
  - **Evidencia:** `docs/seguridad/evidencia/trivy-frontend-dockerfile.txt`.
  - **Resultado:** **1 falla Alta (`DS-0002`)**: El contenedor de Nginx no define directiva `USER`, ejecutándose como superusuario `root`. Se requiere configurar Nginx para operar como usuario no privilegiado (`nginx` o `incus`).

### 4.2. Análisis de Docker Compose y Exposición de Puertos
- **Compose Productivo (`docker-compose.prod.yml`):**
  - `postgres`: No expone puertos hacia el exterior (no tiene directiva `ports:` mapeada al host); se comunica exclusivamente a través de la red aislada `reservas-net`.
  - `backend`: Expone `127.0.0.1:${BACKEND_PORT:-3001}:3001` fijado a localhost (no expuesto a interfaces externas).
  - `frontend`: Expone el puerto `80` para tráfico web institucional.
  - Secretos: No existen contraseñas hardcodeadas en los archivos compose; todas se inyectan a través del archivo de entorno `.env.production`.

### 4.3. Problema Crítico de Configuración: Proxy Inverso y `trust proxy`
- **Diagnóstico:** En `frontend/nginx.conf`, Nginx reenvía las peticiones a la API agregando las cabeceras estándar:
  ```nginx
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  ```
  Sin embargo, en `backend/src/app.js` **falta la instrucción `app.set('trust proxy', ...)`**.
- **Impacto de seguridad:**
  - Express no confía en `X-Forwarded-For` por defecto.
  - Para Express, la dirección IP del cliente (`req.ip`) es la IP interna del contenedor Nginx (`172.x.x.x`) para el 100% de las peticiones.
  - En consecuencia, el limitador de tasa (`express-rate-limit` en `/api/auth/login`) calcula los intentos fallidos contra la IP de Nginx, haciendo que si un usuario supera 10 intentos fallidos, **el login quede bloqueado para todos los usuarios legítimos de la institución**.

---

## 5. Inventario de Rutas y Matriz de Control de Acceso (Backend)

Inventario exhaustivo de todos los endpoints registrados en Express, indicando método, middleware de autenticación, roles permitidos, validación de entrada y control de propiedad de recursos (prevención de IDOR).

| Método | Ruta | Middleware Auth | Roles Permitidos | Validación de Entrada Aplicada | Control de Propiedad (IDOR) | Evaluación de Seguridad |
|---|---|---|---|---|---|---|
| `GET` | `/` | Ninguno | Público | Ninguna | N/A | Endpoint informativo raíz. |
| `GET` | `/api/health` | Ninguno | Público (Healthcheck) | Ninguna | N/A | Verifica estado de conexión a PostgreSQL. |
| `POST` | `/api/auth/login` | Ninguno (Público) | Anónimo | `validarLogin` (campos presentes y no vacíos) + `loginLimiter` (10 intentos / 15 min) | N/A | Requiere mitigación de `trust proxy` y protección contra enumeración de usuarios. |
| `GET` | `/api/aulas` | **Ninguno** | Público | Ninguna | N/A | Lista aulas activas. No expone datos de usuarios. |
| `GET` | `/api/aulas/:id/disponibilidad` | `verificarToken` | `admin`, `usuario` | Validación manual en servicio (`id` entero > 0, fecha YYYY-MM-DD) | No aplica (datos agregados de disponibilidad horaria) | Endpoint técnico. Solo devuelve rangos horarios y estado sin datos de solicitantes. |
| `GET` | `/api/reservas/resumen` | `verificarToken`, `soloAdmin` | `admin` | Ninguna | Solo admin | Métricas globales de reservas. |
| `GET` | `/api/reservas` | `verificarToken` | `admin`, `usuario` | Sanitización de `limit` (max 100), `page` y lista blanca de `sortBy` | **Sí (Garantizado)**: Usuarios comunes filtrados estrictamente por `where.usuarioId = req.usuario.id`. | Admin recibe datos del solicitante; usuarios comunes solo sus propias reservas sin datos personales de terceros. |
| `POST` | `/api/reservas` | `verificarToken` | `admin`, `usuario` | `validarCrearReserva` (horarios laborales, fechas futuras, enteros) | **Sí (Garantizado)**: El servidor sobreescribe `datosReserva.usuarioId = req.usuario.id`. | No permite asignación masiva de usuario ni estado. |
| `GET` | `/api/reservas/:id` | `verificarToken` | `admin`, `usuario` | Sin validación de esquema en `:id` | **Sí (Garantizado)**: Si `rol !== 'admin'` y `reserva.usuarioId !== req.usuario.id`, devuelve `404`. | Protegido contra IDOR. |
| `GET` | `/api/reservas/:id/historial` | `verificarToken` | `admin`, `usuario` | Sin validación de esquema en `:id` | **Sí (Garantizado)**: Invoca internamente `obtenerReservaPorId` exigiendo propiedad o rol admin. | Historial auditado con control estricto de propiedad. |
| `PUT` | `/api/reservas/:id` | `verificarToken`, `soloAdmin` | `admin` | `validarEditarReserva` + validaciones de negocio | Solo admin | Edición integral de reserva reservada a administradores. |
| `PATCH` | `/api/reservas/:id/aprobar` | `verificarToken`, `soloAdmin` | `admin` | Sin validación de esquema en `:id` | Solo admin | Aprobación restringida a rol administrador. |
| `PATCH` | `/api/reservas/:id/rechazar` | `verificarToken`, `soloAdmin` | `admin` | Sin validación de esquema en `:id` | Solo admin | Rechazo restringido a rol administrador. |
| `PATCH` | `/api/reservas/:id/cancelar` | `verificarToken` | `admin`, `usuario` | Sin validación de esquema en `:id` | **Sí (Garantizado)**: Validación explícita `esAdmin || String(reserva.usuarioId) === String(usuario.id)`. Devuelve `403` si no es dueño. | Cancelación lógica controlada. |

---

## 6. Verificación de Puntos Previos a las Mejoras

Revisión punto por punto del estado de los problemas identificados:

1. **Token JWT guardado en `localStorage` (un XSS permitiría robarlo):**
   - **Estado actual:** El frontend almacena el token JWT de usuarios locales en `localStorage` (`AuthContext.jsx:51`). Para usuarios autenticados con Google (Clerk), la sesión reside en memoria y se obtiene dinámicamente mediante `getToken()`.
   - **Diagnóstico:** Permanece como riesgo residual documentado. En Fase 6b se evaluará migración a cookies HTTP-only o fortalecimiento estricto de CSP contra XSS.
2. **`jwt.verify` sin fijar algoritmos permitidos; secreto con valor por defecto en el código:**
   - **Estado actual:** El valor por defecto hardcodeado fue eliminado del código y es validado en el arranque por `backend/src/config/env.js`. Sin embargo, `auth.middleware.js:78` aún invoca `jwt.verify(token, env.JWT_SECRET)` sin fijar explícitamente `algorithms: ['HS256']`.
3. **`express.json()` sin límite de tamaño:**
   - **Estado actual:** Persiste sin límite explícito (`app.use(express.json())` en `backend/src/app.js:22`). Debe limitarse a `10kb` en la Fase 6b.
4. **`console.error(err.stack)` volcando trazas completas:**
   - **Estado actual:** Presente en `backend/src/middleware/error.middleware.js:5-7`. En producción las trazas se imprimen a la consola. Requiere logging estructurado o supresión de trazas en producción con ID de correlación.
5. **Dependencias con rangos `^` y sin escaneo:**
   - **Estado actual:** Todos los `package.json` utilizan prefijos `^`. En la Fase 6b deberán fijarse las dependencias a versiones exactas parcheadas y auditarse en CI mediante `npm audit --audit-level=high`.
6. **Verificación del token de Clerk sin validar firma:**
   - **Estado actual:** Resuelto parcialmente en Fase 1 mediante `verifyToken` de `@clerk/backend` que valida firma y expiración. Falta validar el claim de audiencia/partes autorizadas (`azp`).
7. **Reservas e historial visibles para cualquier usuario autenticado:**
   - **Estado actual:** Resuelto en Fases 1 a 3. El inventario confirma que `listarReservas`, `obtenerReservaPorId`, `obtenerHistorialDeReserva` y `cancelarReserva` aplican aislamiento estricto por `usuarioId` y ocultan datos de solicitantes a usuarios no administradores.
8. **Asignación masiva en registro (`SEC-AUTH-04`):**
   - **Estado actual:** Identificado en `backend/src/services/auth.services.js:27`: `registrarUsuario` acepta `rol` de los datos enviados. Catalogado como severidad **Baja** ("defensa en profundidad"): no explotable hoy; riesgo si algún día se expone una ruta de registro (actualmente `auth.routes.js` solo tiene `POST /login` y solo lo usa `auth.test.js`).
9. **Vinculación por email no verificado en Clerk (`SEC-AUTH-05`):**
   - **Estado actual:** Identificado en `backend/src/middleware/auth.middleware.js:44-52`: el aprovisionamiento JIT vincula a usuario local existente por correo sin comprobar el flag `emailAddresses[0].verification.status === 'verified'`.
10. **Seguridad en tests (`SEC-TEST-01`):**
    - **Estado actual:** Identificado en `backend/tests/setup/globalSetup.cjs:17`: `DROP SCHEMA public CASCADE;` se ejecuta ciegamente sin comprobar que la base de datos sea de test.

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
