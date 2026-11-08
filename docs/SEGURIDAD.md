# Seguridad y Content-Security-Policy (CSP)

Este documento registra las decisiones de seguridad del Sistema de Reservas de Aulas, con foco en la política `Content-Security-Policy` (CSP) configurada en `frontend/nginx.conf`, la inventario de recursos propios frente a terceros y los riesgos residuales asociados a la integración con **Clerk**.

---

## 1. Higiene del código propio (Frontend)

Durante las fases **3b-2**, **3b-3** y **3b-4** se eliminaron todas las dependencias externas no esenciales y las construcciones incompatibles con una CSP estricta dentro del código propio de la aplicación:

1. **Cero estilos en línea (`style=`)**: los 179 bloques `style={{ ... }}` heredados fueron migrados íntegramente a CSS Modules (`*.module.css`) respaldados por variables en `frontend/src/styles/tokens.css`.
2. **Cero scripts en línea**: `frontend/index.html` carga únicamente el módulo de entrada `/src/main.jsx` empaquetado por Vite.
3. **Tipografías autoalojadas (`'self'`)**: se eliminó el `@import` de Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`). Las fuentes **Source Serif 4** (`600`) y **Public Sans** (`400`, `500`, `600`) en subconjunto `latin` se sirven desde el propio origen mediante `@fontsource`.
4. **Íconos e imágenes locales**: los íconos provienen de `lucide-react` compilados como SVG dentro del bundle JS (`'self'`), sin CDN externos.

---

## 2. Excepción documentada: Clerk Authentication (`@clerk/clerk-react`)

El único proveedor externo que carga recursos en el navegador es **Clerk** (utilizado para SSO en `/login` y `/register`). De acuerdo con la documentación oficial de Clerk sobre Content-Security-Policy, su SDK en el navegador requiere los siguientes dominios y directivas:

| Directiva | Valores requeridos por Clerk | Motivo técnico |
|---|---|---|
| `script-src` | `'self'`, `https://*.clerk.accounts.dev`, `https://*.clerk.com`, `https://challenges.cloudflare.com`, `https://*.protect.clerk.com` | Carga del script de Frontend API (FAPI) de Clerk, widgets de autenticación y desafíos antibot de Cloudflare Turnstile / Clerk Protect. |
| `connect-src` | `'self'`, `https://*.clerk.accounts.dev`, `https://*.clerk.com`, `https://clerk-telemetry.com`, `https://*.protect.clerk.com:*` | Peticiones XHR/Fetch hacia la API de sesiones de Clerk y servicios de prevención de fraude (que pueden operar en puertos distintos de `443`, por lo que Clerk exige el comodín de puerto `:*`). |
| `style-src` | `'self'`, `'unsafe-inline'` | Los componentes preconstruidos de Clerk (`<SignIn />`, `<SignUp />`) inyectan etiquetas `<style>` dinámicas en tiempo de ejecución (CSS-in-JS). En una SPA estática servida por Nginx sin generación de `nonce` por request en SSR, Clerk requiere `'unsafe-inline'` en `style-src`. |
| `img-src` | `'self'`, `data:`, `https://img.clerk.com` | Avatares de perfil de usuario y logotipos de proveedores OAuth alojados en el CDN de imágenes de Clerk. |
| `font-src` | `'self'` | Las fuentes de la aplicación se sirven íntegramente desde el mismo origen (`@fontsource`). |
| `worker-src` | `'self'`, `blob:` | Web Workers instanciados por el SDK de Clerk mediante esquemas `blob:`. |
| `frame-src` | `'self'`, `https://challenges.cloudflare.com`, `https://*.clerk.accounts.dev`, `https://*.protect.clerk.com` | Iframes de verificación antibot (Cloudflare Turnstile) y flujos OAuth embebidos de Clerk. |
| `object-src` | `'none'` | Bloqueo total de plugins heredados (`<object>`, `<embed>`, `<applet>`). |
| `base-uri` / `form-action` / `frame-ancestors` | `'self'` | Prevención de inyección de `<base>`, secuestro de envío de formularios y *clickjacking*. |

---

## 3. Política configurada en `frontend/nginx.conf`

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com; connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com https://*.protect.clerk.com:*; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://img.clerk.com; font-src 'self'; worker-src 'self' blob:; frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.protect.clerk.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';" always;
```

> **Nota para paso a producción con dominio propio:** cuando se configure un dominio personalizado de Clerk en producción (por ejemplo `https://clerk.tudominio.edu.ar`), se recomienda reemplazar el comodín de desarrollo `https://*.clerk.accounts.dev` por el hostname exacto de la instancia productiva.

