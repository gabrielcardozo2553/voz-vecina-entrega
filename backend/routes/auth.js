const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { limitarLogin, limitarRegistro } = require('../middleware/limitador');

const MINIMO_PASSWORD = 8;
// Hash de relleno: se compara igual aunque el email no exista, para que la demora no delate qué cuentas existen.
const HASH_FALSO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');


router.post('/registro', limitarRegistro, async (req, res) => {
  try {
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

    const [existentesEmail] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existentesEmail.length > 0) {
      return res.status(400).json({ error: 'Ese email ya está registrado' });
    }

    const [existentesDni] = await db.query('SELECT id FROM usuarios WHERE dni = ?', [dniLimpio]);
    if (existentesDni.length > 0) {
      return res.status(400).json({ error: 'Ese DNI ya está registrado' });
    }

    
    const passwordHasheada = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO usuarios (nombre, apellido, dni, email, password, consentimiento_fecha) VALUES (?, ?, ?, ?, ?, NOW())',
      [nombre, apellido, dniLimpio, email, passwordHasheada]
    );

    res.status(201).json({ id: result.insertId, mensaje: 'Usuario registrado correctamente' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ese email o DNI ya está registrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});


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

    
    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

module.exports = router;