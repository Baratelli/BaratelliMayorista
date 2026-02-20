-- ══════════════════════════════════════════════════════
--  BARATELLI MAYORISTA — Schema PostgreSQL
--  Ejecutar este archivo UNA SOLA VEZ para crear las tablas
--  En psql: \i schema.sql
--  O en pgAdmin: abrir y ejecutar como query
-- ══════════════════════════════════════════════════════

-- Extensión para UUIDs (opcional, usamos SERIAL)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PRODUCTOS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    price       NUMERIC(12,2) NOT NULL,
    price_bulk  NUMERIC(12,2),          -- precio x3 o más (NULL = calcular automático)
    category    VARCHAR(100) NOT NULL DEFAULT 'General',
    stock       INTEGER NOT NULL DEFAULT 0,
    image       VARCHAR(255),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CLIENTES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    phone       VARCHAR(50),            -- número de WhatsApp
    address     TEXT,
    email       VARCHAR(255),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PEDIDOS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_name   VARCHAR(255) NOT NULL,  -- desnormalizado por si el cliente se borra
    customer_phone  VARCHAR(50),
    customer_address TEXT,
    status          VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    -- Estados: pendiente → confirmado → entregado → cancelado
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,  -- sin descuentos
    discount        NUMERIC(12,2) NOT NULL DEFAULT 0,  -- ahorro mayorista
    total           NUMERIC(12,2) NOT NULL DEFAULT 0,  -- total final
    notes           TEXT,
    confirmed_at    TIMESTAMPTZ,   -- cuando se confirma por WhatsApp
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ITEMS DEL PEDIDO ───────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,   -- desnormalizado
    quantity    INTEGER NOT NULL,
    unit_price  NUMERIC(12,2) NOT NULL,   -- precio unitario al momento del pedido
    subtotal    NUMERIC(12,2) NOT NULL    -- unit_price * quantity
);

-- ── RANKING MENSUAL (vista, no tabla) ──────────────────
-- Se calcula dinámicamente, no necesita tabla propia

-- ── ÍNDICES ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_customer    ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created     ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active    ON products(active);

-- ── FUNCIÓN AUTO-UPDATE updated_at ─────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_customers_updated
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_orders_updated
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── DATOS INICIALES (productos del products.json) ──────
INSERT INTO products (name, description, price, category, stock, image) VALUES
    ('Fideo Marolio Mostachol Rayado', 'Fideos Marolio',          700,  'Almacén', 100, 'fideo-marolio-m-rayado.jpg'),
    ('Agua Mineral Villamanaos',       'Agua mineral 6lts',       2000, 'Bebidas',  10, 'villamanaos_6lts.webp'),
    ('Azúcar Tikay 1KG',               'Azúcar la tikay 1kg',     1000, 'Almacén',  50, 'azucar-tikay.jpg'),
    ('Galletitas de agua Pindy x3',    'Galletitas de agua x3',   900,  'Almacén',  10, 'galletitaspindy.png'),
    ('Aceite Mezcla 900ML',            'Aceite Siglo de Oro 900ml',2500,'Almacén',  30, 'aceite-mezcla-siglo-del-oro.webp')
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════
--  LISTO. Verificá con:
--  SELECT table_name FROM information_schema.tables WHERE table_schema='public';
-- ══════════════════════════════════════════════════════
