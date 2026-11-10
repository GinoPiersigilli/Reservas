const globalSetup = require('./setup/globalSetup.cjs');
const { validarDatabaseUrlTest, TEST_ADVISORY_LOCK_ID } = require('./setup/globalSetup.cjs');

describe('SEC-TEST-01: guarda de seguridad en globalSetup para DATABASE_URL_TEST', () => {
  it('throws clear error if DATABASE_URL_TEST equals DATABASE_URL', () => {
    const prodUrl = 'postgres://postgres:password@localhost:5432/reservas';
    expect(() => {
      validarDatabaseUrlTest(prodUrl, prodUrl);
    }).toThrow(/DATABASE_URL_TEST no puede ser igual a DATABASE_URL/);
  });

  it('throws clear error if database name does not end in _test', () => {
    const invalidUrl = 'postgres://postgres:password@localhost:5432/reservas_dev';
    expect(() => {
      validarDatabaseUrlTest(invalidUrl, 'postgres://postgres:password@localhost:5432/reservas_prod');
    }).toThrow(/debe terminar obligatoriamente en '_test'/);
  });

  it('throws error if DATABASE_URL_TEST is empty or missing', () => {
    expect(() => {
      validarDatabaseUrlTest('', 'postgres://localhost/prod');
    }).toThrow(/DATABASE_URL_TEST no está definida/);
  });

  it('accepts valid database url ending in _test and different from DATABASE_URL', () => {
    const testUrl = 'postgres://postgres:password@localhost:5432/reservas_test';
    const prodUrl = 'postgres://postgres:password@localhost:5432/reservas';
    const dbName = validarDatabaseUrlTest(testUrl, prodUrl);
    expect(dbName).toBe('reservas_test');
  });

  describe('advisory lock durante migraciones', () => {
    it('mantiene el advisory lock hasta que terminan las migraciones y lo libera en finally', async () => {
      const callLog = [];

      class MockClient {
        async connect() {
          callLog.push('client.connect');
        }
        async query(sql, params) {
          if (sql.includes('pg_advisory_lock')) {
            callLog.push(`lock(${params[0]})`);
          } else if (sql.includes('pg_terminate_backend')) {
            callLog.push('terminate_connections');
          } else if (sql.includes('DROP SCHEMA')) {
            callLog.push('drop_schema');
          } else if (sql.includes('pg_advisory_unlock')) {
            callLog.push(`unlock(${params[0]})`);
          }
          return { rows: [] };
        }
        async end() {
          callLog.push('client.end');
        }
      }

      const mockExecSync = (cmd) => {
        callLog.push(`execSync:${cmd}`);
      };

      await globalSetup({
        testDbUrl: 'postgres://postgres:pass@localhost:5432/reservas_test',
        prodDbUrl: 'postgres://postgres:pass@localhost:5432/reservas_dev',
        Client: MockClient,
        execSync: mockExecSync
      });

      expect(callLog).toEqual([
        'client.connect',
        `lock(${TEST_ADVISORY_LOCK_ID})`,
        'terminate_connections',
        'drop_schema',
        'execSync:npx sequelize-cli db:migrate --env test',
        `unlock(${TEST_ADVISORY_LOCK_ID})`,
        'client.end'
      ]);
    });

    it('libera el advisory lock en finally incluso si la migración falla', async () => {
      const callLog = [];

      class MockClient {
        async connect() {
          callLog.push('client.connect');
        }
        async query(sql, params) {
          if (sql.includes('pg_advisory_lock')) {
            callLog.push(`lock(${params[0]})`);
          } else if (sql.includes('pg_advisory_unlock')) {
            callLog.push(`unlock(${params[0]})`);
          }
          return { rows: [] };
        }
        async end() {
          callLog.push('client.end');
        }
      }

      const mockFailingExecSync = () => {
        callLog.push('execSync:fail');
        throw new Error('Fallo simulado en migración');
      };

      await expect(
        globalSetup({
          testDbUrl: 'postgres://postgres:pass@localhost:5432/reservas_test',
          prodDbUrl: 'postgres://postgres:pass@localhost:5432/reservas_dev',
          Client: MockClient,
          execSync: mockFailingExecSync
        })
      ).rejects.toThrow('Fallo simulado en migración');

      expect(callLog).toContain(`lock(${TEST_ADVISORY_LOCK_ID})`);
      expect(callLog).toContain('execSync:fail');
      expect(callLog).toContain(`unlock(${TEST_ADVISORY_LOCK_ID})`);
      expect(callLog).toContain('client.end');
      const failIndex = callLog.indexOf('execSync:fail');
      const unlockIndex = callLog.indexOf(`unlock(${TEST_ADVISORY_LOCK_ID})`);
      expect(unlockIndex).toBeGreaterThan(failIndex);
    });
  });
});
