import { saveAs } from 'file-saver';
import { etiquetaCategoria } from './categorias';
import { ESTADOS_TEXTO } from './estados';
import { prioridadDe, PRIORIDAD_TEXTO } from './prioridad';
import { datosResumen, ENCABEZADOS_RESUMEN } from './resumenExcel';
import { COLORES, graficoEstados, graficoCategorias, graficoMeses } from './graficosResumen';

const hoy = () => new Date().toISOString().slice(0, 10);
const sinGato = (hex) => hex.replace('#', '');
const argb = (hex) => `FF${sinGato(hex).toUpperCase()}`;

function descripcionDeFiltros(total, mostrados) {
  return total === mostrados
    ? 'Incluye todos los reportes'
    : `Incluye ${mostrados} de ${total} reportes (según los filtros aplicados)`;
}

function contarEstados(reportes) {
  const cuenta = (e) => reportes.filter((r) => r.estado === e).length;
  return { pendientes: cuenta('pendiente'), enProceso: cuenta('en_proceso'), resueltos: cuenta('resuelto') };
}

// ───────────────────────── Excel ─────────────────────────

export async function exportarExcelConFormato(reportes, totalReportes) {
  const ExcelJS = (await import('exceljs')).default;
  const resumen = datosResumen(reportes);
  const estados = contarEstados(reportes);

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Voz Vecinal';
  libro.created = new Date();

  const borde = { style: 'thin', color: { argb: argb(COLORES.borde) } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };

  // ── Hoja Resumen ──
  const hoja = libro.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  hoja.columns = Array.from({ length: 8 }, () => ({ width: 14 }));
  const PX_FILA = 20;

  hoja.mergeCells('A1:H1');
  hoja.getCell('A1').value = 'Voz Vecinal · Resumen de reportes';
  hoja.getCell('A1').font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORES.primario) } };
  hoja.getCell('A1').alignment = { vertical: 'middle', indent: 1 };
  hoja.getRow(1).height = 42;

  hoja.mergeCells('A2:H2');
  hoja.getCell('A2').value = `Municipalidad de La Cruz · Generado el ${new Date().toLocaleDateString('es-AR')} · ${descripcionDeFiltros(totalReportes, reportes.length)}`;
  hoja.getCell('A2').font = { size: 10, color: { argb: argb(COLORES.oscuro) } };
  hoja.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORES.claro) } };
  hoja.getCell('A2').alignment = { vertical: 'middle', indent: 1 };
  hoja.getRow(2).height = 22;

  // Tarjetas de cifras: [fila, columnaInicial, columnaFinal, valor, etiqueta, color]
  const tarjeta = (fila, desde, hasta, valor, etiqueta, color) => {
    const L = (n) => String.fromCharCode(64 + n);
    hoja.mergeCells(`${L(desde)}${fila}:${L(hasta)}${fila}`);
    hoja.mergeCells(`${L(desde)}${fila + 1}:${L(hasta)}${fila + 1}`);
    const num = hoja.getCell(`${L(desde)}${fila}`);
    num.value = valor;
    num.font = { size: 24, bold: true, color: { argb: argb(color) } };
    num.alignment = { horizontal: 'center', vertical: 'middle' };
    const lab = hoja.getCell(`${L(desde)}${fila + 1}`);
    lab.value = etiqueta;
    lab.font = { size: 10, bold: true, color: { argb: argb(COLORES.suave) } };
    lab.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = desde; c <= hasta; c++) {
      [fila, fila + 1].forEach((f) => {
        const celda = hoja.getCell(`${L(c)}${f}`);
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F5EE' } };
        const lados = {};
        if (f === fila) lados.top = { style: 'medium', color: { argb: argb(color) } };
        if (f === fila + 1) lados.bottom = borde;
        if (c === desde) lados.left = borde;
        if (c === hasta) lados.right = borde;
        celda.border = lados;
      });
    }
  };

  hoja.getRow(3).height = 8;
  hoja.getRow(4).height = 38;
  hoja.getRow(5).height = 22;
  tarjeta(4, 1, 2, reportes.length, 'TOTAL', COLORES.oscuro);
  tarjeta(4, 3, 4, estados.pendientes, 'PENDIENTES', COLORES.pendiente);
  tarjeta(4, 5, 6, estados.enProceso, 'EN PROCESO', COLORES.en_proceso);
  tarjeta(4, 7, 8, estados.resueltos, 'RESUELTOS', COLORES.resuelto);

  hoja.getRow(6).height = 8;
  hoja.getRow(7).height = 30;
  hoja.getRow(8).height = 22;
  const valorGeneral = (texto) => resumen.general.find((f) => f[0].startsWith(texto))?.[1];
  tarjeta(7, 1, 2, valorGeneral('Porcentaje'), '% RESUELTO', COLORES.resuelto);
  tarjeta(7, 3, 5, valorGeneral('Pendientes con'), 'PENDIENTES DE MÁS DE 7 DÍAS', COLORES.pendiente);
  tarjeta(7, 6, 8, valorGeneral('Tiempo promedio'), 'TIEMPO PROMEDIO DE RESOLUCIÓN', COLORES.primario);
  hoja.getCell('A7').font = { size: 20, bold: true, color: { argb: argb(COLORES.resuelto) } };
  hoja.getCell('C7').font = { size: 20, bold: true, color: { argb: argb(COLORES.pendiente) } };
  hoja.getCell('F7').font = { size: 20, bold: true, color: { argb: argb(COLORES.primario) } };

  // Gráficos (imágenes)
  let fila = 10;
  const ANCHO_HOJA_PX = 8 * 103;
  const colocar = (grafico) => {
    const ancho = ANCHO_HOJA_PX;
    const alto = Math.round((grafico.alto * ancho) / grafico.ancho);
    const id = libro.addImage({ base64: grafico.url, extension: 'png' });
    hoja.addImage(id, { tl: { col: 0, row: fila - 1 }, ext: { width: ancho, height: alto } });
    fila += Math.ceil(alto / PX_FILA) + 1;
  };
  colocar(graficoEstados(estados));
  colocar(graficoCategorias(resumen.categorias));
  colocar(graficoMeses(resumen.meses));
  for (let r = 10; r < fila; r++) hoja.getRow(r).height = 15;

  // Tablas
  const tabla = (encabezado, filas, colorear) => {
    if (!filas.length) return;
    hoja.mergeCells(`A${fila}:B${fila}`);
    encabezado.forEach((texto, i) => {
      const columna = i === 0 ? 1 : i + 2;
      const celda = hoja.getCell(fila, columna);
      celda.value = texto;
      celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORES.primario) } };
      celda.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    });
    hoja.getCell(fila, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORES.primario) } };
    hoja.getRow(fila).height = 22;
    fila += 1;
    filas.forEach((datos, n) => {
      hoja.mergeCells(`A${fila}:B${fila}`);
      datos.forEach((valor, i) => {
        const columna = i === 0 ? 1 : i + 2;
        const celda = hoja.getCell(fila, columna);
        celda.value = valor;
        celda.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
        if (colorear) colorear(celda, i, valor);
      });
      for (let c = 1; c <= 2 + encabezado.length - 1; c++) {
        const celda = hoja.getCell(fila, c);
        celda.border = bordes;
        if (n % 2 === 1) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F5EE' } };
      }
      hoja.getRow(fila).height = 20;
      fila += 1;
    });
    fila += 1;
  };

  const colorEstado = (celda, i, valor) => {
    const colores = { 2: COLORES.pendiente, 3: COLORES.en_proceso, 4: COLORES.resuelto };
    if (colores[i] && valor > 0) celda.font = { bold: true, color: { argb: argb(colores[i]) } };
    if (i === 1) celda.font = { bold: true };
  };
  tabla(ENCABEZADOS_RESUMEN.categorias, resumen.categorias, colorEstado);
  tabla(ENCABEZADOS_RESUMEN.meses, resumen.meses, (celda, i) => { if (i > 0) celda.font = { bold: true }; });
  tabla(ENCABEZADOS_RESUMEN.prioridades, resumen.prioridades, (celda, i, valor) => {
    if (i === 0) {
      const color = { Alta: '#c0392b', Media: COLORES.pendiente, Baja: COLORES.resuelto }[valor];
      if (color) celda.font = { bold: true, color: { argb: argb(color) } };
    }
  });

  hoja.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  // ── Hoja Reportes ──
  const detalle = libro.addWorksheet('Reportes', { views: [{ state: 'frozen', ySplit: 1 }] });
  detalle.columns = [
    { header: 'Categoría', key: 'categoria', width: 24 },
    { header: 'Dirección', key: 'direccion', width: 32 },
    { header: 'Descripción', key: 'descripcion', width: 60 },
    { header: 'Prioridad', key: 'prioridad', width: 12 },
    { header: 'Responsable', key: 'responsable', width: 20 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Fecha', key: 'fecha', width: 12 },
  ];
  reportes.forEach((r) => {
    const p = prioridadDe(r);
    detalle.addRow({
      categoria: etiquetaCategoria(r),
      direccion: r.direccion,
      descripcion: r.descripcion,
      prioridad: p ? PRIORIDAD_TEXTO[p] : '',
      responsable: r.responsable || '',
      estado: ESTADOS_TEXTO[r.estado],
      fecha: new Date(r.fecha_creacion).toLocaleDateString('es-AR'),
    });
  });
  const encabezado = detalle.getRow(1);
  encabezado.height = 24;
  encabezado.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORES.primario) } };
    celda.alignment = { vertical: 'middle' };
  });
  const coloresPrioridad = { Alta: '#c0392b', Media: '#b07d12', Baja: COLORES.resuelto };
  const coloresEstado = { Pendiente: '#b07d12', 'En proceso': COLORES.en_proceso, Resuelto: COLORES.resuelto };
  detalle.eachRow((fila_, numero) => {
    if (numero === 1) return;
    fila_.eachCell((celda) => {
      celda.border = bordes;
      celda.alignment = { vertical: 'top', wrapText: true };
      if (numero % 2 === 1) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F5EE' } };
    });
    const prio = fila_.getCell(4);
    if (coloresPrioridad[prio.value]) prio.font = { bold: true, color: { argb: argb(coloresPrioridad[prio.value]) } };
    const est = fila_.getCell(6);
    if (coloresEstado[est.value]) est.font = { bold: true, color: { argb: argb(coloresEstado[est.value]) } };
  });
  if (reportes.length) detalle.autoFilter = { from: 'A1', to: `G${reportes.length + 1}` };

  const buffer = await libro.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `reportes_${hoy()}.xlsx`
  );
}

