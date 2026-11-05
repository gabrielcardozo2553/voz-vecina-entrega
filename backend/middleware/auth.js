const jwt = require('jsonwebtoken');
const db = require('../config/db');


async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado, falta el token' });
  }

  const [esquema, token] = authHeader.split(' ');
  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autorizado, falta el token' });
  }

  let datos;
  try {
    datos = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    // Se confirma en la base que la cuenta sigue existiendo, su rol actual y que la sesión no fue cerrada
    // (por ejemplo, al cambiar la contraseña). Así los cambios valen de inmediato y no recién al vencer el token.
    const [filas] = await db.query('SELECT nombre, rol, sesion_desde FROM usuarios WHERE id = ?', [datos.id]);
    const cuenta = filas[0];
    if (!cuenta || (cuenta.sesion_desde !== null && Number(datos.iat) < Number(cuenta.sesion_desde))) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    req.usuario = { ...datos, nombre: cuenta.nombre, rol: cuenta.rol };
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo comprobar la sesión' });
  }
}

function verificarAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No tienes permisos de administrador' });
  }
  next();
}

module.exports = { verificarToken, verificarAdmin };