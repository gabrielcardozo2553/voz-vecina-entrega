# Arquitectura de Voz Vecinal

## Visión general

```
 Navegador (React + Vite, instalable como PWA)
        │  HTTPS / JSON  (la sesión viaja en una cookie HttpOnly)
        ▼
 Servidor Express (Node.js)  ──►  MySQL            (usuarios, reportes, mensajes, historial…)
        │                    ──►  Cloudinary       (fotos; en local, carpeta backend/uploads)
        │                    ──►  Brevo / SMTP     (códigos por correo; en local se imprimen en consola)
        └──────────────────►  Servicios de Web Push (avisos al celular)
```

En producción un único servicio Express entrega el frontend compilado (`frontend/dist`) y la API (`/api`).

## Estructura del código

```
backend/
  index.js              arranque, cabeceras de seguridad, rutas y entrega del frontend
  routes/
    api.js              reportes, mensajes, notificaciones, panel de administrador
    auth.js             registro, códigos por correo, login, Google, Facebook, recuperar contraseña
    push.js             suscripción a notificaciones push
  middleware/
    auth.js             comprueba la sesión (cookie) y los permisos de administrador
    limitador.js        límite de intentos por IP / por cuenta
  config/
    db.js, opcionesDb.js, crearBase.js, migraciones.js     conexión y esquema (se crea solo)
    cifrado.js          cifrado AES-256-GCM del DNI
    almacen.js          fotos: Cloudinary o disco local
    correo.js, captcha.js, proveedores.js, push.js, notificaciones.js, historial.js
  scripts/              preparar.js, datos-demo.js, backup.js, claves-push.js
  test/                 pruebas automáticas (node --test)
frontend/src/
  pages/                Reportar, Ver reportes, Mis reportes, Admin, Login, Privacidad
  components/           mapa, selector de ubicación, campana, conversación, modal de detalle…
  context/AuthContext   estado de la sesión
  hooks/ utils/ styles/ lógica de apoyo (tema, prioridad, duplicados, exportación) y estilos
```

## Base de datos

Las tablas se crean automáticamente al iniciar el servidor (`backend/config/migraciones.js`).

| Tabla | Contenido |
|---|---|
| `usuarios` | Datos del vecino, rol (`vecino` / `admin`), DNI cifrado, identificadores de Google/Facebook |
| `categorias` | Tipos de problema (Baches, Alumbrado público, etc.) |
| `reportes` | Reporte con categoría, descripción, foto, dirección, coordenadas, estado, responsable y notas internas |
| `mensajes_reporte` | Conversación entre la Municipalidad y el vecino (con foto opcional) |
| `historial_reportes` | Registro de cambios de cada reporte |
| `notificaciones` | Novedades que ve cada persona en la campana |
| `suscripciones_push` | Dispositivos que activaron avisos al celular |
| `registros_pendientes`, `recuperaciones` | Códigos temporales para confirmar el correo y recuperar la contraseña |

Estados de un reporte: `pendiente` → `en_proceso` → `resuelto`.

## API (resumen)

**Públicas:** `GET /api/categorias`, `GET /api/reportes` (lista pública paginada), `GET /api/salud`.

**Sesión (`/api/auth`):** `POST registro`, `verificar-email`, `reenviar-codigo`, `login`, `salir`, `recuperar`, `restablecer`, `google`, `facebook`, `completar-registro`; `GET proveedores`.

**Vecino (requiere sesión):** `POST /api/reportes`, `GET /api/mis-reportes`, `GET|POST /api/reportes/:id/mensajes`, `GET|PUT /api/notificaciones…`, `/api/push/suscribir|baja`.

**Administrador (requiere rol admin):** `GET /api/admin/reportes`, `GET /api/admin/reportes/:id/historial`, `PUT /api/reportes/:id/estado`, `PUT /api/reportes/:id/gestion`, `PUT /api/reportes-lote`, `DELETE /api/reportes/:id`.

## Decisiones de seguridad

- Contraseñas con **bcrypt**; sesión con **JWT en cookie HttpOnly** (`SameSite=Lax`, `Secure` con https), que el servidor revalida contra la base (rol y cuenta vigentes) y se invalida al cambiar la contraseña.
- Confirmación del correo con código de 6 dígitos; verificación opcional anti-bots (Cloudflare Turnstile).
- **Límite de intentos** en login, registro, códigos, reportes y mensajes.
- **DNI cifrado** en la base (AES-256-GCM) con una huella para evitar duplicados.
- Consultas SQL **parametrizadas**; fotos validadas (solo imágenes reales, hasta 5 MB) con nombres aleatorios.
- Cabeceras: política de contenido (CSP), HSTS con https, Permissions-Policy.
- La carpeta `uploads` se sirve con un CSP restrictivo.

## Limitaciones conocidas

- Los límites de intentos viven en memoria: se reinician al reiniciar el servidor.
- El plan gratuito de la nube duerme el servicio tras un rato sin uso y no garantiza copias de seguridad de la base (hay un script de respaldo: `npm run backup`).
- El panel de administrador carga los 2000 reportes más recientes (avisa si hay más).
- La app está pensada para una sola municipalidad; para atender varias haría falta separar los datos por municipio.
