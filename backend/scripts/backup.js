// Copia de seguridad: guarda la base de datos (base.sql) y las fotos subidas.
// Uso:  node scripts/backup.js        (o:  npm run backup)
// Variables opcionales en .env:  BACKUP_DIR (carpeta destino)  y  BACKUP_KEEP (cuántas copias conservar, 14 por defecto).
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const { opcionesConexion } = require('../config/opcionesDb');

const RAIZ = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(RAIZ, '.env') });

const LOTE = 200;

const comillas = (nombre) => `\`${String(nombre).replace(/`/g, '``')}\``;

// Arma el texto SQL de toda la base. "consultar" es una función (sql) => Promise<filas>.
async function generarDump(consultar, nombreBase) {
  const partes = [
    `-- Copia de seguridad de ${nombreBase}`,
    `-- Generada el ${new Date().toISOString()}`,
    'SET FOREIGN_KEY_CHECKS=0;',
    "SET NAMES utf8mb4;",
    '',
  ];

  const tablas = (await consultar('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')).map((f) => Object.values(f)[0]);

  for (const tabla of tablas) {
    const [crear] = await consultar(`SHOW CREATE TABLE ${comillas(tabla)}`);
    partes.push(`DROP TABLE IF EXISTS ${comillas(tabla)};`);
    partes.push(`${crear['Create Table']};`);

    const filas = await consultar(`SELECT * FROM ${comillas(tabla)}`);
    if (filas.length) {
      const columnas = Object.keys(filas[0]).map(comillas).join(', ');
      for (let i = 0; i < filas.length; i += LOTE) {
        const valores = filas.slice(i, i + LOTE).map((fila) => Object.values(fila));
        partes.push(mysql.format(`INSERT INTO ${comillas(tabla)} (${columnas}) VALUES ?;`, [valores]));
      }
    }
    partes.push('');
  }

  partes.push('SET FOREIGN_KEY_CHECKS=1;');
  return partes.join('\n');
}

function sello(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}_${dos(fecha.getHours())}${dos(fecha.getMinutes())}`;
}

function rotar(carpetaBase, conservar) {
  const copias = fs.readdirSync(carpetaBase, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(e.name))
    .map((e) => e.name)
    .sort();
  copias.slice(0, Math.max(0, copias.length - conservar)).forEach((nombre) => {
    fs.rmSync(path.join(carpetaBase, nombre), { recursive: true, force: true });
    console.log(`Se borró la copia antigua ${nombre}`);
  });
}

async function main() {
  const conexion = mysql.createConnection(opcionesConexion()).promise();

  const carpetaBase = path.resolve(process.env.BACKUP_DIR || path.join(RAIZ, '..', 'backups'));
  const destino = path.join(carpetaBase, sello());
  fs.mkdirSync(destino, { recursive: true });

  try {
    const dump = await generarDump(async (sql) => (await conexion.query(sql))[0], process.env.DB_NAME);
    fs.writeFileSync(path.join(destino, 'base.sql'), dump, 'utf8');
  } finally {
    await conexion.end();
  }

  const fotos = path.join(RAIZ, 'uploads');
  if (fs.existsSync(fotos)) fs.cpSync(fotos, path.join(destino, 'uploads'), { recursive: true });

  rotar(carpetaBase, Number(process.env.BACKUP_KEEP) || 14);
  console.log(`Copia de seguridad lista en: ${destino}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('No se pudo hacer la copia de seguridad:', error.message);
    process.exit(1);
  });
}

module.exports = { generarDump, sello };
