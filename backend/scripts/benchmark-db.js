#!/usr/bin/env node
// backend/scripts/benchmark-db.js
/**
 * Benchmark de Rendimiento de Base de Datos PostgreSQL
 * Genera ~200.000 reservas con datos verosímiles en una base exclusiva (*_bench)
 * y ejecuta EXPLAIN (ANALYZE, BUFFERS) sobre las 5 consultas críticas del sistema.
 */

import { Sequelize } from 'sequelize';

const benchUrl =
  process.env.DATABASE_URL_BENCH ||
  process.env.DATABASE_URL ||
  'postgres://reservas_user:reservas_pass@localhost:5432/reservas_bench';

// =========================================================================
// 1. GUARDA DE SEGURIDAD ESTRICTA: El nombre de la base DEBE terminar en _bench
// =========================================================================
let dbName = '';
try {
  const parsed = new URL(benchUrl);
  dbName = parsed.pathname.replace(/^\//, '');
} catch {
  console.error('[BENCHMARK] Error: Formato de URL de base de datos inválido.');
  process.exit(1);
}

if (!dbName || !dbName.endsWith('_bench')) {
  console.error(
    '\x1b[31m%s\x1b[0m',
    '========================================================================='
  );
  console.error('\x1b[31m%s\x1b[0m', 'ERROR CRÍTICO DE SEGURIDAD: OPERACIÓN ABORTADA');
  console.error(
    '\x1b[31m%s\x1b[0m',
    `Este benchmark solo puede ejecutarse contra una base de datos cuyo nombre termine en "_bench".`
  );
  console.error('\x1b[31m%s\x1b[0m', `Base de datos detectada: "${dbName}"`);
  console.error('\x1b[31m%s\x1b[0m', 'Por favor configure DATABASE_URL_BENCH=.../nombre_bench');
  console.error(
    '\x1b[31m%s\x1b[0m',
    '========================================================================='
  );
  process.exit(1);
}

console.log(
  `\x1b[32m[SEGURIDAD OK]\x1b[0m Conectando a base de datos de benchmark segura: "${dbName}"`
);

const sequelize = new Sequelize(benchUrl, {
  dialect: 'postgres',
  logging: false,
  pool: { max: 20, min: 2, acquire: 60000, idle: 10000 }
});

// =========================================================================
// 2. MIGRACIONES Y ESTRUCTURA DE TABLAS
// =========================================================================
async function inicializarEsquema() {
  console.log('\n--- 1. Inicializando extensiones y tablas en base bench ---');
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist;');

  // Migración 001 y 002 (tablas base)
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      "passwordHash" VARCHAR(255),
      rol VARCHAR(50) NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'admin')),
      activo BOOLEAN NOT NULL DEFAULT true,
      "clerkId" VARCHAR(255) UNIQUE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS aulas (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      ubicacion VARCHAR(120),
      capacidad INTEGER NOT NULL CHECK (capacidad >= 1 AND capacidad <= 1000),
      recursos JSONB,
      activa BOOLEAN NOT NULL DEFAULT true
    );
    CREATE UNIQUE INDEX IF NOT EXISTS aulas_nombre_lower_idx ON aulas (LOWER(nombre));

    CREATE TABLE IF NOT EXISTS reservas (
      id SERIAL PRIMARY KEY,
      "aulaId" INTEGER NOT NULL REFERENCES aulas(id) ON DELETE RESTRICT,
      "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      fecha DATE NOT NULL,
      "horaInicio" TIME NOT NULL,
      "horaFin" TIME NOT NULL,
      "cantidadPersonas" INTEGER NOT NULL CHECK ("cantidadPersonas" > 0),
      motivo TEXT NOT NULL,
      estado VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'cancelada', 'rechazada')),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT reservas_horario_valido_check CHECK ("horaInicio" < "horaFin")
    );

    CREATE INDEX IF NOT EXISTS reservas_usuario_id_idx ON reservas ("usuarioId");
    CREATE INDEX IF NOT EXISTS reservas_fecha_idx ON reservas (fecha);
    CREATE INDEX IF NOT EXISTS reservas_estado_idx ON reservas (estado);

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reservas_sin_solapamiento'
      ) THEN
        ALTER TABLE reservas
        ADD CONSTRAINT reservas_sin_solapamiento
        EXCLUDE USING gist (
          "aulaId" WITH =,
          tsrange(("fecha" + "horaInicio"), ("fecha" + "horaFin"), '[)') WITH &&
        ) WHERE (estado IN ('pendiente', 'aprobada'));
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS historial_reservas (
      id SERIAL PRIMARY KEY,
      "reservaId" INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
      "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      accion VARCHAR(50) NOT NULL,
      "valorAnterior" JSONB,
      "valorNuevo" JSONB,
      "fechaHora" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id SERIAL PRIMARY KEY,
      "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      clave VARCHAR(255) NOT NULL,
      "cuerpoHash" VARCHAR(64) NOT NULL,
      "estadoRespuesta" INTEGER NOT NULL,
      "cuerpoRespuesta" JSONB NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_usuario_clave_idx ON idempotency_keys ("usuarioId", clave);
  `);

  console.log('Truncando datos previos en la base bench...');
  await sequelize.query(
    'TRUNCATE TABLE idempotency_keys, historial_reservas, reservas, aulas, usuarios RESTART IDENTITY CASCADE;'
  );
}

// =========================================================================
// 3. GENERACIÓN MASIVA DE 200.000 RESERVAS VEROSÍMILES
// =========================================================================
async function sembrarDatos() {
  console.log('\n--- 2. Sembrando entidades base (50 aulas, 1000 usuarios) ---');

  // 50 Aulas
  const aulasSql = [];
  for (let i = 1; i <= 50; i++) {
    const piso = Math.ceil(i / 10);
    const capacidad = 20 + (i % 8) * 10;
    aulasSql.push(
      `('Aula ${i}', 'Pabellón ${String.fromCharCode(65 + (i % 4))}, Piso ${piso}', ${capacidad}, '{"proyector":true,"wifi":true}'::jsonb, true)`
    );
  }
  await sequelize.query(
    `INSERT INTO aulas (nombre, ubicacion, capacidad, recursos, activa) VALUES ${aulasSql.join(',')};`
  );

  // 1000 Usuarios
  console.log('Insertando 1000 usuarios...');
  const usuariosSql = [];
  for (let i = 1; i <= 1000; i++) {
    usuariosSql.push(
      `('Docente ${i}', 'docente_${i}@utnfrc.edu.ar', '$2b$10$abcdefghijklmnopqrstuu', 'usuario', true)`
    );
  }
  await sequelize.query(
    `INSERT INTO usuarios (nombre, email, "passwordHash", rol, activo) VALUES ${usuariosSql.join(',')};`
  );

  console.log('\n--- 3. Generando 200.000 reservas verosímiles en lotes ---');
  const t0 = Date.now();

  const franjas = [
    { ini: '08:00:00', fin: '10:00:00' },
    { ini: '10:00:00', fin: '12:00:00' },
    { ini: '14:00:00', fin: '16:00:00' },
    { ini: '16:00:00', fin: '18:00:00' },
    { ini: '18:00:00', fin: '20:00:00' }
  ];

  const motivos = [
    'Clase Teórica de Álgebra',
    'Laboratorio de Sistemas Operativos',
    'Examen Parcial de Bases de Datos',
    'Clase de Consulta y Tutoría',
    'Defensa de Proyecto Integrador',
    'Seminario de Inteligencia Artificial',
    'Taller de Redes de Información'
  ];

  const estados = [
    'aprobada',
    'aprobada',
    'aprobada',
    'aprobada',
    'cancelada',
    'rechazada',
    'pendiente'
  ];

  // Fecha base: 2024-01-01 (800 días hacia adelante = hasta 2026-03-10)
  // 50 aulas * 800 días * 5 franjas = 200.000 reservas exactamente!
  const totalAulas = 50;
  const diasPorAula = 800;
  const BATCH_SIZE = 5000;
  let lote = [];
  let insertadas = 0;

  const fechaBase = new Date(Date.UTC(2024, 0, 1));

  for (let a = 1; a <= totalAulas; a++) {
    for (let d = 0; d < diasPorAula; d++) {
      const fechaObj = new Date(fechaBase.getTime() + d * 86400000);
      const yyyy = fechaObj.getUTCFullYear();
      const mm = String(fechaObj.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(fechaObj.getUTCDate()).padStart(2, '0');
      const fechaStr = `${yyyy}-${mm}-${dd}`;

      for (let f = 0; f < franjas.length; f++) {
        const franja = franjas[f];
        const usuarioId = ((a * 800 * 5 + d * 5 + f) % 1000) + 1;
        const motivo = motivos[(d + f) % motivos.length];
        const estado = estados[(d * 5 + f) % estados.length];
        const personas = 15 + ((d + a) % 25);

        lote.push(
          `(${a}, ${usuarioId}, '${fechaStr}', '${franja.ini}', '${franja.fin}', ${personas}, '${motivo}', '${estado}', NOW(), NOW())`
        );

        if (lote.length >= BATCH_SIZE) {
          await sequelize.query(`
            INSERT INTO reservas ("aulaId", "usuarioId", fecha, "horaInicio", "horaFin", "cantidadPersonas", motivo, estado, "createdAt", "updatedAt")
            VALUES ${lote.join(',')};
          `);
          insertadas += lote.length;
          process.stdout.write(
            `\rProgreso: ${insertadas.toLocaleString()} / 200,000 reservas insertadas...`
          );
          lote = [];
        }
      }
    }
  }

  if (lote.length > 0) {
    await sequelize.query(`
      INSERT INTO reservas ("aulaId", "usuarioId", fecha, "horaInicio", "horaFin", "cantidadPersonas", motivo, estado, "createdAt", "updatedAt")
      VALUES ${lote.join(',')};
    `);
    insertadas += lote.length;
  }

  const duracion = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\n\x1b[32m[ÉXITO]\x1b[0m ${insertadas.toLocaleString()} reservas insertadas en ${duracion}s.`
  );

  console.log('Ejecutando ANALYZE para actualizar estadísticas de PostgreSQL...');
  await sequelize.query('ANALYZE reservas; ANALYZE aulas; ANALYZE usuarios;');
}

