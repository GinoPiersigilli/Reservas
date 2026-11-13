# Evidencia de Seguridad y Auditorías

Este directorio almacena los reportes y salidas crudas generadas por las herramientas de análisis de seguridad estático (SAST), dinámico (DAST), escaneo de secretos y auditoría de dependencias, referenciadas en `docs/SEGURIDAD.md`.

> **Qué es y qué no es esta carpeta.** Son salidas fechadas de la auditoría del 10 de noviembre de 2026: respaldan los hallazgos de `SEGURIDAD.md`, no describen el estado de hoy. El estado vigente lo dan los jobs de Trivy, Semgrep, CodeQL y Gitleaks, que corren en cada push. Por eso no se conservan el volcado completo de la imagen del backend (`trivy-image-backend.txt`) ni la versión HTML del informe de ZAP: el primero caduca con cada reconstrucción de la imagen y el segundo repetía lo que ya está en `zap-report.json`.

---

## Índice de Archivos

### Auditoría de Dependencias y Paquetes (`npm`)
- **`npm-audit-backend.txt`**: Auditoría completa de dependencias del backend (`npm audit`).
- **`npm-audit-backend-prod.txt`**: Auditoría estricta de dependencias productivas del backend (`npm audit --omit=dev`).
- **`npm-audit-frontend.txt`**: Auditoría completa de dependencias del frontend (`npm audit`).
- **`npm-audit-frontend-prod.txt`**: Auditoría estricta de dependencias productivas del frontend (`npm audit --omit=dev`).
- **`npm-outdated-backend.txt`**: Relevamiento de versiones de dependencias desactualizadas en backend.
- **`npm-outdated-frontend.txt`**: Relevamiento de versiones de dependencias desactualizadas en frontend.

### Detección de Secretos y Credenciales en Git
- **`gitleaks-report.json`**: Escaneo de patrones de tokens y claves en el historial de Git mediante Gitleaks.
- **`trufflehog-report.json`**: Análisis de cadenas de alta entropía y secretos en el árbol de commits con TruffleHog.

### Análisis Estático de Código (SAST) y Calidad
- **`eslint-backend.txt`**: Ejecución de ESLint sobre el código fuente del backend.
- **`eslint-frontend.txt`**: Ejecución de ESLint sobre el código fuente del frontend.
- **`eslint-security-backend.txt`**: Análisis de patrones vulnerables en backend utilizando `eslint-plugin-security`.
- **`semgrep-report.json`**: Escaneo SAST con Semgrep aplicando reglas para JavaScript, Node.js, React y OWASP Top 10.

### Seguridad de Contenedores e Imágenes Docker
- **`trivy-backend-dockerfile.txt`**: Escaneo de buenas prácticas y directivas del `Dockerfile` de backend con Trivy.
- **`trivy-frontend-dockerfile.txt`**: Escaneo de buenas prácticas y directivas del `Dockerfile` de frontend con Trivy.
- **`trivy-image-frontend.txt`**: Escaneo de vulnerabilidades de sistema operativo (CVEs) en la imagen Docker del frontend.

### Análisis Dinámico de Seguridad Web (DAST)
- **`zap-report.json`**: Resultados estructurados del análisis dinámico de cabeceras HTTP y endpoints con OWASP ZAP.
