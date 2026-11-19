# Instalación paso a paso (para evaluar el proyecto)

Esta guía deja Voz Vecinal funcionando en una PC con Windows (en Linux o Mac es igual). Lleva unos 10 minutos.

## 1. Requisitos

| Programa | Versión | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org) (LTS) | 20 o superior | Ejecutar el servidor y el frontend |
| MySQL o MariaDB | MySQL 8 / MariaDB 10.x | Base de datos. Sirve el que trae [WampServer](https://www.wampserver.com) o [XAMPP](https://www.apachefriends.org) |
| Git (opcional) | cualquiera | Para clonar. También se puede descargar el ZIP desde GitHub |

No hace falta crear la base de datos ni las tablas a mano: el proyecto las crea solo. Si prefieres importar el script a mano (por ejemplo con phpMyAdmin de XAMPP), está en `database/proyecto.sql` y los pasos están en el [README](../README.md#1-base-de-datos-importar-databaseproyectosql).

## 2. Descargar el proyecto

```
git clone https://github.com/gabrielcardozo2553/voz-vecinal.git
cd voz-vecinal
```
(o descargar el ZIP desde GitHub con **Code → Download ZIP**, descomprimirlo y abrir una terminal en esa carpeta)

## 3. Encender MySQL

- **WampServer:** abrirlo y esperar el ícono verde.
- **XAMPP:** abrir el panel y pulsar **Start** en MySQL.

## 4. Instalar y preparar (desde la carpeta del proyecto)

```
npm run instalar
npm run preparar
npm run demo
```

1. `npm run instalar` descarga las dependencias del backend y del frontend.
2. `npm run preparar` crea el archivo `backend/.env` con la configuración y una clave de sesión aleatoria.
   - Por defecto usa MySQL en `localhost`, usuario `root` **sin contraseña** (lo habitual en WampServer y XAMPP).
   - Si tu MySQL tiene contraseña para `root`, abre `backend/.env` y escríbela en `DB_PASSWORD=`.
3. `npm run demo` crea la base `reportes_vecinales`, sus tablas, tres cuentas de prueba y 10 reportes de ejemplo.

## 5. Ejecutar

### Opción A: lo más simple (un solo comando)
```
npm run iniciar
```
Compila el frontend y levanta todo en **http://localhost:3000**.

### Opción B: modo desarrollo (dos terminales)
```
npm run dev:backend      (terminal 1: API en el puerto 3000)
npm run dev:frontend     (terminal 2: web en http://localhost:5173)
```

## 6. Cuentas de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador (panel municipal) | `admin@example.com` | `Admin2026!` |
| Vecino | `ana@example.com` | `Vecino2026!` |
| Vecino | `luis@example.com` | `Vecino2026!` |

Estas cuentas existen solo en la base local y se crean con `npm run demo`.

## 7. Qué se puede probar

- **Como vecino:** crear un reporte (categoría, ubicación en el mapa, foto obligatoria y descripción), ver el mapa y la lista de reportes, seguir "Mis reportes" y la campanita de novedades.
- **Como administrador:** panel con filtros, cambio de estado, responsable y notas internas, historial de cambios, mensajes al vecino, acciones en lote y exportación a Excel y PDF.
- **Modo nocturno:** botón de luna/sol en el encabezado.
- **Registro de una cuenta nueva:** pide confirmar el correo con un código de 6 dígitos. Como en una instalación local no hay servicio de correo configurado, **el código aparece escrito en la terminal donde corre el servidor**.

## 8. Pruebas automáticas

```
npm test
```
Ejecuta las pruebas del backend (sesiones y permisos, límite de intentos, cifrado del DNI, firma de Cloudinary, notificaciones push y validación del nombre de la base). No necesitan la base de datos encendida.

## 9. Funciones opcionales (no hacen falta para evaluar)

Se activan agregando claves en `backend/.env` (ver `backend/.env.example`). Sin ellas la app funciona igual y esas funciones simplemente no aparecen:

- Ingreso con Google y con Facebook → [`CONFIGURAR_INGRESO.md`](CONFIGURAR_INGRESO.md)
- Envío real de correos, fotos en la nube, notificaciones push al celular y cifrado del DNI → [`DESPLIEGUE_GRATIS.md`](DESPLIEGUE_GRATIS.md)

## 10. Versión publicada

Hay una versión funcionando en línea: **https://voz-vecinal.onrender.com** (el plan gratuito se "duerme" si nadie la usa: la primera carga puede tardar hasta un minuto).

## Problemas comunes

| Mensaje | Causa y solución |
|---|---|
| `ECONNREFUSED` o "No se pudo cargar los datos de demostración" | MySQL no está encendido. Enciende WampServer/XAMPP y repite el comando. |
| `ER_ACCESS_DENIED_ERROR` | Usuario o contraseña de MySQL incorrectos. Corrige `DB_USER` y `DB_PASSWORD` en `backend/.env`. |
| `EADDRINUSE` (puerto ocupado) | Otro programa usa el puerto 3000. Ciérralo, o cambia `PORT` en `backend/.env` (y en modo desarrollo, también el puerto del proxy en `frontend/vite.config.js`). |
| `npm` no se reconoce como comando | Node.js no está instalado o hay que abrir una terminal nueva después de instalarlo. |
| El frontend se ve en blanco en modo desarrollo | Falta el backend: en modo desarrollo se necesitan las dos terminales encendidas. |
| Errores raros después de actualizar | Borra las carpetas `node_modules` de `backend` y `frontend` y repite `npm run instalar`. |
