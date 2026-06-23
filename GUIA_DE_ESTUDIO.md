# Guía de Estudio — Parcial 2 DDS
## Sistema de Reservas de Aulas

---

## 1. Arquitectura y Seguridad (Keycloak)

### ¿Cómo se comunican React, Node.js y Keycloak?

Hay tres actores y cada uno tiene un rol claro:

```
React (Frontend)  ←→  Node.js (Backend)  ←→  Keycloak (Proveedor de identidad)
```

- **React** nunca valida tokens ni contraseñas. Solo redirige al usuario a Keycloak y usa el token que recibe para hacer requests al backend.
- **Node.js** no guarda contraseñas ni emite tokens propios. Confía en Keycloak: valida que el token que le llega fue firmado por Keycloak.
- **Keycloak** es el único que autentica usuarios. Guarda las credenciales, verifica las contraseñas y emite los tokens JWT.

---

### Flujo de inicio de sesión paso a paso

**¿Qué pasa cuando el usuario hace clic en "Iniciar sesión"?**

**Paso 1 — El frontend redirige a Keycloak**

En `AuthContext.jsx`, la función `iniciarLogin()` construye una URL y manda al usuario a Keycloak:

```js
const authUrl = `http://localhost:8081/realms/reservas-aulas/protocol/openid-connect/auth
  ?client_id=frontend
  &response_type=code       // pido un código, no un token directo
  &scope=openid profile email
  &redirect_uri=http://localhost:5173/callback`

window.location.href = authUrl;  // redirige el navegador
```

**Paso 2 — El usuario ingresa sus credenciales en Keycloak**

El usuario escribe usuario y contraseña **directamente en la pantalla de Keycloak**, no en tu app. Tu aplicación nunca ve la contraseña.

**Paso 3 — Keycloak redirige de vuelta con un código**

Si las credenciales son correctas, Keycloak redirige al frontend a:
```
http://localhost:5173/callback?code=abc123xyz...
```
Este `code` es temporal, se usa una sola vez y expira rápido.

> **¿Dónde está el PKCE?** En tu implementación actual no usás `code_challenge` explícito desde el frontend (lo haría una librería OIDC completa), pero el flujo base sigue siendo Authorization Code. Si el profesor pregunta por PKCE: es una extensión del flujo que agrega un `code_verifier` secreto que el frontend genera al inicio y el backend presenta al intercambiar el código, para evitar que alguien que intercepte el `code` pueda usarlo.

**Paso 4 — El componente `Callback.jsx` procesa el código**

```js
// Callback.jsx lee el código de la URL
const params = new URLSearchParams(window.location.search);
const code = params.get('code');

// Lo manda al BACKEND (no a Keycloak directamente)
procesarCallback(code);
```

**Paso 5 — El backend intercambia el código por un token**

En `auth.routes.js`, el endpoint `POST /api/auth/token` recibe el código y llama a Keycloak:

```js
// El backend hace este fetch a Keycloak
const body = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: 'frontend',
  code: code,          // el código que vino del frontend
  redirect_uri: 'http://localhost:5173/callback'
});

fetch('http://localhost:8081/realms/reservas-aulas/protocol/openid-connect/token', {
  method: 'POST',
  body
});
```

> **¿Por qué el backend y no el frontend directamente?** Porque el navegador bloquea ese request por CORS. Keycloak no permite que el frontend llame al token endpoint directamente desde el browser.

**Paso 6 — El frontend recibe el `access_token` y extrae los datos del usuario**

```js
// En procesarCallback() del AuthContext
const data = await response.json();  // data.access_token = el JWT

// Se decodifica el payload del JWT (la parte del medio en base64)
const payload = JSON.parse(atob(data.access_token.split('.')[1]));

