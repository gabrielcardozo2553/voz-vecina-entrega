import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { estadoAvisos, activarAvisos, desactivarAvisos, requiereInstalar } from '../utils/push';

// Pie del panel de novedades: permite recibir los avisos en el celular aunque la app esté cerrada.
function AvisosPush() {
  const [estado, setEstado] = useState('cargando');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    estadoAvisos().then((e) => { if (vigente) setEstado(e); });
    return () => { vigente = false; };
  }, []);

  if (estado === 'cargando' || estado === 'no-disponible') return null;

  const cambiar = async () => {
    setOcupado(true);
    setError('');
    try {
      if (estado === 'activo') {
        await desactivarAvisos();
        setEstado('inactivo');
      } else {
        setEstado(await activarAvisos());
      }
    } catch {
      setError('No se pudo cambiar. Inténtalo de nuevo.');
    } finally {
      setOcupado(false);
    }
  };

  if (estado === 'bloqueado') {
    return (
      <div className="avisos-push">
        <p>Los avisos están bloqueados en este navegador. Puedes permitirlos desde los ajustes del sitio.</p>
      </div>
    );
  }

  if (estado === 'inactivo' && requiereInstalar()) {
    return (
      <div className="avisos-push">
        <p>Para recibir avisos en tu iPhone, primero instala la app: en Safari toca Compartir y luego «Añadir a pantalla de inicio».</p>
      </div>
    );
  }

  return (
    <div className="avisos-push">
      <button type="button" onClick={cambiar} disabled={ocupado}>
        {estado === 'activo' ? <BellOff size={15} aria-hidden="true" /> : <BellRing size={15} aria-hidden="true" />}
        {estado === 'activo' ? 'Desactivar avisos en este dispositivo' : 'Activar avisos en este dispositivo'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export default AvisosPush;
