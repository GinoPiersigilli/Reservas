# Propuesta de diseño — Sistema de Reservas de Aulas

Resultado del paso 3b-1, hecho sobre el código real del repositorio (`main`, tras el merge de la Fase 5). Complementa a `DISENO_UX_UI.md` (el brief). Si algo no te convence, cambialo acá **antes** de ejecutar los prompts 3b-2 a 3b-4.

---

## 1. Estado actual (auditoría)

| Hallazgo | Evidencia |
|---|---|
| Ya hubo un rediseño "SaaS" hecho por IA, y conserva el aspecto genérico | Inter + gris `#f9fafb` + azul `#2563eb` de Tailwind, sombras `md`/`lg` en hover, animaciones `fadeIn` y `slideInUp`, página 404 con degradado (según su propio documento) |
| **179 estilos en línea** (`style={{`) en 14 archivos | Resumen 36, FormularioReserva 36, DetalleReserva 25, Login 24, FiltrosReservas 14, Register 14, Reservas 9… Chocan con la CSP de la Fase 6 y con el sistema de tokens |
| Fuente cargada desde Google Fonts con `@import` | `index.css` línea 11. Sale del origen propio: incompatible con una CSP estricta |
| Emojis y símbolos como íconos | 📚 (login y registro), 📋, 📊, 🛠️, 🔍, y ✓ ✗ ✎ ✕ en botones; flechas `→` `←` en enlaces y botones |
| **No hay estructura de aplicación**: cada pantalla arma su propia cabecera con botones sueltos | `App.jsx` no tiene layout compartido; "Volver" y "Cerrar sesión" repetidos en cada página |
| El endpoint de disponibilidad **existe pero no se usa** | `getDisponibilidadAula` está en `aula.service.js` y ninguna pantalla lo llama; el formulario usa `<input type="date">` y dos `<input type="time">` a ciegas |
| El título de la lista es "Mis reservas" aun para el administrador, que ve todas | `Reservas.jsx` |
| `index.html` con `lang="en"` y título "frontend" | Afecta lectores de pantalla y la pestaña del navegador |
| Restos: 4 documentos del rediseño anterior (~60 KB) en `frontend/`, `App.css` de la plantilla de Vite, imágenes de plantilla, servicio duplicado | `COMPARATIVA_VISUAL.md`, `GUIA_CLASES_CSS.md`, `MEJORAS_VISUALES.md`, `README_TRANSFORMACION.md`. Además **afirman cosas que ya no son ciertas** (por ejemplo, que los estilos en línea fueron migrados) |
| Tests de frontend: 4 archivos (Login, Registro, Reservas, Formulario), ~400 líneas | Los rompe cualquier cambio de textos o estructura |
| nginx sin Content-Security-Policy | `frontend/nginx.conf` |

### Los 6 problemas de usabilidad más importantes
1. **Reservar a ciegas.** El usuario elige fecha y horas sin ver qué está ocupado; el error aparece recién al enviar. Es el problema principal.
2. **Sin navegación.** No hay un lugar fijo desde donde ir a "Reservas", "Nueva reserva" o "Panel"; todo depende de botones en cada pantalla.
3. **El administrador no tiene un flujo de trabajo.** Aprobar o rechazar está mezclado con el resto de las acciones en la tabla general; no hay una cola de pendientes.
4. **Acciones destructivas sin confirmación clara** (cancelar, rechazar) y con símbolos como único indicio (✕, ✗).
5. **Estados poco diseñados**: carga, vacío y error con emojis o texto suelto.
6. **Textos inconsistentes**: "Ver →", "← Volver" / "← Volver a mis reservas", "Filtros" con lupa, títulos con emoji.

---

## 2. Concepto

Una herramienta de trabajo institucional: **sobria, densa y legible**, que se parece a un sistema de gestión bien hecho y no a una plantilla. Todo el riesgo visual se concentra en un solo elemento, la **grilla de disponibilidad**; el resto es silencioso.

## 3. Sistema visual

