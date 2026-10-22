import { useEffect, useState } from 'react';
import axios from 'axios';
import { MailCheck, ArrowLeft } from 'lucide-react';

const SEGUNDOS_REENVIO = 60;

// Paso del registro: la persona escribe el código de 6 números que le llegó por correo.
function VerificarCorreo({ email, onVerificado, onVolver }) {
  const [codigo, setCodigo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [exito, setExito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(SEGUNDOS_REENVIO);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const confirmar = async (e) => {
    e.preventDefault();
    if (codigo.length !== 6) {
      setExito(false);
      setMensaje('Escribe los 6 números del código.');
      return;
    }
    setEnviando(true);
    setMensaje('');
    try {
      const res = await axios.post('/api/auth/verificar-email', { email, codigo });
      onVerificado(res.data);
    } catch (error) {
      setExito(false);
      setMensaje(error.response?.data?.error || 'No se pudo confirmar el código.');
    } finally {
      setEnviando(false);
    }
  };

  const reenviar = async () => {
    setMensaje('');
    try {
      await axios.post('/api/auth/reenviar-codigo', { email });
      setExito(true);
      setMensaje('Te enviamos un código nuevo.');
      setEspera(SEGUNDOS_REENVIO);
    } catch (error) {
      setExito(false);
      setMensaje(error.response?.data?.error || 'No se pudo reenviar el código.');
    }
  };

  return (
    <form onSubmit={confirmar} noValidate className="paso-codigo">
      <div className="paso-icono" aria-hidden="true"><MailCheck size={30} /></div>
      <p className="paso-texto">
        Te enviamos un código de 6 números a <strong>{email}</strong>. Escríbelo aquí para confirmar tu correo.
      </p>

      <label className="sr-only" htmlFor="codigo-correo">Código de 6 números</label>
      <input
        id="codigo-correo"
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

      {mensaje && (
        <p className={exito ? 'login-mensaje login-mensaje-exito' : 'login-mensaje login-mensaje-error'} role={exito ? 'status' : 'alert'}>
          {mensaje}
        </p>
      )}

      <button type="submit" className="login-enviar" disabled={enviando}>
        {enviando ? 'Confirmando...' : 'Confirmar mi correo'}
      </button>

      <div className="paso-acciones">
        <button type="button" className="paso-enlace" onClick={reenviar} disabled={espera > 0}>
          {espera > 0 ? `Pedir otro código en ${espera} s` : 'Pedir otro código'}
        </button>
        <button type="button" className="paso-enlace" onClick={onVolver}>
          <ArrowLeft size={16} aria-hidden="true" />
          Corregir mis datos
        </button>
      </div>
      <p className="paso-nota">Si no lo ves, mira también en “Spam” o “Correo no deseado”.</p>
    </form>
  );
}

export default VerificarCorreo;
