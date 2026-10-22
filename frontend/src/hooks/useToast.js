import { useState, useRef, useEffect, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState({ mensaje: '', tipo: '' });
  const temporizador = useRef(null);

  const mostrarToast = useCallback((mensaje, tipo = 'exito') => {
    clearTimeout(temporizador.current);
    setToast({ mensaje, tipo });
    temporizador.current = setTimeout(() => setToast({ mensaje: '', tipo: '' }), 3000);
  }, []);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  return { toast, mostrarToast };
}
