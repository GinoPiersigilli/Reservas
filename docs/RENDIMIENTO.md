# Evidencia de Rendimiento de Base de Datos PostgreSQL — Reservas

Este documento presenta los resultados empíricos, la metodología de prueba, las métricas de `EXPLAIN (ANALYZE, BUFFERS)` y el análisis de impacto sobre un volumen de **200.000 reservas** en PostgreSQL 16.

---

## 1. Metodología y Entorno del Benchmark

### 1.1 Entorno de Ejecución

- **Motor de Base de Datos:** PostgreSQL 16.x (contenedor Docker `postgres:16-alpine`).
- **Base de Datos Exclusiva:** `reservas_bench` (aislada de desarrollo y producción).
- **Mecanismo de Seguridad:** El script de prueba (`backend/scripts/benchmark-db.js`) contiene una guarda obligatoria en tiempo de ejecución que aborta inmediatamente si el nombre de la base de datos no termina en `_bench`.
- **Aislamiento en CI:** Este benchmark de carga masiva **no se ejecuta en el pipeline de CI/CD** para evitar sobrecarga y demoras innecesarias.

### 1.2 Generación de Datos Verosímiles (200.000 registros)

El script generador pobló la base con:

- **50 Aulas** con capacidades realistas (entre 20 y 100 personas) y distribución en pabellones y pisos.
- **1.000 Usuarios** académicos con roles y credenciales.
- **200.000 Reservas** distribuidas cronológicamente a lo largo de 800 días (años 2024 a 2026):
  - 5 franjas no solapadas por día (`08:00–10:00`, `10:00–12:00`, `14:00–16:00`, `16:00–18:00`, `18:00–20:00`).
  - Distribución verosímil de estados: ~70% aprobadas, ~15% canceladas, ~10% rechazadas, ~5% pendientes.
  - Motivos y cantidad de personas congruentes con la capacidad de cada aula.
  - Cumplimiento de la restricción de exclusión GiST (`reservas_sin_solapamiento`).
- Se ejecutó `ANALYZE` sobre `reservas`, `aulas` y `usuarios` para actualizar las estadísticas completas del planificador de costos de PostgreSQL.

---

## 2. Resultados Empíricos — Comparativa de Consultas Críticas

Se evaluaron las 5 consultas críticas del sistema en dos estados:

1. **Línea Base:** Con los índices originales de la Fase 2 (`reservas_usuario_id_idx`, `reservas_fecha_idx`, `reservas_estado_idx` y la exclusión GiST `reservas_sin_solapamiento`).
2. **Con Optimización Justificada:** Incorporando el índice compuesto `reservas_aula_fecha_idx ON reservas ("aulaId", fecha)` en la migración `004-idempotencia.cjs`.

### Tabla Comparativa de Rendimiento (sobre 200.000 filas)

| Consulta Crítica                                                                          | Tiempo Línea Base | Tiempo Con Índice | Mejora / Impacto      | Buffers (Shared Hit / Read)                              |
| ----------------------------------------------------------------------------------------- | ----------------- | ----------------- | --------------------- | -------------------------------------------------------- |
| **1. Listado paginado de usuario** (`WHERE "usuarioId" = X ORDER BY fecha DESC LIMIT 10`) | 0.405 ms          | 0.415 ms          | Estable (~0.4 ms)     | 203 hit (Index Scan sobre `usuario_id_idx` + Top-N sort) |
| **2. Listado admin con filtros combinados** (`aulaId`, `estado`, rango de fechas)         | 0.317 ms          | 0.105 ms          | **+66.9% más rápido** | Reducción de 320 buffers a solo 5 buffers                |
| **3. Disponibilidad por aula y fecha** (`WHERE "aulaId" = X AND fecha = Y`)               | 0.244 ms          | 0.070 ms          | **+71.3% más rápido** | Reducción de 35 buffers a 3 buffers (Index Scan directo) |
| **4. Validación de solapamiento GiST** (`tsrange && tsrange`)                             | 0.050 ms          | 0.054 ms          | Ultrarrápida (~50 µs) | 4 buffers (Bitmap Index Scan sobre GiST)                 |
| **5. Resumen y métricas agregadas** (`GROUP BY estado` sobre 200k filas)                  | 34.589 ms         | 39.188 ms         | Estable (~35–39 ms)   | 3.095 buffers (Parallel Group Aggregate con 2 workers)   |

