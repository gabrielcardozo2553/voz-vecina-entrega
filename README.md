# Voz Vecinal

Aplicación web para que los vecinos reporten problemas de su localidad a la Municipalidad de La Cruz (baches, alumbrado, basura, etc.) y sigan cómo se resuelven. Incluye un panel para el personal municipal.

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** Node.js + Express (`backend/`)
- **Base de datos:** MySQL (por ejemplo, la que trae WampServer)

## Qué puede hacer cada rol

**Vecino:** reportar un problema con foto y ubicación, ver los reportes de todos, seguir los suyos, recibir novedades (campanita) y responder cuando la Municipalidad le pide más información.

**Administrador:** ver y filtrar todos los reportes, cambiar su estado, asignar responsable, anotar notas internas, ver posibles repetidos y el historial de cambios, escribirle al vecino (con fotos), actuar sobre varios reportes a la vez y exportar a Excel o PDF con resumen y gráficos.

## Puesta en marcha

Necesitas Node.js 20 o superior y MySQL funcionando con la base `reportes_vecinales`.

1. **Backend**
   ```
   cd backend
   npm install
   ```
   Copia `.env.example` como `.env` y completa los valores. Para `JWT_SECRET` usa una clave larga y aleatoria:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Luego inicia el servidor (puerto 3000 por defecto):
   ```
   node index.js
   ```
   Al arrancar, el servidor agrega solo las columnas, tablas e índices que falten.

2. **Frontend** (en otra terminal)
   ```
   cd frontend
   npm install
   npm run dev
   ```
   Se abre en http://localhost:5173. Las rutas `/api` y `/uploads` se redirigen solas al backend.

3. **Cuenta de administrador:** se crea registrándose en la app y cambiando el campo `rol` de ese usuario a `admin` en la tabla `usuarios`.

## Probar desde otra red

Con el front y el back encendidos, en una tercera terminal:
```
cloudflared tunnel --url http://localhost:5173
```
Te da una dirección `https://...trycloudflare.com` que funciona desde cualquier lugar mientras la terminal siga abierta.

## Seguridad

- Las contraseñas se guardan con bcrypt y las sesiones duran 7 días.
- El login y el registro tienen límite de intentos.
- Las fotos se validan (solo imágenes, hasta 5 MB) y se guardan con nombres aleatorios.
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
