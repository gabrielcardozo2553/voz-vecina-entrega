const jwt = require('jsonwebtoken');
const db = require('../config/db');


function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado, falta el token' });
  }

  const [esquema, token] = authHeader.split(' ');
  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autorizado, falta el token' });
  }

  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.usuario = datos; 
    next(); 
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}


// El rol se confirma en la base de datos (no solo en el token), para que quitar el permiso de administrador
// o borrar una cuenta tenga efecto de inmediato y no recién cuando venza la sesión.
async function verificarAdmin(req, res, next) {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' });
    }
    const [filas] = await db.query('SELECT rol FROM usuarios WHERE id = ?', [req.usuario.id]);
    if (filas.length === 0 || filas[0].rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' });
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo comprobar el permiso' });
  }
}

module.exports = { verificarToken, verificarAdmin };