import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

const esIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const yaInstalada = () => (
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
);

// Botón "Instalar la app". En Android y computadoras abre el aviso del navegador;
// en iPhone, donde no existe ese aviso, explica cómo agregarla a la pantalla de inicio.
function InstalarApp() {
  const [evento, setEvento] = useState(null);
  const [instalada, setInstalada] = useState(false);
  const [verAyudaIos, setVerAyudaIos] = useState(false);

  useEffect(() => {
    setInstalada(yaInstalada());
    const alOfrecer = (e) => { e.preventDefault(); setEvento(e); };
    const alInstalar = () => { setInstalada(true); setEvento(null); };
    window.addEventListener('beforeinstallprompt', alOfrecer);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alOfrecer);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  if (instalada) return null;

  const instalar = async () => {
    evento.prompt();
    await evento.userChoice.catch(() => {});
    setEvento(null);
  };

  if (evento) {
    return (
      <button type="button" className="instalar-app" onClick={instalar}>
        <Download size={18} aria-hidden="true" />
        Instalar la app en este dispositivo
      </button>
    );
  }

  if (esIos()) {
    return (
      <div className="instalar-app-ios">
        <button type="button" className="instalar-app" onClick={() => setVerAyudaIos(!verAyudaIos)} aria-expanded={verAyudaIos}>
          <Download size={18} aria-hidden="true" />
          Instalar la app en tu iPhone
        </button>
        {verAyudaIos && (
          <p>
            En Safari, toca el botón <Share size={14} aria-hidden="true" /> <strong>Compartir</strong> y elige{' '}
            <strong>Añadir a pantalla de inicio</strong>.
          </p>
        )}
      </div>
    );
  }

  return null;
}

export default InstalarApp;
