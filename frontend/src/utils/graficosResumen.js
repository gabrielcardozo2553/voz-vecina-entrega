// Gráficos del resumen, dibujados con canvas y devueltos como imagen PNG.
// Se usan tanto en el Excel como en el PDF.

export const COLORES = {
  primario: '#0d5c6b',
  oscuro: '#0b3f4a',
  claro: '#dceef0',
  acento: '#d9a441',
  texto: '#26343a',
  suave: '#6b7a80',
  borde: '#e4e0d3',
  pendiente: '#d9a441',
  en_proceso: '#0d5c6b',
  resuelto: '#2f9e5a',
};

const FUENTE = 'Figtree, "Segoe UI", Arial, sans-serif';
const ESCALA = 2;

function crearLienzo(ancho, alto) {
  const canvas = document.createElement('canvas');
  canvas.width = ancho * ESCALA;
  canvas.height = alto * ESCALA;
  const ctx = canvas.getContext('2d');
  ctx.scale(ESCALA, ESCALA);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textBaseline = 'middle';
  return { canvas, ctx, ancho, alto };
}

function resultado({ canvas, ancho, alto }) {
  return { url: canvas.toDataURL('image/png'), ancho, alto };
}

function titulo(ctx, texto) {
  ctx.fillStyle = COLORES.oscuro;
  ctx.font = `700 16px ${FUENTE}`;
  ctx.textAlign = 'left';
  ctx.fillText(texto, 16, 22);
}

function recortar(ctx, texto, maximo) {
  if (ctx.measureText(texto).width <= maximo) return texto;
  let corto = texto;
  while (corto.length > 1 && ctx.measureText(`${corto}…`).width > maximo) corto = corto.slice(0, -1);
  return `${corto}…`;
}

// Anillo con el reparto por estado.
export function graficoEstados({ pendientes, enProceso, resueltos }) {
  const lienzo = crearLienzo(760, 230);
  const { ctx, ancho } = lienzo;
  titulo(ctx, 'Reportes por estado');

  const partes = [
    ['Pendientes', pendientes, COLORES.pendiente],
    ['En proceso', enProceso, COLORES.en_proceso],
    ['Resueltos', resueltos, COLORES.resuelto],
  ];
  const total = pendientes + enProceso + resueltos;
  const cx = 150;
  const cy = 128;
  const radio = 78;
  const grosor = 28;

  if (total === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radio - grosor / 2, 0, Math.PI * 2);
    ctx.lineWidth = grosor;
    ctx.strokeStyle = COLORES.borde;
    ctx.stroke();
  } else {
    let inicio = -Math.PI / 2;
    partes.forEach(([, valor, color]) => {
      if (!valor) return;
      const fin = inicio + (valor / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radio - grosor / 2, inicio, fin);
      ctx.lineWidth = grosor;
      ctx.strokeStyle = color;
      ctx.stroke();
      inicio = fin;
    });
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORES.oscuro;
  ctx.font = `700 34px ${FUENTE}`;
  ctx.fillText(String(total), cx, cy - 6);
  ctx.fillStyle = COLORES.suave;
  ctx.font = `500 13px ${FUENTE}`;
  ctx.fillText('reportes', cx, cy + 20);

  // Leyenda con barra de proporción
  const x0 = 320;
  const anchoBarra = ancho - x0 - 40;
  partes.forEach(([nombre, valor, color], i) => {
    const y = 78 + i * 52;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + 7, y, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORES.texto;
    ctx.font = `600 15px ${FUENTE}`;
    ctx.fillText(nombre, x0 + 24, y);

    const pct = total ? Math.round((valor / total) * 100) : 0;
    ctx.textAlign = 'right';
    ctx.font = `700 15px ${FUENTE}`;
    ctx.fillText(`${valor}  ·  ${pct}%`, x0 + anchoBarra + 20, y);

    ctx.fillStyle = COLORES.borde;
    ctx.fillRect(x0 + 24, y + 14, anchoBarra - 4, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x0 + 24, y + 14, Math.max(valor ? 4 : 0, ((anchoBarra - 4) * pct) / 100), 6);
  });

  return resultado(lienzo);
}