const datosUsuario = {
  id: payload.sub,                    // identificador único del usuario en Keycloak
  nombre: payload.given_name,
  email: payload.email,
  rol: payload.realm_access?.roles?.includes('admin') ? 'admin' : 'usuario'
};
```

**Paso 7 — Se guarda el token y se redirige a `/reservas`**

```js
localStorage.setItem('token', data.access_token);
localStorage.setItem('usuario', JSON.stringify(datosUsuario));
setUsuario(datosUsuario);  // actualiza el Context de React
```

---

### ¿Cómo controla el backend que solo un admin pueda hacer algo?

Hay **dos capas de control** que trabajan en conjunto:

**Capa 1 — `verificarToken` (autenticación): ¿quién sos?**

```js
export const verificarToken = async (req, res, next) => {
  const token = req.get('authorization').substring(7); // saca el "Bearer "

  // Valida el token contra las claves públicas de Keycloak (JWKS)
  const { payload } = await jwtVerify(token, JWKS, { issuer });

  // Si es válido, carga los datos del usuario en req.usuario
  req.usuario = {
    id: payload.sub,
    rol: payload.realm_access?.roles?.includes('admin') ? 'admin' : 'usuario'
  };

  next(); // deja pasar al siguiente middleware
  // Si el token es inválido o falta → 401
};
```

**¿Qué es JWKS?** Son las claves públicas de Keycloak. El backend las descarga de:
`http://localhost:8081/realms/reservas-aulas/protocol/openid-connect/certs`

Con esas claves verifica que la firma del JWT sea legítima. No consulta la base de datos — todo es verificación criptográfica.

**Capa 2 — `soloAdmin` (autorización): ¿tenés permiso?**

```js
export const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin' });
  }
  next();
};
```

**En las rutas se encadenan así:**

```js
// Solo llega al controlador si el token es válido Y el rol es admin
router.patch('/:id/aprobar', verificarToken, soloAdmin, reservasController.aprobarReserva);
//                            ↑ autenticación  ↑ autorización
```

> **Diferencia clave 401 vs 403:**
> - `401` = no hay token o es inválido → "no sé quién sos"
> - `403` = hay token válido pero no tenés permiso → "sé quién sos pero no podés hacer esto"

---

## 2. Flujo End-to-End: Creación de una Reserva

### Paso a paso completo

**1. El usuario completa el formulario en `FormularioReserva.jsx`**

Selecciona aula, fecha, horario, cantidad de personas y motivo. El componente usa `useState` para guardar cada campo en el estado local.

**2. Hace clic en "Crear reserva" → `handleSubmit()`**

Primero se hacen validaciones visuales en el frontend (horaInicio < horaFin, horario laboral). Esto es para dar feedback rápido al usuario, **pero no reemplaza la validación del backend**.

**3. El frontend llama al servicio de Axios**

```js
// reservas.service.js
export const crearReserva = (datos) => api.post('/reservas', datos);
```

El interceptor de Axios automáticamente agrega el token:

```js
// axios.js — interceptor de request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

El request HTTP que sale es:
```
POST http://localhost:3001/api/reservas
Authorization: Bearer eyJhbGciOiJSUzI1...
Content-Type: application/json

