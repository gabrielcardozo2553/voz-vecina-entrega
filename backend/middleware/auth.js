const jwt = require('jsonwebtoken');
const db = require('../config/db');

const NOMBRE_COOKIE = 'vv_sesion';

function leerCookie(req, nombre) {
  const crudo = req.headers.cookie;
  if (!crudo) return null;
  for (const par of crudo.split(';')) {
    const i = par.indexOf('=');
    if (i > 0 && par.slice(0, i).trim() === nombre) {
      try { return decodeURIComponent(par.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

// Con la sesión en cookie, un sitio ajeno no debe poder hacer acciones en nombre de la persona:
// si el navegador indica de qué sitio viene la petición, tiene que ser este mismo sitio.
function origenAjeno(req) {
  const origen = req.headers.origin;
  if (!origen || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return false;
  try { return new URL(origen).host !== req.headers.host; } catch { return true; }
}


async function verificarToken(req, res, next) {
  // La sesión viaja en una cookie que el JavaScript de la página no puede leer. También se acepta
  // el encabezado Authorization (útil para pruebas con herramientas externas).
  let token = leerCookie(req, NOMBRE_COOKIE);
  if (token) {
    if (origenAjeno(req)) return res.status(403).json({ error: 'Solicitud no permitida' });
  } else {
    const [esquema, valor] = String(req.headers.authorization || '').split(' ');
    if (esquema === 'Bearer' && valor) token = valor;
  }
  if (!token) {
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

module.exports = { verificarToken, verificarAdmin, NOMBRE_COOKIE };