# Fase 3b — Rediseño UX/UI
**Estado:** el paso 3b-1 (auditoría y propuesta) **ya está hecho**: ver `docs/DISENO_PROPUESTA.md`. Empezás en 3b-2.
**Rama:** `mejora/fase-3b-ux-ui`. **Modo sugerido:** Planning. Pegá un prompt por vez.
**Cambios en la API:** ninguno. Solo se toca `frontend/` (más `docs/` y el `nginx.conf` si hace falta).

## Antes de empezar (lo hacés vos)
- Copiá al repo `docs/DISENO_UX_UI.md`, `docs/DISENO_PROPUESTA.md` y esta carpeta `docs/prompts/` (hoy te faltan `03b` y `06`).
- Leé `DISENO_PROPUESTA.md`, sobre todo la sección 10 (decisiones abiertas), y cambiá lo que no te guste.
- Sacá 3 o 4 capturas de las pantallas actuales, para comparar.
- Este repo es **público**: no subas capturas con datos reales ni claves.

---

## 3b-2 — Limpieza y fundaciones
```
Leé `docs/CONTEXTO_PROYECTO.md`, `docs/DISENO_UX_UI.md` y `docs/DISENO_PROPUESTA.md`, y respetá las reglas del workspace (`.agent/rules/reservas.md`).

Fase 3b-2 — limpieza y fundaciones. No rediseñes todavía las pantallas.

Limpieza (listá lo que vas a borrar y esperá mi OK antes de borrar):
1. Borrar los documentos del rediseño anterior: `frontend/COMPARATIVA_VISUAL.md`, `GUIA_CLASES_CSS.md`, `MEJORAS_VISUALES.md`, `README_TRANSFORMACION.md`, y `src/App.css`. Borrar `src/assets/hero.png`, `react.svg`, `vite.svg` y `public/icons.svg` solo si no se usan (verificalo con búsqueda).
2. Eliminar `src/services/aulas.service.js` (solo re-exporta `aula.service.js`) y actualizar los imports.
3. `index.html`: `lang="es"`, título "Reservas de aulas", meta description.

Fundaciones:
4. Quitá el `@import` de Google Fonts de `index.css`. Instalá `@fontsource/source-serif-4` (peso 600) y `@fontsource/public-sans` (400, 500, 600), solo subconjunto latino, importados desde `main.jsx`. `font-display: swap`.
5. Reemplazá `index.css` por `src/styles/tokens.css` (variables CSS con los valores EXACTOS de la sección 3 de DISENO_PROPUESTA.md: colores, estados, escala tipográfica, espaciado en múltiplos de 4, radios 4/6 px) y `src/styles/base.css` (reset, tipografía, foco visible de 2 px con `--acento`, `prefers-reduced-motion`). Los componentes usan CSS Modules (`*.module.css`, soportado por Vite sin dependencias). Prohibido escribir colores o tamaños sueltos fuera de `tokens.css`.
6. Eliminá las animaciones `fadeIn` y `slideInUp` y todas las sombras (`box-shadow`) decorativas. Dejá solo el anillo de foco.
7. Instalá `lucide-react`. Componentes base en `src/components/ui/`: Button (primario, secundario, peligro, deshabilitado, cargando), Field (etiqueta + control + ayuda + error asociados con aria), Input, Select, Textarea, Table (con estado vacío), EstadoBadge (texto + ícono + color; los 4 estados), ConfirmDialog (accesible: atrapa el foco, Escape cierra, devuelve el foco), Toast, TablaSkeleton, EmptyState, ErrorState (con "Reintentar").
8. Centralizá los textos de la interfaz en `src/textos.js` (sección 9 de la propuesta).
9. Página `/guia-estilos` (solo si `import.meta.env.DEV`) que muestre todos los componentes y estados.
10. Tests existentes: que sigan pasando (actualizá los que dependan de textos viejos). Agregá tests de render y accesibilidad básica de los componentes de `ui/`.

Reglas: sin `style=` en línea en los componentes nuevos, sin emojis, sin flechas de texto, transiciones solo de 120–160 ms y en respuesta a una acción.

Al terminar: resumen y detenete. Si podés abrir el navegador y sacar capturas, revisá `/guia-estilos`, criticá tu trabajo y corregí antes de entregar.
```

---

