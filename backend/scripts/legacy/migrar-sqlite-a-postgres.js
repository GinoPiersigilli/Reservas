/**
 * ARCHIVADO (Fase 2c — Migración histórica SQLite → PostgreSQL)
 *
 * NOTA: El paquete `sqlite3` fue desinstalado del proyecto tras completar la migración.
 * Si necesitás volver a ejecutar este script sobre un backup `.sqlite`, instalá
 * temporalmente `sqlite3` sin guardarlo en package.json:
 *
 *   cd backend && npm install --no-save sqlite3
 *   node scripts/legacy/migrar-sqlite-a-postgres.js --dry-run
 *   node scripts/legacy/migrar-sqlite-a-postgres.js
 *   npm uninstall sqlite3
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { Sequelize } from 'sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Soporta ejecución desde backend/scripts/ o desde backend/scripts/legacy/
const backendDir = path.basename(__dirname) === 'legacy'
  ? path.resolve(__dirname, '../..')
  : path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendDir, '.env') });

const SQLITE_BACKUP_PATH = path.join(backendDir, 'backups', 'database.pre-mejoras.sqlite');
const isDryRun = process.argv.includes('--dry-run');

function abrirSqliteReadOnly(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function sqliteClose(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

function clasificarUsuarioId(rawId, usuariosSqliteMap) {
  const str = String(rawId).trim();
  if (/^\d+$/.test(str)) {
    const numId = Number(str);
    if (usuariosSqliteMap.has(numId)) {
      return { tipo: 'numerico_existente', numId, raw: rawId };
    }
    return { tipo: 'numerico_huerfano', numId, raw: rawId };
  }
  if (str.startsWith('user_')) {
    return { tipo: 'clerk', clerkId: str, raw: rawId };
  }
  return { tipo: 'uuid_sistema', uuid: str, raw: rawId };
}

function parseJsonSafe(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

async function main() {
  console.log('===================================================================');
  console.log(`  MIGRACIÓN SQLITE → POSTGRESQL (${isDryRun ? 'MODO --dry-run (SOLO LECTURA)' : 'MODO REAL'})`);
  console.log('===================================================================');
  console.log(`Origen SQLite : ${SQLITE_BACKUP_PATH}`);

  if (!fs.existsSync(SQLITE_BACKUP_PATH)) {
    throw new Error(`No existe el archivo de backup SQLite en: ${SQLITE_BACKUP_PATH}`);
  }

  const dbSqlite = await abrirSqliteReadOnly(SQLITE_BACKUP_PATH);

  try {
    // 1. Leer todos los datos de origen desde el backup SQLite
    const usuariosOrigen = await sqliteAll(
      dbSqlite,
      'SELECT id, nombre, email, passwordHash, rol, activo FROM usuarios ORDER BY id ASC'
    );
    const aulasOrigen = await sqliteAll(
      dbSqlite,
      'SELECT id, nombre, ubicacion, capacidad, recursos, activa FROM aulas ORDER BY id ASC'
    );
    const reservasOrigen = await sqliteAll(
      dbSqlite,
      'SELECT id, aulaId, usuarioId, fecha, horaInicio, horaFin, cantidadPersonas, motivo, estado, createdAt FROM reservas ORDER BY id ASC'
    );
    const historialOrigen = await sqliteAll(
      dbSqlite,
      'SELECT id, reservaId, usuarioId, accion, fechaHora, valorAnterior, valorNuevo FROM historial_reservas ORDER BY id ASC'
    );

    console.log('\n--- 1. Conteos en origen (SQLite backup) ---');
    console.log(`  usuarios          : ${usuariosOrigen.length}`);
    console.log(`  aulas             : ${aulasOrigen.length}`);
    console.log(`  reservas          : ${reservasOrigen.length}`);
    console.log(`  historial_reservas: ${historialOrigen.length}`);

    const usuariosSqliteMap = new Map(usuariosOrigen.map((u) => [Number(u.id), u]));
    const aulasSqliteMap = new Map(aulasOrigen.map((a) => [Number(a.id), a]));

    // 2. Recolectar todos los usuarioId usados en reservas e historial
    const aparicionesReservas = new Map();
    const aparicionesHistorial = new Map();
    const todosRawIds = new Set();

    for (const r of reservasOrigen) {
      const key = String(r.usuarioId);
      todosRawIds.add(key);
      aparicionesReservas.set(key, (aparicionesReservas.get(key) || 0) + 1);
    }
    for (const h of historialOrigen) {
      const key = String(h.usuarioId);
      todosRawIds.add(key);
      aparicionesHistorial.set(key, (aparicionesHistorial.get(key) || 0) + 1);
    }

    // Identificar nuevos usuarios necesarios (Clerk y Sistema)
    const clerkIds = [];
    const uuidIds = [];
    for (const rawKey of todosRawIds) {
      const info = clasificarUsuarioId(rawKey, usuariosSqliteMap);
      if (info.tipo === 'numerico_huerfano') {
        throw new Error(`Se encontró usuarioId numérico sin usuario en origen: ${rawKey}`);
      }
      if (info.tipo === 'clerk' && !clerkIds.includes(info.clerkId)) {
        clerkIds.push(info.clerkId);
      }
      if (info.tipo === 'uuid_sistema' && !uuidIds.includes(info.uuid)) {
        uuidIds.push(info.uuid);
      }
    }

    // Calcular IDs proyectados para simulación (--dry-run) o preparación
    const maxIdOrigen = usuariosOrigen.reduce((max, u) => Math.max(max, Number(u.id)), 0);
    let proximoIdSimulado = maxIdOrigen + 1;
    const idSistemaSimulado = proximoIdSimulado++;
    const clerkIdMapSimulado = new Map();
    for (const cid of clerkIds) {
      clerkIdMapSimulado.set(cid, proximoIdSimulado++);
    }

    // Verificar solapamientos activos en origen
    const solapamientosOrigen = [];
    const activasOrigen = reservasOrigen.filter((r) =>
      ['pendiente', 'aprobada'].includes(r.estado)
    );
    for (let i = 0; i < activasOrigen.length; i++) {
      for (let j = i + 1; j < activasOrigen.length; j++) {
        const r1 = activasOrigen[i];
        const r2 = activasOrigen[j];
        if (
          r1.aulaId === r2.aulaId &&
          r1.fecha === r2.fecha &&
          r1.horaInicio < r2.horaFin &&
          r1.horaFin > r2.horaInicio
        ) {
          solapamientosOrigen.push({ r1: r1.id, r2: r2.id, aulaId: r1.aulaId, fecha: r1.fecha });
        }
      }
    }

    // Detectar reservas que superan la capacidad del aula (sin corregirlas)
    const excesosCapacidad = [];
    for (const r of reservasOrigen) {
      const aula = aulasSqliteMap.get(Number(r.aulaId));
      if (!aula) {
        throw new Error(`Reserva #${r.id} apunta a aulaId inexistente: ${r.aulaId}`);
      }
      if (Number(r.cantidadPersonas) > Number(aula.capacidad)) {
        excesosCapacidad.push({
          reservaId: r.id,
          aulaId: aula.id,
          aulaNombre: aula.nombre,
          cantidadPersonas: r.cantidadPersonas,
          capacidadAula: aula.capacidad,
          estado: r.estado,
          fecha: r.fecha,
          motivo: r.motivo
        });
      }
    }

    // Conectar a PostgreSQL
    if (!process.env.DATABASE_URL) {
      throw new Error('Falta variable de entorno DATABASE_URL');
    }
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false
    });

    try {
      await sequelize.authenticate();

      const [pgCountsBefore] = await sequelize.query(`
        SELECT
          (SELECT COUNT(*)::int FROM usuarios) AS usuarios,
          (SELECT COUNT(*)::int FROM aulas) AS aulas,
          (SELECT COUNT(*)::int FROM reservas) AS reservas,
          (SELECT COUNT(*)::int FROM historial_reservas) AS historial
      `);
      console.log('\n--- 2. Estado actual de destino (PostgreSQL antes de correr) ---');
      console.log(`  usuarios          : ${pgCountsBefore[0].usuarios}`);
      console.log(`  aulas             : ${pgCountsBefore[0].aulas}`);
      console.log(`  reservas          : ${pgCountsBefore[0].reservas}`);
      console.log(`  historial_reservas: ${pgCountsBefore[0].historial}`);

      let idSistemaFinal = idSistemaSimulado;
      const clerkIdMapFinal = new Map(clerkIdMapSimulado);

      if (!isDryRun) {
        console.log('\n--- 3. Ejecutando migración en UNA transacción ---');
        await sequelize.transaction(async (transaction) => {
          // 3.1 Insertar los 9 usuarios originales conservando sus IDs (1..9)
          for (const u of usuariosOrigen) {
            await sequelize.query(
              `INSERT INTO usuarios (id, nombre, email, "passwordHash", "clerkId", rol, activo, "createdAt")
               VALUES (:id, :nombre, :email, :passwordHash, NULL, :rol, :activo, CURRENT_TIMESTAMP)
               ON CONFLICT (id) DO UPDATE SET
                 nombre = EXCLUDED.nombre,
                 email = EXCLUDED.email,
                 "passwordHash" = EXCLUDED."passwordHash",
                 rol = EXCLUDED.rol,
                 activo = EXCLUDED.activo;`,
              {
                replacements: {
                  id: Number(u.id),
                  nombre: u.nombre,
                  email: u.email,
                  passwordHash: u.passwordHash,
                  rol: u.rol,
                  activo: Boolean(u.activo)
                },
                transaction
              }
            );
          }

          // Asegurar que la secuencia de usuarios esté al menos en MAX(id) antes de crear Sistema y Clerk
          await sequelize.query(
            `SELECT setval(pg_get_serial_sequence('usuarios', 'id'), COALESCE((SELECT MAX(id) FROM usuarios), 1), true);`,
            { transaction }
          );

          // 3.2 Obtener o crear usuario "Sistema" para los UUID de Keycloak sin equivalente
          const [existingSistema] = await sequelize.query(
            `SELECT id FROM usuarios WHERE email = 'sistema@utnfrc.edu.ar' LIMIT 1;`,
            { transaction }
          );
          if (existingSistema.length > 0) {
            idSistemaFinal = Number(existingSistema[0].id);
          } else {
            const [insertedSistema] = await sequelize.query(
              `INSERT INTO usuarios (nombre, email, "passwordHash", "clerkId", rol, activo, "createdAt")
               VALUES ('Sistema', 'sistema@utnfrc.edu.ar', NULL, NULL, 'admin', false, CURRENT_TIMESTAMP)
               RETURNING id;`,
              { transaction }
            );
            idSistemaFinal = Number(insertedSistema[0].id);
          }

          // 3.3 Obtener o crear usuarios locales para cada clerkId ("user_...")
          for (const cid of clerkIds) {
            const [existingClerk] = await sequelize.query(
              `SELECT id FROM usuarios WHERE "clerkId" = :clerkId LIMIT 1;`,
              { replacements: { clerkId: cid }, transaction }
            );
            if (existingClerk.length > 0) {
              clerkIdMapFinal.set(cid, Number(existingClerk[0].id));
            } else {
              const placeholderNombre = `Usuario Clerk [PLACEHOLDER ${cid}]`;
              const placeholderEmail = `${cid.toLowerCase()}@placeholder.clerk.local`;
              const [insertedClerk] = await sequelize.query(
                `INSERT INTO usuarios (nombre, email, "passwordHash", "clerkId", rol, activo, "createdAt")
                 VALUES (:nombre, :email, NULL, :clerkId, 'usuario', true, CURRENT_TIMESTAMP)
                 RETURNING id;`,
                {
                  replacements: {
                    nombre: placeholderNombre,
                    email: placeholderEmail,
                    clerkId: cid
                  },
                  transaction
                }
              );
              clerkIdMapFinal.set(cid, Number(insertedClerk[0].id));
            }
          }

          // Helper para resolver cualquier usuarioId de origen al ID entero en PostgreSQL
          const resolverUsuarioId = (rawId) => {
            const info = clasificarUsuarioId(rawId, usuariosSqliteMap);
            if (info.tipo === 'numerico_existente') return info.numId;
            if (info.tipo === 'clerk') return clerkIdMapFinal.get(info.clerkId);
            if (info.tipo === 'uuid_sistema') return idSistemaFinal;
            throw new Error(`No se pudo resolver usuarioId: ${rawId}`);
          };

          // 3.4 Insertar aulas conservando IDs originales
          for (const a of aulasOrigen) {
            await sequelize.query(
              `INSERT INTO aulas (id, nombre, ubicacion, capacidad, recursos, activa)
               VALUES (:id, :nombre, :ubicacion, :capacidad, :recursos, :activa)
               ON CONFLICT (id) DO UPDATE SET
                 nombre = EXCLUDED.nombre,
                 ubicacion = EXCLUDED.ubicacion,
                 capacidad = EXCLUDED.capacidad,
                 recursos = EXCLUDED.recursos,
                 activa = EXCLUDED.activa;`,
              {
                replacements: {
                  id: Number(a.id),
                  nombre: a.nombre,
                  ubicacion: a.ubicacion,
                  capacidad: Number(a.capacidad),
                  recursos: a.recursos,
                  activa: Boolean(a.activa)
                },
                transaction
              }
            );
          }

          // 3.5 Insertar reservas conservando IDs originales
          for (const r of reservasOrigen) {
            const targetUsuarioId = resolverUsuarioId(r.usuarioId);
            const createdAtDate = r.createdAt ? new Date(r.createdAt) : new Date();
            await sequelize.query(
              `INSERT INTO reservas (
                 id, "aulaId", "usuarioId", fecha, "horaInicio", "horaFin",
                 "cantidadPersonas", motivo, estado, "createdAt", "updatedAt"
               )
               VALUES (
                 :id, :aulaId, :usuarioId, :fecha::date, :horaInicio::time, :horaFin::time,
                 :cantidadPersonas, :motivo, :estado, :createdAt, :updatedAt
               )
               ON CONFLICT (id) DO UPDATE SET
                 "aulaId" = EXCLUDED."aulaId",
                 "usuarioId" = EXCLUDED."usuarioId",
                 fecha = EXCLUDED.fecha,
                 "horaInicio" = EXCLUDED."horaInicio",
                 "horaFin" = EXCLUDED."horaFin",
                 "cantidadPersonas" = EXCLUDED."cantidadPersonas",
                 motivo = EXCLUDED.motivo,
                 estado = EXCLUDED.estado,
                 "createdAt" = EXCLUDED."createdAt",
                 "updatedAt" = EXCLUDED."updatedAt";`,
              {
                replacements: {
                  id: Number(r.id),
                  aulaId: Number(r.aulaId),
                  usuarioId: targetUsuarioId,
                  fecha: r.fecha,
                  horaInicio: r.horaInicio,
                  horaFin: r.horaFin,
                  cantidadPersonas: Number(r.cantidadPersonas),
                  motivo: r.motivo,
                  estado: r.estado,
                  createdAt: createdAtDate,
                  updatedAt: createdAtDate
                },
                transaction
              }
            );
          }

          // 3.6 Insertar historial_reservas conservando IDs originales
          for (const h of historialOrigen) {
            const targetUsuarioId = resolverUsuarioId(h.usuarioId);
            const fechaHoraDate = h.fechaHora ? new Date(h.fechaHora) : new Date();
            const valAntObj = parseJsonSafe(h.valorAnterior);
            const valNuevoObj = parseJsonSafe(h.valorNuevo);

            await sequelize.query(
              `INSERT INTO historial_reservas (
                 id, "reservaId", "usuarioId", accion, "fechaHora", "valorAnterior", "valorNuevo"
               )
               VALUES (
                 :id, :reservaId, :usuarioId, :accion, :fechaHora, :valorAnterior::jsonb, :valorNuevo::jsonb
               )
               ON CONFLICT (id) DO UPDATE SET
                 "reservaId" = EXCLUDED."reservaId",
                 "usuarioId" = EXCLUDED."usuarioId",
                 accion = EXCLUDED.accion,
                 "fechaHora" = EXCLUDED."fechaHora",
                 "valorAnterior" = EXCLUDED."valorAnterior",
                 "valorNuevo" = EXCLUDED."valorNuevo";`,
              {
                replacements: {
                  id: Number(h.id),
                  reservaId: Number(h.reservaId),
                  usuarioId: targetUsuarioId,
                  accion: h.accion,
                  fechaHora: fechaHoraDate,
                  valorAnterior: valAntObj === null ? null : JSON.stringify(valAntObj),
                  valorNuevo: valNuevoObj === null ? null : JSON.stringify(valNuevoObj)
                },
                transaction
              }
            );
          }

          // 3.7 Reiniciar secuencias de las 4 tablas con setval(pg_get_serial_sequence(...), MAX(id))
          const tablasSecuencia = ['usuarios', 'aulas', 'reservas', 'historial_reservas'];
          for (const tabla of tablasSecuencia) {
            await sequelize.query(
              `SELECT setval(pg_get_serial_sequence('${tabla}', 'id'), (SELECT MAX(id) FROM ${tabla}));`,
              { transaction }
            );
          }

          // 3.8 Verificaciones automáticas dentro de la transacción (si algo falla -> rollback total)
          const [pgCountsAfter] = await sequelize.query(
            `SELECT
               (SELECT COUNT(*)::int FROM usuarios) AS usuarios,
               (SELECT COUNT(*)::int FROM aulas) AS aulas,
               (SELECT COUNT(*)::int FROM reservas) AS reservas,
               (SELECT COUNT(*)::int FROM historial_reservas) AS historial`,
            { transaction }
          );

          const counts = pgCountsAfter[0];
          const expectedUsuarios = usuariosOrigen.length + 1 + clerkIds.length;
          if (counts.aulas !== aulasOrigen.length) {
            throw new Error(`Discrepancia en conteo de aulas: origen=${aulasOrigen.length}, destino=${counts.aulas}`);
          }
          if (counts.reservas !== reservasOrigen.length) {
            throw new Error(`Discrepancia en conteo de reservas: origen=${reservasOrigen.length}, destino=${counts.reservas}`);
          }
          if (counts.historial !== historialOrigen.length) {
            throw new Error(`Discrepancia en conteo de historial_reservas: origen=${historialOrigen.length}, destino=${counts.historial}`);
          }
          if (counts.usuarios !== expectedUsuarios) {
            throw new Error(`Discrepancia en conteo de usuarios: esperado=${expectedUsuarios}, destino=${counts.usuarios}`);
          }

          const [fksHuerfanas] = await sequelize.query(
            `SELECT
               (SELECT COUNT(*)::int FROM reservas r LEFT JOIN usuarios u ON r."usuarioId" = u.id WHERE u.id IS NULL) AS reservas_sin_usuario,
               (SELECT COUNT(*)::int FROM historial_reservas h LEFT JOIN usuarios u ON h."usuarioId" = u.id WHERE u.id IS NULL) AS historial_sin_usuario,
               (SELECT COUNT(*)::int FROM reservas r LEFT JOIN aulas a ON r."aulaId" = a.id WHERE a.id IS NULL) AS reservas_sin_aula,
               (SELECT COUNT(*)::int FROM historial_reservas h LEFT JOIN reservas r ON h."reservaId" = r.id WHERE r.id IS NULL) AS historial_sin_reserva`,
            { transaction }
          );
          const huerfanos = fksHuerfanas[0];
          if (
            huerfanos.reservas_sin_usuario !== 0 ||
            huerfanos.historial_sin_usuario !== 0 ||
            huerfanos.reservas_sin_aula !== 0 ||
            huerfanos.historial_sin_reserva !== 0
          ) {
            throw new Error(`Filas huérfanas detectadas: ${JSON.stringify(huerfanos)}`);
          }

          const [solapamientosPg] = await sequelize.query(
            `SELECT COUNT(*)::int AS total
             FROM reservas r1
             JOIN reservas r2
               ON r1."aulaId" = r2."aulaId"
              AND r1.fecha = r2.fecha
              AND r1.id < r2.id
             WHERE r1.estado IN ('pendiente', 'aprobada')
               AND r2.estado IN ('pendiente', 'aprobada')
               AND r1."horaInicio" < r2."horaFin"
               AND r1."horaFin" > r2."horaInicio";`,
            { transaction }
          );
          if (solapamientosPg[0].total !== 0) {
            throw new Error(`Se detectaron ${solapamientosPg[0].total} solapamientos activos en PostgreSQL`);
          }

          const [constraintsNoValidadas] = await sequelize.query(
            `SELECT c.conname, t.relname AS tabla
             FROM pg_constraint c
             JOIN pg_class t ON c.conrelid = t.oid
             JOIN pg_namespace n ON t.relnamespace = n.oid
             WHERE n.nspname = 'public'
               AND t.relname IN ('usuarios', 'aulas', 'reservas', 'historial_reservas')
               AND c.convalidated = false;`,
            { transaction }
          );
          if (constraintsNoValidadas.length > 0) {
            throw new Error(`Constraints sin validar: ${JSON.stringify(constraintsNoValidadas)}`);
          }
        });
      }

      // 4. Tabla de mapeo completa de usuarios e identidades
      console.log('\n--- 4. Tabla de mapeo completa de usuarios (SQLite → PostgreSQL) ---');
      const tablaMapeo = [];

      // 4.1 Los 9 usuarios de la tabla usuarios de SQLite
      for (const u of usuariosOrigen) {
        const key = String(u.id);
        tablaMapeo.push({
          origenId: u.id,
          tipoOrigen: 'usuario local (tabla usuarios)',
          destinoId: Number(u.id),
          nombreDestino: u.nombre,
          emailDestino: u.email,
          clerkIdDestino: null,
          accion: 'Conserva ID original',
          reservasAsociadas: aparicionesReservas.get(key) || 0,
          historialesAsociados: aparicionesHistorial.get(key) || 0
        });
      }

      // 4.2 Usuarios Clerk ("user_...")
      for (const cid of clerkIds) {
        const destId = clerkIdMapFinal.get(cid);
        tablaMapeo.push({
          origenId: cid,
          tipoOrigen: 'texto Clerk (user_...)',
          destinoId: destId,
          nombreDestino: `Usuario Clerk [PLACEHOLDER ${cid}]`,
          emailDestino: `${cid.toLowerCase()}@placeholder.clerk.local`,
          clerkIdDestino: cid,
          accion: 'Crear/vincular usuario local con clerkId (sin passwordHash)',
          reservasAsociadas: aparicionesReservas.get(cid) || 0,
          historialesAsociados: aparicionesHistorial.get(cid) || 0
        });
      }

      // 4.3 UUIDs de Keycloak sin equivalente -> Usuario "Sistema"
      for (const uuid of uuidIds) {
        tablaMapeo.push({
          origenId: uuid,
          tipoOrigen: 'UUID Keycloak (sin equivalente)',
          destinoId: idSistemaFinal,
          nombreDestino: 'Sistema',
          emailDestino: 'sistema@utnfrc.edu.ar',
          clerkIdDestino: null,
          accion: 'Mapear a usuario "Sistema" (sin passwordHash, inactivo)',
          reservasAsociadas: aparicionesReservas.get(uuid) || 0,
          historialesAsociados: aparicionesHistorial.get(uuid) || 0
        });
      }

      console.table(tablaMapeo);

      // 5. Reporte de reservas que superan la capacidad del aula
      console.log('\n--- 5. Reserva(s) que superan la capacidad del aula (NO corregidas) ---');
      if (excesosCapacidad.length === 0) {
        console.log('  Ninguna.');
      } else {
        console.table(excesosCapacidad);
      }

      // 6. Verificaciones de constraints y estado final en PostgreSQL
      const [constraintsPg] = await sequelize.query(`
        SELECT t.relname AS tabla, c.conname AS constraint_name, c.contype AS tipo, c.convalidated AS validada
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.relname IN ('usuarios', 'aulas', 'reservas', 'historial_reservas')
        ORDER BY t.relname, c.conname;
      `);

      console.log('\n--- 6. Verificaciones automáticas ---');
      console.log(`  Solapamientos activos en origen : ${solapamientosOrigen.length}`);
      console.log(`  Constraints en PostgreSQL       : ${constraintsPg.length} totales (${constraintsPg.filter((c) => c.validada).length} con convalidated = true)`);

      if (!isDryRun) {
        const [pgCountsFinal] = await sequelize.query(`
          SELECT
            (SELECT COUNT(*)::int FROM usuarios) AS usuarios,
            (SELECT COUNT(*)::int FROM aulas) AS aulas,
            (SELECT COUNT(*)::int FROM reservas) AS reservas,
            (SELECT COUNT(*)::int FROM historial_reservas) AS historial
        `);
        const [seqValues] = await sequelize.query(`
          SELECT
            (SELECT last_value::int FROM usuarios_id_seq) AS seq_usuarios,
            (SELECT last_value::int FROM aulas_id_seq) AS seq_aulas,
            (SELECT last_value::int FROM reservas_id_seq) AS seq_reservas,
            (SELECT last_value::int FROM historial_reservas_id_seq) AS seq_historial
        `);
        console.log('  Conteos finales en PostgreSQL   :', pgCountsFinal[0]);
        console.log('  Secuencias reiniciadas (MAX id) :', seqValues[0]);
        console.log('\n[OK] Migración real completada exitosamente en una única transacción.');
      } else {
        console.log('\n[DRY-RUN] Simulación finalizada. No se modificó ningún dato en PostgreSQL.');
      }
    } finally {
      await sequelize.close();
    }
  } finally {
    await sqliteClose(dbSqlite);
  }
}

main().catch((err) => {
  console.error('\n[ERROR EN MIGRACIÓN]:', err.message);
  process.exit(1);
});

