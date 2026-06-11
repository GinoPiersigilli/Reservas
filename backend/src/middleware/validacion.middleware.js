export const validarCrearReserva = (req, res, next) => {
  const { aulaId, usuarioId, fecha, horaInicio, horaFin, cantidadPersonas, motivo } = req.body;
  const faltantes = [];

  if (!aulaId)           faltantes.push('aulaId');
  if (!fecha)            faltantes.push('fecha');
  if (!horaInicio)       faltantes.push('horaInicio');
  if (!horaFin)          faltantes.push('horaFin');
  if (!cantidadPersonas) faltantes.push('cantidadPersonas');
  if (!motivo)           faltantes.push('motivo');

  if (faltantes.length > 0) {
    return res.status(400).json({
      error: `Faltan campos obligatorios: ${faltantes.join(', ')}`
    });
  }

  next();
};

export const validarLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email y contraseña son obligatorios'
    });
  }

  next();
};

export const validarRegistro = (req, res, next) => {
  const { nombre, email, password } = req.body;
  const faltantes = [];

  if (!nombre)   faltantes.push('nombre');
  if (!email)    faltantes.push('email');
  if (!password) faltantes.push('password');

  if (faltantes.length > 0) {
    return res.status(400).json({
      error: `Faltan campos obligatorios: ${faltantes.join(', ')}`
    });
  }

  next();
};