// ───────────────────────── PDF ─────────────────────────

const rgb = (hex) => {
  const h = sinGato(hex);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export async function exportarPDFConFormato(reportes, totalReportes) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();
  const resumen = datosResumen(reportes);
  const estados = contarEstados(reportes);
  const MARGEN = 14;
  const ANCHO = 210 - MARGEN * 2;
  const LIMITE = 282;

  // Banda superior
  doc.setFillColor(...rgb(COLORES.primario));
  doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(...rgb(COLORES.acento));
  doc.rect(0, 30, 210, 1.6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('Voz Vecinal · Resumen de reportes', MARGEN, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `Municipalidad de La Cruz · Generado el ${new Date().toLocaleDateString('es-AR')} · ${descripcionDeFiltros(totalReportes, reportes.length)}`,
    MARGEN, 23
  );

  // Tarjetas de cifras
  const tarjeta = (x, y, w, h, valor, etiqueta, color) => {
    doc.setFillColor(247, 245, 238);
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
    doc.setFillColor(...rgb(color));
    doc.rect(x, y + 1, 1.6, h - 2, 'F');
    doc.setTextColor(...rgb(color));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(h > 20 ? 22 : 15);
    doc.text(String(valor), x + 6, y + (h > 20 ? 12 : 9));
    doc.setTextColor(...rgb(COLORES.suave));
    doc.setFontSize(7.5);
    doc.text(etiqueta, x + 6, y + h - 4);
  };
  const valorGeneral = (texto) => resumen.general.find((f) => f[0].startsWith(texto))?.[1];
  const sep = 4;
  const w4 = (ANCHO - sep * 3) / 4;
  let y = 38;
  [
    [reportes.length, 'TOTAL', COLORES.oscuro],
    [estados.pendientes, 'PENDIENTES', COLORES.pendiente],
    [estados.enProceso, 'EN PROCESO', COLORES.en_proceso],
    [estados.resueltos, 'RESUELTOS', COLORES.resuelto],
  ].forEach(([v, e, c], i) => tarjeta(MARGEN + i * (w4 + sep), y, w4, 24, v, e, c));
  y += 28;
  const w3 = (ANCHO - sep * 2) / 3;
  [
    [valorGeneral('Porcentaje'), '% RESUELTO', COLORES.resuelto],
    [valorGeneral('Pendientes con'), 'PENDIENTES DE MÁS DE 7 DÍAS', COLORES.pendiente],
    [valorGeneral('Tiempo promedio'), 'TIEMPO PROMEDIO DE RESOLUCIÓN', COLORES.primario],
  ].forEach(([v, e, c], i) => tarjeta(MARGEN + i * (w3 + sep), y, w3, 18, v, e, c));
  y += 24;

  // Gráficos
  const colocar = (grafico) => {
    const alto = (grafico.alto * ANCHO) / grafico.ancho;
    if (y + alto > LIMITE) {
      doc.addPage();
      y = 16;
    }
    doc.addImage(grafico.url, 'PNG', MARGEN, y, ANCHO, alto);
    y += alto + 4;
  };
  colocar(graficoEstados(estados));
  colocar(graficoCategorias(resumen.categorias));
  colocar(graficoMeses(resumen.meses));

  // Tablas del resumen
  const estiloTabla = {
    styles: { fontSize: 9, cellPadding: 2.2, lineColor: rgb(COLORES.borde), lineWidth: 0.1 },
    headStyles: { fillColor: rgb(COLORES.primario), textColor: 255 },
    alternateRowStyles: { fillColor: [247, 245, 238] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
    margin: { left: MARGEN, right: MARGEN },
  };
  const tabla = (encabezado, filas, extra = {}) => {
    if (!filas.length) return;
    if (y > LIMITE - 30) {
      doc.addPage();
      y = 16;
    }
    autoTable(doc, { ...estiloTabla, ...extra, startY: y, head: [encabezado], body: filas });
    y = doc.lastAutoTable.finalY + 6;
  };
  tabla(ENCABEZADOS_RESUMEN.categorias, resumen.categorias, {
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const colores = { 2: COLORES.pendiente, 3: COLORES.en_proceso, 4: COLORES.resuelto };
      if (colores[d.column.index] && Number(d.cell.raw) > 0) {
        d.cell.styles.textColor = rgb(colores[d.column.index]);
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });
  tabla(ENCABEZADOS_RESUMEN.prioridades, resumen.prioridades, { tableWidth: 90 });

  // Detalle
  doc.addPage();
  doc.setTextColor(...rgb(COLORES.oscuro));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Detalle de reportes', MARGEN, 16);

  const coloresEstado = { Pendiente: COLORES.pendiente, 'En proceso': COLORES.en_proceso, Resuelto: COLORES.resuelto };
  autoTable(doc, {
    startY: 21,
    head: [['Categoría', 'Dirección', 'Descripción', 'Estado', 'Fecha']],
    body: reportes.map((r) => [
      etiquetaCategoria(r),
      r.direccion,
      r.descripcion,
      ESTADOS_TEXTO[r.estado],
      new Date(r.fecha_creacion).toLocaleDateString('es-AR'),
    ]),
    styles: { fontSize: 8, cellPadding: 2, lineColor: rgb(COLORES.borde), lineWidth: 0.1 },
    headStyles: { fillColor: rgb(COLORES.primario), textColor: 255 },
    alternateRowStyles: { fillColor: [247, 245, 238] },
    margin: { left: MARGEN, right: MARGEN },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3 && coloresEstado[d.cell.raw]) {
        d.cell.styles.textColor = rgb(coloresEstado[d.cell.raw]);
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...rgb(COLORES.suave));
    doc.text('Voz Vecinal · Municipalidad de La Cruz', MARGEN, 291);
    doc.text(`Página ${i} de ${paginas}`, 210 - MARGEN, 291, { align: 'right' });
  }

  doc.save(`reportes_${hoy()}.pdf`);
}
