import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import BotonesSociales from '../components/BotonesSociales';
import VerificarCorreo from '../components/VerificarCorreo';
import CompletarDatos from '../components/CompletarDatos';
import RecuperarContrasena from '../components/RecuperarContrasena';
import Captcha from '../components/Captcha';
import { User, Mail, Lock, IdCard, Eye, EyeOff, ShieldCheck, LogIn, UserPlus, CheckCircle, AlertCircle } from 'lucide-react';
import '../styles/pages/LoginPage.css';

const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’\- ]+$/;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MINIMO_PASSWORD = 8;

function validarCampo(nombre, valor, esRegistro) {
  const texto = valor.trim();
  switch (nombre) {
    case 'nombre':
    case 'apellido':
      if (!texto) return nombre === 'nombre' ? 'Ingresa tu nombre.' : 'Ingresa tu apellido.';
      if (texto.length < 2 || !SOLO_LETRAS.test(texto)) return 'Usa solo letras.';
      return '';
    case 'dni':
      return /^\d{7,8}$/.test(valor) ? '' : 'El DNI debe tener 7 u 8 números.';
    case 'email':
      if (!texto) return 'Ingresa tu email.';
      return EMAIL_VALIDO.test(texto) ? '' : 'Ingresa un email válido.';
    case 'password':
      if (!valor) return 'Ingresa tu contraseña.';
      if (esRegistro && valor.length < MINIMO_PASSWORD) return `Mínimo ${MINIMO_PASSWORD} caracteres.`;
      return '';
    default:
      return '';
  }
}

function IconoEstado({ estado }) {
  if (estado === 'valido') return <CheckCircle className="icono-estado icono-valido" size={20} aria-hidden="true" />;
  if (estado === 'invalido') return <AlertCircle className="icono-estado icono-invalido" size={20} aria-hidden="true" />;
  return null;
}

function MensajeCampo({ id, estado, error, ayuda = '', ok = '' }) {
  let texto = ayuda;
  let clase = 'campo-ayuda';
  if (estado === 'invalido') {
    texto = error;
    clase = 'campo-mensaje campo-mensaje-error';
  } else if (estado === 'valido' && ok) {
    texto = ok;
    clase = 'campo-mensaje campo-mensaje-ok';
  }
  return <p className={clase} id={id} aria-live="polite">{texto}</p>;
}

