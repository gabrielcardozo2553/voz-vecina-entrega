import { useEffect, useState } from 'react';
import axios from 'axios';
import { KeyRound, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const SEGUNDOS_REENVIO = 60;
const MINIMO_PASSWORD = 8;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// "Olvidé mi contraseña": primero se pide el email, luego se escribe el código y la contraseña nueva.
function RecuperarContrasena({ emailInicial = '', onListo, onVolver }) {
  const [fase, setFase] = useState('email');
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [exito, setExito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const avisar = (texto, esExito = false) => {
    setExito(esExito);
    setMensaje(texto);
  };

  const pedirCodigo = async (e) => {
    if (e) e.preventDefault();
    const limpio = email.trim().toLowerCase();
    if (!EMAIL_VALIDO.test(limpio)) {
      avisar('Ingresa un email válido.');
      return;
    }
    setEnviando(true);
    setMensaje('');
    try {
      await axios.post('/api/auth/recuperar', { email: limpio });
      setEmail(limpio);
      setFase('codigo');
      setEspera(SEGUNDOS_REENVIO);
      avisar('', false);
    } catch (error) {
      avisar(error.response?.data?.error || 'No se pudo enviar el código. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const reenviar = async () => {
    setMensaje('');
    try {
      await axios.post('/api/auth/recuperar', { email });
      setEspera(SEGUNDOS_REENVIO);
      avisar('Si ese email está registrado, te enviamos un código nuevo.', true);
    } catch (error) {
      avisar(error.response?.data?.error || 'No se pudo reenviar el código.');
    }
  };

  const cambiar = async (e) => {
    e.preventDefault();
    if (codigo.length !== 6) {
      avisar('Escribe los 6 números del código.');
      return;
    }
    if (password.length < MINIMO_PASSWORD) {
      avisar(`La contraseña nueva debe tener al menos ${MINIMO_PASSWORD} caracteres.`);
      return;
    }
    setEnviando(true);
    setMensaje('');
    try {
      const res = await axios.post('/api/auth/restablecer', { email, codigo, password });
      onListo(res.data);
    } catch (error) {
      avisar(error.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally {
      setEnviando(false);
    }
  };

  const bloqueMensaje = mensaje && (
    <p
      className={exito ? 'login-mensaje login-mensaje-exito' : 'login-mensaje login-mensaje-error'}
      role={exito ? 'status' : 'alert'}
    >
      {mensaje}
    </p>
  );

  if (fase === 'email') {
    return (
      <form onSubmit={pedirCodigo} noValidate className="paso-codigo">
        <div className="paso-icono" aria-hidden="true"><KeyRound size={30} /></div>
        <p className="paso-texto">
          Escribe el email con el que te registraste y te enviaremos un código para crear una contraseña nueva.
        </p>

        <div className="campo">
          <label htmlFor="recuperar-email">Email</label>
          <div className="input-icono neutro">
            <Mail size={20} aria-hidden="true" />
            <input
              id="recuperar-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setMensaje(''); }}
              autoFocus
              required
            />
          </div>
        </div>

        {bloqueMensaje}

        <button type="submit" className="login-enviar" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviarme el código'}
        </button>
        <div className="paso-acciones">
          <button type="button" className="paso-enlace" onClick={onVolver}>
            <ArrowLeft size={16} aria-hidden="true" />
            Volver a ingresar
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={cambiar} noValidate className="paso-codigo">
      <div className="paso-icono" aria-hidden="true"><KeyRound size={30} /></div>
      <p className="paso-texto">
        Si <strong>{email}</strong> está registrado, te enviamos un código de 6 números. Escríbelo y elige tu contraseña nueva.
      </p>

      <label className="sr-only" htmlFor="recuperar-codigo">Código de 6 números</label>
      <input
        id="recuperar-codigo"
        className="codigo-entrada"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="______"
        value={codigo}
        onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '')); setMensaje(''); }}
        autoFocus
      />

      <div className="campo">
        <label htmlFor="recuperar-password">Contraseña nueva</label>
        <div className="input-icono neutro">
          <Lock size={20} aria-hidden="true" />
          <input
            id="recuperar-password"
            type={verPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setMensaje(''); }}
            required
          />
          <button
            type="button"
            className="boton-ver-password"
            onClick={() => setVerPassword(!verPassword)}
            aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={verPassword}
          >
            {verPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        </div>
        <p className="campo-ayuda">Mínimo {MINIMO_PASSWORD} caracteres.</p>
      </div>

      {bloqueMensaje}

      <button type="submit" className="login-enviar" disabled={enviando}>
        {enviando ? 'Guardando...' : 'Cambiar contraseña e ingresar'}
      </button>

      <div className="paso-acciones">
        <button type="button" className="paso-enlace" onClick={reenviar} disabled={espera > 0}>
          {espera > 0 ? `Pedir otro código en ${espera} s` : 'Pedir otro código'}
        </button>
        <button type="button" className="paso-enlace" onClick={onVolver}>
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a ingresar
        </button>
      </div>
      <p className="paso-nota">Si no lo ves, mira también en “Spam” o “Correo no deseado”.</p>
    </form>
  );
}

export default RecuperarContrasena;
