// Datos de conexión a MySQL, compartidos por el servidor y por las copias de seguridad.
// Para bases en la nube (por ejemplo Aiven) que exigen conexión cifrada, agrega en .env:
//   DB_SSL=1
//   DB_SSL_CA=<contenido del certificado ca.pem>   (recomendado; los saltos de línea pueden escribirse como \n)
const fs = require('fs');

function opcionesSsl() {
  if (!process.env.DB_SSL || process.env.DB_SSL === '0') return undefined;
  let ca = process.env.DB_SSL_CA ? process.env.DB_SSL_CA.replace(/\\n/g, '\n') : '';
  if (!ca && process.env.DB_SSL_CA_FILE) {
    try { ca = fs.readFileSync(process.env.DB_SSL_CA_FILE, 'utf8'); } catch (error) {
      console.error('No se pudo leer DB_SSL_CA_FILE:', error.message);
    }
  }
  // Sin certificado se cifra igual, pero sin comprobar quién está del otro lado.
  return ca ? { ca } : { rejectUnauthorized: false };
}

function opcionesConexion() {
  const opciones = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    charset: 'utf8mb4',
  };
  const ssl = opcionesSsl();
  if (ssl) opciones.ssl = ssl;
  return opciones;
}

module.exports = { opcionesConexion };
