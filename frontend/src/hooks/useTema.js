import { useCallback, useEffect, useState } from 'react';

const CLAVE = 'voz-vecinal:tema';

function leerGuardado() {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'claro' || valor === 'oscuro' ? valor : null;
  } catch {
    return null;
  }
}

function sistemaOscuro() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function aplicar(tema) {
  const raiz = document.documentElement;
  if (tema) raiz.setAttribute('data-tema', tema);
  else raiz.removeAttribute('data-tema');
  const meta = document.querySelector('meta[name="theme-color"]');
  const oscuro = tema ? tema === 'oscuro' : sistemaOscuro();
  if (meta) meta.setAttribute('content', oscuro ? '#0e1a1d' : '#0d5c6b');
}

// Tema claro u oscuro. Si la persona no eligió, se sigue la configuración de su dispositivo.
export function useTema() {
  const [guardado, setGuardado] = useState(leerGuardado);
  const [sistema, setSistema] = useState(sistemaOscuro);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const alCambiar = (e) => setSistema(e.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  useEffect(() => { aplicar(guardado); }, [guardado, sistema]);

  const oscuro = guardado ? guardado === 'oscuro' : sistema;

  const alternar = useCallback(() => {
    const nuevo = oscuro ? 'claro' : 'oscuro';
    try { localStorage.setItem(CLAVE, nuevo); } catch { /* sin almacenamiento: solo dura esta visita */ }
    setGuardado(nuevo);
  }, [oscuro]);

  return { oscuro, alternar };
}
