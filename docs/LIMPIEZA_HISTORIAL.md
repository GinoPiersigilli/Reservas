# Guía de Gestión y Saneamiento del Historial Git

> **NOTA IMPORTANTE:** Este documento contiene instrucciones y procedimientos de referencia técnica. **Ninguno de los pasos aquí descritos ha sido ejecutado**, en estricto cumplimiento de las políticas del proyecto de no reescribir el historial de git ni alterar ramas de forma destructiva durante las etapas de desarrollo.

---

## 1. Inventario de Datos Sensibles en el Historial Público Actual

A partir de las auditorías automatizadas con Gitleaks, Trufflehog y la inspección manual del historial de commits, se identificaron los siguientes elementos presentes en commits históricos:

| Elemento / Archivo | Commit de Introducción | Descripción del Contenido | Recomendación de Mitigación |
|---|---|---|---|
| `backend/database.sqlite` | `4935a92a` (permaneció por 11 commits hasta `c8e094c6`) | Archivo binario de base de datos SQLite con usuarios de prueba, direcciones de correo electrónico y hashes bcrypt de contraseñas de testing. | No reutilizar ninguna de las contraseñas utilizadas en la etapa inicial de testing. |
| `JWT_SECRET` por defecto | `20077a02` (`src/services/auth.services.js`) | Cadena estática hardcodeada (`mi_clave_secreta_super_segura_dds_2026`) utilizada como valor fallback en Fase 1. | Generar una clave criptográfica de 48 bytes hexadecimales nueva con `node crypto` para producción y nunca utilizar el valor de prueba. |
| Rutas personales de disco | `32838b48` (`capturar-pantallas.mjs`) | Rutas locales absolutas de Windows (`<ruta-local>/...`) saneadas posteriormente en commit `0b1c7ac2`. | Informativo / Privacidad: no compromete credenciales de autenticación. |
| Clave de Clerk (`sk_test_...`) | `f07ef073` (`docs/CONTEXTO_PROYECTO.md`) | Placeholder de documentación con puntos suspensivos (`CLERK_SECRET_KEY=sk_test_...`). | Rotar las API Keys en el dashboard de Clerk previo al lanzamiento productivo. |

---

## 2. Camino A: Convertir el Repositorio a Privado (Recomendado)

La alternativa más rápida, segura y no disruptiva para ocultar los datos del historial público consiste en modificar la visibilidad del repositorio en GitHub.

### 2.1. Pasos en GitHub
1. Ingresar a la página principal del repositorio en GitHub (`https://github.com/GinoPiersigilli/Reservas`).
2. Dirigirse a la pestaña superior **Settings**.
3. En la sección **General**, desplazarse hasta el bloque inferior **Danger Zone**.
4. En la opción **Change repository visibility**, hacer clic en **Change visibility** y seleccionar **Make private**.
5. Escribir el nombre del repositorio para confirmar la acción y aceptar.

### 2.2. Impacto y Consideraciones
- **Disponibilidad de herramientas nativas de GitHub:** En cuentas personales de GitHub Free, las funcionalidades avanzadas de *CodeQL code scanning alerts* y *Secret scanning alerts* pueden quedar restringidas a repositorios públicos o requerir planes de pago (GitHub Team / Enterprise).
- **Herramientas de CI en Actions:** El flujo de integración continua configurado en `.github/workflows/ci.yml` (**Gitleaks, Semgrep, Trivy y npm audit**) continúa funcionando **100% activo, gratuito y operativo**, utilizando los minutos estándar de GitHub Actions disponibles para repositorios privados.
- **Historial intacto:** No se alteran los hashes de commit ni se requiere coordinación traumática de ramas con otros desarrolladores.

---

## 3. Camino B: Limpieza Permanente del Historial con `git-filter-repo`

Si el proyecto debe permanecer estrictamente público y se requiere eliminar por completo los objetos binarios y las cadenas del historial, debe utilizarse la herramienta oficial `git-filter-repo`.

### 3.1. Requisitos Previos y Respaldo
1. Instalar `git-filter-repo` (requiere Python 3):
   ```bash
   pip install git-filter-repo
   ```
2. Crear un clon espejo de respaldo completo antes de cualquier operación destructiva:
   ```bash
   git clone --mirror https://github.com/GinoPiersigilli/Reservas.git reservas-backup.git
   ```

### 3.2. Procedimiento de Purga
1. Clonar una copia limpia y dedicada para la operación:
   ```bash
   git clone https://github.com/GinoPiersigilli/Reservas.git reservas-limpieza
   cd reservas-limpieza
   ```
2. Eliminar de forma retroactiva el archivo binario `backend/database.sqlite` de todos los commits:
   ```bash
   git filter-repo --path backend/database.sqlite --invert-paths
   ```
3. Reemplazar cadenas de texto sensibles históricas creando un archivo `expresiones.txt`:
   ```text
   mi_clave_secreta_super_segura_dds_2026==>[REDACTED_HISTORICAL_SECRET]
   ```
   Y aplicar el reemplazo sobre todo el historial:
   ```bash
   git filter-repo --replace-text expresiones.txt
   ```
4. Limpiar referencias residuales de git y forzar recolección de basura:
   ```bash
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```
5. Re-vincular el origen remoto:
   ```bash
   git remote add origin https://github.com/GinoPiersigilli/Reservas.git
   ```
6. **Push forzado destructivo:**
   ```bash
   git push origin --force --all
   git push origin --force --tags
   ```

### 3.3. Impacto Operativo y Comunicación a Colaboradores
- **Incompatibilidad de clones existentes:** Cada commit reescrito recibirá un nuevo identificador SHA-1. Todos los *forks*, ramas locales y Pull Requests abiertos quedarán divergentes.
- **Protocolo de aviso:**
  1. Notificar a todo el equipo la ventana de mantenimiento y prohibir nuevos commits.
  2. Verificar que todos los cambios en curso hayan sido integrados o guardados localmente mediante parches (`git format-patch`).
  3. Tras el push forzado, solicitar a todos los colaboradores borrar sus clones locales y clonar nuevamente el repositorio desde cero:
     ```bash
     rm -rf Reservas
     git clone https://github.com/GinoPiersigilli/Reservas.git
     ```
