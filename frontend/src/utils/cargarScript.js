// Carga un script externo una sola vez (por ejemplo, el de Google o Facebook).
const cargados = {};

export function cargarScript(src) {
  if (!cargados[src]) {
    cargados[src] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        delete cargados[src];
        reject(new Error(`No se pudo cargar ${src}`));
      };
      document.head.appendChild(script);
    });
  }
  return cargados[src];
}
