// Crea backend/.env a partir de .env.example, con una clave de sesión aleatoria.
// Uso:  npm run preparar
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const carpeta = path.join(__dirname, '..');
const destino = path.join(carpeta, '.env');
const ejemplo = path.join(carpeta, '.env.example');

if (fs.existsSync(destino)) {
  console.log('Ya existe backend/.env: no se modificó nada.');
  process.exit(0);
}

const clave = crypto.randomBytes(32).toString('hex');
const texto = fs.readFileSync(ejemplo, 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${clave}`);
fs.writeFileSync(destino, texto);

console.log('Se creó backend/.env con una clave de sesión aleatoria.');
console.log('Si tu MySQL tiene contraseña para el usuario root, escríbela en DB_PASSWORD (archivo backend/.env).');
