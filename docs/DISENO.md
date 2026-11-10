# Decisiones de Diseño UI/UX — Sistema de Reservas de Aulas

Este documento sintetiza la arquitectura visual y las decisiones de diseño del sistema, concebido como una herramienta de trabajo institucional: sobria, densa, predecible y accesible.

---

## 1. Principios de Diseño
- **Institucional y funcional:** Tipografía formal y jerarquía visual estricta mediante bordes y espaciados, evitando degradados, sombras flotantes o elementos decorativos genéricos.
- **Riesgo visual concentrado:** Toda la complejidad interactiva se focaliza en la **grilla de disponibilidad horaria**; el resto de la interfaz permanece silencioso.
- **Sin dependencias externas:** Fuentes e íconos autoalojados en el origen propio (`'self'`), alineados con la Content-Security-Policy (CSP) estricta.

---

## 2. Tipografía y Jerarquía
- **Títulos:** *Source Serif 4* (`@fontsource/source-serif-4`), aporta distinción institucional y sobriedad.
- **Interfaz y texto:** *Public Sans* (`@fontsource/public-sans`), tipografía de alta legibilidad diseñada para entornos de gestión pública y académica.
- **Números tabulares:** `font-variant-numeric: tabular-nums` en horas, fechas y tablas para evitar saltos de alineación.
- **Escala tipográfica fija:** 13px (`--texto-xs`), 14px (`--texto-sm`), 16px (`--texto-md`), 20px (`--texto-lg`) y 28px (`--texto-xl`), con ancho máximo de lectura de 70 caracteres.

---

## 3. Sistema de Tokens CSS (`tokens.css`)
Centraliza colores, forma, espaciado y transiciones sin librerías invasivas:
- **Espaciado y forma:** Escala métrica en múltiplos de 4px (`--espacio-1` a `--espacio-12`). Radios contenidos: 4px en controles interactivos (`--radio-control`) y 6px en paneles (`--radio-panel`).
- **Estados semánticos:** Siempre combinan **color + texto + ícono** (`lucide-react`, 16px/20px, trazo 1.75px), nunca únicamente color.
  - Pendiente: ámbar (`--estado-pendiente-fondo`, `--estado-pendiente-texto` y rayado diagonal `--patron-pendiente`).
  - Aprobada: verde macizo (`--estado-aprobada-fondo`, `--estado-aprobada-texto`).
  - Rechazada: rojo (`--estado-rechazada-fondo`, `--estado-rechazada-texto`).
  - Cancelada: gris neutro (`--estado-cancelada-fondo`, `--estado-cancelada-texto`).
- **Movimiento:** Limitado a transiciones funcionales de 120–150ms en foco y hover; respeta `prefers-reduced-motion`.

---

## 4. Grilla de Disponibilidad Horaria
Resuelve el problema central de "reservar a ciegas":
- **Matriz temporal:** Filas para cada aula y columnas en bloques de 30 minutos (08:00 a 22:00) correspondientes a la fecha seleccionada.
- **Interacción y accesibilidad:**
  - Celdas libres interactivas con cálculo dinámico de franjas horarias al hacer clic.
  - Bloques ocupados no interactivos que indican la reserva aprobada o pendiente existente.
  - Navegación completa por teclado con tabulación lógica y atributos `aria-label` descriptivos (*"Aula 101, 10:00 a 10:30, libre"*).
  - Indicador visual de la hora actual en tiempo real (`--linea-ahora`).

---

## 5. Accesibilidad y Contrastes Verificados (WCAG 2.1 AA)
- **Ratios verificados:** Todo par de texto contra fondo supera 4.5:1 (e.g. texto principal sobre superficie: 15.7:1; texto secundario: 6.2:1). Contornos de controles superan 3.0:1 (3.1:1).
- **Verificación automatizada:** Script `frontend/scripts/verificar-contraste.js` y tests en Vitest (`vitest-axe`) auditan contractualmente los tokens y la ausencia de violaciones de accesibilidad en cada vista.

---

## 6. Modo Oscuro (Fase 7)
- **Paleta oscura accesible:** Redefinición integral en `:root[data-theme="dark"]` (`--fondo #0F141A`, `--superficie #171E27`, `--tinta #E7ECF2`, `--borde-control #6B7A8E`). Todos los contrastes cumplen WCAG 2.1 AA (e.g. texto sobre fondo 15.6:1, bordes de control 3.8:1).
- **Sin estilos ni scripts en línea (CSP estricta):** Script estático `/tema-init.js` en el `<head>` servido desde `'self'` para evitar parpadeos (FOUC).
- **Preferencia y persistencia:** Conmutador accesible en `AppShell` (`Sun`/`Moon` con `aria-pressed`), sincronizado con `prefers-color-scheme` y persistido en `localStorage` mediante el hook `useTema`.
