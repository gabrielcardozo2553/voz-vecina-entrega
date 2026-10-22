const { verificarToken, verificarAdmin } = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { prepararBaseDeDatos } = require('../config/migraciones');
const { registrarHistorial } = require('../config/historial');
const { limitarReportes, limitarMensajes } = require('../middleware/limitador');
const { notificar, notificarAdmins } = require('../config/notificaciones');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const EXTENSIONES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Nombre aleatorio y extensión según el tipo real: nunca se usa el nombre que manda el cliente.
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXTENSIONES[file.mimetype]}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONES[file.mimetype]) return cb(null, true);
    const error = new Error('Tipo de archivo no permitido');
    error.code = 'TIPO_INVALIDO';
    cb(error);
  }
});

function borrarArchivo(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const archivo = path.join('uploads', path.basename(url));
  fs.unlink(archivo, () => {});
}

function errorDeSubida(err, res) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'La foto no puede pesar más de 5MB' });
  }
  if (err.code === 'TIPO_INVALIDO') {
    return res.status(400).json({ error: 'El archivo tiene que ser una imagen (JPG, PNG o WEBP)' });
  }
  return res.status(400).json({ error: 'Error al subir la foto' });
}


router.get('/categorias', async (req, res) => {
  try {
    await prepararBaseDeDatos().catch(() => {});
    const [rows] = await db.query('SELECT * FROM categorias');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});


router.get('/reportes', async (req, res) => {
  try {
    await prepararBaseDeDatos();
    const [rows] = await db.query(`
      SELECT r.id, r.descripcion, r.foto_url, r.direccion, r.estado, r.fecha_creacion,
             r.latitud, r.longitud, r.categoria_otro,
             c.nombre AS categoria
      FROM reportes r
      JOIN categorias c ON r.categoria_id = c.id
      ORDER BY r.fecha_creacion DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});


router.post('/reportes', verificarToken, limitarReportes, (req, res, next) => {
  upload.single('foto')(req, res, (err) => {
    if (err) return errorDeSubida(err, res);
    next();
  });
}, async (req, res) => {
  try {
    const { categoria_id, latitud, longitud } = req.body;
    const descripcion = String(req.body.descripcion || '').trim().slice(0, 2000);
    const direccion = String(req.body.direccion || '').trim().slice(0, 255);

    if (!req.file) {
      return res.status(400).json({ error: 'La foto es obligatoria' });
    }
    if (!descripcion || !direccion) {
      borrarArchivo(`/uploads/${req.file.filename}`);
      return res.status(400).json({ error: 'La descripción y la dirección son obligatorias' });
    }
    const lat = latitud === undefined || latitud === '' ? null : Number(latitud);
    const lng = longitud === undefined || longitud === '' ? null : Number(longitud);
    if ((lat !== null && !(lat >= -90 && lat <= 90)) || (lng !== null && !(lng >= -180 && lng <= 180))) {
      borrarArchivo(`/uploads/${req.file.filename}`);
      return res.status(400).json({ error: 'La ubicación no es válida' });
    }

    await prepararBaseDeDatos();
    const [categorias] = await db.query('SELECT nombre FROM categorias WHERE id = ?', [categoria_id]);
    if (categorias.length === 0) {
      borrarArchivo(`/uploads/${req.file.filename}`);
      return res.status(400).json({ error: 'La categoría no es válida' });
    }
    const categoriaOtro = String(req.body.categoria_otro || '').trim().slice(0, 100);
    if (categorias[0].nombre.toLowerCase() === 'otros' && categoriaOtro.length < 3) {
      borrarArchivo(`/uploads/${req.file.filename}`);
      return res.status(400).json({ error: 'Cuéntanos de qué se trata el problema' });
    }

    const foto_url = `/uploads/${req.file.filename}`;

    const [result] = await db.query(
      'INSERT INTO reportes (usuario_id, categoria_id, categoria_otro, descripcion, foto_url, direccion, latitud, longitud) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.usuario.id, categoria_id, categoriaOtro || null, descripcion, foto_url, direccion, lat, lng]
    );

    await notificarAdmins({
      tipo: 'nuevo_reporte',
      reporteId: result.insertId,
      texto: `Nuevo reporte de ${categoriaOtro && categorias[0].nombre.toLowerCase() === 'otros' ? categoriaOtro : categorias[0].nombre}${direccion ? ` en ${direccion}` : ''}`,
    }, req.usuario.id);

    res.status(201).json({ id: result.insertId, mensaje: 'Reporte creado correctamente' });
  } catch (error) {
    console.error(error);
    if (req.file) borrarArchivo(`/uploads/${req.file.filename}`);
    res.status(500).json({ error: 'Error al crear el reporte' });
  }
});


router.get('/mis-reportes', verificarToken, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    const [rows] = await db.query(`
      SELECT r.id, r.descripcion, r.foto_url, r.direccion, r.estado, r.fecha_creacion,
             r.latitud, r.longitud, r.categoria_otro,
             c.nombre AS categoria,
             (SELECT m.autor FROM mensajes_reporte m WHERE m.reporte_id = r.id ORDER BY m.id DESC LIMIT 1) AS ultimo_mensaje_autor,
             (SELECT COUNT(*) FROM mensajes_reporte m2 WHERE m2.reporte_id = r.id) AS cantidad_mensajes
      FROM reportes r
      JOIN categorias c ON r.categoria_id = c.id
      WHERE r.usuario_id = ?
      ORDER BY r.fecha_creacion DESC
    `, [req.usuario.id]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener tus reportes' });
  }
});


const TEXTO_ESTADO = { pendiente: 'Pendiente', en_proceso: 'En proceso', resuelto: 'Resuelto' };

router.put('/reportes/:id/estado', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    await prepararBaseDeDatos();
    const estadosValidos = ['pendiente', 'en_proceso', 'resuelto'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }

    const [previos] = await db.query(
      `SELECT r.estado, r.usuario_id, r.categoria_otro, c.nombre AS categoria
       FROM reportes r JOIN categorias c ON r.categoria_id = c.id WHERE r.id = ?`,
      [id]
    );
    if (previos.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    await db.query(
      `UPDATE reportes
       SET estado = ?,
           fecha_resolucion = CASE
             WHEN ? = 'resuelto' THEN COALESCE(fecha_resolucion, NOW())
             ELSE NULL
           END
       WHERE id = ?`,
      [estado, estado, id]
    );

    if (previos[0].estado !== estado) {
      await registrarHistorial([{
        reporteId: id,
        usuario: req.usuario.nombre,
        accion: 'estado',
        detalle: `${TEXTO_ESTADO[previos[0].estado] || previos[0].estado} → ${TEXTO_ESTADO[estado]}`,
      }]);
      if (previos[0].usuario_id !== req.usuario.id) {
        await notificar([previos[0].usuario_id], {
          tipo: 'estado',
          reporteId: Number(id),
          texto: estado === 'resuelto'
            ? `¡Tu reporte de ${nombreCategoria(previos[0])} fue resuelto!`
            : `Tu reporte de ${nombreCategoria(previos[0])} ahora está ${TEXTO_ESTADO[estado].toLowerCase()}`,
        });
      }
    }

    res.json({ mensaje: 'Estado actualizado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el estado' });
  }
});

router.put('/reportes/:id/gestion', verificarToken, verificarAdmin, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    const { id } = req.params;
    const responsable = String(req.body.responsable || '').trim().slice(0, 100);
    const notas = String(req.body.notas_internas || '').trim().slice(0, 2000);

    const [previos] = await db.query('SELECT responsable, notas_internas FROM reportes WHERE id = ?', [id]);
    if (previos.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    await db.query(
      'UPDATE reportes SET responsable = ?, notas_internas = ? WHERE id = ?',
      [responsable || null, notas || null, id]
    );

    const entradas = [];
    if ((previos[0].responsable || '') !== responsable) {
      entradas.push({
        reporteId: id,
        usuario: req.usuario.nombre,
        accion: 'responsable',
        detalle: responsable ? `Responsable: ${responsable}` : 'Se quitó el responsable',
      });
    }
    if ((previos[0].notas_internas || '') !== notas) {
      entradas.push({ reporteId: id, usuario: req.usuario.nombre, accion: 'notas', detalle: 'Actualizó las notas internas' });
    }
    await registrarHistorial(entradas);

    res.json({ mensaje: 'Gestión actualizada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar los datos de gestión' });
  }
});

function nombreCategoria(r) {
  return r.categoria_otro && String(r.categoria).toLowerCase() === 'otros' ? r.categoria_otro : r.categoria;
}

async function infoReporte(id) {
  const [filas] = await db.query(
    `SELECT r.id, r.usuario_id, r.categoria_otro, c.nombre AS categoria
     FROM reportes r JOIN categorias c ON r.categoria_id = c.id
     WHERE r.id = ?`,
    [id]
  );
  return filas[0] || null;
}

async function reporteAccesible(req, idReporte) {
  const [filas] = await db.query('SELECT usuario_id FROM reportes WHERE id = ?', [idReporte]);
  if (filas.length === 0) return false;
  return req.usuario.rol === 'admin' || filas[0].usuario_id === req.usuario.id;
}

router.get('/reportes/:id/mensajes', verificarToken, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    if (!(await reporteAccesible(req, req.params.id))) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    const [rows] = await db.query(
      `SELECT id, autor, autor_nombre, texto, foto_url, fecha
       FROM mensajes_reporte
       WHERE reporte_id = ?
       ORDER BY id ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los mensajes' });
  }
});

router.post('/reportes/:id/mensajes', verificarToken, limitarMensajes, (req, res, next) => {
  upload.single('foto')(req, res, (err) => {
    if (err) return errorDeSubida(err, res);
    next();
  });
}, async (req, res) => {
  try {
    res.on('finish', () => {
      if (res.statusCode >= 400 && req.file) borrarArchivo(`/uploads/${req.file.filename}`);
    });
    await prepararBaseDeDatos();
    const { id } = req.params;
    const texto = String(req.body.texto || '').trim().slice(0, 1000);
    const esAdmin = req.usuario.rol === 'admin';

    if (!texto && !req.file) {
      return res.status(400).json({ error: 'Escribe un mensaje o adjunta una foto' });
    }
    if (!(await reporteAccesible(req, id))) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    if (!esAdmin) {
      const [pedidos] = await db.query(
        "SELECT 1 FROM mensajes_reporte WHERE reporte_id = ? AND autor = 'admin' LIMIT 1",
        [id]
      );
      if (pedidos.length === 0) {
        return res.status(403).json({ error: 'Todavía no hay ninguna consulta para responder' });
      }
    }

    const fotoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    await db.query(
      'INSERT INTO mensajes_reporte (reporte_id, autor, autor_nombre, texto, foto_url) VALUES (?, ?, ?, ?, ?)',
      [id, esAdmin ? 'admin' : 'vecino', req.usuario.nombre || null, texto, fotoUrl]
    );

    await registrarHistorial([{
      reporteId: id,
      usuario: req.usuario.nombre,
      accion: 'mensaje',
      detalle: esAdmin
        ? 'Pidió más información al vecino'
        : (fotoUrl ? 'El vecino respondió con una foto' : 'El vecino respondió'),
    }]);

    const reporte = await infoReporte(id);
    if (reporte) {
      if (esAdmin) {
        if (reporte.usuario_id !== req.usuario.id) {
          await notificar([reporte.usuario_id], {
            tipo: 'mensaje',
            reporteId: reporte.id,
            texto: `La Municipalidad te escribió sobre tu reporte de ${nombreCategoria(reporte)}`,
          });
        }
      } else {
        await notificarAdmins({
          tipo: 'respuesta',
          reporteId: reporte.id,
          texto: `${req.usuario.nombre || 'Un vecino'} respondió${fotoUrl ? ' con una foto' : ''} sobre el reporte de ${nombreCategoria(reporte)}`,
        }, req.usuario.id);
      }
    }

    res.status(201).json({ mensaje: 'Mensaje enviado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
});

router.put('/reportes-lote', verificarToken, verificarAdmin, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    const ids = Array.isArray(req.body.ids)
      ? [...new Set(req.body.ids.map(Number).filter(Number.isInteger))].slice(0, 500)
      : [];
    const { estado } = req.body;
    const responsable = typeof req.body.responsable === 'string'
      ? req.body.responsable.trim().slice(0, 100)
      : null;

    if (ids.length === 0) {
      return res.status(400).json({ error: 'No se eligió ningún reporte' });
    }
    if (estado === undefined && responsable === null) {
      return res.status(400).json({ error: 'No se indicó ningún cambio' });
    }
    if (estado !== undefined && !TEXTO_ESTADO[estado]) {
      return res.status(400).json({ error: 'Estado no válido' });
    }

    const [previos] = await db.query(
      `SELECT r.id, r.estado, r.responsable, r.usuario_id, r.categoria_otro, c.nombre AS categoria
       FROM reportes r JOIN categorias c ON r.categoria_id = c.id WHERE r.id IN (?)`,
      [ids]
    );
    const entradas = [];

    if (estado !== undefined) {
      await db.query(
        `UPDATE reportes
         SET estado = ?,
             fecha_resolucion = CASE
               WHEN ? = 'resuelto' THEN COALESCE(fecha_resolucion, NOW())
               ELSE NULL
             END
         WHERE id IN (?)`,
        [estado, estado, ids]
      );
      previos.filter((r) => r.estado !== estado).forEach((r) => entradas.push({
        reporteId: r.id,
        usuario: req.usuario.nombre,
        accion: 'estado',
        detalle: `${TEXTO_ESTADO[r.estado] || r.estado} → ${TEXTO_ESTADO[estado]}`,
      }));
      for (const r of previos.filter((x) => x.estado !== estado && x.usuario_id !== req.usuario.id)) {
        await notificar([r.usuario_id], {
          tipo: 'estado',
          reporteId: r.id,
          texto: estado === 'resuelto'
            ? `¡Tu reporte de ${nombreCategoria(r)} fue resuelto!`
            : `Tu reporte de ${nombreCategoria(r)} ahora está ${TEXTO_ESTADO[estado].toLowerCase()}`,
        });
      }
    }

    if (responsable !== null) {
      await db.query('UPDATE reportes SET responsable = ? WHERE id IN (?)', [responsable || null, ids]);
      previos.filter((r) => (r.responsable || '') !== responsable).forEach((r) => entradas.push({
        reporteId: r.id,
        usuario: req.usuario.nombre,
        accion: 'responsable',
        detalle: responsable ? `Responsable: ${responsable}` : 'Se quitó el responsable',
      }));
    }

    await registrarHistorial(entradas);

    res.json({ mensaje: 'Reportes actualizados correctamente', cantidad: previos.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar los reportes' });
  }
});

router.get('/admin/reportes/:id/historial', verificarToken, verificarAdmin, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    const [rows] = await db.query(
      `SELECT id, usuario_nombre, accion, detalle, fecha
       FROM historial_reportes
       WHERE reporte_id = ?
       ORDER BY fecha DESC, id DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
});

router.delete('/reportes/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [reportes] = await db.query('SELECT foto_url FROM reportes WHERE id = ?', [id]);
    if (reportes.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    const [fotosMensajes] = await db
      .query('SELECT foto_url FROM mensajes_reporte WHERE reporte_id = ? AND foto_url IS NOT NULL', [id])
      .catch(() => [[]]);

    await db.query('DELETE FROM reportes WHERE id = ?', [id]);
    await db.query('DELETE FROM historial_reportes WHERE reporte_id = ?', [id]).catch(() => {});
    await db.query('DELETE FROM mensajes_reporte WHERE reporte_id = ?', [id]).catch(() => {});
    await db.query('DELETE FROM notificaciones WHERE reporte_id = ?', [id]).catch(() => {});

    // Se borran también las fotos del disco para no acumular archivos huérfanos.
    borrarArchivo(reportes[0].foto_url);
    fotosMensajes.forEach((m) => borrarArchivo(m.foto_url));

    res.json({ mensaje: 'Reporte eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el reporte' });
  }
});

router.get('/admin/reportes', verificarToken, verificarAdmin, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    const [rows] = await db.query(`
      SELECT r.id, r.descripcion, r.foto_url, r.direccion, r.estado, r.fecha_creacion,
             r.fecha_resolucion, r.responsable, r.notas_internas, r.latitud, r.longitud, r.categoria_otro,
             (SELECT m.autor FROM mensajes_reporte m WHERE m.reporte_id = r.id ORDER BY m.id DESC LIMIT 1) AS ultimo_mensaje_autor,
             (SELECT COUNT(*) FROM mensajes_reporte m2 WHERE m2.reporte_id = r.id) AS cantidad_mensajes,
             c.nombre AS categoria,
             u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, u.dni AS usuario_dni
      FROM reportes r
      JOIN categorias c ON r.categoria_id = c.id
      JOIN usuarios u ON r.usuario_id = u.id
      ORDER BY r.fecha_creacion DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});

// ── Notificaciones del usuario ──
let ultimaLimpieza = 0;

router.get('/notificaciones', verificarToken, async (req, res) => {
  try {
    await prepararBaseDeDatos();
    if (Date.now() - ultimaLimpieza > 60 * 60 * 1000) {
      ultimaLimpieza = Date.now();
      db.query('DELETE FROM notificaciones WHERE fecha < NOW() - INTERVAL 60 DAY').catch(() => {});
    }
    const [items] = await db.query(
      `SELECT id, tipo, reporte_id, texto, leida, fecha
       FROM notificaciones WHERE usuario_id = ?
       ORDER BY id DESC LIMIT 30`,
      [req.usuario.id]
    );
    const [[{ noLeidas }]] = await db.query(
      'SELECT COUNT(*) AS noLeidas FROM notificaciones WHERE usuario_id = ? AND leida = 0',
      [req.usuario.id]
    );
    res.json({ noLeidas, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las notificaciones' });
  }
});

router.put('/notificaciones/leer-todas', verificarToken, async (req, res) => {
  try {
    await db.query('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ? AND leida = 0', [req.usuario.id]);
    res.json({ mensaje: 'Notificaciones marcadas como leídas' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar las notificaciones' });
  }
});

router.put('/notificaciones/:id/leida', verificarToken, async (req, res) => {
  try {
    await db.query('UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?', [req.params.id, req.usuario.id]);
    res.json({ mensaje: 'Notificación marcada como leída' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la notificación' });
  }
});

module.exports = router;