// Crea la base de datos (vacía) si todavía no existe, para que quien instale el proyecto
// no tenga que crearla a mano. Las tablas las crea después config/migraciones.js.
const mysql = require('mysql2/promise');
const { opcionesConexion } = require('./opcionesDb');

const NOMBRE_VALIDO = /^[A-Za-z0-9_]{1,64}$/;
// Sin permiso para crear bases (es lo normal en una base en la nube): no es un problema, la base ya viene creada.
const SIN_PERMISO = ['ER_DBACCESS_DENIED_ERROR', 'ER_SPECIFIC_ACCESS_DENIED_ERROR', 'ER_ACCESS_DENIED_ERROR'];

async function asegurarBaseDeDatos() {
  const nombre = process.env.DB_NAME;
  if (!nombre || !NOMBRE_VALIDO.test(nombre)) return false;
  const { database, ...opciones } = opcionesConexion(); // eslint-disable-line no-unused-vars
  let conexion;
  try {
    conexion = await mysql.createConnection(opciones);
    await conexion.query(`CREATE DATABASE IF NOT EXISTS \`${nombre}\` CHARACTER SET utf8mb4`);
    return true;
  } catch (error) {
    if (!SIN_PERMISO.includes(error.code)) {
      console.warn('No se pudo comprobar la base de datos:', error.message || error.code);
    }
    return false;
  } finally {
    if (conexion) await conexion.end().catch(() => {});
  }
}

module.exports = { asegurarBaseDeDatos, NOMBRE_VALIDO };
