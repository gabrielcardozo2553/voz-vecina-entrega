import { etiquetaCategoria } from './categorias';
import { prioridadDe, PRIORIDAD_TEXTO, tiempoMedioDeRespuesta, textoDuracion } from './prioridad';

const DIA = 24 * 60 * 60 * 1000;
const DIAS_ANTIGUO = 7;

const porcentaje = (parte, total) => (total ? `${Math.round((parte / total) * 100)}%` : '0%');

// Calcula el resumen de los reportes que se exportan, ya separado en bloques.
export function datosResumen(reportes) {
  const total = reportes.length;
  const cuenta = (estado) => reportes.filter((r) => r.estado === estado).length;
  const resueltos = cuenta('resuelto');
  const antiguos = reportes.filter(
    (r) => r.estado === 'pendiente' && (Date.now() - new Date(r.fecha_creacion)) / DIA >= DIAS_ANTIGUO
  ).length;
  const tiempo = tiempoMedioDeRespuesta(reportes);

  const general = [
    ['Total de reportes', total],
    ['Pendientes', cuenta('pendiente')],
    ['En proceso', cuenta('en_proceso')],
    ['Resueltos', resueltos],
    ['Porcentaje resuelto', porcentaje(resueltos, total)],
    [`Pendientes con más de ${DIAS_ANTIGUO} días`, antiguos],
    ['Tiempo promedio de resolución', tiempo ? textoDuracion(tiempo.dias) : 'Sin datos todavía'],
  ];

  const porCategoria = {};
  reportes.forEach((r) => {
    const nombre = etiquetaCategoria(r);
    const fila = porCategoria[nombre] || (porCategoria[nombre] = { total: 0, pendiente: 0, en_proceso: 0, resuelto: 0 });
    fila.total += 1;
    fila[r.estado] += 1;
  });
  const categorias = Object.entries(porCategoria)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([nombre, f]) => [nombre, f.total, f.pendiente, f.en_proceso, f.resuelto]);

  const porMes = {};
  reportes.forEach((r) => {
    const f = new Date(r.fecha_creacion);
    const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
    const fila = porMes[clave] || (porMes[clave] = { recibidos: 0, resueltos: 0 });
    fila.recibidos += 1;
    if (r.estado === 'resuelto') fila.resueltos += 1;
  });
  const meses = Object.keys(porMes).sort().map((clave) => {
    const [anio, mes] = clave.split('-');
    const nombreMes = new Date(Number(anio), Number(mes) - 1, 1)
      .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return [nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1), porMes[clave].recibidos, porMes[clave].resueltos];
  });

  const porPrioridad = {};
  reportes.forEach((r) => {
    const p = prioridadDe(r);
    if (p) porPrioridad[p] = (porPrioridad[p] || 0) + 1;
  });
  const prioridades = Object.entries(porPrioridad).map(([p, n]) => [PRIORIDAD_TEXTO[p], n]);

  return { general, categorias, meses, prioridades };
}

export const ENCABEZADOS_RESUMEN = {
  categorias: ['Por categoría', 'Total', 'Pendientes', 'En proceso', 'Resueltos'],
  meses: ['Por mes', 'Recibidos', 'Resueltos'],
  prioridades: ['Pendientes por prioridad', 'Cantidad'],
};

// Arma las filas de la hoja "Resumen" del Excel.
export function filasResumen(reportes, descripcionFiltros) {
  const { general, categorias, meses, prioridades } = datosResumen(reportes);
  const filas = [
    ['Resumen de reportes vecinales'],
    ['Municipalidad de La Cruz'],
    [`Generado el ${new Date().toLocaleDateString('es-AR')}`],
    [descripcionFiltros],
    [],
    ['Situación general'],
    ...general,
    [],
    ENCABEZADOS_RESUMEN.categorias,
    ...categorias,
    [],
    ENCABEZADOS_RESUMEN.meses,
    ...meses,
  ];
  if (prioridades.length) filas.push([], ENCABEZADOS_RESUMEN.prioridades, ...prioridades);
  return filas;
}