function LoginPage() {
  const [modo, setModo] = useState('login');
  const [formData, setFormData] = useState({ nombre: '', apellido: '', dni: '', email: '', password: '' });
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [mensajeExito, setMensajeExito] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [tocados, setTocados] = useState({});
  const [enviando, setEnviando] = useState(false);
  // Pasos: 'formulario' -> 'codigo' (confirmar correo), 'completar' (datos que faltan tras Google/Facebook) o 'recuperar' (olvidé mi contraseña)
  const [paso, setPaso] = useState('formulario');
  const [emailPendiente, setEmailPendiente] = useState('');
  const [datosSocial, setDatosSocial] = useState(null);
  const [captchaActivo, setCaptchaActivo] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaVuelta, setCaptchaVuelta] = useState(0);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    const valorLimpio = name === 'dni' ? value.replace(/\D/g, '') : value;
    setFormData({ ...formData, [name]: valorLimpio });
  };

  const camposDelModo = modo === 'registro'
    ? ['nombre', 'apellido', 'dni', 'email', 'password']
    : ['email', 'password'];

  const errores = {};
  camposDelModo.forEach((campo) => {
    errores[campo] = validarCampo(campo, formData[campo], modo === 'registro');
  });

  const marcarTocado = (e) => {
    const { name } = e.target;
    setTocados((previos) => ({ ...previos, [name]: true }));
  };

  const estadoCampo = (campo) => {
    if (modo !== 'registro' || !tocados[campo]) return 'neutro';
    return errores[campo] ? 'invalido' : 'valido';
  };

  const entrar = (datos) => {
    login(datos.usuario);
    navigate('/');
  };

  const alResultadoSocial = (datos) => {
    if (datos.requiereRegistro) {
      setDatosSocial(datos);
      setMensaje('');
      setPaso('completar');
    } else {
      entrar(datos);
    }
  };

  const volverAlFormulario = () => {
    setPaso('formulario');
    setDatosSocial(null);
    setMensaje('');
    setMensajeExito(false);
  };

  const cambiarModo = (nuevoModo) => {
    setCaptchaToken('');
    setTocados({});
    setModo(nuevoModo);
    setMensaje('');
    setMensajeExito(false);
    setVerPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setMensajeExito(false);

    if (modo === 'login' && (!formData.email.trim() || !formData.password)) {
      setMensaje('Completa tu email y tu contraseña.');
      document.getElementById(formData.email.trim() ? 'password' : 'email')?.focus();
      return;
    }

    const primerError = modo === 'registro' ? camposDelModo.find((campo) => errores[campo]) : null;
    if (primerError) {
      setTocados(Object.fromEntries(camposDelModo.map((campo) => [campo, true])));
      setMensaje('Revisa los campos marcados en rojo.');
      document.getElementById(primerError)?.focus();
      return;
    }

    if (modo === 'registro') {
      if (!aceptaTerminos) {
        setMensaje('Tienes que aceptar el uso de tus datos para registrarte.');
        return;
      }
      if (captchaActivo && !captchaToken) {
        setMensaje('Marca la casilla de verificación para continuar.');
        return;
      }
    }

    setEnviando(true);

    try {
      if (modo === 'registro') {
        const res = await axios.post('/api/auth/registro', { ...formData, aceptaTerminos, captcha: captchaToken });
        setEmailPendiente(res.data.email || formData.email.trim().toLowerCase());
        setPaso('codigo');
      } else {
        const res = await axios.post('/api/auth/login', {
          email: formData.email,
          password: formData.password
        });
        entrar(res.data);
      }
    } catch (error) {
      setMensaje(error.response?.data?.error || 'Ocurrió un error');
      // La verificación sirve una sola vez: si algo falló, se pide de nuevo.
      if (modo === 'registro' && captchaActivo) {
        setCaptchaToken('');
        setCaptchaVuelta((n) => n + 1);
      }
    } finally {
      setEnviando(false);
    }
  };

  const esRegistro = modo === 'registro';

  return (
    <div className="login-page">
      <div className="login-hero">
        <span className="login-logo">
          <Logo size={44} />
        </span>
        <h2>
          {paso === 'codigo' ? 'Confirma tu correo'
            : paso === 'recuperar' ? 'Recupera tu contraseña'
            : paso === 'completar' ? 'Un último paso'
            : esRegistro ? 'Crea tu cuenta' : 'Bienvenido a Voz Vecinal'}
        </h2>
        <p className="login-subtitulo">
          {paso === 'codigo' ? 'Así nos aseguramos de que tu email es real.'
            : paso === 'recuperar' ? 'Te ayudamos a volver a entrar.'
            : paso === 'completar' ? 'Necesitamos tu DNI para identificar tus reportes.'
            : esRegistro
              ? 'Con tu cuenta puedes reportar problemas y seguir cómo avanzan.'
              : 'Tu barrio, a un reporte de distancia.'}
        </p>
      </div>

      <div className="login-tarjeta">
        {paso === 'codigo' && (
          <VerificarCorreo email={emailPendiente} onVerificado={entrar} onVolver={volverAlFormulario} />
        )}

        {paso === 'recuperar' && (
          <RecuperarContrasena emailInicial={formData.email} onListo={entrar} onVolver={volverAlFormulario} />
        )}

        {paso === 'completar' && datosSocial && (
          <CompletarDatos
            registroToken={datosSocial.registroToken}
            perfil={datosSocial.perfil}
            onListo={entrar}
            onCancelar={volverAlFormulario}
          />
        )}

        {paso === 'formulario' && (
        <>
        <div className="login-tabs" role="group" aria-label="Elegir entre ingresar o registrarse">
          <button
            type="button"
            className={`login-tab ${!esRegistro ? 'activo' : ''}`}
            aria-pressed={!esRegistro}
            onClick={() => cambiarModo('login')}
          >
            <LogIn size={18} aria-hidden="true" />
            Ingresar
          </button>
          <button
            type="button"
            className={`login-tab ${esRegistro ? 'activo' : ''}`}
            aria-pressed={esRegistro}
            onClick={() => cambiarModo('registro')}
          >
            <UserPlus size={18} aria-hidden="true" />
            Registrarme
          </button>
        </div>

        <BotonesSociales
          onResultado={alResultadoSocial}
          onError={(texto) => { setMensajeExito(false); setMensaje(texto); }}
          deshabilitado={enviando}
        />

        <form onSubmit={handleSubmit} noValidate>
          {esRegistro && (
            <>
              <div className="campo-fila">
                <div className="campo">
                  <label htmlFor="nombre">Nombre</label>
                  <div className={`input-icono ${estadoCampo('nombre')}`}>
                    <User size={20} aria-hidden="true" />
                    <input
                      id="nombre"
                      type="text"
                      name="nombre"
                      autoComplete="given-name"
                      value={formData.nombre}
                      onChange={handleChange}
                      onBlur={marcarTocado}
                      aria-invalid={estadoCampo('nombre') === 'invalido'}
                      aria-describedby="nombre-mensaje"
                      required
                    />
                    <IconoEstado estado={estadoCampo('nombre')} />
                  </div>
                  <MensajeCampo id="nombre-mensaje" estado={estadoCampo('nombre')} error={errores.nombre} />
                </div>
                <div className="campo">
                  <label htmlFor="apellido">Apellido</label>
                  <div className={`input-icono ${estadoCampo('apellido')}`}>
                    <User size={20} aria-hidden="true" />
                    <input
                      id="apellido"
                      type="text"
                      name="apellido"
                      autoComplete="family-name"
                      value={formData.apellido}
                      onChange={handleChange}
                      onBlur={marcarTocado}
                      aria-invalid={estadoCampo('apellido') === 'invalido'}
                      aria-describedby="apellido-mensaje"
                      required
                    />
                    <IconoEstado estado={estadoCampo('apellido')} />
                  </div>
                  <MensajeCampo id="apellido-mensaje" estado={estadoCampo('apellido')} error={errores.apellido} />
                </div>
              </div>

              <div className="campo">
                <label htmlFor="dni">DNI</label>
                <div className={`input-icono ${estadoCampo('dni')}`}>
                  <IdCard size={20} aria-hidden="true" />
                  <input
                    id="dni"
                    type="text"
                    name="dni"
                    value={formData.dni}
                    onChange={handleChange}
                    onBlur={marcarTocado}
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="Sin puntos, solo números"
                    aria-invalid={estadoCampo('dni') === 'invalido'}
                    aria-describedby="dni-mensaje"
                    required
                  />
                  <IconoEstado estado={estadoCampo('dni')} />
                </div>
                <MensajeCampo id="dni-mensaje" estado={estadoCampo('dni')} error={errores.dni} />
              </div>
            </>
          )}

          <div className="campo">
            <label htmlFor="email">Email</label>
            <div className={`input-icono ${estadoCampo('email')}`}>
              <Mail size={20} aria-hidden="true" />
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={marcarTocado}
                aria-invalid={estadoCampo('email') === 'invalido'}
                aria-describedby="email-mensaje"
                required
              />
              <IconoEstado estado={estadoCampo('email')} />
            </div>
            <MensajeCampo id="email-mensaje" estado={estadoCampo('email')} error={errores.email} />
          </div>

          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <div className={`input-icono ${estadoCampo('password')}`}>
              <Lock size={20} aria-hidden="true" />
              <input
                id="password"
                type={verPassword ? 'text' : 'password'}
                name="password"
                autoComplete={esRegistro ? 'new-password' : 'current-password'}
                value={formData.password}
                onChange={handleChange}
                onBlur={marcarTocado}
                aria-invalid={estadoCampo('password') === 'invalido'}
                aria-describedby="password-mensaje"
                required
              />
              <IconoEstado estado={estadoCampo('password')} />
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
            <MensajeCampo
              id="password-mensaje"
              estado={estadoCampo('password')}
              error={errores.password}
              ayuda={esRegistro ? `Mínimo ${MINIMO_PASSWORD} caracteres.` : ''}
              ok={esRegistro ? 'Contraseña lista.' : ''}
            />
          </div>

          {esRegistro && (
            <label className="consentimiento">
              <input
                type="checkbox"
                checked={aceptaTerminos}
                onChange={(e) => setAceptaTerminos(e.target.checked)}
              />
              <span>
                Acepto que mi nombre, apellido y DNI se usen para identificar mis reportes y gestionarlos
                ante la Municipalidad. Solo el personal autorizado puede verlos.{' '}
                <Link to="/privacidad" target="_blank">Política de privacidad</Link>.
              </span>
            </label>
          )}

          {esRegistro && (
            <Captcha key={captchaVuelta} onToken={setCaptchaToken} onConfigurado={setCaptchaActivo} />
          )}

          {mensaje && (
            <p
              className={mensajeExito ? 'login-mensaje login-mensaje-exito' : 'login-mensaje login-mensaje-error'}
              role={mensajeExito ? 'status' : 'alert'}
            >
              {mensaje}
            </p>
          )}

          <button type="submit" className="login-enviar" disabled={enviando}>
            {enviando ? 'Enviando...' : esRegistro ? 'Crear mi cuenta' : 'Ingresar'}
          </button>

          {!esRegistro && (
            <div className="paso-acciones">
              <button type="button" className="paso-enlace" onClick={() => { setMensaje(''); setPaso('recuperar'); }}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}
        </form>

        {esRegistro && (
          <p className="login-privacidad">
            <ShieldCheck size={18} aria-hidden="true" />
            Tus datos los ve solo el personal municipal autorizado.
          </p>
        )}
        </>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
