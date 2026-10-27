import { Moon, Sun } from 'lucide-react';
import { useTema } from '../hooks/useTema';

// Botón del encabezado para cambiar entre modo claro y modo nocturno.
function BotonTema() {
  const { oscuro, alternar } = useTema();
  const etiqueta = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo nocturno';
  return (
    <button type="button" className="boton-tema" onClick={alternar} aria-label={etiqueta} title={etiqueta}>
      {oscuro ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}

export default BotonTema;
