import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { cargarScript } from '../utils/cargarScript';
import '../styles/components/BotonesSociales.css';

let alRecibirGoogle = null;
let googleIniciado = false;
let facebookIniciado = false;

function IconoFacebook() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
      />
    </svg>
  );
}

// Botones "Continuar con Google" y "Continuar con Facebook". Solo aparecen los que están configurados en el servidor.
function BotonesSociales({ onResultado, onError, deshabilitado = false }) {
  const [proveedores, setProveedores] = useState(null);
  const [facebookListo, setFacebookListo] = useState(false);
  const [ingresando, setIngresando] = useState(false);
  const contenedorGoogle = useRef(null);

  useEffect(() => {
    let vigente = true;
    axios.get('/api/auth/proveedores')
      .then((res) => { if (vigente) setProveedores(res.data); })
      .catch(() => { if (vigente) setProveedores({ google: null, facebook: null }); });
    return () => { vigente = false; };
  }, []);

  const enviar = async (ruta, cuerpo) => {
    setIngresando(true);
    try {
      const res = await axios.post(`/api/auth/${ruta}`, cuerpo);
      onResultado(res.data);
    } catch (error) {
      onError(error.response?.data?.error || 'No se pudo ingresar. Inténtalo de nuevo.');
    } finally {
      setIngresando(false);
    }
  };

  // Siempre se usa la versión más reciente de la función, sin volver a iniciar Google.
  alRecibirGoogle = (respuesta) => enviar('google', { credential: respuesta.credential });

  useEffect(() => {
    if (!proveedores?.google) return undefined;
    let vigente = true;
    cargarScript('https://accounts.google.com/gsi/client')
      .then(() => {
        if (!vigente || !window.google?.accounts?.id) return;
        if (!googleIniciado) {
          window.google.accounts.id.initialize({
            client_id: proveedores.google,
            callback: (respuesta) => alRecibirGoogle && alRecibirGoogle(respuesta),
            ux_mode: 'popup',
          });
          googleIniciado = true;
        }
        if (contenedorGoogle.current) {
          contenedorGoogle.current.innerHTML = '';
          const ancho = Math.min(360, Math.max(200, contenedorGoogle.current.offsetWidth || 320));
          window.google.accounts.id.renderButton(contenedorGoogle.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            locale: 'es-419',
            width: ancho,
          });
        }
      })
      .catch(() => onError('No se pudo cargar el ingreso con Google. Revisa tu conexión.'));
    return () => { vigente = false; };
  }, [proveedores?.google]);

  useEffect(() => {
    if (!proveedores?.facebook) return undefined;
    let vigente = true;
    window.fbAsyncInit = () => {
      if (!facebookIniciado) {
        window.FB.init({ appId: proveedores.facebook, cookie: false, xfbml: false, version: 'v21.0' });
        facebookIniciado = true;
      }
      if (vigente) setFacebookListo(true);
    };
    cargarScript('https://connect.facebook.net/es_LA/sdk.js')
      .then(() => { if (window.FB && vigente) window.fbAsyncInit(); })
      .catch(() => onError('No se pudo cargar el ingreso con Facebook. Revisa tu conexión.'));
    return () => { vigente = false; };
  }, [proveedores?.facebook]);

  const ingresarConFacebook = () => {
    if (!window.FB) return;
    window.FB.login((respuesta) => {
      if (respuesta.authResponse?.accessToken) {
        enviar('facebook', { accessToken: respuesta.authResponse.accessToken });
      } else {
        onError('No se completó el ingreso con Facebook.');
      }
    }, { scope: 'public_profile,email' });
  };

  if (!proveedores || (!proveedores.google && !proveedores.facebook)) return null;

  return (
    <div className="sociales">
      <div className="sociales-botones" aria-busy={ingresando}>
        {proveedores.google && (
          <div className={`sociales-google ${deshabilitado || ingresando ? 'sociales-inactivo' : ''}`} ref={contenedorGoogle} />
        )}
        {proveedores.facebook && (
          <button
            type="button"
            className="boton-facebook"
            onClick={ingresarConFacebook}
            disabled={!facebookListo || deshabilitado || ingresando}
          >
            <IconoFacebook />
            Continuar con Facebook
          </button>
        )}
      </div>
      <div className="sociales-separador" role="separator">
        <span>o con tu email</span>
      </div>
    </div>
  );
}

export default BotonesSociales;
