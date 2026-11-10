# Lista de Verificación Manual de Seguridad (Checklist del Administrador)

Esta guía contiene los pasos específicos, breves y ordenados que deben ejecutarse manualmente desde las consolas de administración y el entorno de despliegue para garantizar la seguridad operativa integral del sistema.

---

### Paso 1: Activar Autenticación de Dos Factores (2FA) en GitHub
1. Ingresá a tu cuenta de GitHub y hacé clic en tu avatar (arriba a la derecha) -> **Settings**.
2. En el menú lateral izquierdo, seleccioná **Password and authentication**.
3. En la sección **Two-factor authentication**, hacé clic en **Enable two-factor authentication**.
4. Escaneá el código QR con tu aplicación autenticadora TOTP (Google Authenticator, Bitwarden, etc.) o configurá una llave de seguridad FIDO2.
5. Descargá y guardá los códigos de recuperación (*recovery codes*) en un gestor seguro de contraseñas.

---

### Paso 2: Proteger la Rama `main` contra Modificaciones Directas
1. En el repositorio de GitHub, ingresá a la pestaña **Settings** -> **Branches**.
2. Hacé clic en **Add branch ruleset** (o **Add branch protection rule**).
3. En el nombre de la regla indicá `Proteger main` y en *Branch pattern* escribí `main`.
4. Activá las siguientes casillas obligatorias:
   - **Require a pull request before merging** (obliga a abrir PR y prohíbe `git push` directo a `main`).
   - **Require status checks to pass before merging** (buscá y seleccioná el workflow `CI` para que ningún PR se fusione si fallan tests, linters o escaneos de seguridad).
   - **Do not allow bypassing the above settings** (aplica la protección también a los administradores).
5. Guardá los cambios.

---

### Paso 3: Activar Secret Scanning y Push Protection en GitHub
1. En **Settings** del repositorio, navegá en el menú lateral hacia **Code security and analysis**.
2. En la sección **Secret scanning**, hacé clic en **Enable**.
3. Activá también la opción **Push protection**:
   - Esta función interceptará y bloqueará de forma inmediata cualquier `git push` que contenga accidentalmente credenciales conocidas (API keys de Clerk, tokens de AWS, claves privadas).

---

### Paso 4: Definir la Visibilidad del Repositorio o Saneamiento de Historial
1. Leé la guía técnica [`docs/LIMPIEZA_HISTORIAL.md`](./LIMPIEZA_HISTORIAL.md).
2. **Opción recomendada (Camino A):**
   - Dirigite a **Settings** -> **General** -> bloque inferior **Danger Zone**.
   - En **Change repository visibility**, seleccioná **Make private**.
   - Los secretos históricos quedan inmediatamente ocultos del público y el CI continúa funcionando al 100%.
3. **Opción alternativa (Camino B):** Si el repositorio debe ser público, coordiná una ventana de mantenimiento y ejecutá `git-filter-repo` para purgar de raíz `database.sqlite` y cadenas sensibles, seguido de un push forzado coordinado.

---

### Paso 5: Rotar Claves en Clerk y Generar un Nuevo `JWT_SECRET`
1. Ingresá al panel de administración de Clerk (`https://dashboard.clerk.com`).
2. Seleccioná tu aplicación y dirigite a **API Keys**.
3. Generá una nueva clave secreta (`CLERK_SECRET_KEY`) y revocá la clave anterior.
4. Generá un nuevo secreto criptográfico de 48 bytes hexadecimales para la firma de JWTs locales ejecutando en tu terminal:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
5. Actualizá el archivo `.env.production` del servidor con los nuevos valores.

---

### Paso 6: Aislar y Diferenciar Credenciales de Producción y Desarrollo
1. Verificá que las variables en `.env.production` (`POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`, `CLERK_SECRET_KEY`) sean únicas y totalmente distintas de los entornos locales (`.env`, `backend/.env`).
2. Asegurate de que `.env.production` permanezca estrictamente ignorado por git:
   ```bash
   git check-ignore .env.production
   ```
3. No compartas nunca el archivo `.env.production` por canales no seguros (correo, chat, capturas de pantalla).

---

### Paso 7: Programar y Probar la Restauración de Copias de Seguridad (Backups)
1. En el host donde corre Docker, programá un cron job que ejecute diariamente el script de respaldo:
   ```bash
   crontab -e
   # Ejemplo: backup diario a las 03:00 AM
   0 3 * * * /ruta/al/proyecto/scripts/backup-db.sh >> /var/log/backup-reservas.log 2>&1
   ```
2. Realizá un simulacro de recuperación en un entorno controlado para validar la integridad del volcado:
   ```bash
   ./scripts/restore-db.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz
   ```
3. Comprobá que la aplicación inicie y que los registros históricos y reservas se visualicen correctamente tras la restauración.

---

### Paso 8: Habilitar Cifrado HTTPS/TLS para el Despliegue en Internet
1. Para publicar el sistema en producción real, colocá un terminador TLS delante de Nginx (por ejemplo, Certbot de Let's Encrypt o Cloudflare SSL/TLS).
2. Forzá la redirección permanente de HTTP (puerto 80) a HTTPS (puerto 443).
3. Habilitá la cabecera `Strict-Transport-Security` (HSTS) en el proxy frontal:
   ```nginx
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
   ```
4. Verificá la configuración del certificado y el score A+ en herramientas de análisis como SSL Labs.
