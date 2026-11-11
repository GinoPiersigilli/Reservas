# Sistema de Reservas de Aulas

[![CI](https://github.com/GinoPiersigilli/Reservas/actions/workflows/ci.yml/badge.svg)](https://github.com/GinoPiersigilli/Reservas/actions/workflows/ci.yml)
[![CodeQL Analysis](https://github.com/GinoPiersigilli/Reservas/actions/workflows/codeql.yml/badge.svg)](https://github.com/GinoPiersigilli/Reservas/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Plataforma web institucional full-stack para la gestión, consulta visual de disponibilidad horaria y asignación de aulas académicas sin riesgo de solapamiento.

---

## Capturas de Pantalla

| Grilla de Disponibilidad Horaria | Panel Administrativo |
|---|---|
| ![Grilla de disponibilidad](docs/img/nueva-reserva-grilla-escritorio.png) | ![Panel admin](docs/img/panel-admin-escritorio.png) |

| Listado y Filtros de Reservas | Grilla en Modo Oscuro |
|---|---|
| ![Listado de reservas](docs/img/reservas-admin-escritorio.png) | ![Modo oscuro](docs/img/nueva-reserva-grilla-oscuro.png) |

---

## Problema que Resuelve y Funcionalidades por Rol

Elimina la "reserva a ciegas" mediante una grilla visual en bloques de 30 minutos (08:00 a 22:00) y previene la doble reserva física a nivel de base de datos.
- **Docentes y Estudiantes (`usuario`):** Consultan disponibilidad en tiempo real, seleccionan franjas horarias libres con dos clics, gestionan sus solicitudes y cancelan reservas activas.
- **Personal Administrativo (`admin`):** Cola priorizada de solicitudes pendientes, aprobación/rechazo con confirmación, edición integral de reservas, auditoría histórica, visualización de solicitantes y panel analítico de métricas de ocupación y demanda de aulas.

---

## Arquitectura y Stack Tecnológico

```mermaid
graph LR
  Client[SPA React 19] -->|HTTPS /api| Nginx[Proxy Nginx + CSP]
  Nginx -->|Proxy HTTP| Node[Backend Express + Zod]
  Node -->|Transacciones & GiST| DB[(PostgreSQL 16)]
  Node -->|Verificación Token| Auth[Clerk Auth / JWT Local]
```

- **Frontend:** React 19, CSS Modules, Tokens CSS (`tokens.css`), fuentes institucionales autoalojadas (`@fontsource`), Vite y Vitest + `vitest-axe`.
- **Backend:** Node.js (ESM), Express, Sequelize 6, Zod (validación de esquemas), Jest y Supertest.
- **Base de Datos:** PostgreSQL 16 con extensión `btree_gist` para exclusión física temporal.
- **Infraestructura:** Docker Compose, Nginx (reverse proxy y Content-Security-Policy sin `'unsafe-inline'` en `script-src`).

---

## Decisiones Técnicas Destacadas

- **Inmunidad a la Doble Reserva:** Restricción de exclusión en PostgreSQL (`EXCLUDE USING gist`) con rangos `tsrange` semiabiertos `[inicio, fin)` que rechaza físicamente solapamientos ante concurrencia.
- **Control Temporal e Intradiario:** Validación defensiva que rechaza solicitudes en fechas pasadas y en horarios ya transcurridos del día corriente en el huso oficial (`America/Argentina/Cordoba`).
- **Atomicidad Transaccional:** Creación, edición y transiciones de estado envueltas en transacciones ACID con registro inmutable en `historial_reservas`.
- **Modelado Formal y Analítica de Gestión:** Documentación con diagramas formales DER y Máquina de Estados en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md), y métricas analíticas de ocupación mensual y demanda en el panel administrativo.
- **Autenticación Híbrida y Estado Activo:** Soporte simultáneo para Clerk SSO y JWT local (HS256), con validación obligatoria del estado del usuario en la base de datos en cada petición.
- **Accesibilidad y Modo Oscuro:** Interfaz auditada con axe sin violaciones (WCAG 2.1 AA), navegación por teclado y modo oscuro con anti-flicker (`/tema-init.js`) compatible con CSP.
- **Pipeline de Seguridad en CI:** Escaneo continuo de imágenes Docker con Trivy, SAST con Semgrep y CodeQL, y detección de secretos con Gitleaks.

---

## Seguridad y Riesgos Aceptados

El análisis exhaustivo de seguridad se detalla en [docs/SEGURIDAD.md](docs/SEGURIDAD.md). Riesgos aceptados y mitigados:
- **Almacenamiento de JWT local en `localStorage`:** Mitigado con política CSP estricta en Nginx (sin `'unsafe-inline'` en `script-src`), cookies HttpOnly planificadas para evolución futura.
- **Directiva `'unsafe-inline'` en `style-src`:** Requerida por el SDK `@clerk/clerk-react` para inyectar hojas de estilo; aislada de la ejecución de scripts.

---

## Puesta en Marcha Local

```bash
# 1. Configurar archivos de entorno
cp .env.example .env && cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env

# 2. Iniciar motor PostgreSQL
docker compose up -d postgres

# 3. Aplicar migraciones y datos de prueba
npm run migrate --prefix backend && npm run seed --prefix backend

# 4. Iniciar backend API (puerto 3001)
npm run dev --prefix backend

# 5. En otra terminal, iniciar frontend (puerto 5173)
npm run dev --prefix frontend
```

> **Credenciales de demostración local** (generadas exclusivamente mediante el seeder para pruebas locales):
> - Administrador: `admin@utnfrc.edu.ar` / `admin123`
> - Usuario docente: `david@utnfrc.edu.ar` / `user123`

---

## Tests y Verificación

```bash
npm test --prefix backend                  # Pruebas unitarias, concurrencia y contratos (Jest)
npm test --prefix frontend                 # Pruebas de componentes y accesibilidad axe (Vitest)
node frontend/scripts/verificar-contraste.js # Validación contractual de contraste WCAG 2.1 AA
node frontend/scripts/capturar-pantallas.mjs # Verificación responsive automatizada con Chrome/Brave
```

---

## Consideraciones para Producción y Próximos Pasos

- **Terminación TLS/HTTPS:** Debe configurarse un proxy reverso con certificados SSL válidos delante de Nginx.
- **Copias de Seguridad:** Scripts automatizados `scripts/backup-db.sh` y `scripts/restore-db.sh` con retención de 7 días.
- **Próximas mejoras:** Pantalla de gestión administrativa (ABM) de aulas desde la interfaz web.

Documentación técnica completa: [Arquitectura](docs/ARQUITECTURA.md) | [Diseño UI/UX](docs/DISENO.md) | [Guía de Despliegue](docs/DEPLOY.md) | [Seguridad](docs/SEGURIDAD.md).

---

## Proceso de Desarrollo y Licencia

Desarrollado de manera iterativa con asistencia de herramientas de IA (Google Antigravity), con diseño de arquitectura, revisión de código, desarrollo de pruebas y auditoría de seguridad implementados con criterio propio.

Distribuido bajo licencia [MIT](LICENSE). © 2026 Gino Piersigilli.
