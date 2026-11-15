import { jest } from '@jest/globals';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import { sincronizarUsuarioClerk } from '../src/middleware/auth.middleware.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

/**
 * Dos problemas de la vía de Clerk que no se ven con una sola petición por vez.
 *
 * El primero es de costo: cada petición consultaba la API de Clerk por red
 * antes de mirar la base, aunque la fila local ya tuviera todo lo necesario.
 * El segundo es de concurrencia: el primer ingreso dispara varias peticiones a
 * la vez y todas intentaban crear la misma fila.
 */

const usuarioDeClerk = (id, email) => ({
  id,
  primaryEmailAddressId: 'idem_1',
  emailAddresses: [{ id: 'idem_1', emailAddress: email, verification: { status: 'verified' } }],
  firstName: 'Carrera',
  lastName: 'Concurrente',
  publicMetadata: {}
});

beforeEach(async () => {
  await limpiarBaseDeDatos();
});

afterAll(async () => {
  await sequelize.close();
});

describe('alta de una cuenta de Clerk bajo peticiones simultáneas', () => {
  it('varias peticiones a la vez crean una sola fila y ninguna falla', async () => {
    const clerkUser = usuarioDeClerk('user_2Simultaneo', 'simultaneo@example.com');

    // Lo que hace el navegador al entrar: pide aulas y reservas a la vez.
    const resultados = await Promise.all([
      sincronizarUsuarioClerk(clerkUser),
      sincronizarUsuarioClerk(clerkUser),
      sincronizarUsuarioClerk(clerkUser),
      sincronizarUsuarioClerk(clerkUser)
    ]);

    const filas = await Usuario.findAll({ where: { clerkId: 'user_2Simultaneo' } });
    expect(filas).toHaveLength(1);

    // Todas devuelven la misma cuenta: ninguna se quedó sin usuario.
    resultados.forEach((usuario) => {
      expect(usuario.id).toBe(filas[0].id);
    });
  });

  it('la que pierde la carrera devuelve la cuenta, no un error', async () => {
    const clerkUser = usuarioDeClerk('user_2Perdedor', 'perdedor@example.com');

    // La fila ya existe: simula a la petición que llegó un instante después.
    const ganadora = await sincronizarUsuarioClerk(clerkUser);
    const perdedora = await sincronizarUsuarioClerk(clerkUser);

    expect(perdedora.id).toBe(ganadora.id);
  });

  it('un error que no sea de unicidad sigue propagándose', async () => {
    const clerkUser = usuarioDeClerk('user_2Roto', 'roto@example.com');
    const fallo = new Error('la base se cayó');

    const espia = jest.spyOn(Usuario, 'findOne').mockRejectedValueOnce(fallo);
    try {
      await expect(sincronizarUsuarioClerk(clerkUser)).rejects.toThrow('la base se cayó');
    } finally {
      espia.mockRestore();
    }
  });
});