{
  "aulaId": 1,
  "fecha": "2026-07-10",
  "horaInicio": "09:00",
  "horaFin": "11:00",
  "cantidadPersonas": 20,
  "motivo": "Clase de prueba"
}
```

**4. El backend recibe el request — pasa por los middlewares**

```
Request → verificarToken → validarCrearReserva → controlador → servicio → BD
```

- `verificarToken`: valida el JWT, carga `req.usuario`
- `validarCrearReserva`: verifica que vengan todos los campos obligatorios (aulaId, fecha, horaInicio, horaFin, cantidadPersonas, motivo). Si falta alguno → 400

**5. El controlador delega al servicio**

```js
export const crearReserva = async (req, res, next) => {
  try {
    const datosReserva = req.body;
    datosReserva.usuarioId = req.usuario.id;  // el id viene del token, no del body
    const nuevaReserva = await reservasService.crearNuevaReserva(datosReserva);
    res.status(201).json(nuevaReserva);
  } catch (error) {
    next(error);  // manda el error al middleware de errores
  }
};
```

**6. El servicio ejecuta todas las validaciones de negocio**

Ver sección 3 para el detalle completo.

**7. Si todo pasa → se persiste en SQLite y se registra en el historial**

```js
const nuevaReserva = await Reserva.create({ ...datos, estado: 'pendiente' });
await registrarAccion(nuevaReserva.id, usuarioId, 'creacion', null, { estado: 'pendiente' });
```

**8. El frontend recibe la respuesta**

- Si es `201` → navega al detalle de la reserva creada
- Si es `400` o `409` → muestra el mensaje de error cerca del formulario

---

## 3. Reglas de Negocio Clave

### Superposición de horarios

**¿Cómo se detecta?**

Se busca en la base de datos si ya existe alguna reserva que use el mismo aula, en la misma fecha, con estado `pendiente` o `aprobada`, y cuyo horario se solape con el pedido:

```js
const reservaExistente = await Reserva.findOne({
  where: {
    aulaId,
    fecha,
    estado: { [Op.in]: ['pendiente', 'aprobada'] },  // canceladas y rechazadas no cuentan
    [Op.and]: [
      { horaInicio: { [Op.lt]: horaFin } },   // la existente empieza ANTES de que termine la nueva
      { horaFin:    { [Op.gt]: horaInicio } }  // la existente termina DESPUÉS de que empiece la nueva
    ]
  }
});

if (reservaExistente) throw new Error('El aula ya está reservada en ese horario');
```

**¿Qué pasa en el límite exacto?**

Si una reserva termina a las `10:00` y la nueva empieza a las `10:00`:
- `horaInicio_existente (9:00) < horaFin_nueva (10:00)` → ✅ verdadero
- `horaFin_existente (10:00) > horaInicio_nueva (10:00)` → ❌ **falso** (es igual, no mayor)

Como la segunda condición es falsa, **no hay conflicto**. Es el comportamiento correcto según el enunciado.

**Al editar una reserva**, se agrega `id: { [Op.ne]: reservaId }` para excluir la propia reserva de la comparación.

---

### Capacidad del aula

```js
const aula = await Aula.findByPk(aulaId);

if (!aula) throw new Error('El aula solicitada no existe');         // 404
if (!aula.activa) throw new Error('El aula no está activa');        // 400
if (cantidadPersonas > aula.capacidad)
  throw new Error('La cantidad de personas supera la capacidad');   // 400
```

Primero verifica que el aula exista y esté activa, después verifica la capacidad. El orden importa para dar mensajes de error precisos.

---

### Manejo de Estados e Historial

**Flujo de estados válido:**

```
pendiente ──→ aprobada   (solo admin)
pendiente ──→ rechazada  (solo admin)
pendiente ──→ cancelada  (admin o propietario)
aprobada  ──→ cancelada  (admin o propietario)

cancelada  → ❌ no puede cambiar a ningún estado
rechazada  → ❌ no puede cambiar a ningún estado
```

**Implementación en el servicio:**

```js
// Ejemplo en aprobarReserva
if (reserva.estado !== 'pendiente') {
  throw new Error('Solo se pueden aprobar reservas pendientes');  // 400
}

reserva.estado = 'aprobada';
await reserva.save();

// Registro automático en el historial
await registrarAccion(
  reservaId,
  usuarioId,
  'aprobacion',
  { estado: 'pendiente' },  // valorAnterior
  { estado: 'aprobada' }    // valorNuevo
);
```

**¿Qué guarda el historial?**

Cada vez que se aprueba, rechaza, cancela o edita una reserva, se inserta un registro en `historial_reservas` con:
- `reservaId`: a qué reserva afecta
- `usuarioId`: quién hizo la acción
- `accion`: `'creacion'`, `'aprobacion'`, `'rechazo'`, `'cancelacion'`, `'edicion'`
- `fechaHora`: cuándo pasó (se pone `new Date()` automáticamente)
- `valorAnterior`: estado antes del cambio (puede ser null en creación)
- `valorNuevo`: estado después del cambio

---

### Validación de horario laboral

```js
const WORK_HOUR_START = '08:00';
const WORK_HOUR_END   = '22:00';

