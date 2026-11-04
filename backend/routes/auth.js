const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { prepararBaseDeDatos } = require('../config/migraciones');
const { enviarCodigo } = require('../config/correo');
const { captchaConfigurado, verificarCaptcha } = require('../config/captcha');
const { verificarGoogle, verificarFacebook, googleConfigurado, facebookConfigurado } = require('../config/proveedores');
const {
  limitarLogin, limitarRegistro, limitarVerificacion, limitarReenvio, limitarRecuperacion, limitarSocial,
} = require('../middleware/limitador');

const MINIMO_PASSWORD = 8;
const MINUTOS_CODIGO = 15;
const MAX_INTENTOS_CODIGO = 5;
const SEGUNDOS_ENTRE_ENVIOS = 60;
// Hash de relleno: se compara igual aunque el email no exista, para que la demora no delate qué cuentas existen.
const HASH_FALSO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);
// Solo letras, números y los símbolos habituales: así no entran comillas, paréntesis, comas, <> ni otros
// caracteres con significado especial en las direcciones de correo (ni dominios con caracteres raros).
const EMAIL_VALIDO = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const SECRETO_REGISTRO = () => `${process.env.JWT_SECRET}:registro-social`;

function emitirSesion(usuario) {
  const token = jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  );
  return { token, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } };
}

const generarCodigo = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const hashCodigo = (codigo) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(codigo).digest('hex');