---

## 4. Análisis de riesgo residual por directiva

1. **`style-src 'self' 'unsafe-inline'`**:
   - **Riesgo residual:** si existiera una vulnerabilidad de inyección HTML (HTML injection), un atacante podría inyectar estilos CSS arbitrarios (por ejemplo, para alterar visualmente la interfaz o intentar exfiltración limitada por selectores CSS), aunque **no permite ejecutar JavaScript** porque `script-src` no incluye `'unsafe-inline'` ni `'unsafe-eval'`.
   - **Mitigación:** el código propio de React escapa por defecto todas las expresiones JSX, no se utiliza `dangerouslySetInnerHTML` en ningún componente del proyecto, y `connect-src` e `img-src` están restringidos a orígenes conocidos, bloqueando canales de exfiltración CSS hacia servidores arbitrarios.
2. **Comodines de subdominio en `script-src` y `connect-src` (`https://*.clerk.accounts.dev`, `https://*.clerk.com`, `https://*.protect.clerk.com:*`)**:
   - **Riesgo residual:** en entornos de desarrollo (`*.clerk.accounts.dev`), cualquier instancia alojada bajo ese dominio compartido de Clerk está cubierta por el comodín.
   - **Mitigación:** en despliegues productivos debe restringirse al subdominio FAPI específico de la institución (`https://clerk.<dominio-institucional>`) y mantener `script-src` sin `'unsafe-inline'`.
3. **`worker-src 'self' blob:`**:
   - **Riesgo residual:** permite instanciar Web Workers a partir de URLs `blob:` creadas por scripts ya autorizados en `script-src`.
   - **Mitigación:** dado que `script-src` bloquea scripts en línea y `eval`, un atacante no puede crear un `Blob` ejecutable sin haber comprometido previamente un script de `'self'` o de Clerk.
4. **`img-src 'self' data: https://img.clerk.com`**:
   - **Riesgo residual:** permite cargar imágenes en formato `data:` e imágenes desde `img.clerk.com`.
   - **Mitigación:** las imágenes no tienen capacidad de ejecución de scripts y no se permiten orígenes arbitrarios (`*`) que faciliten *tracking pixels* externos.

---

## 5. Privacidad y protección de datos del solicitante (Fase 3b-6)

Para proteger la privacidad de los usuarios del sistema y evitar la filtración accidental de datos personales sensibles o credenciales:

1. **Exposición exclusiva a administradores:**
   - El nombre y correo electrónico del solicitante (`usuario: { id, nombre, email }`) solo se incluyen en las respuestas de la API (`/api/reservas`, `/api/reservas/:id`, `/api/reservas/resumen`) si quien efectúa la consulta posee el rol de administrador (`rol === 'admin'`).
   - Los usuarios comunes solo consultan sus propias reservas y no reciben el objeto `usuario` en las respuestas.

2. **Proyección estricta de atributos de Usuario:**
   - Dado que el modelo `Usuario` en Sequelize no oculta por defecto el campo `passwordHash`, queda terminantemente prohibido realizar `include` de `Usuario` sin una lista explícita y restringida de atributos: `attributes: ['id', 'nombre', 'email']`.
   - Tests automatizados en backend (`backend/tests/reservas.test.js`) validan continuamente que ninguna respuesta de `/api/reservas`, `/api/reservas/:id` ni `/api/reservas/resumen` contenga las cadenas `passwordHash` o `password`.

3. **Inmunidad en endpoints de disponibilidad:**
   - El endpoint de consulta de ocupación de aulas (`GET /api/aulas/:id/disponibilidad`) permanece estrictamente técnico y público para usuarios autenticados: solo devuelve `horaInicio`, `horaFin` y `estado`, sin incluir jamás nombres, correos ni identificadores de solicitantes.

4. **Tratamiento en interfaz de usuario (Frontend):**
   - En la tabla de reservas, el panel administrativo y la vista de detalle, el correo electrónico del solicitante no se renderiza en texto plano en la pantalla, sino únicamente como tooltip accesible en el atributo HTML `title` del nombre, reduciendo la exposición visual innecesaria de datos de contacto.

---

## 6. Evaluación de CSP tras la migración a Google OAuth directo (Fase 3b-7)

