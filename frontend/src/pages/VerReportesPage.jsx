import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/pages/VerReportesPage.css';
import { iconoCategoria, colorCategoria, etiquetaCategoria } from '../utils/categorias';
import { MapPin, Calendar, Plus, X, RefreshCw } from 'lucide-react';
import { ESTADOS_TEXTO } from '../utils/estados';
import Spinner from '../components/Spinner';
import PantallaEstado from '../components/PantallaEstado';
import DetalleReporteModal from '../components/DetalleReporteModal';

const POR_PAGINA = 12;

// "2026-10" -> "Octubre de 2026"
function textoMes(valor) {
  const [anio, mes] = valor.split('-').map(Number);
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function VerReportesPage() {
  const [items, setItems] = useState([]);
  const [conteo, setConteo] = useState({ todos: 0, pendiente: 0, en_proceso: 0, resuelto: 0 });
  const [meses, setMeses] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(false);
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);
  const [filtroMes, setFiltroMes] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const ultimaPeticion = useRef(0);

  // Pide una página al servidor. Si llegan respuestas fuera de orden, solo vale la última.
  const cargarPagina = (numero) => {
    const id = ++ultimaPeticion.current;
    const params = { pagina: numero, limite: POR_PAGINA };
    if (filtroEstado !== 'todos') params.estado = filtroEstado;
    if (filtroMes !== 'todos') params.mes = filtroMes;

    if (numero === 1) setActualizando(true);
    else setCargandoMas(true);
    setError(false);

    return axios.get('/api/reportes', { params })
      .then(res => {
        if (id !== ultimaPeticion.current) return;
        setItems(anteriores => (numero === 1 ? res.data.items : [...anteriores, ...res.data.items]));
        setConteo(res.data.conteo);
        setMeses(res.data.meses);
        setHayMas(res.data.hayMas);
        setPagina(numero);
      })
      .catch(err => {
        if (id !== ultimaPeticion.current) return;
        console.error(err);
        setError(true);
      })
      .finally(() => {
        if (id !== ultimaPeticion.current) return;
        setCargando(false);
        setActualizando(false);
        setCargandoMas(false);
      });
  };

  useEffect(() => {
    cargarPagina(1);
  }, [filtroEstado, filtroMes]);

  if (cargando) return <Spinner texto="Cargando reportes..." />;

  if (error && items.length === 0) {
    return (
      <PantallaEstado tipo="conexion">
        <button type="button" className="pantalla-boton" onClick={() => { setCargando(true); cargarPagina(1); }}>
          <RefreshCw size={18} aria-hidden="true" />
          Reintentar
        </button>
      </PantallaEstado>
    );
  }

  return (
    <div className="ver-reportes-page">
      <div className="ver-reportes-cabecera">
        <h2>Reportes del pueblo</h2>
        <p className="ver-reportes-subtitulo">
          Mira los problemas que reportaron tus vecinos y cómo va su resolución.
        </p>
      </div>

      {meses.length > 0 && (
        <div className="filtros-barra">
          <div className="filtro-estados" role="group" aria-label="Filtrar por estado">
            {[
              ['todos', 'Todos'],
              ['pendiente', 'Pendientes'],
              ['en_proceso', 'En proceso'],
              ['resuelto', 'Resueltos'],
            ].map(([valor, texto]) => (
              <button
                type="button"
                key={valor}
                className={`filtro-chip filtro-${valor} ${filtroEstado === valor ? 'activo' : ''}`}
                aria-pressed={filtroEstado === valor}
                onClick={() => setFiltroEstado(valor)}
              >
                {texto}
                <span className="filtro-conteo">{conteo[valor]}</span>
              </button>
            ))}
          </div>
          <select
            className="filtro-mes"
            aria-label="Filtrar por mes"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
          >
            <option value="todos">Todos los meses</option>
            {meses.map(mes => (
              <option key={mes} value={mes}>{textoMes(mes)}</option>
            ))}
          </select>
        </div>
      )}

      {items.length === 0 ? (
        meses.length === 0 ? (
          <PantallaEstado tipo="vacio" texto="Cuando los vecinos reporten problemas, los verás aquí. Puedes ser el primero.">
            <Link to="/" className="pantalla-boton">
              <Plus size={18} aria-hidden="true" />
              Hacer un reporte
            </Link>
          </PantallaEstado>
        ) : (
          <PantallaEstado tipo="sinResultados" texto="No hay reportes con ese filtro. Prueba con otro estado o mes.">
            <button
              type="button"
              className="pantalla-boton pantalla-boton-suave"
              onClick={() => { setFiltroEstado('todos'); setFiltroMes('todos'); }}
            >
              <X size={18} aria-hidden="true" />
              Quitar filtros
            </button>
          </PantallaEstado>
        )
      ) : (
        <>
          <div className={`reportes-grid ${actualizando ? 'reportes-grid-actualizando' : ''}`} aria-busy={actualizando}>
            {items.map(r => {
              const Icono = iconoCategoria(r.categoria);
              const color = colorCategoria(r.categoria);
              return (
                <div
                  key={r.id}
                  className="reporte-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setReporteSeleccionado(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setReporteSeleccionado(r);
                    }
                  }}
                >
                  <div className="reporte-media">
                    {r.foto_url ? (
                      <img src={r.miniatura_url || r.foto_url} alt="Foto del reporte" className="reporte-foto" loading="lazy" decoding="async" />
                    ) : (
                      <div className={`reporte-foto reporte-sin-foto ${color}`}>
                        <Icono size={40} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                    )}
                    <span className={`estado-pill estado-${r.estado}`}>
                      <span className="estado-punto" />
                      {ESTADOS_TEXTO[r.estado]}
                    </span>
                  </div>
                  <div className="reporte-info">
                    <span className={`categoria-chip ${color}`}>
                      <Icono size={15} strokeWidth={2} aria-hidden="true" />
                      {etiquetaCategoria(r)}
                    </span>
                    <p className="reporte-descripcion">{r.descripcion}</p>
                    <p className="reporte-direccion">
                      <MapPin size={15} aria-hidden="true" />
                      {r.direccion}
                    </p>
                    <span className="reporte-fecha">
                      <Calendar size={14} aria-hidden="true" />
                      {new Date(r.fecha_creacion).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {hayMas && (
            <div className="cargar-mas-contenedor">
              <button
                type="button"
                className="boton-cargar-mas"
                disabled={cargandoMas}
                onClick={() => cargarPagina(pagina + 1)}
              >
                {cargandoMas ? 'Cargando...' : 'Cargar más reportes'}
              </button>
            </div>
          )}
          {error && (
            <p className="cargar-mas-error" role="alert">No se pudieron cargar más reportes. Inténtalo de nuevo.</p>
          )}
        </>
      )}

      <DetalleReporteModal
        reporte={reporteSeleccionado}
        onCerrar={() => setReporteSeleccionado(null)}
      />
    </div>
  );
}

export default VerReportesPage;