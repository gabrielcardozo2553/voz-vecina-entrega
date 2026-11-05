// Cifrado del DNI en la base de datos.
// Con DNI_KEY definida en .env, el DNI se guarda cifrado (AES-256-GCM) y se busca por una huella (HMAC-SHA256),
// así nadie que acceda a la base o a una copia de seguridad puede leer los DNI sin esa clave.
// Sin DNI_KEY todo sigue funcionando como antes (DNI en texto plano).
// IMPORTANTE: guarda DNI_KEY en un lugar seguro. Si se pierde, los DNI cifrados no se pueden recuperar.
const crypto = require('crypto');

const PREFIJO = 'v1:';

const clave = (uso) => crypto.createHash('sha256').update(`${uso}:${process.env.DNI_KEY}`).digest();
const cifradoActivo = () => typeof process.env.DNI_KEY === 'string' && process.env.DNI_KEY.length >= 16;
const estaCifrado = (valor) => typeof valor === 'string' && valor.startsWith(PREFIJO);

function cifrarDni(dni) {
  const plano = String(dni);
  if (!cifradoActivo() || estaCifrado(plano)) return plano;
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv('aes-256-gcm', clave('dni-cifrado'), iv);
  const datos = Buffer.concat([cifrador.update(plano, 'utf8'), cifrador.final()]);
  return PREFIJO + Buffer.concat([iv, cifrador.getAuthTag(), datos]).toString('base64url');
}

// Devuelve el DNI en claro. Si todavía estaba sin cifrar lo devuelve tal cual; si no se puede descifrar, devuelve null.
function descifrarDni(valor) {
  if (valor === null || valor === undefined) return null;
  if (!estaCifrado(valor)) return String(valor);
  if (!cifradoActivo()) return null;
  try {
    const bruto = Buffer.from(valor.slice(PREFIJO.length), 'base64url');
    const descifrador = crypto.createDecipheriv('aes-256-gcm', clave('dni-cifrado'), bruto.subarray(0, 12));
    descifrador.setAuthTag(bruto.subarray(12, 28));
    return Buffer.concat([descifrador.update(bruto.subarray(28)), descifrador.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// Huella fija del DNI: permite comprobar que no esté repetido sin guardarlo en claro.
const huellaDni = (dni) => (
  cifradoActivo() ? crypto.createHmac('sha256', clave('dni-huella')).update(String(dni)).digest('hex') : null
);

module.exports = { cifradoActivo, estaCifrado, cifrarDni, descifrarDni, huellaDni };
