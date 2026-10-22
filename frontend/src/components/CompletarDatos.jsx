import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { User, IdCard, Mail, ShieldCheck } from 'lucide-react';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Paso final para quien ingresó con Google o Facebook por primera vez: faltan el DNI y el consentimiento.
function CompletarDatos({ registroToken, perfil, onListo, onCancelar }) {
  const [nombre, setNombre] = useState(perfil.nombre || '');
  const [apellido, setApellido] = useState(perfil.apellido || '');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  const pideEmail = !perfil.email;

  const enviar = async (e) => {
    e.preventDefault();
    setMensaje('');
    if (!nombre.trim() || !apellido.trim()) return setMensaje('Completa tu nombre y apellido.');
    if (!/^\d{7,8}$/.test(dni)) return setMensaje('El DNI debe tener 7 u 8 números, sin puntos.');
    if (pideEmail && !EMAIL_VALIDO.test(email.trim())) return setMensaje('Escribe un email válido.');
    if (!acepta) return setMensaje('Tienes que aceptar el uso de tus datos para continuar.');

    setEnviando(true);
    try {
      const res = await axios.post('/api/auth/completar-registro', {
        registroToken,
        nombre,
        apellido,
        dni,
        email: pideEmail ? email : undefined,
        aceptaTerminos: true,
      });
      onListo(res.data);
    } catch (error) {
      setMensaje(error.response?.data?.error || 'No se pudo completar el registro.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      {perfil.email && (
        <p className="completar-correo">
          <Mail size={18} aria-hidden="true" />
          <span>{perfil.email}</span>
        </p>
      )}

      <div className="campo-fila">
        <div className="campo">
          <label htmlFor="c-nombre">Nombre</label>
          <div className="input-icono">
            <User size={20} aria-hidden="true" />
            <input id="c-nombre" type="text" autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="c-apellido">Apellido</label>
          <div className="input-icono">
            <User size={20} aria-hidden="true" />
            <input id="c-apellido" type="text" autoComplete="family-name" value={apellido} onChange={(e) => setApellido(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="campo">
        <label htmlFor="c-dni">DNI</label>
        <div className="input-icono">
          <IdCard size={20} aria-hidden="true" />
          <input
            id="c-dni"
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder="Sin puntos, solo números"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
        </div>
      </div>

      {pideEmail && (
        <div className="campo">
          <label htmlFor="c-email">Email</label>
          <div className="input-icono">
            <Mail size={20} aria-hidden="true" />
            <input id="c-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <p className="campo-ayuda">Tu cuenta de Facebook no compartió un email. Lo usaremos para avisarte de tus reportes.</p>
        </div>
      )}

      <label className="consentimiento">
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
        <span>
          Acepto que mi nombre, apellido y DNI se usen para identificar mis reportes y gestionarlos
          ante la Municipalidad. Solo el personal autorizado puede verlos.{' '}
          <Link to="/privacidad" target="_blank">Política de privacidad</Link>.
        </span>
      </label>

      {mensaje && <p className="login-mensaje login-mensaje-error" role="alert">{mensaje}</p>}

      <button type="submit" className="login-enviar" disabled={enviando}>
        {enviando ? 'Guardando...' : 'Terminar mi registro'}
      </button>
      <div className="paso-acciones">
        <button type="button" className="paso-enlace" onClick={onCancelar}>Cancelar</button>
      </div>
      <p className="login-privacidad">
        <ShieldCheck size={18} aria-hidden="true" />
        Tus datos los ve solo el personal municipal autorizado.
      </p>
    </form>
  );
}

export default CompletarDatos;
