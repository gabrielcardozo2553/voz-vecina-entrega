// Dónde se guardan las fotos.
//  - Sin configurar: en la carpeta backend/uploads (sirve para trabajar en tu PC).
//  - Con Cloudinary: en la nube. Es lo que hace falta en un hosting gratuito, porque ahí el disco se borra.
// Configuración en .env (cualquiera de las dos formas):
//   CLOUDINARY_URL=cloudinary://CLAVE:SECRETO@NOMBRE_DE_LA_NUBE
//   o bien CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DIR_UPLOADS = path.join(__dirname, '..', 'uploads');
const CARPETA_NUBE = 'voz-vecinal';

function credenciales() {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url.trim());
    if (m) return { apiKey: m[1], apiSecret: m[2], nube: m[3] };
  }
  const { CLOUDINARY_CLOUD_NAME: nube, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
  return nube && apiKey && apiSecret ? { nube, apiKey, apiSecret } : null;
}

const nubeConfigurada = () => credenciales() !== null;

// Cloudinary pide firmar cada petición: SHA-1 de los parámetros ordenados + el secreto.
function firmar(parametros, apiSecret) {
  const texto = Object.keys(parametros).sort().map((k) => `${k}=${parametros[k]}`).join('&');
  return crypto.createHash('sha1').update(texto + apiSecret).digest('hex');
}

function borrarLocal(rutaArchivo) {
  fs.unlink(rutaArchivo, () => {});
}

// Recibe un archivo ya recibido por multer (guardado en disco) y devuelve la dirección con la que se mostrará.
async function publicar(archivo) {
  const cred = credenciales();
  if (!cred) return `/uploads/${archivo.filename}`;

  const marca = Math.floor(Date.now() / 1000);
  const firmados = { folder: CARPETA_NUBE, timestamp: marca };
  const cuerpo = new FormData();
  cuerpo.append('file', new Blob([fs.readFileSync(archivo.path)], { type: archivo.mimetype }), archivo.filename);
  cuerpo.append('api_key', cred.apiKey);
  cuerpo.append('timestamp', String(marca));
  cuerpo.append('folder', CARPETA_NUBE);
  cuerpo.append('signature', firmar(firmados, cred.apiSecret));

  const respuesta = await fetch(`https://api.cloudinary.com/v1_1/${cred.nube}/image/upload`, {
    method: 'POST',
    body: cuerpo,
    signal: AbortSignal.timeout(30000),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || !datos.secure_url) {
    throw new Error(`Cloudinary rechazó la foto: ${datos.error?.message || respuesta.status}`);
  }
  borrarLocal(archivo.path);
  return datos.secure_url;
}

// Borra una foto, esté en la carpeta local o en Cloudinary. Si falla no interrumpe nada.
function borrar(url) {
  if (!url) return;
  if (url.startsWith('/uploads/')) {
    borrarLocal(path.join(DIR_UPLOADS, path.basename(url)));
    return;
  }
  const cred = credenciales();
  const m = /\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url);
  if (!cred || !m || !url.includes('res.cloudinary.com')) return;

  const marca = Math.floor(Date.now() / 1000);
  const firmados = { public_id: m[1], timestamp: marca };
  const cuerpo = new URLSearchParams({
    public_id: m[1],
    timestamp: String(marca),
    api_key: cred.apiKey,
    signature: firmar(firmados, cred.apiSecret),
  });
  fetch(`https://api.cloudinary.com/v1_1/${cred.nube}/image/destroy`, {
    method: 'POST',
    body: cuerpo,
    signal: AbortSignal.timeout(15000),
  }).catch((error) => console.error('No se pudo borrar la foto de la nube:', error.message));
}

module.exports = { nubeConfigurada, publicar, borrar, firmar, DIR_UPLOADS };
