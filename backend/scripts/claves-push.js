// Genera las claves VAPID para las notificaciones push (no necesita instalar nada).
// Uso:  node scripts/claves-push.js
// Copia los dos valores a las variables de entorno (Render → Environment, o backend/.env).
const crypto = require('crypto');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const publica = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);

console.log('Copia estas líneas en tus variables de entorno:\n');
console.log(`VAPID_PUBLIC_KEY=${publica.toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${priv.d}`);
console.log('VAPID_SUBJECT=mailto:tu-correo@ejemplo.com');
console.log('\nGuarda la clave privada en un lugar seguro y no la subas a GitHub.');