## 3b-3 — Estructura y pantallas
```
Leé `docs/DISENO_UX_UI.md` y `docs/DISENO_PROPUESTA.md`, y respetá las reglas del workspace. Usá solo los tokens y componentes de la 3b-2.

Fase 3b-3 — layout y pantallas, una por vez, un commit por pantalla. No cambies la API ni la lógica de negocio.

1. AppShell (sección 4 de la propuesta): barra lateral en escritorio y menú desplegable en móvil, con Reservas, Nueva reserva y Panel (solo admin), y al pie el nombre, el rol y "Cerrar sesión". Usalo como layout de las rutas protegidas en `App.jsx` (React Router `<Outlet>`). Quitá de cada página los botones "Volver" y "Cerrar sesión" repetidos. Rutas y permisos (`RutaProtegida`, `RutaSoloAdmin`) sin cambios.
2. Login y Registro: panel centrado de 400 px (sección 5). Formulario local con errores asociados a cada campo. Los componentes de Clerk (`SignIn`, `SignUp`) se estilizan con su propiedad `appearance` (variables de color y fuente de los tokens). Quitá el emoji del título.
3. Reservas (lista): título "Reservas" para admin y "Mis reservas" para usuario; filtros siempre visibles en una fila; tabla con orden y paginación, columna "Solicitante" solo para admin; esqueleto de carga, estado vacío y de error.
4. Nueva reserva / Editar reserva: el flujo de la sección 5 con la **grilla de disponibilidad** de la sección 6. Usá `getDisponibilidadAula` (ya existe en `aula.service.js`) para pedir las franjas de cada aula activa del día elegido, en paralelo (`Promise.all`); franjas de 08:00 a 22:00 definidas en un único archivo de configuración. Aprobada = bloque macizo, pendiente = rayado diagonal, ambos con el horario escrito; las franjas ocupadas no se pueden seleccionar; selección con dos clics en pasos de 30 min dentro de una misma aula; celdas como `<button>` con etiqueta accesible y navegación con flechas; en móvil, lista vertical por aula; línea de "ahora" solo si la fecha es hoy; horas pasadas deshabilitadas. Los campos de hora escritos siguen disponibles y sincronizados. Validá en el cliente formato, fecha no pasada y capacidad del aula, sabiendo que el servidor decide: mostrá en el formulario el mensaje del servidor si hay solapamiento. Antes de enviar, mostrá un resumen.
5. Detalle: ruta de migas, lista de datos, historial como tabla cronológica, barra de acciones con ConfirmDialog en cancelar y rechazar.
6. Panel (admin): primero la cola de pendientes con Aprobar y Rechazar en la fila (con confirmación), luego "Hoy", luego totales por estado y aulas más reservadas como datos compactos. Sin tarjetas de métricas con números grandes.
7. 404: mismo layout, una frase y un enlace.
8. Eliminá todos los `style={{` que queden (hoy son 179 en 14 archivos) y los emojis/símbolos de texto (✓ ✗ ✎ ✕ → ←). Verificá con `grep -rn "style={{" frontend/src` que no quede ninguno, salvo que sea imprescindible y esté justificado en un comentario.
9. Actualizá los tests (Login, Registro, Reservas, Formulario) y agregá: grilla con franja ocupada no seleccionable, error de solapamiento mostrado en el formulario, cola de pendientes del panel, y que un usuario común no vea el destino "Panel".

Al terminar cada pantalla: capturas (si tenés navegador) y autocrítica contra la lista "evitar" de `DISENO_UX_UI.md`. Al final: resumen y detenete.
```

---

## 3b-4 — Accesibilidad, responsive y verificación
```
Leé `docs/DISENO_UX_UI.md` y `docs/DISENO_PROPUESTA.md`, y respetá las reglas del workspace.

Fase 3b-4 — verificación y pulido. Corregí lo que encuentres, con evidencia.

1. Responsive: revisá todas las pantallas en 360, 768 y 1280 px. Sin desborde horizontal de la página; las tablas anchas hacen scroll dentro de su contenedor; objetivos táctiles de al menos 44 px en móvil.
2. Accesibilidad: recorré toda la app solo con teclado (orden lógico, foco siempre visible, diálogos que atrapan y devuelven el foco, Escape cierra, la grilla se maneja con flechas y Enter). Corré axe (`vitest-axe` o `@axe-core/playwright`) sobre cada pantalla y corregí todo lo serio o crítico. Verificá con un script el contraste de los pares de color de `tokens.css` contra la tabla de la sección 3 de la propuesta.
3. Estados: forzá fallas de red y verificá cargando, vacío y error en cada pantalla.
4. CSP y recursos externos: confirmá que no hay `style=` ni scripts en línea propios, ni fuentes, íconos o imágenes externas. **Excepción esperable: Clerk.** Leé la documentación de Clerk sobre Content-Security-Policy y listá exactamente qué dominios y qué directivas necesita (incluyendo si requiere estilos en línea). Redactá una CSP para `frontend/nginx.conf` que permita solo eso, y documentá en `docs/SEGURIDAD.md` (si ya existe, en una sección nueva) qué riesgo residual implica cada permiso. No la apliques en producción sin que yo lo apruebe: probala primero en local.
5. Rendimiento: tamaño del build antes y después, fuentes limitadas a lo necesario, sin dependencias de UI sin usar.
6. Quitá `/guia-estilos` del build de producción y todo CSS que ya no se use.
7. Capturas finales de cada pantalla (escritorio y móvil) con datos de prueba (`admin@utnfrc.edu.ar`, `david@utnfrc.edu.ar`), guardadas en `docs/img/` con nombres sin espacios. **Este repo es público:** que no aparezcan claves, tokens, la URL de la base ni datos reales.
8. Verificá que el `Dockerfile` del frontend sigue construyendo y que `docker compose -f docker-compose.prod.yml up --build` levanta con la interfaz nueva.
9. Actualizá `README.md` (estructura del frontend, capturas) y `docs/CONTEXTO_PROYECTO.md`.

Al terminar: resumen con lo corregido y lo pendiente, y detenete.
```

## Cómo saber que quedó bien
- Reservar un aula lleva 3 pasos y nunca se puede elegir una franja ocupada.
- Una persona ajena al proyecto no dice "se ve hecho por IA".
- Usable completa con teclado y en un celular; `grep -rn "style={{" frontend/src` no devuelve nada.
- Tests, lint y axe pasan; el CI queda en verde; el build de producción levanta.
