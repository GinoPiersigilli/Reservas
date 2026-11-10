const { validarDatabaseUrlTest } = require('./setup/globalSetup.cjs');

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
});