---

## 3. Justificación Técnica del Nuevo Índice

### Consulta de Disponibilidad (`GET /api/aulas/:id/disponibilidad?fecha=YYYY-MM-DD`):

- **Sin índice compuesto:** PostgreSQL ejecutaba un `Bitmap Heap Scan` combinando índices individuales, consumiendo 35 buffers de memoria y tardando 0.244 ms.
- **Con `reservas_aula_fecha_idx`:** El planificador pasa a un `Index Scan` directo de 3 bloques (`Buffers: shared hit=3`), bajando el tiempo de ejecución a **0.070 ms (70 microsegundos)**, una aceleración del **71.3%**.

### Consulta de Administración con Filtros (`GET /api/reservas?...`):

- El índice compuesto permite resolver conjuntamente el filtro de aula y la restricción temporal, reduciendo el costo de I/O en un **98.4% de buffers** (de 320 lecturas de bloque a 5 lecturas).

---

## 4. Eficiencia de la Restricción GiST de Exclusión Temporal

Uno de los hallazgos más destacados del benchmark es el rendimiento de la restricción de solapamiento:

```sql
ALTER TABLE reservas
ADD CONSTRAINT reservas_sin_solapamiento
EXCLUDE USING gist (
  "aulaId" WITH =,
  tsrange(("fecha" + "horaInicio"), ("fecha" + "horaFin"), '[)') WITH &&
) WHERE (estado IN ('pendiente', 'aprobada'));
```

A pesar del volumen de 200.000 filas, la verificación de solapamiento mediante el índice GiST con extensión `btree_gist` toma **0.050 ms (50 microsegundos)** y lee únicamente **4 buffers**. Esto garantiza que la serialización de reservas concurrentes opere a nivel de motor de datos con mínimo consumo de recursos y sin table scans.

---

## 5. Límites Reales del Benchmark

1. **Memoria Caché y Almacenamiento:** El benchmark se ejecutó en un entorno con disco de estado sólido (SSD) y memoria suficiente para alojar los buffers en caché (`shared hit`). En entornos con memoria restringida y lecturas desde disco frío, los beneficios de reducir de 320 buffers a 5 buffers serán aún más notorios.
2. **Conexiones Concurrentes:** El benchmark midió el costo y la velocidad de ejecución de consultas individuales de forma intensiva. Las pruebas de saturación de conexiones concurrentes (100 pedidos en simultáneo) se encuentran formalizadas en la suite `backend/tests/concurrencia.test.js`.
3. **Métricas Agregadas:** La consulta analítica de resumen (`GROUP BY estado`) recorre toda la tabla mediante workers paralelos (~35 ms). Para volúmenes superiores a 1.000.000 de filas en producción, se recomienda considerar una tabla de agregación o vistas materializadas refrescadas concurrentemente.

---

## 6. Procedimiento para Reproducir el Benchmark

Para reproducir estas mediciones en cualquier entorno con Docker y PostgreSQL:

1. **Crear la base de datos de benchmark:**

   ```bash
   docker exec reservas-db psql -U reservas_user -d reservas -c "CREATE DATABASE reservas_bench OWNER reservas_user;"
   ```

2. **Ejecutar el script de benchmark:**

   ```bash
   DATABASE_URL_BENCH="postgres://reservas_user:reservas_pass@localhost:5432/reservas_bench" node backend/scripts/benchmark-db.js
   ```

3. **Verificar la guarda de seguridad:**
   ```bash
   # Debe abortar de inmediato con código 1:
   DATABASE_URL_BENCH="postgres://reservas_user:reservas_pass@localhost:5432/reservas_produccion" node backend/scripts/benchmark-db.js
   ```

---

## Pruebas de carga de la API (k6)

El benchmark anterior mide el motor de base de datos con 200.000 filas. Para
medir la API completa bajo concurrencia —latencia, throughput y tasa de
errores— hay un escenario de k6 en `carga/disponibilidad.js`.

Umbrales, parámetros y forma de ejecución: [`carga/README.md`](../carga/README.md).

Tampoco se ejecuta en CI: necesita el binario de k6 y una base con datos
reales, y sus tiempos dependen del hardware, por lo que un umbral fijo en CI
produciría fallos que no indican una regresión. Los resultados de cada corrida
relevante se anotan en esta página.