### Color (contrastes calculados, todos cumplen AA)
| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--fondo` | `#F5F6F8` | Fondo de página | texto sobre fondo: 14,5:1 |
| `--superficie` | `#FFFFFF` | Paneles, tablas | texto sobre superficie: 15,7:1 |
| `--tinta` | `#1B2430` | Texto principal | |
| `--tinta-2` | `#566273` | Texto secundario | 6,2:1 sobre blanco |
| `--acento` | `#1F4E8C` | Acciones, enlaces, foco | 8,3:1 con texto blanco |
| `--acento-hover` | `#173C6B` | Estado hover | |
| `--borde` | `#D5DAE1` | Divisiones | |
| `--borde-control` | `#8A94A3` | Contorno de inputs | 3,1:1 (mínimo de componentes UI) |
| `--peligro` | `#A4262C` | Cancelar, rechazar | 7,3:1 con texto blanco |

Estados (siempre **texto + ícono + color**, nunca solo color):
| Estado | Texto | Fondo | Contraste |
|---|---|---|---|
| Pendiente | `#7A4300` | `#FBF0D9` | 7,1:1 |
| Aprobada | `#1D5E36` | `#E3F1E8` | 6,7:1 |
| Rechazada | `#8F1F24` | `#F8E3E3` | 7,2:1 |
| Cancelada | `#454F5E` | `#E6E9ED` | 6,8:1 |

Si la facultad tiene colores institucionales, sustituí `--acento` y `--acento-hover`; el resto no cambia.

### Tipografía (autoalojada con `@fontsource`, sin Google Fonts)
- **Source Serif 4** (600) para títulos de página y el título del login. Es lo que da tono formal y distingue de la interfaz típica.
- **Public Sans** (400, 500, 600) para todo lo demás. Números de horas en `tabular-nums`.
- Escala: 13 / 14 / 16 / 20 / 28 px. Cuerpo 14 px en tablas y 16 px en formularios. Líneas de texto de hasta 70 caracteres.

### Forma, profundidad y movimiento
- Radio 4 px en controles y 6 px en paneles. Nada de pastillas redondeadas, salvo el indicador de estado.
- **Sin sombras.** La jerarquía sale de bordes de 1 px y espaciado (múltiplos de 4 px).
- Íconos: `lucide-react`, trazo de 1,75 px, 16 px en botones. Sin emojis ni flechas de texto.
- Movimiento: ninguno decorativo. Transiciones de 120–160 ms solo como respuesta a una acción. Se respeta `prefers-reduced-motion`. Se eliminan `fadeIn` y `slideInUp`.

---

## 4. Estructura de la aplicación

Se crea un **layout compartido** (`AppShell`) para todas las pantallas autenticadas. Hoy las rutas están sueltas en `App.jsx`.

```
Escritorio                                    Móvil (< 768 px)
┌───────────┬──────────────────────────┐     ┌──────────────────────────┐
│ Reservas  │ Título de la página      │     │ ☰  Reservas de aulas     │
│ de aulas  │ ──────────────────────── │     ├──────────────────────────┤
│           │                          │     │ Título de la página      │
│ Reservas  │ (contenido)              │     │ (contenido)              │
│ Nueva res.│                          │     │                          │
│ Panel *   │                          │     └──────────────────────────┘
│           │                          │     El menú abre un panel con los
│ ───────── │                          │     mismos destinos y la sesión.
│ D. Pérez  │                          │
│ Usuario   │                          │     * solo administrador
│ Cerrar    │                          │
│ sesión    │                          │
└───────────┴──────────────────────────┘
```
Destinos: **Reservas** (el usuario ve las suyas; el administrador, todas), **Nueva reserva**, **Panel** (solo administrador). El botón "Volver" de cada pantalla desaparece, salvo en el detalle, donde se reemplaza por una ruta de migas simple ("Reservas / #25").

## 5. Pantallas

### Login
```
┌──────────────────────────────────────────┐
│                                          │
│         Reservas de aulas                │  ← serif
│         Ingrese con su cuenta            │
│                                          │
│   Correo electrónico                     │
│   [______________________________]       │
│   Contraseña                             │
│   [______________________________]       │
│   [ Ingresar ]                           │
│   ──────────  o  ──────────              │
│   [ Continuar con Clerk / Google ]       │
│   ¿No tiene cuenta? Crear cuenta         │
└──────────────────────────────────────────┘
```
Un panel centrado de 400 px sobre el fondo gris. Sin logo emoji, sin ilustraciones. Los componentes de Clerk se ajustan con su propiedad `appearance` para usar los mismos colores y la misma fuente. Los datos de las cuentas de prueba salen de la pantalla (ya están en el README).

