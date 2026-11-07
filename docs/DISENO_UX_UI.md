# Brief de diseño UX/UI — Sistema de Reservas de Aulas

Documento de dirección visual para el rediseño. Es una **propuesta**: lo que no te convenza, cambialo antes de ejecutar los prompts (`prompts/03b-rediseno-ux-ui.md`).

## 1. Producto y personas
- **Qué es:** herramienta institucional para reservar aulas de una facultad.
- **Quiénes la usan:** estudiantes y docentes (piden aulas, muchas veces desde el celular) y personal administrativo (aprueban o rechazan solicitudes, desde una computadora).
- **Tarea principal de cada uno:**
  - Usuario: ver qué aula está libre en una fecha y reservarla rápido, sin errores.
  - Administrador: procesar la cola de solicitudes pendientes de un vistazo.
- **Tono:** formal, claro, confiable. Parece una herramienta de trabajo de una institución, no una app de consumo ni una landing de startup.

## 2. Una sola cosa memorable
Gastamos el riesgo visual en un único lugar: la **grilla de disponibilidad del día**. Aulas en filas, horas en columnas, bloques ocupados dibujados sobre la línea de tiempo. Es lo que la hace distinta a cualquier otro sistema de reservas, y es lo que realmente ayuda a decidir. Todo lo demás es sobrio y silencioso.

```
            08   09   10   11   12   13   14   15   16
Aula 101    ·····[ Física II ]···········[ Reunión  ]··
Aula 102    [ Álgebra ][ Parcial  ]·····················
Lab. 3      ·····················[ Cátedra ]············
                         ▲ línea de "ahora"
```
(El resultado final lo decide el agente con la propuesta de 3b-1; esto es solo la idea.)

## 3. Sistema visual (propuesto)

**Color** (si la facultad tiene colores institucionales, usarlos como acento y reemplazar el azul):
| Rol | Valor propuesto |
|---|---|
| Fondo de página | `#F5F6F8` (gris frío muy claro) |
| Superficie (paneles) | `#FFFFFF` |
| Texto principal | `#1B2430` |
| Texto secundario | `#566273` |
| Acento institucional | `#1F4E8C` (azul profundo, sobrio) |
| Borde | `#D5DAE1` |

Estados, siempre con **texto o ícono además del color** (accesibilidad): pendiente = ámbar, aprobada = verde, rechazada = rojo, cancelada = gris. Todos con contraste AA.

**Tipografía:** dos familias claramente distintas, autoalojadas con `@fontsource` (nada de Google Fonts por CDN: se alinea con la CSP estricta de la Fase 6).
- Títulos: **Source Serif 4** (da el tono formal y se aleja del look por defecto).
- Interfaz y texto: **Public Sans** (diseñada para sitios institucionales, muy legible).
- Horas y números en tablas: `font-variant-numeric: tabular-nums`.
- Escala fija (por ejemplo 13 / 14 / 16 / 20 / 28 px), largo de línea máximo ~70 caracteres.

**Forma y profundidad:**
- Radio de borde pequeño y con jerarquía: 4 px en controles, 6 px en paneles. Nada de todo redondeado.
- Sin sombras decorativas: la estructura la dan bordes de 1 px y el espaciado.
- Espaciado en múltiplos de 4 px, grilla de 12 columnas en escritorio.

**Íconos:** una sola librería de líneas (`lucide-react`), tamaño y trazo consistentes. Cero emojis.

**Movimiento:** casi ninguno. Transiciones de 120–160 ms solo como respuesta a una acción (abrir un diálogo, confirmar). Respetar `prefers-reduced-motion`.

## 4. Lo que hace que se vea "hecho por IA" (evitar)
- Degradados violeta/azul, efecto vidrio (glassmorphism), fondos con manchas de color.
- Todo troceado en tarjetas idénticas, con el mismo radio grande y la misma sombra suave.
- Emojis como íconos, o saludos tipo "¡Bienvenido de nuevo! 👋".
- Títulos con una palabra resaltada en otro color; etiquetas en MAYÚSCULAS sobre cada título.
- Números grandes con subtítulo chico y degradé de acento para "estadísticas".
- Flechas "→" al final de cada botón; textos de relleno que venden en vez de explicar.
- Animaciones de entrada (subir y aparecer) en cada sección y hover elevado en cada tarjeta.
- Tablas reemplazadas por tarjetas cuando los datos son tabulares.

## 5. Estructura y UX
**Layout:** es una aplicación, no una página de marketing. Barra lateral (o barra superior en móvil) con 3 o 4 destinos, contenido denso y alineado a la izquierda. Las listas de reservas son **tablas** con orden y filtros, no tarjetas.

**Flujos clave:**
1. *Reservar:* elegir fecha → ver la grilla de disponibilidad (usa `GET /api/aulas/:id/disponibilidad` de la Fase 3) → elegir aula y franja libre → completar motivo y cantidad de personas → resumen y confirmación. Las franjas ocupadas no se pueden seleccionar. Máximo 3 pasos.
2. *Mis reservas:* tabla con estado, filtros por estado y fecha, acción de cancelar con confirmación.
3. *Administrador:* cola de pendientes arriba, con aprobar y rechazar en la misma fila; resumen del día; filtros por aula y fecha.
4. *Login:* una sola pantalla sobria, con ingreso local y con Clerk, sin ilustraciones.

**Estados que siempre se diseñan:** cargando (esqueleto de la tabla, no un spinner a pantalla completa), vacío (explica qué hacer), error (qué pasó y cómo resolverlo) y éxito.

**Redacción (español neutro formal):**
- Mayúscula solo al inicio de la oración. Verbos en infinitivo en botones: "Reservar aula", "Guardar cambios", "Cancelar reserva".
- Misma palabra para la misma acción en todo el flujo: si el botón dice "Reservar", la confirmación dice "Reserva creada".
- Errores sin disculpas ni vaguedad: "El aula 101 ya está reservada de 10:00 a 12:00. Elegí otra franja." (pasar a una forma neutra como "Elija otra franja" si se prefiere un tono más formal; decidir una vez y mantenerlo).
- Fechas `dd/mm/aaaa`, hora de 24 h, semana desde el lunes.

## 6. Calidad mínima (no negociable)
- Funciona en celular (diseño mobile-first) y en escritorio.
- Foco de teclado visible; toda la interfaz usable sin mouse.
- Contraste mínimo AA; el estado nunca se comunica solo con color.
- Etiquetas asociadas a cada campo; mensajes de error vinculados al campo.
- Sin estilos en línea propios (`style="..."`) ni scripts en línea. Excepción a documentar: los componentes de Clerk traen sus propios recursos y estilos (ver `DISENO_PROPUESTA.md`, sección 10).
- Sin cambios en la API: el rediseño es solo del frontend.

## 7. Extra opcional (requiere tocar la base)
"Motivo del rechazo": que el administrador explique por qué rechaza y el usuario lo vea. Implica una columna nueva y una migración; hacerlo solo si querés, en una fase aparte.
