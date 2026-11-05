const db = require('./db');
const { cifradoActivo, estaCifrado, cifrarDni, descifrarDni, huellaDni } = require('./cifrado');

let preparada = null;

async function agregarColumnaSiFalta(tabla, columna, definicion) {
  const [existe] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna]
  );
  if (existe.length === 0) {
    await db.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    console.log(`Se agregó la columna ${tabla}.${columna}`);
    return true;
  }
  return false;
}

async function agregarIndiceSiFalta(tabla, nombre, columnas, unico = false) {
  const [existe] = await db.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [tabla, nombre]
  );
  if (existe.length === 0) {
    await db.query(`CREATE ${unico ? 'UNIQUE ' : ''}INDEX ${nombre} ON ${tabla} (${columnas})`);
    console.log(`Se agregó el índice ${nombre}`);
  }
}

// El DNI cifrado ocupa más lugar que 8 números: se amplía la columna si hace falta.
async function ampliarColumnaDni() {
  const [col] = await db.query(
    `SELECT CHARACTER_MAXIMUM_LENGTH AS largo FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'dni'`
  );
  if (col.length > 0 && Number(col[0].largo) < 120) {
    await db.query('ALTER TABLE usuarios MODIFY dni VARCHAR(120) NOT NULL');
    console.log('Se amplió la columna usuarios.dni');
  }
}

// Con DNI_KEY activa, los DNI que estaban en texto plano se cifran una sola vez.
async function cifrarDnisPendientes() {
  const [filas] = await db.query('SELECT id, dni, dni_hash FROM usuarios');
  if (!cifradoActivo()) {
    if (filas.some((f) => estaCifrado(f.dni))) {
      console.warn('ATENCIÓN: hay DNI cifrados pero falta DNI_KEY: no se podrán leer hasta que la vuelvas a poner.');
    }
    return;
  }
  let cifrados = 0;
  for (const f of filas) {
    const plano = descifrarDni(f.dni);
    if (plano === null || (estaCifrado(f.dni) && f.dni_hash)) continue;
    try {
      await db.query('UPDATE usuarios SET dni = ?, dni_hash = ? WHERE id = ?', [cifrarDni(plano), huellaDni(plano), f.id]);
      cifrados += 1;
    } catch (e) {
      console.warn(`No se pudo cifrar el DNI del usuario ${f.id}:`, e.message);
    }
  }
  if (cifrados > 0) console.log(`Se cifraron ${cifrados} DNI`);
}

function describirError(error) {
  const interno = error.errors && error.errors[0];
  return error.message || error.code || (interno && (interno.message || interno.code)) || String(error);
}

