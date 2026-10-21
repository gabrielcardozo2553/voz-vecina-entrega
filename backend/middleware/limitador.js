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

module.exports = { limitarLogin, limitarRegistro };