### Reservas (lista)
```
Reservas                                               [ Nueva reserva ]
Filtros: Estado [Todos v]  Fecha [__/__/____]  Aula [Todas v]  Buscar [____]
┌────┬─────────┬────────────┬─────────────┬─────────────────┬───────────┬────────┐
│ #  │ Aula    │ Fecha      │ Horario     │ Motivo          │ Estado    │        │
├────┼─────────┼────────────┼─────────────┼─────────────────┼───────────┼────────┤
│ 25 │ Aula 101│ 12/11/2026 │ 10:00–12:00 │ Parcial Física  │ ◔ Pendiente│ Ver    │
│ 24 │ Lab. 3  │ 12/11/2026 │ 14:00–16:00 │ Cátedra         │ ✓ Aprobada │ Ver    │
└────┴─────────┴────────────┴─────────────┴─────────────────┴───────────┴────────┘
Mostrando 1–10 de 25                                 [Anterior] 1 2 3 [Siguiente]
```
Los filtros están siempre a la vista, en una sola fila, sin el botón "🔍 Filtros". Para el administrador se agrega la columna "Solicitante". La acción por fila es solo "Ver"; las acciones de gestión viven en el detalle y, para pendientes, en el Panel.

### Nueva reserva (flujo principal, 3 pasos en una sola pantalla)
```
Nueva reserva
① Fecha y aula    ② Franja horaria    ③ Datos y confirmación

Fecha [12/11/2026]        Cantidad de personas [__]

            08  09  10  11  12  13  14  15  16  17  18 …
Aula 101    ·   ·  [▒▒ Parcial ▒▒]  ·   ·  [███ Cátedra ██] ·
Aula 102    [███ Álgebra ███]  ·   ·   ·   ·   ·   ·   ·
Lab. 3      ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·
                         ▲ ahora (solo si la fecha es hoy)

Seleccionado: Aula 102 · 10:00 a 12:00 (2 h)       Motivo [____________]
[ Reservar aula ]  [ Cancelar ]
```
Es la pantalla central; el detalle de la grilla está en la sección 6. El paso ③ muestra un resumen antes de enviar. Se mantienen los campos de hora escritos como alternativa para quien use solo teclado o prefiera tipearlos.

### Detalle de reserva
Ruta de migas arriba. Una lista de datos (etiqueta a la izquierda, valor a la derecha) en un solo panel, el estado con su indicador, y debajo el historial como tabla cronológica (fecha, acción, usuario). Las acciones (editar, aprobar, rechazar, cancelar) en una barra al pie del panel, con diálogo de confirmación para las destructivas.

### Panel de administrador
```
Panel
Pendientes de aprobación (3)
┌────┬──────────┬────────────┬─────────────┬────────────────┬──────────────────┐
│ #  │ Aula     │ Fecha      │ Horario     │ Solicitante    │                  │
│ 25 │ Aula 101 │ 12/11/2026 │ 10:00–12:00 │ D. Pérez       │ [Aprobar][Rechazar]│
└────┴──────────┴────────────┴─────────────┴────────────────┴──────────────────┘
Hoy, 07/11/2026
 10:00–12:00  Aula 101  Parcial de Física           Aprobada
 14:00–16:00  Lab. 3    Cátedra                      Aprobada
Totales por estado          Aulas más reservadas
 Pendientes 3  Aprobadas 12  Aula 101   9
 Rechazadas 2  Canceladas 4  Lab. 3     6
```
Sin tarjetas de métricas con números gigantes. La cola de pendientes va primero porque es la tarea principal; los totales son una línea de datos compacta.

### Estado vacío, carga y error (para todas las tablas)
- Carga: esqueleto con la forma de la tabla, no un spinner a pantalla completa.
- Vacío: "No hay reservas para los filtros elegidos. Limpie los filtros o cree una reserva." con una acción.
- Error: "No se pudieron cargar las reservas. Revise la conexión e intente de nuevo." con botón "Reintentar".

### 404
Mismo layout, un título, una frase y un enlace a "Reservas". Sin degradado.

---

## 6. Grilla de disponibilidad (el elemento distintivo)

