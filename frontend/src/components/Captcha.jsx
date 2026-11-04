import { useEffect, useRef } from 'react';
import axios from 'axios';
import { cargarScript } from '../utils/cargarScript';

let consultaClave = null;

// Pregunta una sola vez al servidor si hay verificación anti-bots activada.
function obtenerClave() {
  if (!consultaClave) {
    consultaClave = axios.get('/api/auth/proveedores')
      .then((res) => res.data?.captcha || null)
      .catch(() => { consultaClave = null; return null; });
  }
  return consultaClave;
}

// Casilla "No soy un robot" de Cloudflare Turnstile. No aparece si el servidor no la tiene configurada.
function Captcha({ onToken, onConfigurado }) {
  const contenedor = useRef(null);
  const idWidget = useRef(null);

  useEffect(() => {
    let vigente = true;
    obtenerClave().then(async (clave) => {
      if (!vigente) return;
      onConfigurado?.(Boolean(clave));
      if (!clave) return;
      try {
        await cargarScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
        if (!vigente || !contenedor.current || !window.turnstile) return;
        idWidget.current = window.turnstile.render(contenedor.current, {
          sitekey: clave,
          language: 'es',
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        });
      } catch {
        // Si no carga, el envío mostrará un aviso y se podrá reintentar.
      }
    });
    return () => {
      vigente = false;
      if (idWidget.current != null && window.turnstile) {
        try { window.turnstile.remove(idWidget.current); } catch { /* ya no existe */ }
      }
    };
  }, []);

  return <div ref={contenedor} className="captcha" />;
}

export default Captcha;
