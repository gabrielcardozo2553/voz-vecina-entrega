# Voz Vecinal

**Tema:** reclamos vecinales. Aplicación web para que los vecinos de La Cruz (Corrientes) reporten problemas de su localidad a la Municipalidad (baches, alumbrado, basura, etc.) y sigan cómo se resuelven. Incluye un panel para el personal municipal.

🌐 Versión en línea: https://voz-vecinal.onrender.com *(puede tardar hasta un minuto en abrir la primera vez)*

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 19, Vite, React Router, Axios, Leaflet (mapas) |
| Backend | Node.js, Express 5, JWT en cookie HttpOnly, bcrypt, multer |
| Base de datos | MySQL / MariaDB (`mysql2`) |
| Extras | App instalable (PWA), notificaciones push, modo nocturno, exportación a Excel y PDF |

## Estructura del repositorio

```
voz-vecinal/
├── frontend/            → aplicación React
├── backend/             → servidor Node (API)
├── database/
│   └── proyecto.sql     → script de la base de datos (tablas + datos de demostración)
├── docs/                → guías: instalación, arquitectura, despliegue
└── README.md            → descripción, instalación y usuario de prueba
```

## Requisitos

- [Node.js](https://nodejs.org) 20 o superior (incluye `npm`)
- MySQL o MariaDB. Sirve el que trae **XAMPP** (o WampServer)

## 1. Base de datos: importar `database/proyecto.sql`

El script crea la base `reportes_vecinales`, sus tablas, las categorías y las cuentas y reportes de demostración.

**Con XAMPP y phpMyAdmin**
1. Abrir el *Panel de control de XAMPP* y pulsar **Start** en **Apache** y en **MySQL**.
2. Entrar a http://localhost/phpmyadmin
3. Pestaña **Importar** → **Seleccionar archivo** → elegir `database/proyecto.sql` → **Importar** (abajo de todo).

**Por consola** (desde la carpeta del proyecto, con MySQL encendido)
```
C:\xampp\mysql\bin\mysql.exe -u root -e "source database/proyecto.sql"
```
(si el usuario `root` tiene contraseña, agregar `-p`).

*Alternativa sin importar el archivo:* después de instalar el backend, `npm run demo` (en la carpeta del proyecto) crea las mismas tablas y datos.

## 2. Backend: instalar y ejecutar

```
cd backend
npm install
npm run preparar     # crea backend/.env (MySQL en localhost, usuario root sin contraseña, como XAMPP)
npm start            # API en http://localhost:3000
```
Si tu MySQL tiene contraseña para `root`, escríbela en `DB_PASSWORD` del archivo `backend/.env`.

## 3. Frontend: instalar y ejecutar

En otra terminal:
```
cd frontend
npm install
npm run dev          # web en http://localhost:5173
```
Abrir **http://localhost:5173** (el backend del paso 2 tiene que estar encendido).

*Opción de un solo comando:* desde la carpeta del proyecto, `npm run instalar` y luego `npm run iniciar` compilan el frontend y lo sirven junto con la API en http://localhost:3000.

## 4. Usuario de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| **Administrador** (panel municipal) | `admin@example.com` | `Admin2026!` |
| Vecino | `ana@example.com` | `Vecino2026!` |
| Vecino | `luis@example.com` | `Vecino2026!` |

Un registro nuevo pide confirmar el correo con un código de 6 dígitos. Sin servicio de correo configurado (instalación local), **el código aparece escrito en la terminal del backend**.

## Qué puede hacer cada rol

**Vecino:** reportar un problema con foto y ubicación en el mapa, ver los reportes de todos, seguir los suyos, recibir novedades (campanita) y responder cuando la Municipalidad le pide más información.

**Administrador:** ver y filtrar todos los reportes, cambiar su estado, asignar responsable, anotar notas internas, ver posibles repetidos y el historial de cambios, escribirle al vecino (con fotos), actuar sobre varios reportes a la vez y exportar a Excel o PDF con resumen y gráficos.

## Pruebas automáticas

```
cd backend
npm test
```

## Documentación adicional

- [`docs/INSTALACION.md`](docs/INSTALACION.md): guía detallada con solución a problemas comunes
- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md): estructura del código, tablas, API y decisiones de seguridad
- [`docs/DESPLIEGUE_GRATIS.md`](docs/DESPLIEGUE_GRATIS.md) y [`docs/CONFIGURAR_INGRESO.md`](docs/CONFIGURAR_INGRESO.md): puesta en línea y funciones opcionales (Google, Facebook, correo real, fotos en la nube, notificaciones push)

