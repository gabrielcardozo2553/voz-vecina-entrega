// Limitador de intentos en memoria (sin dependencias). Frena la fuerza bruta en login y registro.
function crearLimitador({ ventanaMs, maximo, mensaje, clave }) {
  const intentos = new Map();

  setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of intentos) if (v.vence <= ahora) intentos.delete(k);
  }, 60 * 1000).unref();

  return (req, res, next) => {
    const k = clave(req);
    const ahora = Date.now();
    let registro = intentos.get(k);
    if (!registro || registro.vence <= ahora) {
      registro = { cuenta: 0, vence: ahora + ventanaMs };
      intentos.set(k, registro);
    }
    registro.cuenta += 1;
    if (registro.cuenta > maximo) {
      res.set('Retry-After', String(Math.ceil((registro.vence - ahora) / 1000)));
      return res.status(429).json({ error: mensaje });
    }
    next();
  };
}

const limitarLogin = crearLimitador({
  ventanaMs: 15 * 60 * 1000,
  maximo: 10,
  mensaje: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  clave: (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase()}`,
});

const limitarRegistro = crearLimitador({
  ventanaMs: 60 * 60 * 1000,
  maximo: 30,
  mensaje: 'Demasiados registros desde esta conexión. Inténtalo más tarde.',
  clave: (req) => req.ip,
});

// Evita que una misma cuenta llene el servidor de reportes, mensajes o fotos.
const limitarReportes = crearLimitador({
  ventanaMs: 60 * 60 * 1000,
  maximo: 20,
  mensaje: 'Enviaste muchos reportes en poco tiempo. Inténtalo de nuevo más tarde.',
  clave: (req) => `reportes|${req.usuario?.id || req.ip}`,
});

const limitarMensajes = crearLimitador({
  ventanaMs: 60 * 60 * 1000,
  maximo: 120,
  mensaje: 'Enviaste muchos mensajes en poco tiempo. Inténtalo de nuevo más tarde.',
  clave: (req) => `mensajes|${req.usuario?.id || req.ip}`,
});

// Códigos de confirmación: pocos intentos para que no se puedan adivinar.
const limitarVerificacion = crearLimitador({
  ventanaMs: 15 * 60 * 1000,
  maximo: 10,
  mensaje: 'Demasiados intentos con el código. Espera unos minutos e inténtalo de nuevo.',
  clave: (req) => `verificar|${req.ip}|${String(req.body?.email || '').toLowerCase()}`,
});

const limitarReenvio = crearLimitador({
  ventanaMs: 60 * 60 * 1000,
  maximo: 6,
  mensaje: 'Pediste muchos códigos. Espera un rato antes de pedir otro.',
  clave: (req) => `reenvio|${String(req.body?.email || '').toLowerCase()}|${req.ip}`,
});

const limitarSocial = crearLimitador({
  ventanaMs: 15 * 60 * 1000,
  maximo: 40,
  mensaje: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  clave: (req) => `social|${req.ip}`,
});

module.exports = { limitarLogin, limitarRegistro, limitarReportes, limitarMensajes, limitarVerificacion, limitarReenvio, limitarSocial };
