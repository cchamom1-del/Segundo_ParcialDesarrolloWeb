# AutoPuja GT — Subastas de vehículos en tiempo real (caso Copart)

## 🌐 Sitio web publicado

### 👉 **https://autopuja-gt.onrender.com** 👈

> El servidor gratuito de Render se "duerme" tras 15 min sin visitas: la primera carga puede tardar ~40 segundos. Después responde al instante.

## 🔑 Usuarios de prueba

| Nombre | Correo | Contraseña | Rol |
|---|---|---|---|
| Ana López | `ana@autopuja.gt` | `Subasta#2026` | usuario |
| Carlos Méndez | `carlos@autopuja.gt` | `Subasta#2026` | usuario |
| Lucía Ramírez | `lucia@autopuja.gt` | `Subasta#2026` | usuario |
| Administrador | `admin@autopuja.gt` | `Admin#2026` | admin |

En la pantalla de **Iniciar sesión** hay botones de acceso rápido para cada usuario de prueba.

### Prueba cruzada de tiempo real (recomendada)
1. Abre el sitio en **Chrome** e inicia sesión como **Ana**.
2. Abre el sitio en **Edge / Firefox / ventana de incógnito** e inicia sesión como **Carlos**.
3. En ambos, entra al mismo vehículo **en vivo** (por ejemplo, el *2019 Honda Civic* o la *2022 Hyundai Tucson*).
4. Oferta con Carlos → en la ventana de Ana el precio, el historial y el contador cambian **sin presionar F5**.
5. Oferta con Ana → Carlos ve el badge rojo **"Tu oferta ha sido superada"**, escucha un aviso sonoro y recibe una notificación aunque esté en otra página; Ana ve el badge verde **"¡Vas ganando esta subasta!"**.

---

## Cumplimiento de la rúbrica

| Serie | Criterio | Implementación |
|---|---|---|
| I · S1.1 | Git y publicación | Desplegado en Render, enlace arriba, 3 usuarios + admin |
| I · S1.2 | Autenticación | Registro (nombre, apellido, correo, teléfono, contraseña segura) y login con JWT. Anónimos solo ven el catálogo; publicar y ofertar devuelven **401** en el servidor. Roles `usuario` y `admin` |
| II · S2.1 | Vehículo y galería | Ficha técnica completa (año, tipo, marca, modelo, motor, transmisión, combustible, tren de manejo, cilindros), clasificación de daño 🟢🟡🔴, carrusel con miniaturas, flechas, teclado, deslizamiento táctil y pantalla completa; mínimo 5 fotos validado en cliente **y** servidor |
| II · S2.2 | Catálogo y filtros | Home con cards y filtros multitarea combinables: texto, estado, daño, marca → modelo, año, precio, combustible, tren de manejo, transmisión, tipo y cilindros. Los filtros quedan en la URL (se pueden compartir) |
| III · S3.1 | Tiempo real | Server-Sent Events: pujas, historial, contador, "vas ganando"/"te superaron", cierre y personas viendo se actualizan **sin F5**. Postores anónimos |
| III · S3.2 | Reglas de puja | Validadas **en el servidor**: oferta ≥ monto base, supera la actual por ≥ 10 %, no fuera de inicio/fin, el dueño no puede ofertar, transacciones atómicas contra pujas simultáneas |

## Características únicas

- **Cero dependencias**: el backend usa solo módulos nativos de Node.js (JWT HS256 y hash de contraseñas con `scrypt` implementados con `crypto`). No hay `node_modules`, así que el despliegue no falla por versiones.
- **Pujas atómicas**: cada oferta pasa por un candado por subasta y una transacción con **ETag/If‑Match** en Firebase; si dos personas ofertan el mismo monto al mismo tiempo, solo una gana (hay prueba automatizada).
- **Privacidad del postor por diseño**: el servidor nunca envía `leaderId` ni el dueño; los mensajes en vivo se personalizan por conexión ("vas ganando" / "te superaron") sin revelar a nadie quién es el líder.
- **Reloj sincronizado con el servidor**: los contadores usan la hora del servidor, no la de la computadora del usuario.
- **Piso de subasta en vivo** en el Home con las últimas ofertas de toda la plataforma.
- **Personas viendo ahora** en cada subasta.
- **Avisos globales**: si te superan mientras navegas otra página, recibes una notificación con botón "Ofertar", sonido y parpadeo del título de la pestaña.
- **Confirmación en dos pasos** y botones de oferta rápida (mínimo, +5 %, +15 %).
- **Mis pujas**: panel en vivo con subastas que vas ganando, en las que te superaron y las ganadas.
- **Mis publicaciones**: búsqueda, filtros por estado, métricas, editar y eliminar (bloqueos inteligentes si ya hay ofertas: no se puede bajar el monto base ni adelantar el cierre).
- **Publicación con vista previa en vivo** de la tarjeta, arrastrar y soltar fotos, reordenar, elegir portada y compresión automática de imágenes en el navegador.
- **Cierre automático** cada segundo: vendido (si hubo oferta ≥ base) o desierta, con aviso al ganador, a los perdedores y al publicador.
- Diseño claro y responsivo, accesible con teclado.

