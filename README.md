# Voz Vecinal

Aplicación web para que los vecinos reporten problemas de su localidad a la Municipalidad de La Cruz (baches, alumbrado, basura, etc.) y sigan cómo se resuelven. Incluye un panel para el personal municipal.

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** Node.js + Express (`backend/`)
- **Base de datos:** MySQL (por ejemplo, la que trae WampServer)

## Qué puede hacer cada rol

**Vecino:** reportar un problema con foto y ubicación, ver los reportes de todos, seguir los suyos, recibir novedades (campanita) y responder cuando la Municipalidad le pide más información.

**Administrador:** ver y filtrar todos los reportes, cambiar su estado, asignar responsable, anotar notas internas, ver posibles repetidos y el historial de cambios, escribirle al vecino (con fotos), actuar sobre varios reportes a la vez y exportar a Excel o PDF con resumen y gráficos.

## Puesta en marcha rápida

Necesitas **Node.js 20+** y **MySQL/MariaDB encendido** (por ejemplo, WampServer o XAMPP). Desde la carpeta del proyecto:

```
npm run instalar     # instala backend y frontend
npm run preparar     # crea backend/.env con una clave aleatoria
npm run demo         # crea la base, las tablas, cuentas de prueba y reportes de ejemplo
npm run iniciar      # compila el frontend y abre todo en http://localhost:3000
```

Cuentas de demostración (se crean con `npm run demo`):

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@example.com` | `Admin2026!` |
| Vecino | `ana@example.com` | `Vecino2026!` |

📘 **Guía completa para instalar y evaluar:** [`docs/INSTALACION.md`](docs/INSTALACION.md) · 🏗️ **Arquitectura, base de datos y API:** [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) · 🧪 **Pruebas:** `npm test`

En modo desarrollo (dos terminales): `npm run dev:backend` y `npm run dev:frontend` (web en http://localhost:5173).

Para hacer administradora a otra cuenta real, define `ADMIN_EMAIL` en `backend/.env` (la cuenta debe tener el correo confirmado).

## Versión para usar (un solo puerto)

Para dejarlo funcionando de forma estable, en vez de `npm run dev`:
```
cd frontend
npm run build
cd ../backend
node index.js
```
Si existe `frontend/dist`, el mismo servidor entrega la web y la API en http://localhost:3000. Es más rápido, más seguro que el modo desarrollo y alcanza con un solo túnel.

## Ponerlo en línea gratis

La guía paso a paso está en [`docs/DESPLIEGUE_GRATIS.md`](docs/DESPLIEGUE_GRATIS.md): Render (la app), Aiven (MySQL), Cloudinary (fotos) y Brevo (correo). El archivo `render.yaml` ya deja el servicio preparado.

## Copias de seguridad

```
cd backend
npm run backup
```
Guarda la base de datos (`base.sql`) y las fotos en una carpeta `backups/` junto al proyecto, con fecha y hora, y conserva las últimas 14 copias (se cambia con `BACKUP_KEEP` en el `.env`; `BACKUP_DIR` elige otra carpeta, por ejemplo un disco externo).

Para que se haga sola todos los días a las 3:00 en Windows:
```
schtasks /create /tn "Backup Voz Vecinal" /tr "node D:\reportes_vecinales\backend\scripts\backup.js" /sc daily /st 03:00
```
Para **restaurar**: importa `base.sql` en MySQL (por ejemplo desde phpMyAdmin) y copia el contenido de la carpeta `uploads` de la copia a `backend/uploads`.

## Ingreso con Google, Facebook y correo

Se puede ingresar con Google, con Facebook o creando una cuenta con email y contraseña (confirmando el correo con un código). Cada método se activa al completar sus datos en el `.env`: la guía paso a paso está en [`docs/CONFIGURAR_INGRESO.md`](docs/CONFIGURAR_INGRESO.md). Después de agregar `nodemailer`, ejecuta `npm install` en `backend`.

## Modo nocturno

El botón de luna o sol del encabezado cambia entre modo claro y nocturno. Si la persona no elige, se usa la configuración de su dispositivo. Los colores de ambos modos están en `frontend/src/styles/tema.css` y `frontend/src/index.css`.

## Probar desde otra red

Con el servidor encendido, en otra terminal:
```
cloudflared tunnel --url http://localhost:3000
```
(En modo desarrollo, con `npm run dev`, el túnel apunta al puerto 5173.)
Te da una dirección `https://...trycloudflare.com` que funciona desde cualquier lugar mientras la terminal siga abierta.

## Seguridad

- El registro puede llevar verificación anti-bots (Cloudflare Turnstile, ver `docs/CONFIGURAR_INGRESO.md`).
- La sesión va en una cookie HttpOnly (el código de la página no puede leerla) y se cierra al cambiar la contraseña. Con `DNI_KEY` en `.env`, los DNI se guardan cifrados en la base. `npm test` en `backend` corre las pruebas automáticas. Los avisos push al celular se activan con las claves de `npm run claves-push` (ver `docs/DESPLIEGUE_GRATIS.md`).
- Cuando el servidor entrega el frontend compilado, la página lleva una política de contenido (CSP) y, con https, HSTS. Si la CSP bloquea algo, pon `CSP_SOLO_REPORTE=1` en `.env`.
- Las contraseñas se guardan con bcrypt y las sesiones duran 7 días.
- El login y el registro tienen límite de intentos.
- Las fotos se validan (solo imágenes reales, hasta 5 MB) y se guardan con nombres aleatorios, junto con una miniatura para que las listas carguen rápido.
- Hay límites de envío por cuenta para evitar abusos, y la lista pública de reportes se carga por páginas.
- `.env`, las fotos subidas y los archivos `.sql` no se suben al repositorio.
- Opcionales en `.env`: `CORS_ORIGIN` para limitar qué sitio puede usar la API y `TRUST_PROXY` si hay un proxy delante.

## Estructura

```
backend/
  index.js            arranque del servidor
  routes/             rutas de la API (auth y reportes)
  middleware/         sesión, permisos y límite de intentos
  config/             base de datos, migraciones, historial y notificaciones
  uploads/            fotos subidas
frontend/src/
  pages/              pantallas
  components/         piezas reutilizables
  utils/              lógica de apoyo (prioridad, duplicados, exportación)
  styles/             estilos
```

## Autor

Gabriel Alejandro Cardozo — Tecnicatura en Desarrollo de Software.

Versión en línea: https://voz-vecinal.onrender.com
