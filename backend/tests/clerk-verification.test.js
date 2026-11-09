import request from 'supertest';
import { verifyToken, createClerkClient } from '@clerk/backend';
import env from '../src/config/env.js';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
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
      emailAddresses: [{ emailAddress: 'clerk.user@utnfrc.edu.ar', verification: { status: 'verified' } }],
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
});
