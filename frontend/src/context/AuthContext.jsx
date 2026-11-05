import { createContext, useState, useContext, useCallback, useMemo } from 'react';
import axios from 'axios';
import { desactivarAvisos } from '../utils/push';

const AuthContext = createContext();

// La sesión real vive en una cookie que el navegador envía solo y que el código de la página no puede leer.
// Aquí solo se recuerda quién es (nombre y rol) para dibujar la pantalla, y hasta cuándo vale.
const DURACION_MS = 7 * 24 * 60 * 60 * 1000;

function borrarSesionGuardada() {
  localStorage.removeItem('usuario');
  localStorage.removeItem('sesion-vence');
  localStorage.removeItem('token'); // restos de versiones anteriores, donde el token se guardaba aquí
}

// Lee la sesión guardada. Si está dañada o ya venció, se descarta para no mostrar pantallas rotas.
function leerSesionGuardada() {
  try {
    const guardado = localStorage.getItem('usuario');
    const vence = Number(localStorage.getItem('sesion-vence'));
    if (!guardado || !vence || vence < Date.now()) {
      borrarSesionGuardada();
      return null;
    }
    localStorage.removeItem('token');
    return JSON.parse(guardado);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerSesionGuardada);

  const login = useCallback((datosUsuario) => {
    localStorage.removeItem('token');
    localStorage.setItem('usuario', JSON.stringify(datosUsuario));
    localStorage.setItem('sesion-vence', String(Date.now() + DURACION_MS));
    setUsuario(datosUsuario);
  }, []);

  const logout = useCallback(() => {
    borrarSesionGuardada();
    setUsuario(null);
    // Se quitan los avisos de este dispositivo (para que no le lleguen a la próxima persona que lo use)
    // y se pide al servidor que borre la cookie de sesión. Si algo falla, igual se cierra en este dispositivo.
    desactivarAvisos().finally(() => axios.post('/api/auth/salir').catch(() => {}));
  }, []);

  // Valor estable: así los componentes no se vuelven a dibujar (ni se reengancha el control de sesión) sin necesidad.
  const valor = useMemo(() => ({ usuario, login, logout }), [usuario, login, logout]);

  return (
    <AuthContext.Provider value={valor}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