## Arquitectura

```
Navegador (SPA, JavaScript ES Modules)
   │  fetch → API REST (JSON, JWT)          EventSource ← Server‑Sent Events
   ▼                                           ▲
Node.js (servidor HTTP nativo) ─────────────────┘
   ├─ routes/api.js        controladores / endpoints
   ├─ services/            auth, vehículos, pujas, catálogos, tiempo real
   └─ db/                  Firebase Realtime Database (REST) | JSON local
```

```
autopuja/
├─ server/
│  ├─ index.js              servidor HTTP, archivos estáticos, motor de cierre
│  ├─ config.js
│  ├─ routes/api.js         endpoints REST
│  ├─ services/             auth.js, vehicles.js, realtime.js, catalogs.js
│  ├─ db/                   firebaseStore.js, localStore.js
│  ├─ lib/                  http.js (router), security.js (JWT, scrypt, IDs, candados)
│  └─ seed/                 usuarios y vehículos de demostración
├─ client/                  SPA: index.html, css/, js/pages, js/components
├─ tests/api.test.js        pruebas de reglas de negocio (node --test)
├─ render.yaml              despliegue en Render
└─ database.rules.json      reglas de Firebase (acceso solo desde el servidor)
```

### Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registro |
| POST | `/api/auth/login` | Inicio de sesión (JWT) |
| GET | `/api/auth/me` | Usuario actual 🔒 |
| GET | `/api/catalogs` | Catálogos: marcas/modelos, tipos, combustibles, transmisiones, tracción, cilindros, daños |
| GET | `/api/vehicles?marca=&danio=&estado=&anioMin=…` | Inventario con filtros y facetas |
| GET | `/api/vehicles/:id` | Detalle + fotos + historial anónimo |
| POST | `/api/vehicles` | Publicar 🔒 |
| PUT / DELETE | `/api/vehicles/:id` | Editar / eliminar (solo dueño o admin) 🔒 |
| POST | `/api/vehicles/:id/bids` | Ofertar 🔒 |
| GET | `/api/me/vehicles` · `/api/me/bids` | Mis publicaciones · Mis pujas 🔒 |
| GET | `/api/stream` | Canal en vivo (Server‑Sent Events) |

### Modelo de datos (Firebase Realtime Database)

```
users/{uid}              nombre, apellido, email, telefono, role, passwordHash
usersByEmail/{emailKey}  uid
vehicles/{id}            ficha técnica, danio, precioBase, inicio, cierre, currentBid, bidCount, leaderId*, status
photos/{id}              [fotos]
bids/{id}/{bidId}        amount, at, userId*
bidders/{id}/{uid}       max, at
userBids/{uid}/{id}      max, at
```
\* nunca se envían al cliente.

## Ejecutar localmente

Requisito: Node.js 20 o superior. **No hace falta `npm install`.**

```bash
npm start          # http://localhost:3000 (usa un JSON local si no configuras Firebase)
npm test           # pruebas de reglas de negocio
npm run seed:reset # reinicia los datos de demostración
```

## Despliegue

1. **Firebase**: crear proyecto → *Realtime Database* → crear base. En *Configuración del proyecto → Cuentas de servicio* generar una clave privada (JSON). Publicar `database.rules.json` (acceso solo desde el servidor).
2. **Render**: *New → Blueprint* con este repositorio (usa `render.yaml`) y definir:
   - `FIREBASE_DATABASE_URL` = URL de la Realtime Database
   - `FIREBASE_SERVICE_ACCOUNT` = contenido del JSON de la cuenta de servicio
3. Al primer arranque se crean automáticamente los usuarios y vehículos de prueba.
