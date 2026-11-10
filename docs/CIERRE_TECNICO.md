# Informe de Cierre Técnico y Auditoría Integral — Sistema de Reservas

> **Documento:** Cierre Técnico y Evaluación de Calidad de Software  
> **Sistema:** Plataforma de Gestión de Reservas de Aulas Universitarias  
> **Institución:** Universidad Tecnológica Nacional — Facultad Regional Córdoba (UTN FRC)  
> **Carrera:** Tecnicatura Universitaria en Programación / Analista Universitario en Sistemas  
> **Autor:** Gino Piersigilli  
> **Fecha de Auditoría:** 10 de noviembre de 2026  
> **Rama Auditada:** `mejora/fase-8-portfolio` (Pull Request #47 abierto contra `main`, pendiente de integración)  
> **Último Commit Auditado:** `441954e` (`fix(ci): dimensionar pool de conexiones y timeout especifico en prueba de concurrencia`)  
> **Total de Commits Evaluados:** 158 commits alcanzables en `HEAD`  

---

## A. Estado General y Alcance

### A.1. Contexto y Objetivos del Cierre
El presente cierre técnico consolida y certifica la calidad de ingeniería de la plataforma **Reservas** como pieza principal de portfolio técnico profesional. El propósito ha sido auditar exhaustivamente el sistema existente, verificar la integridad referencial y concurrencia en la base de datos, validar la consistencia de las reglas de negocio, contrastar los análisis estáticos y dinámicos de seguridad, evaluar la fidelidad de las suites de prueba y garantizar que la documentación refleje con total precisión el código desplegado.

### A.2. Alcance de las Verificaciones Realizadas
Las actividades de evaluación abarcaron los componentes del repositorio en su estado actual:
1. **Historial de Control de Versiones:** Inspección de 154 commits analizados por Gitleaks sobre los 158 alcanzables desde `HEAD` (Gitleaks omite commits de merge sin cambios de contenido/diffs vacíos); análisis con TruffleHog; investigación forense de commits `20077a02` y `4935a92a` (`SEC-SEC-02`). No abarca ramas remotas huérfanas o no fusionadas.
2. **Backend API:** 21 módulos en Express ESM, esquemas de validación Zod, autenticación dual (JWT + Clerk JWKS), 14 endpoints con control IDOR y middleware de manejo de errores.
3. **Capa de Persistencia y Concurrencia:** PostgreSQL 16 con extensión `btree_gist`, restricción de exclusión `EXCLUDE USING gist`, intervalos semiabiertos `tsrange`, migraciones Sequelize y advisory locks en testing.
4. **Frontend SPA:** React 19, Vite, React Router, CSS Modules, diseño con tokens semánticos accesibles (modo claro y oscuro auditados bajo WCAG 2.1 AA).
5. **Infraestructura y Contenedores:** Nginx unprivileged (UID 101), multi-stage Dockerfiles con usuario no root, escaneo de imágenes con Trivy y proxy inverso endurecido.
6. **Pipeline de Integración Continua (CI/CD):** Workflows de GitHub Actions fijados por commit SHA completo de 40 caracteres, escaneos automáticos de Semgrep, Gitleaks, CodeQL y npm audit.

---

## B. Hallazgos de Auditoría

A continuación se detallan los hallazgos identificados, confirmados o investigados durante el proceso de cierre técnico:

| Identificador | Severidad | Componente / Ubicación | Descripción del Hallazgo | Evidencia Técnica | Estado Actual |
|---|---|---|---|---|---|
| **SEC-SEC-02 (Parte A)** | **Alta (Histórica)** | `backend/src/services/auth.services.js` | Clave de firma JWT fallback hardcodeada (`mi_clave_secreta_super_segura_dds_2026`) introducida en commit inicial `20077a02`. | Commit `20077a02` | **Mitigado en código activo**. En `env.js`, `JWT_SECRET` es obligatoria; la app no arranca sin ella y no existe ningún fallback. La clave permanece legible en commits históricos. |
| **SEC-SEC-02 (Parte B)** | **Alta (Histórica)** | `backend/database.sqlite` | Archivo binario SQLite versionado durante 11 commits (desde `4935a92a` hasta `c8e094c6`). Contenía 9 cuentas de usuarios con hashes bcrypt `$2b$10$...`, incluyendo datos personales identificables (nombres y correos institucionales de alumnos). | Extracción e inspección forense con `node:sqlite` | **Mitigado en árbol activo**. La BD fue eliminada en Fase 1 y sustituida por PostgreSQL. Existe incertidumbre sobre si los hashes correspondían a contraseñas personales reutilizadas por los estudiantes. |
| **SEC-SEC-01** | **Baja** | `docs/CONTEXTO_PROYECTO.md` | Detección de token de Clerk en commit `f07ef073`. | Gitleaks / `git log` | **No confirmado (Falso Positivo)**. Se trataba de la cadena de ejemplo con puntos suspensivos `CLERK_SECRET_KEY=clave_ejemplo_...`. El archivo fue eliminado en Fase 8. |
| **SEC-HIST-01** | **Baja** | `frontend/scripts/capturar-pantallas.mjs` | Rutas absolutas del entorno local de desarrollo de Windows versionadas en commit `32838b48`. | `git log` | **Cerrado**. Saneadas a rutas relativas en commit `0b1c7ac2`; árbol activo 100 % limpio. |
| **SEC-SAST-01** | **Media** | `frontend/nginx.conf` | Uso de variable `$host` en proxy inverso susceptible a *Host Header Injection*. | Semgrep | **Cerrado**. Host fijado estáticamente a `proxy_set_header Host backend;`. |
| **SEC-SAST-02** | **Baja** | `.github/workflows/ci.yml`, `codeql.yml` | Pasos de GitHub Actions utilizando tags mutables (`@v4`, `@v5`). | Semgrep | **Cerrado**. Fijados a commit SHAs inmutables de 40 caracteres oficiales. |
| **SEC-SAST-03** | **Baja** | `backend/src/config/env.js` | Detección de `detect-object-injection` por acceso dinámico a `process.env[variable]`. | ESLint Security | **Falso Positivo Justificado**. Se itera una lista blanca fija, cerrada e inmutable sin entradas no confiables del usuario. |
| **SEC-AUTH-01** | **Media** | `frontend/src/context/AuthContext.jsx` | Token JWT local almacenado en `localStorage`. | Inspección de código | **Riesgo Aceptado Documentado**. Mitigado con CSP estricta sin `'unsafe-inline'` en scripts, expiración a 2 horas y 0 usos de `innerHTML`. |
| **SEC-AUTH-06** | **Media** | `backend/src/middleware/auth.middleware.js` | Excepción de base de datos en `Usuario.findByPk` caía indebidamente a Clerk respondiendo 401 en vez de 500. | Suite de tests | **Cerrado**. Captura explícita invocando `next(dbError)` para devolver 500 y evitar deslogueos falsos. |
| **SEC-TEST-02** | **Baja** | `backend/src/middleware/validacion.middleware.js` | Filtros opcionales enviados por el frontend como cadenas vacías (`fecha=&estado=`) generaban error 400 en esquemas Zod. | Inspección de integración | **Cerrado**. Preprocesamiento con Zod transformando strings vacíos a `undefined`, y suite de 15 pruebas de contrato en backend. |

---

## C. Correcciones Técnicas Aplicadas y Justificación

1. **Investigación y Diagnóstico Exhaustivo de SEC-SEC-02:**
   - *Hallazgo comprobado (Parte A - JWT):* En commit `20077a02`, el código incluía textualmente: `// En un proyecto real esto va en un archivo .env, pero lo dejamos acá para simplificar` y `const JWT_SECRET = 'mi_clave_secreta_super_segura_dds_2026'`. Demuestra origen académico en la cátedra DDS. En el árbol activo, `env.js` exige la variable sin fallback (0 ocurrencias de la clave histórica). Sin embargo, la clave permanece en el historial público, lo cual permitiría forjar tokens si alguien la reutilizara en una instalación activa.
   - *Inspección de `database.sqlite` (Parte B - Datos y Hashes):* Se extrajo el blob binario anterior a su eliminación en `c8e094c6~1`. Se identificaron 9 registros de usuarios. Mientras que cuentas como `admin@utnfrc.edu.ar`, `nuevo@test.com` y `test-user@example.com` tienen propósitos funcionales de prueba, registros como `David Ismael López Rodriguez` (`david@utnfrc.edu.ar`) y `Laura Gómez` (`laura@utnfrc.edu.ar`) contienen **Datos Personales Identificables (PII)** reales de estudiantes/colaboradores. Todos poseían hashes bcrypt `$2b$10$...`. No es posible certificar si los hashes correspondían a contraseñas personales reales o de prueba; existe el riesgo residual de ataques de diccionario offline si hubo reutilización de contraseñas personales.
   - *Decisión sobre purga:* Se mantiene el protocolo con `git-filter-repo` documentado como **Requiere Autorización**, dado que reescribir el historial altera los 158 commits e invalida los clones existentes.
2. **Saneamiento y Actualización de Auditorías en Documentación:**
   - Se actualizó `docs/SEGURIDAD.md` reflejando el alcance sobre los commits alcanzables en `HEAD`.
   - Gitleaks analizó 154 commits: **0 fugas detectadas**.
   - Semgrep analizó 186 archivos con 116 reglas: **0 hallazgos activos**.
   - Trivy en escaneo de umbral CI (`--severity HIGH,CRITICAL --ignore-unfixed`): **0 vulnerabilidades HIGH o CRITICAL**. En escaneo completo (sin filtros de severidad), detecta 3 vulnerabilidades MEDIUM en librerías Node coincidentes con `npm audit`.
3. **Consolidación de Arquitectura y Diseño:**
   - Fusión y síntesis de documentos de diseño en `docs/DISENO.md` (54 líneas) y arquitectura en `docs/ARQUITECTURA.md` (176 líneas), orientados formalmente a evaluadores técnicos.
   - Eliminación de scripts obsoletos (`migrar-sqlite-a-postgres.js`, `verificar-csp-clerk.mjs`) y unificación de evidencias activas en `docs/seguridad/evidencia/`.
4. **Optimización del Pool de Conexiones y Resiliencia en Concurrencia (CI):**
   - *Diagnóstico:* Sequelize utilizaba el valor por defecto (`pool.max: 5`). Ante la prueba de 20 solicitudes simultáneas en runners virtuales de CI (2 vCPUs), las peticiones se encolaban en Node.js, excediendo esporádicamente el timeout estándar de Jest (5000 ms) y bloqueando las pruebas posteriores.
   - *Solución:* Se dimensionó el pool en `backend/src/config/database.js` (`max: 30` en test, `20` en prod/dev; `min: 2`; `acquire: 30000`) y se asignó un timeout específico de 15000 ms a la prueba de concurrencia en `tests/seguridad.test.js`.
   - *Resultado:* Ejecución completa de las 10 suites de backend 100 % reproducible en ~22 s (tiempo reducido a más de la mitad respecto a CI).

---

## D. Resultados de Verificación y Métricas

### D.1. Suite de Pruebas Automatizadas (194 tests)
- **Aclaración sobre Cobertura:** La aprobación de 194 pruebas automatizadas certifica la correctitud funcional de los casos de prueba implementados, **no implica una cobertura exhaustiva del 100 % de líneas, ramas o caminos de ejecución**.
- **Backend (Jest / Supertest / PostgreSQL 16):**
  - **10 suites pasadas, 128 tests pasados, 0 fallos.**
  - Pruebas destacadas:
    - `contrato-frontend.test.js`: 15 tests que emulan las peticiones exactas del cliente React.
    - `seguridad.test.js`: 26 tests de ataque (IDOR, SQLi, mass assignment, DoS 413, rate limit 429 y condición de carrera de 20 solicitudes simultáneas donde solo 1 es creada).
    - `esquema-constraint.test.js`: validación de la restricción GiST de exclusión en base de datos.
    - `trust-proxy.test.js`: verificación del aislamiento de contadores de rate limiting por IP de origen.
    - `clerk-verification.test.js`: validación del bloqueo de aprovisionamiento si el correo no está verificado.
- **Frontend (Vitest / React Testing Library / vitest-axe):**
  - **11 suites pasadas, 66 tests pasados, 0 fallos.**
  - Pruebas destacadas:
    - `Accesibilidad.test.jsx`: auditorías de accesibilidad con `axe` en login, registro, shell y vistas principales, tanto en modo claro como en modo oscuro.
    - `useTema.test.jsx` y `useGoogleOAuth.test.jsx`: ciclo de vida de preferencias y autenticación.
    - `axios.test.js`: interceptor global ante respuestas 401.

### D.2. Calidad de Código y Estilo (Linters)
- **Backend (`npm run lint --prefix backend`):** 0 errores, 0 advertencias (ESLint 9 Flat Config).
- **Frontend (`npm run lint --prefix frontend`):** 0 errores, 0 advertencias.

### D.3. Compilación y Bundle de Producción (Frontend)
- **Vite Build (`npm run build --prefix frontend`):** Exitoso en 1.41 s.
  - Bundle JavaScript principal: **457.8 KB** (~130 KB gzipped) conteniendo React 19, Clerk SDK, React Router y Lucide Icons.
  - Hoja de estilos CSS: **47.0 KB** de variables nativas CSS (sin librerías runtime ni inyección dinámica).
  - Tipografías locales auto-alojadas: 6 archivos WOFF/WOFF2 de 14 a 25 KB cada uno.

### D.4. Verificación de Accesibilidad y Contraste WCAG 2.1 AA
- **Ejecución (`node frontend/scripts/verificar-contraste.js`):**
  - Modo Claro: 10/10 combinaciones evaluadas cumplen el ratio mínimo de 4.5:1.
  - Modo Oscuro: 11/11 combinaciones evaluadas cumplen el ratio mínimo de 4.5:1.

### D.5. Escaneos de Seguridad en Contenedores y Dependencias
- **Gitleaks:** 154 commits escaneados de los 158 alcanzables en `HEAD` (omitiendo diffs vacíos). Resultado: `0 leaks found`.
- **Semgrep:** 186 archivos escaneados, 116 reglas comunitarias oficiales (`p/javascript`, `p/nodejs`, `p/react`, `p/owasp-top-ten`). Resultado: `0 findings`.
- **Trivy (Parámetros exactos y resultados diferenciados):**
  - *Filtro CI (`--scanners vuln --exit-code 1 --ignore-unfixed --severity HIGH,CRITICAL`):* **0 vulnerabilidades** en `reservas-backend:latest` y `reservas-frontend:latest`.
  - *Escaneo completo (`--scanners vuln --severity LOW,MEDIUM,HIGH,CRITICAL`):* Detecta **3 vulnerabilidades de severidad MEDIUM** en el backend (`glob` CVE-2026-118773, `minimatch` CVE-2026-118764, `uuid` CVE-2026-41907).
- **npm audit en Producción (`--omit=dev`):**
  - Frontend: 0 vulnerabilidades.
  - Backend: **7 vulnerabilidades de severidad moderada** en dependencias transitivas de `sequelize@6.37.8` y `sequelize-cli@6.6.5` (`minimatch`, `editorconfig`, `glob`, `js-beautify`, `uuid`). No se registran vulnerabilidades de severidad Alta ni Crítica en producción.

---

## E. Riesgos Residuales, Limitaciones y Deuda Técnica

1. **Almacenamiento de Token JWT Local en `localStorage` (`SEC-AUTH-01`):**
   - *Riesgo:* Ante un hipotético XSS exitoso, el token de sesión podría ser leído mediante JavaScript.
   - *Mitigación actual:* Content Security Policy estricta sin `'unsafe-inline'` en `script-src`, 0 usos de `innerHTML`, tokens con vida útil de 2 horas.
   - *Recomendación para producción real:* Migrar a cookies con banderas `HttpOnly`, `Secure` y `SameSite=Strict` cuando el backend y frontend compartan dominio o subdominio productivo.
2. **Directiva `style-src 'unsafe-inline'` en CSP:**
   - *Riesgo:* Permite la inyección de estilos en línea.
   - *Justificación:* Requisito arquitectónico indispensable impuesto por el SDK cliente de Clerk para la inyección de sus componentes de interfaz modal. Mitigado por el hecho de que `script-src` prohíbe scripts en línea.
3. **Clave y Hashes en el Historial Git (`SEC-SEC-02`):**
   - *Riesgo residual:* La clave hardcodeada de desarrollo y los hashes bcrypt residen en commits antiguos del historial público. No es posible garantizar si alguna contraseña fue reutilizada por los estudiantes autores.
   - *Mitigación:* Se redactó el protocolo de purga con `git-filter-repo`. No se ha ejecutado para evitar la reescritura destructiva de los identificadores SHA-1 del repositorio público, considerándose un riesgo aceptable para un proyecto académico/portfolio donde la base nunca fue productiva.
4. **Vulnerabilidades Moderadas en Dependencias Transitivas:**
   - Las 7 vulnerabilidades moderadas reportadas por `npm audit` (y 3 por Trivy en nivel MEDIUM) corresponden a dependencias internas de `sequelize@6.37.8`. Forzar su actualización requeriría migrar a versiones mayores incompatibles (`sequelize@3` o `sequelize-cli@6.6.2`). Se mantiene como riesgo aceptado documentado.
5. **Validación de Horarios Intradiarios en la Creación de Reservas:**
   - *Escenario no cubierto:* La función `esFechaPasada` verifica que la fecha no sea previa a la actual (`fecha >= hoy`), pero no restringe reservas para el mismo día en horarios ya transcurridos (e.g. solicitar una franja de 08:00 a 10:00 a las 14:00 del mismo día).
6. **Concurrencia en Edición de Reservas:**
   - *Escenario no cubierto por tests de estrés:* La prueba de concurrencia de 20 peticiones simultáneas se implementó exclusivamente para `POST /api/reservas`. Aunque `PUT /api/reservas/:id` delega la atomicidad en la misma restricción GiST de PostgreSQL dentro de una transacción, no cuenta con un test de estrés de 20 peticiones concurrentes simultáneas.

---

## F. Tabla de Tareas y Estado de Cierre

| Área de Trabajo | Tarea / Actividad | Estado | Observaciones Técnicas |
|---|---|---|---|
| **P0 — Seguridad Histórica** | Investigación de commit `20077a02` (`JWT_SECRET`) | **Completada** | Confirmado origen académico DDS UTN; mitigado en código activo. |
| **P0 — Seguridad Histórica** | Inspección forense de `database.sqlite` (`4935a92a`) | **Completada** | Identificados 9 usuarios con PII institucional de alumnos y hashes bcrypt. |
| **P0 — Seguridad Histórica** | Análisis de exclusiones en `.gitleaksignore` | **Completada** | 3 reglas justificadas; ninguna oculta credenciales reales. |
| **P0 — Seguridad Histórica** | Purga retroactiva con `git-filter-repo` | **Requiere Autorización** | Procedimiento documentado; no ejecutado por alterar SHAs públicos. |
| **P1 — Auditoría Integral** | Escaneo Gitleaks de los 154 commits alcanzables | **Completada** | 0 fugas detectadas en historial de diffs. |
| **P1 — Auditoría Integral** | Escaneo Semgrep de 186 archivos | **Completada** | 0 hallazgos activos en reglas OWASP / Node / React. |
| **P1 — Auditoría Integral** | Escaneo Trivy de imágenes Docker | **Completada** | 0 vulnerabilidades HIGH/CRITICAL; 3 MEDIUM identificadas y justificadas. |
| **P1 — Auditoría Integral** | Actualización de `docs/SEGURIDAD.md` | **Completada** | Sincronizado con el alcance actual de commits. |
| **P2 — Reglas de Negocio** | Validación de intervalos `[inicio, fin)` y horarios | **Completada** | Garantizada en PostgreSQL mediante restricción GiST. |
| **P2 — Reglas de Negocio** | Matriz de transiciones de reservas | **Completada** | Flujo estricto validado en backend (`reservas.services.js`). |
| **P2 — Reglas de Negocio** | Trazabilidad y auditoría atómica en BD | **Completada** | Registros en `historial_reservas` en la misma transacción Sequelize. |
| **P3 — Base de Datos** | Verificación de `reservas_sin_solapamiento` | **Completada** | Restricción GiST activa para estados `pendiente` y `aprobada`. |
| **P3 — Base de Datos** | Concurrencia y Advisory Locks en Tests | **Completada** | `pg_advisory_lock` y pool dimensionado a 30 conexiones. |
| **P4 — Testing y Calidad** | Ejecución de suite Backend (Jest) | **Completada** | 128 tests aprobados (10 suites). Cobertura no absoluta. |
| **P4 — Testing y Calidad** | Ejecución de suite Frontend (Vitest) | **Completada** | 66 tests aprobados (11 suites). |
| **P4 — Testing y Calidad** | Verificación de accesibilidad WCAG 2.1 AA | **Completada** | 100 % de contraste y auditorías `axe` en verde. |
| **P5 — CI/CD e Infraestructura** | Endurecimiento de GitHub Actions | **Completada** | Commit SHAs inmutables de 40 caracteres en todos los pasos. |
| **P5 — CI/CD e Infraestructura** | Contenedores Nginx unprivileged | **Completada** | Nginx ejecutando como usuario UID 101 sin root. |
| **P6 — Reproducibilidad** | Simulación de instalación limpia en 5 pasos | **Completada** | Instrucciones de `README.md` validadas contra `.env.example`. |
| **P7 — Documentación** | Saneamiento de documentación de portfolio | **Completada** | `README.md`, `ARQUITECTURA.md`, `DISENO.md`, `LICENSE` MIT listos. |

---

## Conclusión Técnica

El sistema **Reservas** alcanza un nivel de madurez, integridad de datos, seguridad por capas y cobertura de pruebas óptimo para su presentación técnica y defensa académica. Las conclusiones aquí presentadas reflejan con rigurosidad las mediciones reproducibles obtenidas en la rama `mejora/fase-8-portfolio`. El Pull Request #47 permanece **abierto** contra la rama `main`, pendiente de revisión y merge definitivo por parte del equipo.