function codigoCoincide(codigo, hashGuardado) {
  const a = Buffer.from(hashCodigo(codigo), 'hex');
  const b = Buffer.from(String(hashGuardado), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function emailODniOcupado(email, dni) {
  const [porEmail] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (porEmail.length > 0) return 'Ese email ya está registrado';
  const [porDni] = await db.query('SELECT id FROM usuarios WHERE dni = ?', [dni]);
  if (porDni.length > 0) return 'Ese DNI ya está registrado';
  return null;
}

// Qué métodos de ingreso están disponibles (el navegador arma los botones con esto).
router.get('/proveedores', (req, res) => {
  res.json({
    google: googleConfigurado() ? process.env.GOOGLE_CLIENT_ID : null,
    facebook: facebookConfigurado() ? process.env.FACEBOOK_APP_ID : null,
    captcha: captchaConfigurado() ? process.env.TURNSTILE_SITE_KEY : null,
  });
});

// ── Registro con email: primero se confirma el correo con un código ──
router.post('/registro', limitarRegistro, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    if (!(await verificarCaptcha(req.body.captcha, req.ip))) {
      return res.status(400).json({ error: 'No pudimos confirmar que eres una persona. Completa la verificación e inténtalo de nuevo.' });
    }
    const { dni, password, aceptaTerminos } = req.body;
    const nombre = texto(req.body.nombre, 100);
    const apellido = texto(req.body.apellido, 100);
    const email = texto(req.body.email, 150).toLowerCase();

    if (!nombre || !apellido || !dni || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    if (!EMAIL_VALIDO.test(email)) {
      return res.status(400).json({ error: 'El email no es válido' });
    }
    if (typeof password !== 'string' || password.length < MINIMO_PASSWORD || password.length > 72) {
      return res.status(400).json({ error: `La contraseña debe tener entre ${MINIMO_PASSWORD} y 72 caracteres` });
    }
    const dniLimpio = String(dni).trim();
    if (!/^\d{7,8}$/.test(dniLimpio)) {
      return res.status(400).json({ error: 'El DNI debe tener 7 u 8 números, sin puntos' });
    }
    if (aceptaTerminos !== true) {
      return res.status(400).json({ error: 'Tienes que aceptar el uso de tus datos para registrarte' });
    }

    const ocupado = await emailODniOcupado(email, dniLimpio);
    if (ocupado) return res.status(400).json({ error: ocupado });

    const codigo = generarCodigo();
    const datos = JSON.stringify({
      nombre, apellido, dni: dniLimpio, passwordHash: await bcrypt.hash(password, 10),
    });

    await db.query(
      `INSERT INTO registros_pendientes (email, datos, codigo_hash, intentos, vence, ultimo_envio)
       VALUES (?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())
       ON DUPLICATE KEY UPDATE datos = VALUES(datos), codigo_hash = VALUES(codigo_hash), intentos = 0,
                               vence = VALUES(vence), ultimo_envio = NOW()`,
      [email, datos, hashCodigo(codigo), MINUTOS_CODIGO]
    );

    try {
      await enviarCodigo(email, codigo, nombre);
    } catch (errorCorreo) {
      console.error('No se pudo enviar el correo:', errorCorreo.message);
      await db.query('DELETE FROM registros_pendientes WHERE email = ?', [email]);
      return res.status(502).json({ error: 'No pudimos enviar el correo. Revisa que el email esté bien escrito e inténtalo de nuevo.' });
    }

    res.status(202).json({ pendiente: true, email, mensaje: 'Te enviamos un código por correo' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

router.post('/verificar-email', limitarVerificacion, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    const email = texto(req.body.email, 150).toLowerCase();
    const codigo = texto(req.body.codigo, 10).replace(/\s/g, '');
    if (!email || !/^\d{6}$/.test(codigo)) {
      return res.status(400).json({ error: 'Escribe el código de 6 números que te llegó por correo' });
    }

    const [filas] = await db.query(
      'SELECT *, vence < NOW() AS vencido FROM registros_pendientes WHERE email = ?',
      [email]
    );
    const pendiente = filas[0];
    if (!pendiente || pendiente.vencido) {
      if (pendiente) await db.query('DELETE FROM registros_pendientes WHERE id = ?', [pendiente.id]);
      return res.status(400).json({ error: 'El código venció. Pide uno nuevo.' });
    }
    if (pendiente.intentos >= MAX_INTENTOS_CODIGO) {
      await db.query('DELETE FROM registros_pendientes WHERE id = ?', [pendiente.id]);
      return res.status(400).json({ error: 'Se agotaron los intentos. Vuelve a registrarte para recibir otro código.' });
    }

    if (!codigoCoincide(codigo, pendiente.codigo_hash)) {
      await db.query('UPDATE registros_pendientes SET intentos = intentos + 1 WHERE id = ?', [pendiente.id]);
      return res.status(400).json({ error: 'El código no es correcto' });
    }

    const datos = JSON.parse(pendiente.datos);
    const ocupado = await emailODniOcupado(email, datos.dni);
    if (ocupado) {
      await db.query('DELETE FROM registros_pendientes WHERE id = ?', [pendiente.id]);
      return res.status(400).json({ error: ocupado });
    }

    const [resultado] = await db.query(
      `INSERT INTO usuarios (nombre, apellido, dni, email, password, email_verificado, consentimiento_fecha)
       VALUES (?, ?, ?, ?, ?, 1, NOW())`,
      [datos.nombre, datos.apellido, datos.dni, email, datos.passwordHash]
    );
    await db.query('DELETE FROM registros_pendientes WHERE id = ?', [pendiente.id]);

    const [usuarios] = await db.query('SELECT id, nombre, rol FROM usuarios WHERE id = ?', [resultado.insertId]);
    res.status(201).json(emitirSesion(usuarios[0]));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ese email o DNI ya está registrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al confirmar el correo' });
  }
});

router.post('/reenviar-codigo', limitarReenvio, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    const email = texto(req.body.email, 150).toLowerCase();
    const [filas] = await db.query(
      'SELECT id, datos, TIMESTAMPDIFF(SECOND, ultimo_envio, NOW()) AS segundos FROM registros_pendientes WHERE email = ?',
      [email]
    );
    if (filas.length === 0) {
      return res.status(400).json({ error: 'No hay un registro pendiente para ese email. Vuelve a registrarte.' });
    }
    if (filas[0].segundos < SEGUNDOS_ENTRE_ENVIOS) {
      return res.status(429).json({ error: `Espera ${SEGUNDOS_ENTRE_ENVIOS - filas[0].segundos} segundos para pedir otro código.` });
    }

    const codigo = generarCodigo();
    await db.query(
      `UPDATE registros_pendientes
       SET codigo_hash = ?, intentos = 0, vence = DATE_ADD(NOW(), INTERVAL ? MINUTE), ultimo_envio = NOW()
       WHERE id = ?`,
      [hashCodigo(codigo), MINUTOS_CODIGO, filas[0].id]
    );
    try {
      await enviarCodigo(email, codigo, JSON.parse(filas[0].datos).nombre);
    } catch (errorCorreo) {
      console.error('No se pudo enviar el correo:', errorCorreo.message);
      return res.status(502).json({ error: 'No pudimos enviar el correo. Inténtalo de nuevo en un momento.' });
    }
    res.json({ mensaje: 'Te enviamos un código nuevo' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al reenviar el código' });
  }
});

// ── Olvidé mi contraseña: código por correo y contraseña nueva ──
const RESPUESTA_RECUPERAR = { mensaje: 'Si ese email está registrado, te enviamos un código.' };

router.post('/recuperar', limitarRecuperacion, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    const email = texto(req.body.email, 150).toLowerCase();
    if (!EMAIL_VALIDO.test(email)) {
      return res.status(400).json({ error: 'Ingresa un email válido' });
    }

    // La respuesta es siempre la misma, exista o no la cuenta, para no revelar quién está registrado.
    const [usuarios] = await db.query('SELECT nombre FROM usuarios WHERE email = ?', [email]);
    if (usuarios.length === 0) return res.json(RESPUESTA_RECUPERAR);

    const [previas] = await db.query(
      'SELECT TIMESTAMPDIFF(SECOND, ultimo_envio, NOW()) AS segundos FROM recuperaciones WHERE email = ?',
      [email]
    );
    if (previas.length > 0 && previas[0].segundos < SEGUNDOS_ENTRE_ENVIOS) {
      return res.json(RESPUESTA_RECUPERAR);
    }

    const codigo = generarCodigo();
    await db.query(
      `INSERT INTO recuperaciones (email, codigo_hash, intentos, vence, ultimo_envio)
       VALUES (?, ?, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())
       ON DUPLICATE KEY UPDATE codigo_hash = VALUES(codigo_hash), intentos = 0,
         vence = VALUES(vence), ultimo_envio = VALUES(ultimo_envio)`,
      [email, hashCodigo(codigo), MINUTOS_CODIGO]
    );
    try {
      await enviarCodigo(email, codigo, usuarios[0].nombre, { recuperar: true });
    } catch (errorCorreo) {
      console.error('No se pudo enviar el correo:', errorCorreo.message);
      await db.query('DELETE FROM recuperaciones WHERE email = ?', [email]);
      return res.status(502).json({ error: 'No pudimos enviar el correo. Inténtalo de nuevo en un momento.' });
    }
    res.json(RESPUESTA_RECUPERAR);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar el código' });
  }
});

router.post('/restablecer', limitarVerificacion, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    const email = texto(req.body.email, 150).toLowerCase();
    const codigo = texto(req.body.codigo, 10).replace(/\s/g, '');
    const { password } = req.body;
    if (!email || !/^\d{6}$/.test(codigo)) {
      return res.status(400).json({ error: 'Escribe el código de 6 números que te llegó por correo' });
    }
    if (typeof password !== 'string' || password.length < MINIMO_PASSWORD || password.length > 72) {
      return res.status(400).json({ error: `La contraseña debe tener entre ${MINIMO_PASSWORD} y 72 caracteres` });
    }

    const [filas] = await db.query(
      'SELECT *, vence < NOW() AS vencido FROM recuperaciones WHERE email = ?',
      [email]
    );
    const pedido = filas[0];
    if (!pedido || pedido.vencido) {
      if (pedido) await db.query('DELETE FROM recuperaciones WHERE id = ?', [pedido.id]);
      return res.status(400).json({ error: 'El código venció. Pide uno nuevo.' });
    }
    if (pedido.intentos >= MAX_INTENTOS_CODIGO) {
      await db.query('DELETE FROM recuperaciones WHERE id = ?', [pedido.id]);
      return res.status(400).json({ error: 'Se agotaron los intentos. Pide un código nuevo.' });
    }
    if (!codigoCoincide(codigo, pedido.codigo_hash)) {
      await db.query('UPDATE recuperaciones SET intentos = intentos + 1 WHERE id = ?', [pedido.id]);
      return res.status(400).json({ error: 'El código no es correcto' });
    }

    // Poder leer el código demuestra que el correo es de la persona, así que también queda confirmado.
    const passwordHash = await bcrypt.hash(password, 10);
    const [resultado] = await db.query(
      'UPDATE usuarios SET password = ?, email_verificado = 1 WHERE email = ?',
      [passwordHash, email]
    );
    await db.query('DELETE FROM recuperaciones WHERE id = ?', [pedido.id]);
    if (resultado.affectedRows === 0) {
      return res.status(400).json({ error: 'No se encontró la cuenta. Pide un código nuevo.' });
    }

    const [usuarios] = await db.query('SELECT id, nombre, rol FROM usuarios WHERE email = ?', [email]);
    res.json(emitirSesion(usuarios[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
});

// ── Ingreso con Google o Facebook ──
async function responderConIdentidad(res, identidad) {
  const columna = identidad.proveedor === 'google' ? 'google_id' : 'facebook_id';

  let [usuarios] = await db.query(`SELECT id, nombre, rol FROM usuarios WHERE ${columna} = ?`, [identidad.id]);

  // Google confirma que el email es de la persona: si ya había una cuenta con ese email, se vincula.
  if (usuarios.length === 0 && identidad.proveedor === 'google') {
    [usuarios] = await db.query('SELECT id, nombre, rol FROM usuarios WHERE email = ?', [identidad.email]);
    if (usuarios.length > 0) {
      await db.query(
        'UPDATE usuarios SET google_id = ?, email_verificado = 1 WHERE id = ? AND google_id IS NULL',
        [identidad.id, usuarios[0].id]
      );
    }
  }

  if (usuarios.length > 0) return res.json(emitirSesion(usuarios[0]));

  // Persona nueva: faltan el DNI y el consentimiento. Se devuelve un pase corto para completar el registro.
  const registroToken = jwt.sign(
    {
      proveedor: identidad.proveedor,
      id: identidad.id,
      email: identidad.email,
      emailVerificado: identidad.emailVerificado,
      nombre: identidad.nombre,
      apellido: identidad.apellido,
    },
    SECRETO_REGISTRO(),
    { expiresIn: '20m', algorithm: 'HS256' }
  );
  return res.json({
    requiereRegistro: true,
    registroToken,
    perfil: { nombre: identidad.nombre, apellido: identidad.apellido, email: identidad.email },
  });
}

function manejarErrorSocial(error, res) {
  if (error.rechazada) return res.status(401).json({ error: 'No pudimos confirmar tu identidad. Inténtalo de nuevo.' });
  console.error(error);
  return res.status(500).json({ error: 'No se pudo ingresar. Inténtalo de nuevo en un momento.' });
}

router.post('/google', limitarSocial, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    if (!googleConfigurado()) return res.status(503).json({ error: 'El ingreso con Google no está disponible' });
    const credencial = texto(req.body.credential, 4096);
    if (!credencial) return res.status(400).json({ error: 'Falta la credencial de Google' });
    await responderConIdentidad(res, await verificarGoogle(credencial));
  } catch (error) {
    manejarErrorSocial(error, res);
  }
});

router.post('/facebook', limitarSocial, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    if (!facebookConfigurado()) return res.status(503).json({ error: 'El ingreso con Facebook no está disponible' });
    const accessToken = texto(req.body.accessToken, 4096);
    if (!accessToken) return res.status(400).json({ error: 'Falta la credencial de Facebook' });
    await responderConIdentidad(res, await verificarFacebook(accessToken));
  } catch (error) {
    manejarErrorSocial(error, res);
  }
});

