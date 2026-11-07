# Fase 6 — Auditoría y endurecimiento de seguridad (final)
**Cuándo:** después de terminar y mergear las fases 1 a 5. **Rama:** `mejora/fase-6-seguridad-final`.
**Modo sugerido:** Planning. Son 4 prompts; pegalos de a uno.

## Qué esperar (importante)
Ningún sistema puede garantizar "cero vulnerabilidades", y menos uno escrito por IA y revisado por la misma IA. Lo que sí se puede lograr:
- que no quede ninguna vulnerabilidad **conocida y detectable** con las herramientas estándar;
- que cada hallazgo tenga evidencia (comando + resultado) y no solo la palabra del agente;
- que los riesgos que no se eliminan queden **documentados** en `docs/SEGURIDAD.md`.

**Revisión independiente:** el agente que escribió el código no debería ser el único que lo revisa. Al final de la 6c, pedile una revisión a otra herramienta/modelo o a un compañero o docente, pasándoles `docs/SEGURIDAD.md`.

## Lista de puntos a re-verificar (salen del código previo a las mejoras)
Estaban así antes de empezar; confirmá que quedaron resueltos o decidí conscientemente:
- Token JWT guardado en `localStorage` (un XSS permitiría robarlo).
- `jwt.verify` sin fijar algoritmos permitidos; secreto con valor por defecto en el código.
- `express.json()` sin límite de tamaño.
- `console.error(err.stack)` volcando trazas completas.
- Dependencias con rangos `^` y sin escaneo.
- Verificación del token de Clerk sin validar firma.
- Reservas e historial visibles para cualquier usuario autenticado.

---

## 6a — Auditoría automatizada
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 6a — auditoría automatizada. NO corrijas nada todavía: solo medí y reportá. Ejecutá cada herramienta, guardá la salida cruda en `docs/seguridad/evidencia/` y generá `docs/SEGURIDAD.md` con una tabla de hallazgos (id, severidad crítica/alta/media/baja, dónde, evidencia, estado).

1. Dependencias: `npm audit` en backend y frontend (y `npm audit --omit=dev`). Listá también paquetes desactualizados (`npm outdated`) y los que ya no se mantienen.
2. Secretos: escaneá el código Y TODO EL HISTORIAL de git con gitleaks (o trufflehog) buscando claves de Clerk, JWT_SECRET, contraseñas, URLs con credenciales y archivos sensibles (.env, *.sqlite, *.dump). Si no podés instalarlo, dame el comando exacto para que lo corra yo.
3. SAST: semgrep con los rulesets `p/javascript`, `p/nodejs`, `p/react`, `p/owasp-top-ten`, y eslint con `eslint-plugin-security`.
4. Contenedores (si existen los Dockerfile de la Fase 5): escaneo de imágenes con trivy y del compose con una revisión de puertos expuestos, usuario no root y secretos en variables.
5. Inventario: listá todas las rutas del backend con método, middleware de auth, roles permitidos y validación aplicada. Marcá las que no tengan auth, o con auth pero sin chequeo de propiedad.

Entregable: `docs/SEGURIDAD.md` con los hallazgos y la evidencia. Detenete y esperá mi OK.
```

## 6b — Revisión manual del código y correcciones
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 6b — revisión manual + correcciones, usando docs/SEGURIDAD.md. Revisá el código archivo por archivo contra cada categoría y, por cada una, escribí en SEGURIDAD.md "revisado / hallazgo / no aplica" con el archivo y la línea. Corregí los hallazgos de severidad crítica, alta y media, un commit por hallazgo con el id en el mensaje, y un test que reproduzca el problema (debe fallar antes y pasar después).

Autenticación y sesión
- Contraseñas: bcrypt con costo >= 12, política mínima de contraseña, sin devolver nunca passwordHash en ninguna respuesta (revisá toJSON/attributes en TODAS las consultas).
- Login: mismo mensaje y tiempo de respuesta aproximado para usuario inexistente y contraseña incorrecta (sin enumeración), rate limit y bloqueo temporal por cuenta, no solo por IP.
- JWT: algoritmo fijado (`algorithms: ['HS256']`), issuer/audience, expiración corta, secreto aleatorio de al menos 32 bytes desde variable de entorno.
- Clerk: verificación de firma, expiración y `azp`; que el usuario local desactivado (activo=false) no pueda operar aunque su token sea válido; revisá que el rol NUNCA se tome del token ni del body sino de la base.
- Token en el navegador: evaluá localStorage vs cookie httpOnly+SameSite. Si se mantiene localStorage, exigí CSP estricta y cero uso de innerHTML/dangerouslySetInnerHTML, y documentá el riesgo residual. Si se cambia a cookies, agregá protección CSRF.
- Logout y manejo de 401 en el frontend (limpiar sesión, redirigir).

Autorización
- Matriz rol × endpoint completa y generada desde el inventario de 6a. IDOR: probar con el id de reservas de otro usuario en TODOS los endpoints con :id (ver, editar, cancelar, historial, aprobar, rechazar).
- Mass assignment: whitelist de campos aceptados en cada POST/PUT (nadie puede enviar rol, usuarioId, estado ni id en el body para otra cosa que lo permitido).
- Los chequeos de permisos viven en el servidor; el frontend solo oculta botones.

Entradas y salidas
- Validación con esquema (zod o joi) en TODAS las rutas: body, params y query, con tipos, rangos y largos.
- Límites: express.json({ limit: '10kb' }), límite en paginación, protección contra parameter pollution.
- Sin SQL crudo con interpolación (confirmalo por búsqueda). Cualquier `sequelize.query` debe usar parámetros.
- Errores: en producción nunca devolver ni loguear trazas con datos sensibles; respuesta genérica con id de correlación.
- XSS: escapado de todo texto de usuario (motivo, nombres) en el frontend; ninguna inserción de HTML crudo.

Configuración HTTP
- helmet con CSP definida (no la de defecto), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. CORS con lista exacta de orígenes, sin comodines. `trust proxy` bien configurado si hay proxy delante (si no, el rate limit ve la IP equivocada).
- Source maps desactivados en el build de producción. Confirmá que ninguna variable VITE_ contiene secretos (todo lo VITE_ es público; solo la publishable key de Clerk puede estar ahí).

Logs y auditoría
- Registrar intentos de login fallidos y acciones de admin (aprobar/rechazar/cancelar) con usuario, fecha e IP. Nunca registrar contraseñas, tokens ni el body completo.

Dependencias
- Actualizar lo vulnerable; fijar versiones exactas con package-lock y usar `npm ci` en CI y Docker. Quitar dependencias sin uso (por ejemplo, si quedó alguna de SQLite o Keycloak).

Al terminar: actualizá SEGURIDAD.md con el estado de cada hallazgo y detenete.
```

