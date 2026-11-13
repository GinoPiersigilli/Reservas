# Pruebas de carga (k6)

Miden latencia, throughput y tasa de errores de los dos caminos más usados de la
API: la consulta de disponibilidad (lectura) y la creación de reservas
(escritura con transacción y restricción de exclusión).

No se ejecutan en CI: requieren el binario de k6 y una base de datos con datos
reales, y sus números dependen del hardware. Se corren a mano cuando se cambia
algo que pueda afectar el rendimiento, y los resultados se anotan en
`docs/RENDIMIENTO.md`.

## Requisitos

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) instalado.
- La API corriendo contra una base de datos **de pruebas** (nunca producción),
  con migraciones y semillas aplicadas:

```bash
cd backend
npm run migrate && npm run seed
npm run dev
```

## Ejecución

```bash
# Escenario por defecto: 10 usuarios virtuales durante 30 segundos
k6 run carga/disponibilidad.js

# Parámetros opcionales
BASE_URL=http://localhost:3001/api VUS=25 DURACION=1m k6 run carga/disponibilidad.js
```

El script crea su propio usuario de prueba iniciando sesión con las
credenciales de las semillas y reserva franjas en fechas lejanas para no
interferir con los datos de demostración.

## Umbrales

La corrida falla si no se cumplen:

| Umbral                                    | Valor    | Motivo                               |
| ----------------------------------------- | -------- | ------------------------------------ |
| `http_req_failed`                         | < 1%     | Errores de transporte o 5xx          |
| `http_req_duration{tipo:lectura}` p(95)   | < 400 ms | Consulta de disponibilidad           |
| `http_req_duration{tipo:escritura}` p(95) | < 800 ms | Alta de reserva con transacción      |
| `checks`                                  | > 99%    | Respuestas con el contenido esperado |

Un 409/400 por franja ocupada **no** cuenta como error: es la respuesta correcta
cuando dos usuarios virtuales piden la misma franja.
