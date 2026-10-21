import { etiquetaCategoria } from './categorias';
import { prioridadDe, PRIORIDAD_TEXTO, tiempoMedioDeRespuesta, textoDuracion } from './prioridad';

const DIA = 24 * 60 * 60 * 1000;
const DIAS_ANTIGUO = 7;

const porcentaje = (parte, total) => (total ? `${Math.round((parte / total) * 100)}%` : '0%');

// Arma las filas de la hoja "Resumen" a partir de los reportes que se están exportando.
export function filasResumen(reportes, descripcionFiltros) {
  const total = reportes.length;
  const cuenta = (estado) => reportes.filter((r) => r.estado === estado).length;
  const resueltos = cuenta('resuelto');
  const antiguos = reportes.filter(
    (r) => r.estado === 'pendiente' && (Date.now() - new Date(r.fecha_creacion)) / DIA >= DIAS_ANTIGUO
  ).length;
  const tiempo = tiempoMedioDeRespuesta(reportes);

  const filas = [
    ['Resumen de reportes vecinales'],
    ['Municipalidad de La Cruz'],
    [`Generado el ${new Date().toLocaleDateString('es-AR')}`],
    [descripcionFiltros],
    [],
    ['Situación general'],
    ['Total de reportes', total],
    ['Pendientes', cuenta('pendiente')],
    ['En proceso', cuenta('en_proceso')],
    ['Resueltos', resueltos],
    ['Porcentaje resuelto', porcentaje(resueltos, total)],
    [`Pendientes con más de ${DIAS_ANTIGUO} días`, antiguos],
    ['Tiempo promedio de resolución', tiempo ? textoDuracion(tiempo.dias) : 'Sin datos todavía'],
    [],
    ['Por categoría', 'Total', 'Pendientes', 'En proceso', 'Resueltos'],
  ];

  const categorias = {};
  reportes.forEach((r) => {
    const nombre = etiquetaCategoria(r);
    const fila = categorias[nombre] || (categorias[nombre] = { total: 0, pendiente: 0, en_proceso: 0, resuelto: 0 });
    fila.total += 1;
    fila[r.estado] += 1;
  });
  Object.entries(categorias)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([nombre, f]) => filas.push([nombre, f.total, f.pendiente, f.en_proceso, f.resuelto]));

  filas.push([], ['Por mes', 'Recibidos', 'Resueltos']);
  const meses = {};
  reportes.forEach((r) => {
    const f = new Date(r.fecha_creacion);
    const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
    const fila = meses[clave] || (meses[clave] = { recibidos: 0, resueltos: 0 });
    fila.recibidos += 1;
    if (r.estado === 'resuelto') fila.resueltos += 1;
  });
  Object.keys(meses).sort().forEach((clave) => {
    const [anio, mes] = clave.split('-');
    const nombreMes = new Date(Number(anio), Number(mes) - 1, 1)
      .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    filas.push([nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1), meses[clave].recibidos, meses[clave].resueltos]);
  });

  const prioridades = {};
  reportes.forEach((r) => {
    const p = prioridadDe(r);
    if (p) prioridades[p] = (prioridades[p] || 0) + 1;
  });
  if (Object.keys(prioridades).length) {
    filas.push([], ['Pendientes por prioridad', 'Cantidad']);
    Object.entries(prioridades).forEach(([p, n]) => filas.push([PRIORIDAD_TEXTO[p], n]));
  }

  return filas;
}