En la Fase 3b-7 se reemplazaron los componentes embebidos de Clerk (`<SignIn />` y `<SignUp />`) en `/login` y `/register` por botones nativos de la aplicación ("Continuar con Google" y "Registrarse con Google") que disparan directamente el flujo OAuth mediante `signIn.authenticateWithRedirect` y `signUp.authenticateWithRedirect` con callback en `/sso-callback`.

### 6.1. Impacto en el DOM y estilos de la aplicación
- **Limpieza del DOM:** los formularios de login y registro se renderizan 100% con componentes propios estilizados mediante CSS Modules (`*.module.css`) y tokens semánticos (`tokens.css`). Ya no se inyecta en el DOM el árbol CSS-in-JS que Clerk construía para sus formularios embebidos.
- **Sin estilos inline propios:** ni `Login.jsx` ni `Register.jsx` contienen atributos `style=`.

### 6.2. Directivas de Clerk que continúan siendo estrictamente necesarias
Aunque no se utilicen `<SignIn />` ni `<SignUp />`, la aplicación inicializa `<ClerkProvider>` en la raíz (`main.jsx`) para gestionar la sesión, el token JWT y el intercambio OAuth en `/sso-callback` (`<AuthenticateWithRedirectCallback />`). Por ende, el navegador carga el bundle core de Clerk (`@clerk/clerk-react`) que requiere:

| Directiva | Requerida | Justificación técnica |
|---|---|---|
| `script-src` | **Sí** | `https://*.clerk.accounts.dev`, `https://*.clerk.com`, `https://challenges.cloudflare.com`, `https://*.protect.clerk.com`. Carga del script FAPI de Clerk y de Cloudflare Turnstile para protección antibot en la inicialización del cliente. |
| `connect-src` | **Sí** | `https://*.clerk.accounts.dev`, `https://*.clerk.com`, `https://clerk-telemetry.com`, `https://*.protect.clerk.com:*`. Peticiones a la API de autenticación para obtener claves públicas de verificación, telemetría y sincronización de sesión. |
| `worker-src` | **Sí** | `blob:`. El SDK de Clerk inicializa web workers internos mediante URLs `blob:` para tareas en segundo plano. |
| `frame-src` | **Sí** | `https://challenges.cloudflare.com`, `https://*.clerk.accounts.dev`, `https://*.protect.clerk.com`. Verificaciones de seguridad invisibles de Cloudflare Turnstile e iframes de ayuda para redirecciones de autenticación cruzada. |
| `img-src` | **Sí** | `https://img.clerk.com`. Necesario si en fases posteriores se exhiben avatares sincronizados desde la cuenta de Google u otros assets alojados en el CDN de Clerk. |

### 6.3. ¿Se puede remover `style-src 'unsafe-inline'` sin romper el login?
- **Diagnóstico:** **NO.**
- **Motivo técnico:** Aunque la pantalla de `/login` ya no renderice `<SignIn />`, el SDK cliente de Clerk (`@clerk/clerk-react` / `@clerk/shared`) inyecta dinámicamente elementos `<style>` en el `<head>` del documento durante el ciclo de vida del cliente. Esto ocurre para:
  1. Contenedores y badges de Cloudflare Turnstile / Clerk Protect.
  2. Overlays y modales de fallback que Clerk activa en caso de requerir verificación adicional (por ejemplo, paso intermedio de autenticación multifactor o resolución de cuentas vinculadas).
  3. Estados de error globales o toasts inyectados por el runtime de Clerk.
- Si se elimina `'unsafe-inline'` de `style-src`, el navegador genera violaciones de CSP (`Refused to apply inline style because it violates the following Content Security Policy directive...`) y los componentes de soporte/seguridad de Clerk fallan en inicializarse o rompen visualmente los flujos de redirección.
- Al tratarse de una SPA servida como archivos estáticos a través de Nginx (sin un servidor Node SSR que pueda inyectar un `nonce` criptográfico único por cada petición HTTP), la directiva `'unsafe-inline'` en `style-src` sigue siendo **indispensable** mientras `@clerk/clerk-react` forme parte del frontend.

### 6.4. Política en `frontend/nginx.conf`
En cumplimiento estricto con las especificaciones del requerimiento, **`frontend/nginx.conf` NO fue modificado**. La configuración actual permanece intacta y garantiza total compatibilidad y operatividad del login con Google OAuth y Clerk.


