import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, CheckCheck, FilePlus2, MessageCircle, MessageSquareReply, RefreshCw, PartyPopper, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/components/Campana.css';

const INTERVALO_MS = 20000;
export const EVENTO_NOVEDADES = 'voz-vecinal:novedades';

const ICONOS = {
  nuevo_reporte: FilePlus2,
  respuesta: MessageSquareReply,
  mensaje: MessageCircle,
  estado: RefreshCw,
};

function haceCuanto(fecha) {
  const minutos = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}

function Campana() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState({ noLeidas: 0, items: [] });
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState('');
  const contenedor = useRef(null);
  const anterior = useRef(null);

  const esAdmin = usuario?.rol === 'admin';

  const cargar = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await axios.get('/api/notificaciones', { headers: { Authorization: `Bearer ${token}` } });
      const nuevas = res.data.noLeidas;

      if (anterior.current === null) {
        // Primera carga de la sesión: se avisa una sola vez si hay novedades.
        let yaAvisado = false;
        try { yaAvisado = sessionStorage.getItem('novedades-avisadas') === '1'; } catch { /* sin storage */ }
        if (nuevas > 0 && !yaAvisado) {
          setAviso(nuevas === 1 ? 'Tienes 1 novedad' : `Tienes ${nuevas} novedades`);
        }
        try { sessionStorage.setItem('novedades-avisadas', '1'); } catch { /* sin storage */ }
      } else if (nuevas > anterior.current) {
        const ultima = res.data.items.find((n) => !n.leida);
        setAviso(ultima ? ultima.texto : 'Tienes novedades');
        window.dispatchEvent(new Event(EVENTO_NOVEDADES));
      }
      anterior.current = nuevas;
      setDatos(res.data);
    } catch {
      /* si falla la red no se molesta al usuario: se reintenta en el próximo ciclo */
    }
  }, []);

  useEffect(() => {
    if (!usuario) {
      anterior.current = null;
      setDatos({ noLeidas: 0, items: [] });
      return undefined;
    }
    cargar();
    const temporizador = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, INTERVALO_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      clearInterval(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [usuario, cargar]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(''), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    if (!abierto) return undefined;
    const alClicFuera = (e) => {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false);
    };
    const alTeclear = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  if (!usuario) return null;

  const encabezado = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const marcarTodas = async () => {
    setDatos((d) => ({ noLeidas: 0, items: d.items.map((n) => ({ ...n, leida: 1 })) }));
    anterior.current = 0;
    try {
      await axios.put('/api/notificaciones/leer-todas', {}, { headers: encabezado() });
    } catch { cargar(); }
  };

  const abrirNotificacion = async (n) => {
    setAbierto(false);
    setAviso('');
    if (!n.leida) {
      setDatos((d) => ({
        noLeidas: Math.max(0, d.noLeidas - 1),
        items: d.items.map((x) => (x.id === n.id ? { ...x, leida: 1 } : x)),
      }));
      anterior.current = Math.max(0, (anterior.current || 1) - 1);
      axios.put(`/api/notificaciones/${n.id}/leida`, {}, { headers: encabezado() }).catch(() => {});
    }
    if (n.reporte_id) {
      navigate(`${esAdmin ? '/admin' : '/mis-reportes'}?reporte=${n.reporte_id}`);
    }
  };

  const cantidad = datos.noLeidas > 9 ? '9+' : String(datos.noLeidas);

  return (
    <div className="campana" ref={contenedor}>
      <button
        type="button"
        className="campana-boton"
        onClick={() => { setAbierto((v) => !v); setAviso(''); if (!abierto) cargar(); }}
        aria-label={datos.noLeidas > 0 ? `Notificaciones: ${datos.noLeidas} sin leer` : 'Notificaciones'}
        aria-expanded={abierto}
      >
        <Bell size={20} aria-hidden="true" />
        {datos.noLeidas > 0 && <span className="campana-contador">{cantidad}</span>}
      </button>

      {aviso && !abierto && (
        <div className="campana-aviso" role="status">
          <PartyPopper size={16} aria-hidden="true" />
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso('')} aria-label="Cerrar aviso">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {abierto && (
        <div className="campana-panel" role="dialog" aria-label="Notificaciones">
          <div className="campana-panel-cabecera">
            <h3>Novedades</h3>
            {datos.noLeidas > 0 && (
              <button type="button" onClick={marcarTodas}>
                <CheckCheck size={15} aria-hidden="true" />
                Marcar todas como leídas
              </button>
            )}
          </div>

          {datos.items.length === 0 ? (
            <p className="campana-vacia">
              {esAdmin
                ? 'Aquí verás los reportes nuevos y las respuestas de los vecinos.'
                : 'Aquí verás cuando tu reporte avance o la Municipalidad te escriba.'}
            </p>
          ) : (
            <ul className="campana-lista">
              {datos.items.map((n) => {
                const Icono = ICONOS[n.tipo] || Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`campana-item ${n.leida ? '' : 'campana-item-nueva'}`}
                      onClick={() => abrirNotificacion(n)}
                    >
                      <span className={`campana-icono campana-icono-${n.tipo}`}>
                        <Icono size={16} aria-hidden="true" />
                      </span>
                      <span className="campana-item-texto">
                        <span>{n.texto}</span>
                        <small>{haceCuanto(n.fecha)}</small>
                      </span>
                      {!n.leida && <span className="campana-punto" aria-label="Sin leer" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default Campana;