function prepararBaseDeDatos() {
  if (!preparada) {
    preparada = (async () => {
      // Tablas principales: solo se crean si la base está vacía (por ejemplo, una base nueva en la nube).
      // Si ya existen, no se toca nada.
      await db.query(`
        CREATE TABLE IF NOT EXISTS categorias (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL
        ) DEFAULT CHARSET=utf8mb4
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL,
          apellido VARCHAR(100) NOT NULL,
          dni VARCHAR(120) NOT NULL,
          email VARCHAR(150) NOT NULL,
          password VARCHAR(255) NOT NULL,
          rol VARCHAR(20) NOT NULL DEFAULT 'vecino',
          consentimiento_fecha DATETIME NULL
        ) DEFAULT CHARSET=utf8mb4
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS reportes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          categoria_id INT NOT NULL,
          descripcion TEXT NOT NULL,
          foto_url VARCHAR(255) NULL,
          direccion VARCHAR(255) NOT NULL,
          latitud DECIMAL(10,8) NULL,
          longitud DECIMAL(11,8) NULL,
          estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
          fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) DEFAULT CHARSET=utf8mb4
      `);
      const [[{ total: totalCategorias }]] = await db.query('SELECT COUNT(*) AS total FROM categorias');
      if (totalCategorias === 0) {
        await db.query('INSERT INTO categorias (nombre) VALUES ?', [[
          ['Baches'], ['Alumbrado público'], ['Basura / Limpieza'], ['Animales sueltos'],
          ['Inundaciones'], ['Tránsito / Señales'], ['Espacios verdes'], ['Vandalismo'],
        ]]);
        console.log('Se cargaron las categorías iniciales');
      }

      await agregarColumnaSiFalta('reportes', 'fecha_resolucion', 'DATETIME NULL');
      await agregarColumnaSiFalta('reportes', 'responsable', 'VARCHAR(100) NULL');
      await agregarColumnaSiFalta('reportes', 'notas_internas', 'TEXT NULL');
      await agregarColumnaSiFalta('reportes', 'categoria_otro', 'VARCHAR(100) NULL');
      await agregarColumnaSiFalta('reportes', 'miniatura_url', 'VARCHAR(255) NULL');

      // Ingreso con Google/Facebook y confirmación de correo.
      const columnaNueva = await agregarColumnaSiFalta('usuarios', 'email_verificado', 'TINYINT(1) NOT NULL DEFAULT 0');
      // Las cuentas que ya existían antes de esta función se consideran confirmadas.
      if (columnaNueva) await db.query('UPDATE usuarios SET email_verificado = 1');
      await agregarColumnaSiFalta('usuarios', 'google_id', 'VARCHAR(64) NULL');
      await agregarColumnaSiFalta('usuarios', 'facebook_id', 'VARCHAR(64) NULL');
      // Las sesiones iniciadas antes de este momento (en segundos) dejan de valer: se usa al cambiar la contraseña.
      await agregarColumnaSiFalta('usuarios', 'sesion_desde', 'BIGINT NULL');
      await db.query(`
        CREATE TABLE IF NOT EXISTS registros_pendientes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(150) NOT NULL,
          datos TEXT NOT NULL,
          codigo_hash CHAR(64) NOT NULL,
          intentos INT NOT NULL DEFAULT 0,
          vence DATETIME NOT NULL,
          ultimo_envio DATETIME NOT NULL,
          UNIQUE KEY uq_pendientes_email (email)
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS recuperaciones (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(150) NOT NULL,
          codigo_hash CHAR(64) NOT NULL,
          intentos INT NOT NULL DEFAULT 0,
          vence DATETIME NOT NULL,
          ultimo_envio DATETIME NOT NULL,
          UNIQUE KEY uq_recuperaciones_email (email)
        )
      `);
      await db.query(`
        INSERT INTO categorias (nombre)
        SELECT 'Otros' FROM DUAL
        WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Otros')
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS mensajes_reporte (
          id INT AUTO_INCREMENT PRIMARY KEY,
          reporte_id INT NOT NULL,
          autor VARCHAR(10) NOT NULL,
          autor_nombre VARCHAR(100) NULL,
          texto TEXT NOT NULL,
          fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_mensajes_reporte (reporte_id)
        )
      `);
      await agregarColumnaSiFalta('mensajes_reporte', 'foto_url', 'VARCHAR(255) NULL');
      await db.query(`
        CREATE TABLE IF NOT EXISTS historial_reportes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          reporte_id INT NOT NULL,
          usuario_nombre VARCHAR(100) NULL,
          accion VARCHAR(30) NOT NULL,
          detalle VARCHAR(255) NULL,
          fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_historial_reporte (reporte_id)
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS notificaciones (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          tipo VARCHAR(20) NOT NULL,
          reporte_id INT NULL,
          texto VARCHAR(255) NOT NULL,
          leida TINYINT(1) NOT NULL DEFAULT 0,
          fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_notificaciones_usuario (usuario_id, leida, fecha)
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS suscripciones_push (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          endpoint_hash CHAR(64) NOT NULL,
          endpoint VARCHAR(1000) NOT NULL,
          p256dh VARCHAR(255) NOT NULL,
          auth VARCHAR(255) NOT NULL,
          fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_push_endpoint (endpoint_hash),
          INDEX idx_push_usuario (usuario_id)
        ) DEFAULT CHARSET=utf8mb4
      `);
      // Índices para que las listas sigan rápidas cuando haya muchos reportes.
      await agregarIndiceSiFalta('reportes', 'idx_reportes_usuario', 'usuario_id').catch(() => {});
      await agregarIndiceSiFalta('reportes', 'idx_reportes_fecha', 'fecha_creacion').catch(() => {});
      await ampliarColumnaDni();
      await agregarColumnaSiFalta('usuarios', 'dni_hash', 'CHAR(64) NULL');
      await agregarIndiceSiFalta('usuarios', 'uq_usuarios_dni_hash', 'dni_hash', true).catch(() => {});
      await cifrarDnisPendientes().catch((e) => console.warn('No se pudieron cifrar los DNI:', e.message));
      // Evita cuentas duplicadas aunque dos registros lleguen al mismo tiempo (si ya hay repetidas, se avisa y se sigue).
      await agregarIndiceSiFalta('usuarios', 'uq_usuarios_email', 'email', true)
        .catch((e) => console.warn('No se pudo asegurar email único:', e.message));
      await agregarIndiceSiFalta('usuarios', 'uq_usuarios_google', 'google_id', true).catch(() => {});
      await agregarIndiceSiFalta('usuarios', 'uq_usuarios_facebook', 'facebook_id', true).catch(() => {});
      await agregarIndiceSiFalta('usuarios', 'uq_usuarios_dni', 'dni', true)
        .catch((e) => console.warn('No se pudo asegurar DNI único:', e.message));
    })().catch((error) => {
      preparada = null;
      console.error('No se pudo preparar la base de datos:', describirError(error));
      throw error;
    });
  }
  return preparada;
}

module.exports = { prepararBaseDeDatos };