## Información adicional

### Versión de un solo puerto (frontend compilado)

Para dejarlo funcionando de forma estable, en vez de `npm run dev`:
```
cd frontend
npm run build
cd ../backend
node index.js
```
Si existe `frontend/dist`, el mismo servidor entrega la web y la API en http://localhost:3000. Es más rápido, más seguro que el modo desarrollo y alcanza con un solo túnel.

### Ponerlo en línea gratis

La guía paso a paso está en [`docs/DESPLIEGUE_GRATIS.md`](docs/DESPLIEGUE_GRATIS.md): Render (la app), Aiven (MySQL), Cloudinary (fotos) y Brevo (correo). El archivo `render.yaml` ya deja el servicio preparado.

### Copias de seguridad

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

### Ingreso con Google, Facebook y correo

Se puede ingresar con Google, con Facebook o creando una cuenta con email y contraseña (confirmando el correo con un código). Cada método se activa al completar sus datos en el `.env`: la guía paso a paso está en [`docs/CONFIGURAR_INGRESO.md`](docs/CONFIGURAR_INGRESO.md). Después de agregar `nodemailer`, ejecuta `npm install` en `backend`.

### Modo nocturno

El botón de luna o sol del encabezado cambia entre modo claro y nocturno. Si la persona no elige, se usa la configuración de su dispositivo. Los colores de ambos modos están en `frontend/src/styles/tema.css` y `frontend/src/index.css`.

### Probar desde otra red

Con el servidor encendido, en otra terminal:
```
cloudflared tunnel --url http://localhost:3000
```
(En modo desarrollo, con `npm run dev`, el túnel apunta al puerto 5173.)
Te da una dirección `https://...trycloudflare.com` que funciona desde cualquier lugar mientras la terminal siga abierta.

### Seguridad

- El registro puede llevar verificación anti-bots (Cloudflare Turnstile, ver `docs/CONFIGURAR_INGRESO.md`).
- La sesión va en una cookie HttpOnly (el código de la página no puede leerla) y se cierra al cambiar la contraseña. Con `DNI_KEY` en `.env`, los DNI se guardan cifrados en la base. `npm test` en `backend` corre las pruebas automáticas. Los avisos push al celular se activan con las claves de `npm run claves-push` (ver `docs/DESPLIEGUE_GRATIS.md`).
- Cuando el servidor entrega el frontend compilado, la página lleva una política de contenido (CSP) y, con https, HSTS. Si la CSP bloquea algo, pon `CSP_SOLO_REPORTE=1` en `.env`.
- Las contraseñas se guardan con bcrypt y las sesiones duran 7 días.
- El login y el registro tienen límite de intentos.
- Las fotos se validan (solo imágenes reales, hasta 5 MB) y se guardan con nombres aleatorios, junto con una miniatura para que las listas carguen rápido.
- Hay límites de envío por cuenta para evitar abusos, y la lista pública de reportes se carga por páginas.
- `.env`, las fotos subidas y los archivos `.sql` no se suben al repositorio.
- Opcionales en `.env`: `CORS_ORIGIN` para limitar qué sitio puede usar la API y `TRUST_PROXY` si hay un proxy delante.

## Autor

Gabriel Alejandro Cardozo — Tecnicatura en Desarrollo de Software.
