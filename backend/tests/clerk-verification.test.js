import request from 'supertest';
import { verifyToken, createClerkClient } from '@clerk/backend';
import env from '../src/config/env.js';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import Usuario from '../src/models/usuario.model.js';
import { limpiarBaseDeDatos } from './setup/dbHelpers.js';

jest.mock('@clerk/backend', () => {
  const actual = jest.requireActual('@clerk/backend');
  const mockGetUser = jest.fn();
  return {
    ...actual,
    verifyToken: jest.fn(),
    createClerkClient: jest.fn(() => ({
      users: {
        getUser: mockGetUser
      }
    })),
    __mockGetUser: mockGetUser
  };
});

beforeEach(async () => {
  await limpiarBaseDeDatos();
  jest.clearAllMocks();
});

afterAll(async () => {
  await sequelize.close();
});

describe('SEC-AUTH-03: verificación de tokens de Clerk con authorizedParties', () => {
  it('passes authorizedParties from CORS_ORIGINS to verifyToken', async () => {
    verifyToken.mockResolvedValueOnce({ sub: 'user_clerk_azp_test' });

    const clerkClientInstance = createClerkClient();
    clerkClientInstance.users.getUser.mockResolvedValueOnce({
      id: 'user_clerk_azp_test',
      firstName: 'Clerk',
      lastName: 'User',
      emailAddresses: [
        { emailAddress: 'clerk.user@utnfrc.edu.ar', verification: { status: 'verified' } }
      ],
      publicMetadata: { rol: 'usuario' }
    });

    const response = await request(app)
      .get('/api/reservas')
      .set('Authorization', 'Bearer fake_clerk_token_azp');

    expect(response.status).toBe(200);

    expect(verifyToken).toHaveBeenCalledWith(
      'fake_clerk_token_azp',
      expect.objectContaining({
        authorizedParties: env.CORS_ORIGINS
      })
    );
  });

  it('rejects with 401 when verifyToken rejects due to invalid authorized parties or bad token', async () => {
    verifyToken.mockRejectedValueOnce(new Error('Token verification failed: invalid azp'));

    const response = await request(app)
      .get('/api/reservas')
      .set('Authorization', 'Bearer fake_clerk_token_rejected');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Token inválido o expirado');
  });

  describe('SEC-AUTH-05: vinculación segura por email verificado en Clerk', () => {
    it('rejects with 403 and prevents database changes when Clerk email is not verified', async () => {
      const userLocal = await Usuario.create({
        nombre: 'Docente Local',
        email: 'docente@utnfrc.edu.ar',
        clerkId: null,
        rol: 'usuario',
        activo: true
      });

      verifyToken.mockResolvedValueOnce({ sub: 'user_clerk_unverified' });

      const clerkClientInstance = createClerkClient();
      clerkClientInstance.users.getUser.mockResolvedValueOnce({
        id: 'user_clerk_unverified',
        firstName: 'Docente',
        lastName: 'Clerk',
        emailAddresses: [
          {
            id: 'email_1',
            emailAddress: 'docente@utnfrc.edu.ar',
            verification: { status: 'unverified' }
          }
        ],
        primaryEmailAddressId: 'email_1',
        publicMetadata: { rol: 'usuario' }
      });

      const response = await request(app)
        .get('/api/reservas')
        .set('Authorization', 'Bearer token_clerk_unverified');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/correo|email.*verificado/i);

      // Verificar que en la base de datos NO se vinculó ni se modificó el usuario
      const userRecargado = await Usuario.findByPk(userLocal.id);
      expect(userRecargado.clerkId).toBeNull();

      // Verificar que tampoco se creó un nuevo usuario
      const totalUsuarios = await Usuario.count();
      expect(totalUsuarios).toBe(1);
    });

    it('links local account when Clerk primary email is verified', async () => {
      const userLocal = await Usuario.create({
        nombre: 'Docente Verificado',
        email: 'docente-verificado@utnfrc.edu.ar',
        clerkId: null,
        rol: 'usuario',
        activo: true
      });

      verifyToken.mockResolvedValueOnce({ sub: 'user_clerk_verified_ok' });

      const clerkClientInstance = createClerkClient();
      clerkClientInstance.users.getUser.mockResolvedValueOnce({
        id: 'user_clerk_verified_ok',
        firstName: 'Docente',
        lastName: 'Verificado',
        emailAddresses: [
          {
            id: 'email_v',
            emailAddress: 'docente-verificado@utnfrc.edu.ar',
            verification: { status: 'verified' }
          }
        ],
        primaryEmailAddressId: 'email_v',
        publicMetadata: { rol: 'usuario' }
      });

      const response = await request(app)
        .get('/api/reservas')
        .set('Authorization', 'Bearer token_clerk_verified');

      expect(response.status).toBe(200);

      const userRecargado = await Usuario.findByPk(userLocal.id);
      expect(userRecargado.clerkId).toBe('user_clerk_verified_ok');
    });

    it('does not change user when clerkId already matches an existing local user', async () => {
      const userExistente = await Usuario.create({
        nombre: 'Usuario Con ClerkId',
        email: 'existente@utnfrc.edu.ar',
        clerkId: 'user_clerk_ya_vinculado',
        rol: 'usuario',
        activo: true
      });

      verifyToken.mockResolvedValueOnce({ sub: 'user_clerk_ya_vinculado' });

      const clerkClientInstance = createClerkClient();
      clerkClientInstance.users.getUser.mockResolvedValueOnce({
        id: 'user_clerk_ya_vinculado',
        firstName: 'Usuario',
        lastName: 'Con ClerkId',
        emailAddresses: [
          {
            id: 'email_existente',
            emailAddress: 'existente@utnfrc.edu.ar',
            verification: { status: 'verified' }
          }
        ],
        publicMetadata: { rol: 'usuario' }
      });

      const response = await request(app)
        .get('/api/reservas')
        .set('Authorization', 'Bearer token_clerk_existente');

      expect(response.status).toBe(200);

      const userRecargado = await Usuario.findByPk(userExistente.id);
      expect(userRecargado.clerkId).toBe('user_clerk_ya_vinculado');
      expect(userRecargado.email).toBe('existente@utnfrc.edu.ar');
    });
  });

  /**
   * Cada petición con token de Clerk consultaba su API por red antes de mirar
   * la base, aunque la fila local ya tuviera todo lo necesario para armar
   * `req.usuario`. Eso sumaba una ida y vuelta externa a cada GET y gastaba el
   * cupo de la API de Clerk sin ninguna necesidad.
   */
  describe('cuántas veces se le pregunta a Clerk', () => {
    const PERFIL_COMPLETO = {
      id: 'user_clerk_reiterado',
      firstName: 'Reiterado',
      lastName: 'Usuario',
      primaryEmailAddressId: 'email_1',
      emailAddresses: [
        {
          id: 'email_1',
          emailAddress: 'reiterado@utnfrc.edu.ar',
          verification: { status: 'verified' }
        }
      ],
      publicMetadata: {}
    };

    it('la primera vez sí, porque todavía no hay fila local', async () => {
      verifyToken.mockResolvedValue({ sub: 'user_clerk_reiterado' });
      const clerk = createClerkClient();
      clerk.users.getUser.mockResolvedValue(PERFIL_COMPLETO);

      const res = await request(app)
        .get('/api/reservas')
        .set('Authorization', 'Bearer token_reiterado');

      expect(res.status).toBe(200);
      expect(clerk.users.getUser).toHaveBeenCalledTimes(1);
    });

    it('las siguientes no: la fila local ya alcanza', async () => {
      verifyToken.mockResolvedValue({ sub: 'user_clerk_reiterado' });
      const clerk = createClerkClient();
      clerk.users.getUser.mockResolvedValue(PERFIL_COMPLETO);

      await request(app).get('/api/reservas').set('Authorization', 'Bearer token_reiterado');
      const llamadasTrasLaPrimera = clerk.users.getUser.mock.calls.length;

      await request(app).get('/api/reservas').set('Authorization', 'Bearer token_reiterado');
      await request(app).get('/api/aulas').set('Authorization', 'Bearer token_reiterado');
      await request(app).get('/api/reservas').set('Authorization', 'Bearer token_reiterado');

      expect(clerk.users.getUser).toHaveBeenCalledTimes(llamadasTrasLaPrimera);
    });

    it('pero sí cuando a la fila le faltan datos que solo Clerk tiene', async () => {
      await Usuario.create({
        nombre: '[PLACEHOLDER] Migrado',
        email: 'user_clerk_migrado@placeholder.clerk.local',
        passwordHash: null,
        clerkId: 'user_clerk_migrado',
        rol: 'usuario',
        activo: true
      });

      verifyToken.mockResolvedValue({ sub: 'user_clerk_migrado' });
      const clerk = createClerkClient();
      clerk.users.getUser.mockResolvedValue({
        ...PERFIL_COMPLETO,
        id: 'user_clerk_migrado',
        emailAddresses: [
          {
            id: 'email_1',
            emailAddress: 'migrado@utnfrc.edu.ar',
            verification: { status: 'verified' }
          }
        ]
      });

      await request(app).get('/api/reservas').set('Authorization', 'Bearer token_migrado');

      expect(clerk.users.getUser).toHaveBeenCalled();
      const completado = await Usuario.findOne({ where: { clerkId: 'user_clerk_migrado' } });
      expect(completado.email).toBe('migrado@utnfrc.edu.ar');
      expect(completado.nombre).not.toContain('[PLACEHOLDER');
    });

    it('una cuenta desactivada responde 401, igual que por la vía del token local', async () => {
      await Usuario.create({
        nombre: 'Desactivado Clerk',
        email: 'desactivado-clerk@utnfrc.edu.ar',
        passwordHash: null,
        clerkId: 'user_clerk_inactivo',
        rol: 'usuario',
        activo: false
      });

      verifyToken.mockResolvedValue({ sub: 'user_clerk_inactivo' });

      const res = await request(app)
        .get('/api/reservas')
        .set('Authorization', 'Bearer token_inactivo');

      expect(res.status).toBe(401);
    });
  });
});