## 6c — Pruebas de ataque en local
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 6c — pruebas ofensivas SOLO contra mi entorno local o de test, nunca contra producción ni servicios de terceros. Levantá la app con una base de pruebas y:

1. Escaneo dinámico con OWASP ZAP (modo baseline, con docker) contra el backend y el frontend locales. Guardá el reporte en docs/seguridad/evidencia/.
2. Escribí una suite `backend/tests/seguridad.test.js` que automatice ataques reales y debe pasar completa:
   - token ausente, expirado, con firma inválida, con algoritmo "none", con rol modificado → 401/403;
   - usuario A sobre recursos de B en cada endpoint con :id → 403/404;
   - usuario común intentando acciones de admin;
   - mass assignment (enviar rol, usuarioId, estado, id);
   - payloads de inyección SQL y XSS en motivo, email, filtros y sortBy → sin error 500 y sin ejecución;
   - bodies gigantes y JSON malformado → 413/400 sin caída;
   - fuerza bruta de login → bloqueo/429;
   - condición de carrera: 20 reservas simultáneas al mismo horario → exactamente 1 creada;
   - ninguna respuesta contiene passwordHash, JWT_SECRET ni trazas de error.
3. Revisá la base: el usuario de la aplicación debe ser distinto del superusuario, con permisos solo de lectura/escritura sobre sus tablas (las migraciones usan otro usuario con más privilegios); el puerto 5432 no debe estar publicado en el compose de producción; conexión con SSL en producción.
4. Cerrá cada hallazgo de ZAP o de la suite con corrección y evidencia, y volvé a correr todo hasta que quede limpio.

Entregable: SEGURIDAD.md actualizado con el resultado de ZAP y de la suite. Detenete.
```

## 6d — Repositorio, secretos y cierre
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MEJORAS_ANTIGRAVITY.md` y `docs/PLAN_POSTGRESQL.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 6d — repositorio y cierre.

1. Historial de git: si gitleaks encontró secretos o archivos sensibles (database.sqlite, .env) en commits anteriores, NO reescribas el historial vos: explicame los pasos exactos con git filter-repo o BFG, qué implica para los demás colaboradores y qué secretos hay que ROTAR sí o sí (rotar es obligatorio aunque se limpie el historial, porque ya pudieron copiarse).
2. Agregá al CI: npm audit (falla con severidad alta o crítica), gitleaks, semgrep y trivy. Agregá `.github/dependabot.yml` para npm y Docker, y el workflow de CodeQL.
3. Creá `SECURITY.md` (cómo reportar una vulnerabilidad) y completá `docs/SEGURIDAD.md` con: resumen, tabla final de hallazgos con estado, evidencia, riesgos residuales aceptados con justificación, y lista de lo que NO se verificó.
4. Escribí `docs/CHECKLIST_MANUAL.md` con lo que tengo que hacer yo en GitHub y en los servicios externos (no lo podés hacer vos): activar 2FA en mi cuenta, proteger la rama main (PR obligatorio, CI verde, sin push directo), activar secret scanning y push protection, repo privado si corresponde, rotar claves de Clerk y JWT_SECRET, claves de producción distintas de las de desarrollo, y programar y probar la restauración de backups.
5. Verificá que `docs/SEGURIDAD.md` no contenga ningún secreto real.

Al terminar: resumen con hallazgos abiertos, severidad y qué falta de mi lado. Detenete.
```

## Cómo saber que terminó bien
- `SEGURIDAD.md` no tiene hallazgos críticos, altos ni medios abiertos.
- La suite `seguridad.test.js` pasa y corre en el CI.
- gitleaks sobre todo el historial sale limpio, o los secretos expuestos están rotados.
- Hiciste la revisión independiente y cargaste sus observaciones en el mismo archivo.
