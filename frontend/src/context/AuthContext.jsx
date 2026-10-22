import { createContext, useState, useContext, useCallback, useMemo } from 'react';

const AuthContext = createContext();

function tokenVencido(token) {
  try {
    const carga = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Boolean(carga.exp) && carga.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Lee la sesión guardada. Si está dañada o el token ya venció, se descarta para no mostrar pantallas rotas.
function leerSesionGuardada() {
  try {
    const guardado = localStorage.getItem('usuario');
    const token = localStorage.getItem('token');
    if (!guardado || !token || tokenVencido(token)) {
      localStorage.removeItem('usuario');
      localStorage.removeItem('token');
      return null;
    }
    return JSON.parse(guardado);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerSesionGuardada);

  const login = useCallback((token, datosUsuario) => {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
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