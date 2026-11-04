# Configurar el ingreso: Google, Facebook y correo

La app permite tres formas de ingresar o crear la cuenta:

1. **Con Google** (el email ya viene confirmado por Google).
2. **Con Facebook** (pensado para quienes no usan Gmail).
3. **Con email y contraseña**, confirmando el correo con un código de 6 números que llega al mail.

Cada una se activa sola cuando completas sus datos en `backend/.env`. Si falta alguna, simplemente no aparece el botón o el código se muestra en la terminal del servidor (útil para probar).

Después de cambiar el `.env`, reinicia el backend (`node index.js`).

---

## 1. Correo con código de confirmación (Gmail)

Sirve para que quien se registra con email y contraseña tenga que usar un correo real.

1. Crea (o elige) una cuenta de Gmail **solo para la app**, por ejemplo una que represente a la Municipalidad.
2. En esa cuenta, activa la **verificación en dos pasos** (Cuenta de Google → Seguridad).
3. Entra a https://myaccount.google.com/apppasswords y crea una **contraseña de aplicación** (ponle de nombre "Voz Vecinal"). Google te muestra 16 letras.
4. En `backend/.env`:
   ```
   MAIL_USER=la_cuenta@gmail.com
   MAIL_PASS=las16letrassinespacios
   MAIL_FROM=Voz Vecinal
   ```
5. En la carpeta `backend`, ejecuta `npm install` (se agregó `nodemailer`) y reinicia.

Gmail permite unos 500 correos por día: de sobra para empezar. Más adelante, con dominio propio, conviene un servicio de envío de correos (Brevo, Resend, etc.) y solo cambiar `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER` y `MAIL_PASS`.

**Sin configurar esto**, el registro con email sigue funcionando en tu PC: el código aparece en la terminal del backend con el texto `[CORREO SIN CONFIGURAR]`.

---

## 2. Ingreso con Google

1. Entra a https://console.cloud.google.com con tu cuenta de Google y crea un proyecto nuevo (por ejemplo "Voz Vecinal").
2. Busca **"Google Auth Platform"** (antes "Pantalla de consentimiento de OAuth") y complétala:
   - Nombre de la aplicación: Voz Vecinal.
   - Correo de asistencia: tu correo.
   - Tipo de usuario: **Externo**.
   - Datos de contacto del desarrollador: tu correo.
   - Si te pide un enlace de política de privacidad, usa `https://TU-DOMINIO/privacidad` (la página ya existe en la app).
3. En la misma sección, pasa la app a **"En producción"** (Publicar). Mientras esté en "Prueba", solo pueden entrar las cuentas que agregues como usuarios de prueba. Como solo se pide nombre y email, Google no exige una revisión larga.
4. Ve a **Clientes** (o "Credenciales") → **Crear cliente de OAuth** → tipo **Aplicación web**.
5. En **Orígenes autorizados de JavaScript** agrega:
   - `http://localhost:5173` (modo desarrollo)
   - `http://localhost:3000` (versión para usar)
   - Y cuando tengas dominio: `https://tu-dominio.com`
   (Cada dirección tiene que estar escrita una por una. Las direcciones temporales de `cloudflared` cambian cada vez, así que para probar desde el celular conviene esperar al dominio o usar un túnel con nombre fijo.)
6. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) y ponlo en `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=123456-abc.apps.googleusercontent.com
   ```
7. Reinicia el backend. En la pantalla de ingreso aparece el botón "Continuar con Google".

---

## 3. Ingreso con Facebook

Facebook es más exigente que Google. Tiene dos particularidades importantes:

- **Necesita https** en cualquier dirección que no sea `localhost`. Para probar desde el celular hace falta el dominio final (o un túnel con https y dirección fija).
- Muchas cuentas de Facebook (sobre todo de personas mayores) están creadas con un **número de teléfono** y no comparten email. En ese caso la app se lo pide al terminar el registro, y queda como email sin confirmar.

Pasos:

1. Entra a https://developers.facebook.com con tu cuenta de Facebook y acepta ser desarrollador.
2. **Mis apps → Crear app**. Elige el caso de uso **"Autenticar y solicitar datos de los usuarios con Inicio de sesión con Facebook"**. Nombre: Voz Vecinal.
3. En el panel de la app, **Configuración → Básica**:
   - Copia el **ID de la app** y la **Clave secreta**.
   - **URL de la política de privacidad**: `https://TU-DOMINIO/privacidad`.
   - **URL de instrucciones para eliminar datos**: `https://TU-DOMINIO/privacidad#eliminar-datos`.
   - Categoría: la que corresponda (por ejemplo "Gobierno" u "Otros").
4. En **Inicio de sesión con Facebook → Configuración**, en "Dominios permitidos para el SDK de JavaScript" agrega tu dominio, y activa "Iniciar sesión con el SDK de JavaScript".
5. Activa el modo **"Publicada" (Live)** de la app (interruptor arriba). Mientras esté en "Desarrollo", solo pueden entrar las cuentas con rol en la app. Con los permisos básicos (`public_profile` y `email`) no hace falta revisión de Facebook.
6. En `backend/.env`:
   ```
   FACEBOOK_APP_ID=1234567890
   FACEBOOK_APP_SECRET=la_clave_secreta
   ```
   La clave secreta **nunca** se comparte ni se sube a GitHub (el `.env` ya está ignorado).
7. Reinicia el backend.

---

## Cómo funciona por dentro (para saber qué esperar)

- **Google / Facebook, primera vez:** la persona elige su cuenta; la app comprueba la identidad directamente con Google o Facebook y le pide lo que falta (DNI y aceptar el uso de datos). Desde la segunda vez entra directo.
- **Si ya tenía una cuenta con el mismo email** y entra con Google, las cuentas se unen sin duplicar nada.
- **Registro con email:** se guarda de forma provisoria, llega el código al correo (vence en 15 minutos, 5 intentos) y recién al confirmarlo se crea la cuenta y la persona queda adentro.
- **Cuentas anteriores** a este cambio siguen funcionando con su email y contraseña.

## Lo que esto no resuelve

Google y Facebook confirman **quién es la persona o su correo**, pero **no su DNI**: ese dato lo escribe el vecino. Si la Municipalidad necesita validarlo, hay que hacerlo con otra vía (por ejemplo, cotejarlo en mesa de entradas).

## Verificación anti-bots en el registro (opcional)

Evita que programas automáticos creen cuentas falsas. Usa Cloudflare Turnstile, que es gratis y no pide tarjeta.

1. Entra a https://dash.cloudflare.com y crea una cuenta gratis, o ingresa con la que ya tengas.
2. En el menú ve a **Turnstile** y pulsa **Agregar widget**.
3. Nombre: `Voz Vecinal`. En **Nombres de host** agrega `localhost` y, cuando lo tengas, tu dominio. Para probar con el túnel de cloudflared agrega también `trycloudflare.com`.
4. Modo del widget: **Administrado**. Pulsa **Crear**.
5. Copia la **clave del sitio** y la **clave secreta**, y agrégalas a `backend/.env`:

```
TURNSTILE_SITE_KEY=la_clave_del_sitio
TURNSTILE_SECRET=la_clave_secreta
```

6. Reinicia el backend. En la pantalla de registro aparecerá la casilla de verificación.

Si no defines estas claves, el registro funciona igual que antes, solo con el límite de intentos. La clave secreta no se comparte ni se sube a GitHub.