- Filas: aulas activas. Columnas: horas de **08:00 a 22:00**, que es la franja que ya valida el backend (`WORK_HOUR_START`/`WORK_HOUR_END`). Se define en un único archivo de configuración del frontend.
- Datos: para el día elegido se piden las franjas de cada aula con `GET /api/aulas/:id/disponibilidad?fecha=`, en paralelo. Con 5 aulas son 5 pedidos livianos. No hace falta cambiar la API.
- **Codificación del estado sin depender del color:** aprobada = bloque macizo; pendiente = bloque con **rayado diagonal**. Ambos con el rango horario escrito. Las franjas ocupadas no son seleccionables.
- Selección: clic en el inicio y clic en el fin, en pasos de 30 minutos, dentro de una misma aula. La selección se muestra con el color de acento y el resumen aparece debajo.
- Accesibilidad: cada celda libre es un `<button>` con etiqueta ("Aula 101, 10:00, libre"); se navega con flechas y se confirma con Enter. Los campos de hora escritos siguen disponibles y quedan sincronizados con la selección.
- Móvil: la grilla pasa a una lista vertical por aula con sus franjas libres como botones.
- Línea de "ahora" solo si la fecha elegida es hoy.
- Las horas pasadas del día actual se muestran deshabilitadas.

El servidor sigue siendo quien decide: si hay un choque, la restricción de la base de datos lo rechaza y el mensaje del servidor se muestra en el formulario.

---

## 7. Autocrítica contra el brief

Revisé esta propuesta contra la lista de "se ve hecho por IA" de `DISENO_UX_UI.md` y el estado actual:
- **Azul + gris + sombras suaves** es justo lo que ya tiene el repo y lo que genera casi cualquier plantilla. Se cambia por bordes en vez de sombras, serif en los títulos y una paleta con tintas azuladas; **la identidad real la da la grilla**, no la paleta.
- **Tarjetas de métricas** del panel actual: eliminadas, reemplazadas por la cola de pendientes y datos compactos.
- **Badge redondeado de color**: se mantiene solo como indicador de estado y siempre con ícono y texto.
- **Íconos**: de emojis a una sola familia de líneas.
- **Recorte deliberado:** no agrego modo oscuro, ni gráficos, ni animaciones. Si más adelante hace falta modo oscuro, los tokens ya lo permiten.

## 8. Limpieza que incluye el rediseño
Borrar `COMPARATIVA_VISUAL.md`, `GUIA_CLASES_CSS.md`, `MEJORAS_VISUALES.md`, `README_TRANSFORMACION.md`, `src/App.css`, y las imágenes de plantilla que ya no se usen (`hero.png`, `react.svg`, `vite.svg`); eliminar `aulas.service.js` (solo re-exporta a `aula.service.js`); `index.html` con `lang="es"` y título "Reservas de aulas".

## 9. Textos clave
| Hoy | Propuesta |
|---|---|
| `Mis reservas` (también para admin) | `Reservas` (admin) / `Mis reservas` (usuario) |
| `🛠️ Panel de administración` | `Panel` |
| `🔍 Filtros` (botón) | Filtros siempre visibles |
| `Ver →` | `Ver` |
| `← Volver a mis reservas` | Ruta de migas: `Reservas / #25` |
| `✓ Aprobar` `✗ Rechazar` `✕ Cancelar` | `Aprobar` `Rechazar` `Cancelar reserva`, con ícono de línea |
| `Error al cargar las aulas` | `No se pudieron cargar las aulas. Intente de nuevo.` |
| Crear | `Reservar aula` |

Fechas `dd/mm/aaaa`, hora de 24 h, tono neutro formal ("Ingrese", "Elija"). Todos los textos en un solo archivo (`src/textos.js`).

## 10. Decisiones abiertas (para que decidas vos)
1. **Clerk y la CSP.** Los componentes de Clerk cargan recursos de los dominios de Clerk y aplican estilos propios. Una CSP estricta (Fase 6) tiene que permitir esos dominios y, según la documentación de Clerk, posiblemente estilos en línea para esos componentes. No se puede prometer "cero recursos externos" mientras se use Clerk; se documenta el permiso exacto y su riesgo. La alternativa es dejar solo el login local (menos funcional).
2. **Resolución de la grilla:** 30 minutos. Si preferís 15 o 60, cambia una constante.
3. **Endpoint único de disponibilidad.** Con más aulas convendría un `GET /api/disponibilidad?fecha=` que devuelva todo junto. No se incluye ahora para no tocar la API.
4. **Motivo del rechazo** (opcional, requiere una columna nueva y una migración): quedó fuera de este rediseño.