if (horaInicio < WORK_HOUR_START || horaFin > WORK_HOUR_END) {
  throw new Error(`Las reservas solo se permiten entre las 08:00 y las 22:00`);
}
```

Se valida **antes** de consultar la base de datos para cortar rápido. Los valores son configurables por variable de entorno.

---

## 4. Estado y Componentes en React

### ¿Cómo se comparten datos entre componentes?

El proyecto usa **dos mecanismos** según el tipo de dato:

**Context API → datos globales de sesión**

`AuthContext.jsx` guarda el usuario autenticado y lo hace disponible en toda la app:

```jsx
// Cualquier componente puede acceder al usuario así:
const { usuario, cerrarSesion } = useAuth();

// Ejemplo en Reservas.jsx
<p>Bienvenido, {usuario?.nombre} ({usuario?.rol})</p>
```

El contexto se inicializa leyendo `localStorage` para sobrevivir recargas de página.

**useState → datos locales del componente**

Para datos que solo usa un componente (formularios, listas cargadas de la API):

```jsx
// En FormularioReserva.jsx
const [form, setForm] = useState({ aulaId: '', fecha: '', horaInicio: '', ... });
const [error, setError] = useState(null);
const [cargando, setCargando] = useState(false);
```

**Props → pasar datos de padre a hijo**

Por ejemplo, `Reservas.jsx` le pasa la función `onAccion` a `TablaReservas` para que pueda recargar el listado después de una acción:

```jsx
<TablaReservas reservas={reservas} onAccion={cargarReservas} />
```

---

### ¿Cómo reacciona el frontend ante un error del backend?

Todos los errores de Axios se capturan en el `catch`:

```jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  setCargando(true);
  setError(null);

  try {
    await crearReserva(form);
    navigate('/reservas');
  } catch (err) {
    // err.response.data.error es el mensaje que mandó el backend
    setError(err.response?.data?.error || 'Error al guardar la reserva');
  } finally {
    setCargando(false);
  }
};

// En el JSX se muestra cerca del formulario
{error && <p style={{ color: 'red' }}>{error}</p>}
```

**Casos específicos:**
- `400` → muestra el mensaje de validación del backend ("El aula ya está reservada en ese horario")
- `401` → el interceptor podría redirigir al login (o se muestra el error)
- `403` → muestra "No tenés permiso para realizar esta acción"
- `404` → muestra "La reserva no existe"

---

## Resumen para el examen — Cheat sheet

| Pregunta | Respuesta rápida |
|---|---|
| ¿Quién autentica usuarios? | Keycloak |
| ¿Quién valida el token en cada request? | El middleware `verificarToken` usando JWKS |
| ¿Dónde están las reglas de negocio? | En `reservas.services.js`, no en el controlador |
| ¿Qué status devuelve un token inválido? | 401 |
| ¿Qué status devuelve falta de permisos? | 403 |
| ¿Qué reservas cuentan para superposición? | Solo `pendiente` y `aprobada` |
| ¿Dos reservas que se tocan en el límite chocan? | No |
| ¿Desde dónde se manda el token en cada request? | Interceptor de Axios, automáticamente |
| ¿Dónde se guarda el token en el frontend? | `localStorage` |
| ¿Cómo se comparte el usuario entre componentes? | Context API (`AuthContext`) |
| ¿Qué pasa cuando se aprueba una reserva? | Cambia estado + se registra en historial |
| ¿Puede una reserva cancelada volver a pendiente? | No |
| ¿Dónde se valida la capacidad? | En el servicio del backend |
| ¿Por qué el frontend no intercambia el código con Keycloak directamente? | CORS lo bloquea |
