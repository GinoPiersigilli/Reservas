// src/docs/openapi.js

/**
 * Especificación OpenAPI 3.1 de la API, escrita a mano.
 *
 * Se mantiene junto al código y no se genera desde los esquemas de zod para que
 * siga siendo legible, pero una prueba (`tests/openapi.test.js`) compara esta
 * especificación con las rutas que Express tiene registradas y falla si alguna
 * queda sin documentar: así no se desactualiza en silencio.
 */

const respuestaError = (descripcion) => ({
  description: descripcion,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' }
    }
  }
});

const PARAM_ID = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Identificador numérico del recurso',
  schema: { type: 'integer', minimum: 1 }
};

const ERRORES_COMUNES = {
  400: respuestaError('Datos inválidos o regla de negocio incumplida'),
  401: respuestaError('Falta el token o no es válido'),
  403: respuestaError('El rol del usuario no permite la operación'),
  404: respuestaError('El recurso no existe'),
  429: respuestaError('Se superó el límite de peticiones'),
  503: respuestaError('Servicio temporalmente sobrecargado')
};

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'API de Reservas de Aulas',
    version: '1.0.0',
    description: [
      'API del sistema de reservas de aulas.',
      '',
      'La integridad de los horarios la garantiza PostgreSQL mediante una',
      'restricción de exclusión, no el backend: dos reservas solapadas en la',
      'misma aula son imposibles incluso con peticiones simultáneas.',
      '',
      'Esta documentación se publica únicamente fuera de producción.'
    ].join('\n'),
    license: { name: 'MIT', identifier: 'MIT' }
  },
  servers: [{ url: '/api', description: 'Servidor actual' }],
  tags: [
    { name: 'Autenticación', description: 'Inicio de sesión local' },
    { name: 'Reservas', description: 'Solicitud y gestión de reservas' },
    { name: 'Aulas', description: 'Catálogo de aulas y disponibilidad' },
    { name: 'Operación', description: 'Sondas de estado del servicio' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    parameters: { Id: PARAM_ID },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Mensaje apto para mostrar al usuario' },
          correlationId: {
            type: 'string',
            format: 'uuid',
            description: 'Presente en errores internos; coincide con X-Request-Id'
          }
        },
        required: ['error']
      },
      Credenciales: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 }
        }
      },
      Sesion: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT local, válido por 2 horas' },
          usuario: { $ref: '#/components/schemas/Usuario' }
        }
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string' },
          email: { type: 'string', format: 'email' },
          rol: { type: 'string', enum: ['usuario', 'admin'] }
        }
      },
      Aula: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string' },
          ubicacion: { type: 'string' },
          capacidad: { type: 'integer', minimum: 1 },
          recursos: { type: 'string', nullable: true },
          activa: { type: 'boolean' }
        }
      },
      AulaNueva: {
        type: 'object',
        required: ['nombre', 'ubicacion', 'capacidad'],
        properties: {
          nombre: { type: 'string', maxLength: 100 },
          ubicacion: { type: 'string', maxLength: 150 },
          capacidad: { type: 'integer', minimum: 1 },
          recursos: { type: 'string', nullable: true }
        }
      },
      Reserva: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          aulaId: { type: 'integer' },
          usuarioId: { type: 'integer' },
          fecha: { type: 'string', format: 'date' },
          horaInicio: { type: 'string', example: '14:00' },
          horaFin: { type: 'string', example: '16:00' },
          cantidadPersonas: { type: 'integer', minimum: 1 },
          motivo: { type: 'string', maxLength: 255 },
          estado: {
            type: 'string',
            enum: ['pendiente', 'aprobada', 'rechazada', 'cancelada']
          }
        }
      },
      ReservaNueva: {
        type: 'object',
        required: ['aulaId', 'fecha', 'horaInicio', 'horaFin', 'cantidadPersonas', 'motivo'],
        properties: {
          aulaId: { type: 'integer', minimum: 1 },
          fecha: { type: 'string', format: 'date' },
          horaInicio: { type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '14:00' },
          horaFin: { type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '16:00' },
          cantidadPersonas: { type: 'integer', minimum: 1 },
          motivo: { type: 'string', maxLength: 255 }
        }
      },
      ListadoReservas: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          pagina: { type: 'integer' },
          porPagina: { type: 'integer' },
          datos: { type: 'array', items: { $ref: '#/components/schemas/Reserva' } }
        }
      },
      EntradaHistorial: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          accion: {
            type: 'string',
            enum: ['creacion', 'edicion', 'aprobacion', 'rechazo', 'cancelacion']
          },
          usuarioId: { type: 'integer' },
          usuario: {
            type: 'object',
            nullable: true,
            description: 'Quien hizo el cambio. Sin correo: lo ve también quien pidió la reserva.',
            properties: {
              id: { type: 'integer' },
              nombre: { type: 'string' }
            }
          },
          fechaHora: { type: 'string', format: 'date-time' },
          valorAnterior: { type: 'object', nullable: true },
          valorNuevo: { type: 'object', nullable: true }
        }
      },
      Disponibilidad: {
        type: 'object',
        properties: {
          aulaId: { type: 'integer' },
          fecha: { type: 'string', format: 'date' },
          franjas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                horaInicio: { type: 'string' },
                horaFin: { type: 'string' },
                estado: { type: 'string', enum: ['pendiente', 'aprobada'] }
              }
            }
          }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Operación'],
        summary: 'Estado del servicio y de la base (histórico, equivale a readiness)',
        security: [],
        responses: {
          200: { description: 'El servicio y la base responden' },
          503: respuestaError('La base de datos no responde')
        }
      }
    },
    '/health/live': {
      get: {
        tags: ['Operación'],
        summary: 'Liveness: el proceso está vivo (no consulta la base)',
        security: [],
        responses: { 200: { description: 'El proceso responde' } }
      }
    },
    '/health/ready': {
      get: {
        tags: ['Operación'],
        summary: 'Readiness: el servicio puede atender tráfico',
        security: [],
        responses: {
          200: { description: 'Listo para recibir tráfico' },
          503: respuestaError('La base de datos no responde o tardó demasiado')
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Inicia sesión con credenciales locales',
        description: 'Limitado a 10 intentos por IP cada 15 minutos.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Credenciales' }
            }
          }
        },
        responses: {
          200: {
            description: 'Sesión iniciada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Sesion' } }
            }
          },
          401: ERRORES_COMUNES[401],
          429: ERRORES_COMUNES[429]
        }
      }
    },
    '/reservas': {
      get: {
        tags: ['Reservas'],
        summary: 'Lista reservas con filtros y paginación',
        description:
          'Un usuario común solo recibe sus propias reservas; un administrador recibe todas, con los datos del solicitante.',
        parameters: [
          { name: 'fecha', in: 'query', schema: { type: 'string', format: 'date' } },
          {
            name: 'estado',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['pendiente', 'aprobada', 'rechazada', 'cancelada']
            }
          },
          { name: 'aulaId', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'q', in: 'query', description: 'Busca en el motivo', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
          },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: ['fecha', 'createdAt', 'estado'] }
          },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } }
        ],
        responses: {
          200: {
            description: 'Página de reservas',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ListadoReservas' } }
            }
          },
          400: ERRORES_COMUNES[400],
          401: ERRORES_COMUNES[401]
        }
      },
      post: {
        tags: ['Reservas'],
        summary: 'Solicita una reserva',
        description: [
          'La reserva queda en estado `pendiente`.',
          '',
          'Acepta la cabecera opcional `Idempotency-Key` (UUID): si se reintenta',
          'la misma petición con la misma clave y el mismo cuerpo, se devuelve la',
          'respuesta original en lugar de crear una segunda reserva, y la',
          'respuesta incluye `Idempotent-Replay: true`. La misma clave con un',
          'cuerpo distinto responde 422.'
        ].join('\n'),
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ReservaNueva' } }
          }
        },
        responses: {
          201: {
            description: 'Reserva creada',
            headers: {
              'Idempotent-Replay': {
                description: 'Presente con valor true si la respuesta es una repetición',
                schema: { type: 'string' }
              }
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reserva' } }
            }
          },
          400: respuestaError('Datos inválidos, aula inactiva o capacidad insuficiente'),
          401: ERRORES_COMUNES[401],
          404: ERRORES_COMUNES[404],
          409: respuestaError('El aula ya está reservada en ese horario'),
          422: respuestaError('La clave de idempotencia ya se usó con otro cuerpo'),
          429: ERRORES_COMUNES[429],
          503: ERRORES_COMUNES[503]
        }
      }
    },
    '/reservas/resumen': {
      get: {
        tags: ['Reservas'],
        summary: 'Panel administrativo: métricas y ocupación',
        responses: {
          200: { description: 'Métricas agregadas, distribución por estado y ocupación por aula' },
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403]
        }
      }
    },
    '/reservas/{id}': {
      parameters: [{ $ref: '#/components/parameters/Id' }],
      get: {
        tags: ['Reservas'],
        summary: 'Obtiene una reserva',
        description: 'Un usuario común solo puede ver las suyas.',
        responses: {
          200: {
            description: 'Reserva',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reserva' } }
            }
          },
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403],
          404: ERRORES_COMUNES[404]
        }
      },
      put: {
        tags: ['Reservas'],
        summary: 'Edita una reserva (solo administradores)',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ReservaNueva' } }
          }
        },
        responses: {
          200: {
            description: 'Reserva actualizada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reserva' } }
            }
          },
          400: ERRORES_COMUNES[400],
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403],
          404: ERRORES_COMUNES[404],
          429: ERRORES_COMUNES[429]
        }
      }
    },
    '/reservas/{id}/historial': {
      parameters: [{ $ref: '#/components/parameters/Id' }],
      get: {
        tags: ['Reservas'],
        summary: 'Historial de cambios de la reserva',
        description: 'Registro de auditoría de solo lectura: no puede modificarse ni borrarse.',
        responses: {
          200: {
            description: 'Entradas del historial',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/EntradaHistorial' } }
              }
            }
          },
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403],
          404: ERRORES_COMUNES[404]
        }
      }
    },
    '/reservas/{id}/aprobar': {
      parameters: [{ $ref: '#/components/parameters/Id' }],
      patch: {
        tags: ['Reservas'],
        summary: 'Aprueba una reserva pendiente (solo administradores)',
        responses: {
          200: {
            description: 'Reserva aprobada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reserva' } }
            }
          },
          400: respuestaError('La reserva no está pendiente o el horario ya transcurrió'),
          409: respuestaError('El aula ya está reservada en ese horario'),
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403],
          404: ERRORES_COMUNES[404],
          429: ERRORES_COMUNES[429]
        }
      }
    },
    '/reservas/{id}/rechazar': {
      parameters: [{ $ref: '#/components/parameters/Id' }],
      patch: {
        tags: ['Reservas'],
        summary: 'Rechaza una reserva pendiente (solo administradores)',
        responses: {
          200: {
            description: 'Reserva rechazada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reserva' } }
            }
          },
          400: respuestaError('La reserva no está pendiente'),
          409: respuestaError('El aula ya está reservada en ese horario'),
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403],
          404: ERRORES_COMUNES[404],
          429: ERRORES_COMUNES[429]
        }
      }
    },
    '/reservas/{id}/cancelar': {
      parameters: [{ $ref: '#/components/parameters/Id' }],
      patch: {
        tags: ['Reservas'],
        summary: 'Cancela una reserva',
        description: 'El solicitante puede cancelar las suyas; un administrador, cualquiera.',
        responses: {
          200: {
            description: 'Reserva cancelada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Reserva' } }
            }
          },
          400: respuestaError('La reserva ya terminó o no puede cancelarse'),
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403],
          404: ERRORES_COMUNES[404],
          429: ERRORES_COMUNES[429]
        }
      }
    },
    '/aulas': {
      get: {
        tags: ['Aulas'],
        summary: 'Lista las aulas',
        parameters: [
          {
            name: 'incluirInactivas',
            in: 'query',
            description: 'Solo tiene efecto para administradores',
            schema: { type: 'string', enum: ['true', 'false'] }
          }
        ],
        responses: {
          200: {
            description: 'Aulas',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Aula' } }
              }
            }
          },
          401: ERRORES_COMUNES[401]
        }
      },
      post: {
        tags: ['Aulas'],
        summary: 'Crea un aula (solo administradores)',
        description: 'El nombre es único sin distinguir mayúsculas.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AulaNueva' } }
          }
        },
        responses: {
          201: {
            description: 'Aula creada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Aula' } }
            }
          },
          400: ERRORES_COMUNES[400],
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403],
          409: respuestaError('Ya existe un aula con ese nombre'),
          429: ERRORES_COMUNES[429]
        }
      }
    },
    '/aulas/{id}': {
      parameters: [{ $ref: '#/components/parameters/Id' }],
      put: {
        tags: ['Aulas'],
        summary: 'Edita un aula (solo administradores)',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AulaNueva' } }
          }
        },
        responses: {
          200: {
            description: 'Aula actualizada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Aula' } }
            }
          },
          400: ERRORES_COMUNES[400],
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403],
          404: ERRORES_COMUNES[404],
          409: respuestaError('Nombre duplicado o capacidad menor a las reservas futuras'),
          429: ERRORES_COMUNES[429]
        }
      }
    },
    '/aulas/{id}/disponibilidad': {
      parameters: [{ $ref: '#/components/parameters/Id' }],
      get: {
        tags: ['Aulas'],
        summary: 'Franjas ocupadas del aula en una fecha',
        parameters: [
          { name: 'fecha', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          200: {
            description: 'Disponibilidad',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Disponibilidad' } }
            }
          },
          400: ERRORES_COMUNES[400],
          401: ERRORES_COMUNES[401],
          404: ERRORES_COMUNES[404]
        }
      }
    },
    '/aulas/{id}/desactivar': {
      parameters: [{ $ref: '#/components/parameters/Id' }],
      patch: {
        tags: ['Aulas'],
        summary: 'Da de baja un aula (solo administradores)',
        description: [
          'El aula deja de aceptar nuevas reservas y se conserva su historial.',
          'Si tiene reservas futuras pendientes o aprobadas, la operación se',
          'rechaza salvo que se envíe `cancelarReservasFuturas: true`, que las',
          'cancela registrando cada cambio en el historial.'
        ].join('\n'),
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { cancelarReservasFuturas: { type: 'boolean', default: false } }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Aula dada de baja',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Aula' } }
            }
          },
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403],
          404: ERRORES_COMUNES[404],
          409: respuestaError('Tiene reservas futuras y no se pidió cancelarlas'),
          429: ERRORES_COMUNES[429]
        }
      }
    },
    '/aulas/{id}/reactivar': {
      parameters: [{ $ref: '#/components/parameters/Id' }],
      patch: {
        tags: ['Aulas'],
        summary: 'Reactiva un aula dada de baja (solo administradores)',
        responses: {
          200: {
            description: 'Aula reactivada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Aula' } }
            }
          },
          401: ERRORES_COMUNES[401],
          403: ERRORES_COMUNES[403],
          404: ERRORES_COMUNES[404],
          429: ERRORES_COMUNES[429]
        }
      }
    }
  }
};

export default openapi;
