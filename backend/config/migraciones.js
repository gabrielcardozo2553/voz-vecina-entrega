const db = require('./db');

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

function describirError(error) {
  const interno = error.errors && error.errors[0];
  return error.message || error.code || (interno && (interno.message || interno.code)) || String(error);
}

function prepararBaseDeDatos() {
  if (!preparada) {
    preparada = (async () => {
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
      // Índices para que las listas sigan rápidas cuando haya muchos reportes.
      await agregarIndiceSiFalta('reportes', 'idx_reportes_usuario', 'usuario_id').catch(() => {});
      await agregarIndiceSiFalta('reportes', 'idx_reportes_fecha', 'fecha_creacion').catch(() => {});
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