// =========================================================================
// 4. EXPLAIN (ANALYZE, BUFFERS) DE LAS 5 CONSULTAS CRÍTICAS
// =========================================================================
async function ejecutarExplain(nombre, sql) {
  const [results] = await sequelize.query(
    `EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING, SUMMARY) ${sql}`
  );
  const lineas = results.map((r) => r['QUERY PLAN']);
  const planCompleto = lineas.join('\n');

  // Extraer Planning Time y Execution Time
  const execMatch = planCompleto.match(/Execution Time:\s*([0-9.]+)\s*ms/);
  const planMatch = planCompleto.match(/Planning Time:\s*([0-9.]+)\s*ms/);
  const buffersMatch = planCompleto.match(/Buffers:\s*([^)]+)/);

  const execTime = execMatch ? parseFloat(execMatch[1]) : null;
  const planTime = planMatch ? parseFloat(planMatch[1]) : null;
  const buffers = buffersMatch ? buffersMatch[1].trim() : 'N/A';

  return {
    nombre,
    sql: sql.trim(),
    execTime,
    planTime,
    buffers,
    lineasPlan: lineas.slice(0, 4).join(' | ')
  };
}

async function correrBenchmarks(etiqueta = 'Línea Base (Esquema Original)') {
  console.log(`\n=============================================================`);
  console.log(`  EJECUTANDO BENCHMARKS: ${etiqueta}`);
  console.log(`=============================================================`);

  const resultados = [];

  // Consulta 1: Listado paginado de un usuario
  const q1 = `
    SELECT r.id, r."aulaId", r.fecha, r."horaInicio", r."horaFin", r.estado, r.motivo, a.nombre as "aulaNombre"
    FROM reservas r
    JOIN aulas a ON r."aulaId" = a.id
    WHERE r."usuarioId" = 42
    ORDER BY r.fecha DESC, r."horaInicio" DESC
    LIMIT 10 OFFSET 0;
  `;
  resultados.push(await ejecutarExplain('1. Listado paginado de usuario (LIMIT 10)', q1));

  // Consulta 2: Listado de admin con filtros combinados (estado, aula, rango de fechas)
  const q2 = `
    SELECT r.id, r.fecha, r."horaInicio", r."horaFin", r."cantidadPersonas", r.estado, a.nombre as "aulaNombre"
    FROM reservas r
    JOIN aulas a ON r."aulaId" = a.id
    WHERE r.estado = 'aprobada'
      AND r."aulaId" = 5
      AND r.fecha >= '2025-01-01' AND r.fecha <= '2025-06-30'
    ORDER BY r.fecha DESC
    LIMIT 20;
  `;
  resultados.push(await ejecutarExplain('2. Listado admin con filtros combinados', q2));

  // Consulta 3: Disponibilidad por aula y fecha específica
  const q3 = `
    SELECT id, "horaInicio", "horaFin", estado
    FROM reservas
    WHERE "aulaId" = 5
      AND fecha = '2025-05-15'
      AND estado IN ('pendiente', 'aprobada')
    ORDER BY "horaInicio" ASC;
  `;
  resultados.push(await ejecutarExplain('3. Disponibilidad por aula y fecha', q3));

  // Consulta 4: Validación de solapamiento GiST
  const q4 = `
    SELECT id
    FROM reservas
    WHERE "aulaId" = 5
      AND estado IN ('pendiente', 'aprobada')
      AND tsrange(("fecha" + "horaInicio"), ("fecha" + "horaFin"), '[)') && tsrange('2025-05-15 10:00:00', '2025-05-15 12:00:00', '[)');
  `;
  resultados.push(await ejecutarExplain('4. Validación de solapamiento GiST', q4));

  // Consulta 5: Resumen y métricas de ocupación
  const q5 = `
    SELECT estado, COUNT(*) as total
    FROM reservas
    GROUP BY estado;
  `;
  resultados.push(await ejecutarExplain('5. Resumen: conteo agregado por estado', q5));

  for (const r of resultados) {
    console.log(`\n• ${r.nombre}:`);
    console.log(`  Execution Time: \x1b[33m${r.execTime} ms\x1b[0m (Planning: ${r.planTime} ms)`);
    console.log(`  Buffers: ${r.buffers}`);
    console.log(`  Plan: ${r.lineasPlan}`);
  }

  return resultados;
}

