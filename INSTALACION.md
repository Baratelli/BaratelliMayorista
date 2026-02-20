# Baratelli Mayorista — Guía de instalación

## Estructura del proyecto

```
Baratelli-main/         ← frontend (GitHub Pages)
  index.html
  admin.html
  products.json
  product-images/

backend/                ← servidor Node.js (tu PC)
  src/
  schema.sql
  package.json
  .env.example
```

---

## Paso 1 — Crear la base de datos en PostgreSQL

1. Abrí **pgAdmin** o **psql**
2. Creá una base de datos nueva llamada `baratelli`
3. Ejecutá el archivo `backend/schema.sql` sobre esa base de datos
   - En pgAdmin: clic derecho sobre la BD → Query Tool → abrí `schema.sql` → ejecutar
   - En psql: `\c baratelli` y luego `\i schema.sql`

---

## Paso 2 — Configurar el backend

1. Entrá a la carpeta `backend/`
2. Copiá `.env.example` y renombralo `.env`
3. Completá tus datos en `.env`:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=baratelli
DB_USER=postgres
DB_PASSWORD=TU_CONTRASEÑA_DE_POSTGRES
JWT_SECRET=cualquier_string_largo_secreto
ADMIN_PASSWORD=la_contraseña_del_panel_admin
PORT=3001
```

4. Instalá las dependencias (solo la primera vez):
```
cd backend
npm install
```

5. Iniciá el servidor:
```
npm start
```

Deberías ver:
```
✅ PostgreSQL conectado
🚀 Baratelli API corriendo en http://localhost:3001
```

---

## Paso 3 — Probar localmente

Para el frontend necesitás un servidor local (no doble clic):

**Opción A — VS Code + Live Server**
- Clic derecho sobre `Baratelli-main/index.html` → Open with Live Server

**Opción B — Python**
```
cd Baratelli-main
python -m http.server 8000
```
Entrá a http://localhost:8000

---

## Paso 4 — Exponer tu PC a internet (para que funcione desde GitHub Pages)

Usá **ngrok** (gratis):

1. Registrate en https://ngrok.com (gratis)
2. Descargá e instalá ngrok
3. Ejecutá: `ngrok http 3001`
4. Te da una URL tipo: `https://abc123.ngrok-free.app`
5. Actualizá la variable `API_URL` en `index.html` y `admin.html`:
   ```js
   const API_URL = 'https://abc123.ngrok-free.app/api';
   ```
6. Subí el `index.html` y `admin.html` actualizados a GitHub

**Importante:** La URL de ngrok cambia cada vez que lo reiniciás (en el plan gratuito).
Para una URL fija, usá el plan de pago de ngrok ($8/mes) o configurá un servicio como DuckDNS.

---

## Flujo de un pedido

1. Cliente entra al sitio, arma su carrito
2. Completa nombre, teléfono (opcional) y dirección
3. Hace clic en "Enviar por WhatsApp" → el pedido se registra en la BD con estado **pendiente**
4. Te llega el WhatsApp con el detalle y el número de pedido
5. Entrás al panel admin → Pedidos → confirmás el pedido
6. El stock baja automáticamente en la BD
7. El catálogo se actualiza la próxima vez que alguien lo visita

---

## Ranking mensual

El panel admin tiene una sección **Ranking** donde podés ver:
- Los mejores clientes del mes ordenados por monto total
- Comparación con el mes anterior (sube/baja)
- Cantidad de pedidos y productos comprados

Podés usar esto para premiar al cliente #1 cada mes con un descuento especial, envío gratis, etc.
