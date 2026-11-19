// Carga datos de demostración: una cuenta de administrador, dos de vecinos y reportes de ejemplo.
// Crea la base y las tablas si hacen falta. Se puede ejecutar varias veces sin duplicar nada.
// Uso:  npm run demo
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { asegurarBaseDeDatos } = require('../config/crearBase');
const { prepararBaseDeDatos } = require('../config/migraciones');
const { cifrarDni, huellaDni } = require('../config/cifrado');

const CUENTAS = [
  { nombre: 'Administración', apellido: 'Municipal', dni: '10000001', email: 'admin@example.com', password: 'Admin2026!', rol: 'admin' },
  { nombre: 'Ana', apellido: 'Gómez', dni: '20000002', email: 'ana@example.com', password: 'Vecino2026!', rol: 'vecino' },
  { nombre: 'Luis', apellido: 'Pérez', dni: '20000003', email: 'luis@example.com', password: 'Vecino2026!', rol: 'vecino' },
];

// [cuenta, categoría, descripción, dirección, latitud, longitud, estado, días de antigüedad]
const REPORTES = [
  ['ana', 'Baches', 'Bache grande en la calzada, ya rompió una cubierta.', 'Av. San Martín 450', -29.1792, -56.6431, 'pendiente', 2],
  ['luis', 'Alumbrado público', 'La luminaria de la esquina lleva una semana apagada.', 'Calle Belgrano 120', -29.1801, -56.6462, 'en_proceso', 6],
  ['ana', 'Basura / Limpieza', 'Basural acumulado junto a la plaza.', 'Plaza principal', -29.1775, -56.6449, 'pendiente', 3],
  ['luis', 'Animales sueltos', 'Perros sueltos en la zona de la escuela.', 'Calle Mitre 310', -29.1812, -56.6418, 'resuelto', 15],
  ['ana', 'Inundaciones', 'Se junta agua en la esquina cuando llueve.', 'Calle Sarmiento 88', -29.1786, -56.6475, 'en_proceso', 9],
  ['luis', 'Tránsito / Señales', 'Falta el cartel de PARE.', 'Av. Libertad y Rivadavia', -29.1769, -56.6402, 'pendiente', 1],
  ['ana', 'Espacios verdes', 'Pasto muy alto en la plazoleta del barrio.', 'Barrio Norte', -29.1740, -56.6440, 'resuelto', 18],
  ['luis', 'Vandalismo', 'Pintadas en el frente del salón comunitario.', 'Calle Moreno 205', -29.1822, -56.6455, 'pendiente', 4],
  ['ana', 'Baches', 'Pozo en la entrada del barrio.', 'Acceso sur', -29.1835, -56.6430, 'resuelto', 20],
  ['luis', 'Alumbrado público', 'Poste con cables sueltos.', 'Calle Urquiza 77', -29.1758, -56.6481, 'en_proceso', 7],
];

async function cargarDatosDemo() {
  await asegurarBaseDeDatos();
  await prepararBaseDeDatos();

  const ids = {};
  for (const c of CUENTAS) {
    const [existe] = await db.query('SELECT id FROM usuarios WHERE email = ?', [c.email]);
    if (existe.length > 0) {
      ids[c.email.split('@')[0]] = existe[0].id;
      continue;
    }
    const clave = await bcrypt.hash(c.password, 10);
    const [res] = await db.query(
      `INSERT INTO usuarios (nombre, apellido, dni, dni_hash, email, password, rol, email_verificado, consentimiento_fecha)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [c.nombre, c.apellido, cifrarDni(c.dni), huellaDni(c.dni), c.email, clave, c.rol]
    );
    ids[c.email.split('@')[0]] = res.insertId;
    console.log(`Cuenta creada: ${c.email}`);
  }

  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM reportes');
  if (total === 0) {
    const [categorias] = await db.query('SELECT id, nombre FROM categorias');
    const idCategoria = (nombre) => categorias.find((c) => c.nombre === nombre)?.id;
    for (const [cuenta, categoria, descripcion, direccion, lat, lng, estado, dias] of REPORTES) {
      const [res] = await db.query(
        `INSERT INTO reportes (usuario_id, categoria_id, descripcion, direccion, latitud, longitud, estado, fecha_creacion, fecha_resolucion)
         VALUES (?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY),
                 ${estado === 'resuelto' ? 'DATE_SUB(NOW(), INTERVAL ? DAY)' : 'NULL'})`,
        [ids[cuenta], idCategoria(categoria), `[DEMO] ${descripcion}`, direccion, lat, lng, estado, dias,
          ...(estado === 'resuelto' ? [Math.max(1, dias - 5)] : [])]
      );
      if (estado !== 'pendiente') {
        await db.query(
          'INSERT INTO historial_reportes (reporte_id, usuario_nombre, accion, detalle) VALUES (?, ?, ?, ?)',
          [res.insertId, 'Administración', 'estado',
            `Pendiente → ${estado === 'resuelto' ? 'Resuelto' : 'En proceso'}`]
        );
      }
    }
    console.log(`Se cargaron ${REPORTES.length} reportes de ejemplo`);
  } else {
    console.log('Ya hay reportes: no se agregaron los de ejemplo.');
  }

  console.log('\nCuentas de demostración:');
  console.log('  Administrador:  admin@example.com  /  Admin2026!');
  console.log('  Vecino:         ana@example.com    /  Vecino2026!');
  console.log('  Vecino:         luis@example.com   /  Vecino2026!');
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Este script es solo para demostración: no se ejecuta con NODE_ENV=production.');
    process.exit(1);
  }
  await cargarDatosDemo();
  await db.end();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('No se pudieron cargar los datos de demostración:', error.message || error.code);
    console.error('Revisa que MySQL esté encendido y que backend/.env tenga los datos correctos (DB_HOST, DB_USER, DB_PASSWORD).');
    process.exit(1);
  });
}

module.exports = { cargarDatosDemo, CUENTAS };
