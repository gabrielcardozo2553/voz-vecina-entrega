import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { NOMBRE_APP, LOCALIDAD, CONTACTO_PRIVACIDAD } from '../config';
import '../styles/pages/PrivacidadPage.css';

// Texto base de privacidad. Conviene que la Municipalidad lo revise antes de usarlo oficialmente.
function PrivacidadPage() {
  return (
    <div className="privacidad-page">
      <div className="privacidad-cabecera">
        <span className="privacidad-icono" aria-hidden="true"><ShieldCheck size={28} /></span>
        <h2>Política de privacidad</h2>
        <p>{NOMBRE_APP} · {LOCALIDAD}</p>
      </div>

      <section>
        <h3>Qué datos guardamos</h3>
        <p>
          Tu nombre, apellido, DNI y email. Si ingresas con Google o Facebook, recibimos solo tu nombre y tu email
          (y un identificador interno de esa cuenta). Además guardamos lo que cargas en cada reporte: la categoría,
          la descripción, la dirección, la ubicación en el mapa y la foto, y los mensajes que intercambias con la Municipalidad.
        </p>
      </section>

      <section>
        <h3>Para qué los usamos</h3>
        <p>
          Para identificar tus reportes, gestionarlos ante la Municipalidad, avisarte cómo avanzan y poder comunicarnos contigo
          si falta información. No usamos tus datos para publicidad ni los vendemos.
        </p>
      </section>

      <section>
        <h3>Quién puede verlos</h3>
        <p>
          Tu nombre, apellido y DNI los ve solo el personal municipal autorizado. Los demás vecinos pueden ver los reportes
          (categoría, descripción, dirección, foto y estado), pero no quién los hizo.
        </p>
      </section>

      <section>
        <h3>Google y Facebook</h3>
        <p>
          Usamos estos servicios únicamente para confirmar quién eres al ingresar. No publicamos nada en tu nombre
          ni accedemos a tus contactos, amigos o publicaciones.
        </p>
      </section>

      <section>
        <h3>Cuánto tiempo los guardamos</h3>
        <p>
          Mientras tu cuenta esté activa y sea necesario para gestionar los reportes. Puedes pedir que se borre tu cuenta
          y tus datos en cualquier momento.
        </p>
      </section>

      <section id="eliminar-datos">
        <h3>Cómo pedir que borremos tus datos</h3>
        <p>
          Comunícate con la Municipalidad de La Cruz y pide la eliminación de tu cuenta, indicando tu nombre y el email con el que
          te registraste.
          {CONTACTO_PRIVACIDAD ? <> Puedes escribir a <strong>{CONTACTO_PRIVACIDAD}</strong>.</> : null}
          {' '}Si ingresaste con Facebook, también puedes quitar la aplicación desde la configuración de tu cuenta de Facebook.
        </p>
      </section>

      <section>
        <h3>Información en tu dispositivo</h3>
        <p>
          Guardamos en tu navegador un dato de sesión para que no tengas que ingresar en cada visita. Se borra al cerrar sesión.
        </p>
      </section>

      <p className="privacidad-volver"><Link to="/">Volver al inicio</Link></p>
    </div>
  );
}

export default PrivacidadPage;