// =========================================================================
// 5. EVALUACIÓN DE ÍNDICES ADICIONALES
// =========================================================================
async function evaluarIndiceNuevo(resultadosBase) {
  console.log(`\n=============================================================`);
  console.log(`  EVALUACIÓN DE ÍNDICE COMPUESTO: ("aulaId", fecha)`);
  console.log(`=============================================================`);
  console.log('Creando índice: reservas_aula_fecha_idx...');
  await sequelize.query(
    'CREATE INDEX IF NOT EXISTS reservas_aula_fecha_idx ON reservas ("aulaId", fecha);'
  );
  await sequelize.query('ANALYZE reservas;');

  const resultadosConIndice = await correrBenchmarks('Con Índice Compuesto ("aulaId", fecha)');

  console.log(`\n=============================================================`);
  console.log(`  COMPARATIVA ANTES Y DESPUÉS`);
  console.log(`=============================================================`);
  console.log('| Consulta | Antes (ms) | Después (ms) | Impacto |');
  console.log('|---|---|---|---|');

  for (let i = 0; i < resultadosBase.length; i++) {
    const base = resultadosBase[i];
    const despues = resultadosConIndice[i];
    const diff = (base.execTime - despues.execTime).toFixed(3);
    const pct = (((base.execTime - despues.execTime) / base.execTime) * 100).toFixed(1);
    console.log(
      `| ${base.nombre} | ${base.execTime} ms | ${despues.execTime} ms | ${diff > 0 ? `+${pct}% más rápido` : `${pct}%`} |`
    );
  }
}

async function main() {
  try {
    await inicializarEsquema();
    await sembrarDatos();
    const resultadosBase = await correrBenchmarks('Línea Base (Esquema Original)');
    await evaluarIndiceNuevo(resultadosBase);
    console.log('\n\x1b[32m[COMPLETADO]\x1b[0m Benchmark finalizado exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('\n\x1b[31m[ERROR]\x1b[0m', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
