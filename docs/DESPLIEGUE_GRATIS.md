# Poner Voz Vecinal en línea gratis

Esta guía deja la app funcionando en internet sin pagar nada, con una dirección `https://...onrender.com`. Sirve para un piloto o una versión casi definitiva. Más adelante se puede pasar a un plan de pago sin tocar el código.

## Qué se usa y para qué

| Servicio | Para qué | Dónde |
|---|---|---|
| **Render** | Corre la app (servidor y página) | render.com |
| **Aiven** | Base de datos MySQL | aiven.io |
| **Cloudinary** | Guarda las fotos de los vecinos | cloudinary.com |
| **Brevo** | Envía los códigos por correo | brevo.com |

¿Por qué no se usa Gmail para los correos? Render, en su plan gratuito, bloquea los puertos de correo (SMTP), así que Gmail no funcionaría ahí. Brevo se usa por HTTPS y sí funciona.
¿Por qué las fotos van a Cloudinary? En el plan gratuito de Render el disco se borra cada vez que el servicio se reinicia o se actualiza.

## Lo que tienes que saber antes (límites del plan gratis)

- **El servicio se duerme** tras unos 15 minutos sin visitas y tarda cerca de 1 minuto en despertar. Se puede evitar con el aviso periódico del paso 8.
- **La base de datos de Aiven puede apagarse** si pasa mucho tiempo sin actividad. El mismo aviso periódico lo evita.
- **No hay garantías de continuidad**: estos planes pueden cambiar o limitarse. Conviene revisar los límites vigentes en cada sitio antes de empezar.
- La app guarda DNI, nombres y fotos de vecinos. Para el uso real, conviene pasar a un plan de pago.

## Paso 1: Base de datos en Aiven

1. Crea una cuenta en https://aiven.io (no pide tarjeta para el plan gratis).
2. Pulsa **Create service**, elige **MySQL** y el plan **Free**. Elige la región más cercana que ofrezca.
3. Espera a que el estado sea **Running**.
4. En la pantalla del servicio, copia estos datos: **Host**, **Port**, **User**, **Password** y **Database name** (normalmente `defaultdb`).
5. Descarga el **CA certificate** (archivo `ca.pem`). Ábrelo con el Bloc de notas y copia todo el contenido, desde `-----BEGIN CERTIFICATE-----` hasta `-----END CERTIFICATE-----`.

Las tablas se crean solas la primera vez que arranca la app.

## Paso 2: Fotos en Cloudinary

1. Crea una cuenta gratis en https://cloudinary.com.
2. En el panel principal (Dashboard) busca **API Environment variable** (a veces aparece como "Product Environment Credentials") y copia el valor, que tiene esta forma:
   `cloudinary://UNA_CLAVE:UN_SECRETO@nombre_de_tu_nube`

Ese texto completo es tu `CLOUDINARY_URL`. No lo compartas.

## Paso 3: Correo en Brevo

1. Crea una cuenta gratis en https://www.brevo.com.
2. Ve a **Senders, Domains & Dedicated IPs → Senders** y agrega el correo desde el que saldrán los mensajes (conviene uno propio de la app, por ejemplo `vozvecinal.lacruz@gmail.com`). Brevo te manda un enlace para confirmarlo.
3. Ve a **SMTP & API → API Keys** y genera una clave. Cópiala.

Si Brevo te pide completar un formulario de activación de la cuenta, hazlo: sin eso no deja enviar correos. No pude confirmar si el plan gratis incluye el envío por API, así que revisa que en tu cuenta aparezca disponible.

## Paso 4: Crear el servicio en Render

1. Crea una cuenta en https://render.com e ingresa con tu cuenta de GitHub.
2. Pulsa **New +** y elige **Blueprint**. Autoriza a Render a ver el repositorio `voz-vecinal` (aunque sea privado) y selecciónalo.
3. Render lee el archivo `render.yaml` y te pide los valores de estas variables:

| Variable | Qué poner |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Los datos de Aiven (paso 1) |
| `DB_SSL_CA` | El contenido de `ca.pem` completo |
| `CLOUDINARY_URL` | El valor del paso 2 |
| `BREVO_API_KEY` | La clave del paso 3 |
| `MAIL_REMITENTE` | El correo que verificaste en Brevo |
| `ADMIN_EMAIL` | Tu correo: esa cuenta será la administradora |

   `JWT_SECRET` se genera solo.
4. Pulsa **Apply**. La primera vez tarda varios minutos en construir. Cuando termine, Render te muestra la dirección, algo como `https://voz-vecinal-xxxx.onrender.com`.

## Paso 5: Crear tu cuenta de administrador

1. Abre la dirección de Render y entra a **Registrarme** con el mismo correo que pusiste en `ADMIN_EMAIL`.
2. Confirma el correo con el código que te llega.
3. Esa cuenta queda como administradora y verás el **Panel admin**.

Si ya habías creado la cuenta antes de poner `ADMIN_EMAIL`, en Render pulsa **Manual Deploy → Restart** y volverá a revisarse.

## Paso 6: Ajustar Google (si lo usas)

En la consola de Google Cloud, en tu cliente de OAuth, agrega la dirección de Render en **Orígenes autorizados de JavaScript**, por ejemplo `https://voz-vecinal-xxxx.onrender.com`. En Render agrega la variable `GOOGLE_CLIENT_ID` en la pestaña **Environment**.

## Paso 7: Facebook y verificación anti-bots (opcionales)

Se configuran como se explica en `docs/CONFIGURAR_INGRESO.md`, usando la dirección de Render. Las variables (`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`) se agregan en la pestaña **Environment** del servicio. Facebook exige https, y la dirección de Render ya lo tiene.

## Paso 8: Mantenerlo despierto (recomendado)

1. Crea una cuenta gratis en https://uptimerobot.com.
2. Agrega un monitor de tipo **HTTP(s)** con la dirección `https://voz-vecinal-xxxx.onrender.com/api/salud` y revisión cada 5 minutos.

Así la app no se duerme y la base de datos recibe actividad. Es un recurso habitual, pero Render puede cambiar sus reglas.

## Cómo se actualiza

Cada vez que se sube un cambio a la rama `main` de GitHub, Render reconstruye y publica la app solo. Mientras lo hace, la página puede tardar unos minutos.

## Copias de seguridad

- La base de datos tiene copias propias en Aiven (según su documentación). Revisa en tu panel qué incluye el plan gratis.
- El comando `npm run backup` también funciona contra la base de la nube, si pones esos mismos datos en un `.env` en tu computadora. Ese comando copia la base, pero **no las fotos de Cloudinary**, que quedan en su panel.

## Si algo falla

- Mira la pestaña **Logs** del servicio en Render. Ahí aparece el motivo.
- Si la página carga pero no deja ingresar con Google o Facebook, revisa que la dirección de Render esté agregada en cada servicio.
- Si no llega el código por correo, revisa en los registros la línea `No se pudo enviar el correo:`.
- Si algo del diseño se bloquea por la política de seguridad, agrega `CSP_SOLO_REPORTE=1` en Environment.

## Pasar a un plan de pago

No hay que cambiar el código. En Render se cambia el plan del servicio por uno de pago, y se puede pasar la base de datos a un plan de pago de Aiven o a otro proveedor cambiando las variables `DB_*`. El servicio deja de dormirse y conviene sumar un disco o seguir con Cloudinary para las fotos.
