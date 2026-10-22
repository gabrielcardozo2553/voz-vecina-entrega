import { Link } from 'react-router-dom';
import '../../styles/components/layout/Footer.css';
import { NOMBRE_APP, LOCALIDAD } from '../../config';

function Footer() {
  return (
    <footer className="footer">
      <p>© {new Date().getFullYear()} {LOCALIDAD} — {NOMBRE_APP}</p>
      <p><Link to="/privacidad">Política de privacidad</Link></p>
    </footer>
  );
}

export default Footer;