router.post('/completar-registro', limitarSocial, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    let datos;
    try {
      datos = jwt.verify(String(req.body.registroToken || ''), SECRETO_REGISTRO(), { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'Pasó mucho tiempo. Vuelve a ingresar con Google o Facebook.' });
    }

    const nombre = texto(req.body.nombre, 100) || datos.nombre;
    const apellido = texto(req.body.apellido, 100) || datos.apellido;
    const dniLimpio = String(req.body.dni || '').trim();
    // Si el proveedor no entregó email (Facebook), lo escribe la persona y queda sin confirmar.
    const email = (datos.email || texto(req.body.email, 150)).toLowerCase();

    if (!nombre || !apellido) return res.status(400).json({ error: 'Completa tu nombre y apellido' });
    if (!/^\d{7,8}$/.test(dniLimpio)) {
      return res.status(400).json({ error: 'El DNI debe tener 7 u 8 números, sin puntos' });
    }
    if (!EMAIL_VALIDO.test(email)) return res.status(400).json({ error: 'Escribe un email válido' });
    if (req.body.aceptaTerminos !== true) {
      return res.status(400).json({ error: 'Tienes que aceptar el uso de tus datos para registrarte' });
    }

    const ocupado = await emailODniOcupado(email, dniLimpio);
    if (ocupado) {
      return res.status(400).json({
        error: `${ocupado}. Si ya tienes cuenta, ingresa con tu email y contraseña.`,
      });
    }

    const columna = datos.proveedor === 'google' ? 'google_id' : 'facebook_id';
    // Cuenta sin contraseña propia: se guarda una clave al azar que nadie conoce.
    const claveInutilizable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    const [resultado] = await db.query(
      `INSERT INTO usuarios (nombre, apellido, dni, email, password, ${columna}, email_verificado, consentimiento_fecha)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nombre, apellido, dniLimpio, email, claveInutilizable, datos.id, datos.emailVerificado ? 1 : 0]
    );

    const [usuarios] = await db.query('SELECT id, nombre, rol FROM usuarios WHERE id = ?', [resultado.insertId]);
    res.status(201).json(emitirSesion(usuarios[0]));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Esa cuenta, email o DNI ya está registrado. Prueba ingresando.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al completar el registro' });
  }
});

// ── Ingreso con email y contraseña ──
router.post('/login', limitarLogin, async (req, res) => {
  try {
    const email = texto(req.body.email, 150).toLowerCase();
    const { password } = req.body;
    if (!email || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email o contraseña incorrectos' });
    }

    const [usuarios] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (usuarios.length === 0) {
      await bcrypt.compare(password, HASH_FALSO);
      return res.status(400).json({ error: 'Email o contraseña incorrectos' });
    }

    const usuario = usuarios[0];
    const passwordCorrecta = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecta) {
      return res.status(400).json({ error: 'Email o contraseña incorrectos' });
    }

    res.json(emitirSesion(usuario));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

module.exports = router;