// Barras horizontales apiladas por categoría. Cada fila: [nombre, total, pendientes, enProceso, resueltos].
export function graficoCategorias(filas, maximoFilas = 10) {
  let datos = filas;
  if (filas.length > maximoFilas) {
    const resto = filas.slice(maximoFilas - 1).reduce(
      (acc, f) => [acc[0], acc[1] + f[1], acc[2] + f[2], acc[3] + f[3], acc[4] + f[4]],
      ['Otras categorías', 0, 0, 0, 0]
    );
    datos = [...filas.slice(0, maximoFilas - 1), resto];
  }

  const altoFila = 30;
  const alto = Math.max(110, 70 + datos.length * altoFila);
  const lienzo = crearLienzo(760, alto);
  const { ctx, ancho } = lienzo;
  titulo(ctx, 'Reportes por categoría');

  // Leyenda arriba a la derecha
  let xl = ancho - 16;
  [['Resueltos', COLORES.resuelto], ['En proceso', COLORES.en_proceso], ['Pendientes', COLORES.pendiente]].forEach(([n, c]) => {
    ctx.font = `500 12px ${FUENTE}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORES.suave;
    ctx.fillText(n, xl, 22);
    const w = ctx.measureText(n).width;
    ctx.fillStyle = c;
    ctx.fillRect(xl - w - 14, 17, 10, 10);
    xl -= w + 30;
  });

  const xEtiqueta = 16;
  const xBarra = 235;
  const anchoMax = ancho - xBarra - 56;
  const mayor = Math.max(1, ...datos.map((f) => f[1]));

  datos.forEach((f, i) => {
    const y = 52 + i * altoFila;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORES.texto;
    ctx.font = `500 13px ${FUENTE}`;
    ctx.fillText(recortar(ctx, f[0], xBarra - xEtiqueta - 12), xEtiqueta, y + 9);

    ctx.fillStyle = '#f3f1ea';
    ctx.fillRect(xBarra, y, anchoMax, 18);

    let x = xBarra;
    [[f[4], COLORES.resuelto], [f[3], COLORES.en_proceso], [f[2], COLORES.pendiente]].forEach(([valor, color]) => {
      if (!valor) return;
      const w = (valor / mayor) * anchoMax;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, 18);
      x += w;
    });

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORES.oscuro;
    ctx.font = `700 13px ${FUENTE}`;
    ctx.fillText(String(f[1]), xBarra + anchoMax + 10, y + 9);
  });

  return resultado(lienzo);
}

function etiquetaMes(nombre) {
  const [mes, , anio] = nombre.split(' ');
  return `${mes.slice(0, 3)} ${String(anio || '').slice(2)}`.trim();
}

// Columnas agrupadas por mes: recibidos vs resueltos. Cada fila: [nombre, recibidos, resueltos].
export function graficoMeses(filas) {
  const datos = filas.slice(-12);
  const lienzo = crearLienzo(760, 250);
  const { ctx, ancho, alto } = lienzo;
  titulo(ctx, 'Evolución por mes');

  let xl = ancho - 16;
  [['Resueltos', COLORES.resuelto], ['Recibidos', COLORES.primario]].forEach(([n, c]) => {
    ctx.font = `500 12px ${FUENTE}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORES.suave;
    ctx.fillText(n, xl, 22);
    const w = ctx.measureText(n).width;
    ctx.fillStyle = c;
    ctx.fillRect(xl - w - 14, 17, 10, 10);
    xl -= w + 30;
  });

  const izq = 44;
  const der = 20;
  const arriba = 52;
  const base = alto - 36;
  const altoUtil = base - arriba;
  const mayor = Math.max(1, ...datos.map((f) => f[1]));
  const paso = Math.max(1, Math.ceil(mayor / 4));
  const tope = paso * Math.ceil(mayor / paso);

  ctx.font = `500 11px ${FUENTE}`;
  for (let v = 0; v <= tope; v += paso) {
    const y = base - (v / tope) * altoUtil;
    ctx.strokeStyle = COLORES.borde;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(izq, y);
    ctx.lineTo(ancho - der, y);
    ctx.stroke();
    ctx.fillStyle = COLORES.suave;
    ctx.textAlign = 'right';
    ctx.fillText(String(v), izq - 8, y);
  }

  if (datos.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORES.suave;
    ctx.font = `500 14px ${FUENTE}`;
    ctx.fillText('Todavía no hay datos para mostrar', ancho / 2, (arriba + base) / 2);
    return resultado(lienzo);
  }

  const ranura = (ancho - izq - der) / datos.length;
  const anchoCol = Math.min(34, ranura * 0.32);
  datos.forEach((f, i) => {
    const centro = izq + ranura * i + ranura / 2;
    [[f[1], COLORES.primario, -anchoCol], [f[2], COLORES.resuelto, 0]].forEach(([valor, color, desplazamiento]) => {
      const h = (valor / tope) * altoUtil;
      const x = centro + desplazamiento;
      ctx.fillStyle = color;
      ctx.fillRect(x, base - h, anchoCol - 2, h);
      if (valor) {
        ctx.fillStyle = COLORES.oscuro;
        ctx.font = `700 11px ${FUENTE}`;
        ctx.textAlign = 'center';
        ctx.fillText(String(valor), x + (anchoCol - 2) / 2, base - h - 9);
      }
    });
    ctx.fillStyle = COLORES.texto;
    ctx.font = `500 12px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(etiquetaMes(f[0]), centro, base + 18);
  });

  return resultado(lienzo);
}
