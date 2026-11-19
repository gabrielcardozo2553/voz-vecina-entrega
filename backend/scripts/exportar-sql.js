// Genera database/proyecto.sql: tablas + categorías + cuentas y reportes de demostración.
// Trabaja SIEMPRE sobre una base temporal propia (reportes_demo_export), que crea y borra: no toca tus datos reales.
// Necesita MySQL encendido y backend/.env con los datos de conexión.
// Uso:  npm run exportar-sql
const BASE_TEMPORAL = 'reportes_demo_export';
process.env.DB_NAME = BASE_TEMPORAL; // debe ir antes de cargar la conexión

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const { opcionesConexion } = require('../config/opcionesDb');
const { generarDump } = require('./backup');

const BASE_ENTREGA = 'reportes_vecinales'; // nombre de la base dentro del .sql (el mismo que usa .env.example)
const DESTINO = path.join(__dirname, '..', '..', 'database', 'proyecto.sql');

async function main() {
  const { database, ...sinBase } = opcionesConexion(); // eslint-disable-line no-unused-vars
  const servidor = mysql.createConnection(sinBase).promise();
  await servidor.query(`DROP DATABASE IF EXISTS \`${BASE_TEMPORAL}\``);

  const { cargarDatosDemo } = require('./datos-demo');
  const db = require('../config/db');
  try {
    await cargarDatosDemo();
    const conexion = mysql.createConnection(opcionesConexion()).promise();
    try {
      const sql = await generarDump(
        async (consulta) => (await conexion.query(consulta))[0],
        BASE_ENTREGA,
        { portable: true, titulo: 'Voz Vecinal - script de la base de datos (con datos de demostración)' }
      );
      fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
      fs.writeFileSync(DESTINO, sql, 'utf8');
    } finally {
      await conexion.end();
    }
  } finally {
    await db.end().catch(() => {});
    await servidor.query(`DROP DATABASE IF EXISTS \`${BASE_TEMPORAL}\``);
    await servidor.end();
  }
  console.log(`Listo: ${path.relative(process.cwd(), DESTINO)}`);
}

main().catch((error) => {
  console.error('No se pudo generar el archivo SQL:', error.message || error.code);
  console.error('Revisa que MySQL esté encendido y que backend/.env tenga los datos correctos (DB_HOST, DB_USER, DB_PASSWORD).');
  process.exit(1);
});
