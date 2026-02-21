import pool from '../config/db.js';

// ── Calcular precio mayorista automático ──
function calcBulkPrice(price) {
    return Math.ceil((parseFloat(price) - 100) / 100) * 100;
}

// POST /api/orders — crea un pedido (sin bajar stock aún)
export const createOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        const { customer_name, customer_phone, customer_address, items } = req.body;

        if (!customer_name || !items?.length) {
            return res.status(400).json({ error: 'Nombre y productos son obligatorios' });
        }

        await client.query('BEGIN');

        // 1. Buscar o crear cliente
        let customerId = null;
        if (customer_phone) {
            const existing = await client.query(
                'SELECT id FROM customers WHERE phone = $1',
                [customer_phone]
            );
            if (existing.rows[0]) {
                customerId = existing.rows[0].id;
                // Actualizar nombre/dirección por si cambió
                await client.query(
                    'UPDATE customers SET name=$1, address=$2 WHERE id=$3',
                    [customer_name, customer_address, customerId]
                );
            } else {
                const newCustomer = await client.query(
                    'INSERT INTO customers (name, phone, address) VALUES ($1,$2,$3) RETURNING id',
                    [customer_name, customer_phone, customer_address]
                );
                customerId = newCustomer.rows[0].id;
            }
        }

        // 2. Verificar stock y calcular totales (SIN bajar stock todavía)
        let subtotal = 0, discount = 0, total = 0;
        const itemsWithPrices = [];

        for (const item of items) {
            const { rows } = await client.query(
                'SELECT id, name, price, price_bulk, stock FROM products WHERE id=$1 AND active=TRUE FOR SHARE',
                [item.product_id]
            );
            if (!rows[0]) throw new Error(`Producto ${item.product_id} no encontrado`);
            const product = rows[0];

            if (product.stock < item.quantity) {
                throw new Error(`Stock insuficiente para "${product.name}" (disponible: ${product.stock})`);
            }

            const normalPrice = parseFloat(product.price);
            const bulkPrice   = product.price_bulk ? parseFloat(product.price_bulk) : calcBulkPrice(normalPrice);
            const usesBulk    = item.quantity >= 3;
            const unitPrice   = usesBulk ? bulkPrice : normalPrice;
            const lineTotal   = unitPrice * item.quantity;
            const lineSaving  = usesBulk ? (normalPrice - bulkPrice) * item.quantity : 0;

            subtotal += normalPrice * item.quantity;
            discount += lineSaving;
            total    += lineTotal;

            itemsWithPrices.push({
                product_id:   product.id,
                product_name: product.name,
                quantity:     item.quantity,
                unit_price:   unitPrice,
                subtotal:     lineTotal,
            });
        }

        // 3. Crear el pedido en estado "pendiente"
        const orderResult = await client.query(
            `INSERT INTO orders
                (customer_id, customer_name, customer_phone, customer_address, status, subtotal, discount, total)
             VALUES ($1,$2,$3,$4,'pendiente',$5,$6,$7) RETURNING *`,
            [customerId, customer_name, customer_phone, customer_address, subtotal, discount, total]
        );
        const order = orderResult.rows[0];

        // 4. Insertar items del pedido
        for (const item of itemsWithPrices) {
            await client.query(
                `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [order.id, item.product_id, item.product_name, item.quantity, item.unit_price, item.subtotal]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            order_id:    order.id,
            customer_id: customerId,
            subtotal,
            discount,
            total,
            status:      'pendiente',
            message:     'Pedido registrado. Esperando confirmación.'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
};

// POST /api/orders/:id/confirm — confirma el pedido Y baja el stock
export const confirmOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar que existe y está pendiente
        const { rows } = await client.query(
            'SELECT * FROM orders WHERE id=$1 FOR UPDATE',
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
        if (rows[0].status !== 'pendiente') {
            return res.status(400).json({ error: `El pedido ya está en estado "${rows[0].status}"` });
        }

        // Obtener items
        const items = await client.query(
            'SELECT * FROM order_items WHERE order_id=$1',
            [req.params.id]
        );

        // Bajar stock con FOR UPDATE (bloqueo para evitar race conditions)
        for (const item of items.rows) {
            if (!item.product_id) continue;
            const product = await client.query(
                'SELECT stock FROM products WHERE id=$1 FOR UPDATE',
                [item.product_id]
            );
            if (!product.rows[0]) continue;
            if (product.rows[0].stock < item.quantity) {
                throw new Error(`Stock insuficiente para "${item.product_name}" al confirmar`);
            }
            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id=$2',
                [item.quantity, item.product_id]
            );
        }

        // Marcar como confirmado
        const updated = await client.query(
            `UPDATE orders SET status='confirmado', confirmed_at=NOW()
             WHERE id=$1 RETURNING *`,
            [req.params.id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Pedido confirmado y stock actualizado', order: updated.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
};

// PUT /api/orders/:id/status — cambiar estado (admin)
export const updateOrderStatus = async (req, res) => {
    const { status } = req.body;
    const valid = ['pendiente', 'confirmado', 'entregado', 'cancelado'];
    if (!valid.includes(status)) {
        return res.status(400).json({ error: `Estado inválido. Válidos: ${valid.join(', ')}` });
    }
    try {
        const extra = status === 'entregado' ? ', delivered_at=NOW()' : '';
        const { rows } = await pool.query(
            `UPDATE orders SET status=$1${extra} WHERE id=$2 RETURNING *`,
            [status, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
};

// GET /api/orders — lista de pedidos (admin)
export const getOrders = async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;
        let query = `
            SELECT o.*,
                   COALESCE(
                       json_agg(json_build_object(
                           'product_name', oi.product_name,
                           'quantity',     oi.quantity,
                           'unit_price',   oi.unit_price,
                           'subtotal',     oi.subtotal
                       )) FILTER (WHERE oi.order_id IS NOT NULL),
                       '[]'
                   ) as items
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
        `;
        const params = [];
        if (status) {
            params.push(status);
            query += ` WHERE o.status = $${params.length}`;
        }
        query += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
        params.push(limit, offset);

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
};

// DELETE /api/orders/:id — borrar un pedido
export const deleteOrder = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id FROM orders WHERE id=$1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
        await pool.query('DELETE FROM order_items WHERE order_id=$1', [req.params.id]);
        await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
        res.json({ message: 'Pedido eliminado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar pedido' });
    }
};

// GET /api/orders/:id — detalle de un pedido
export const getOrder = async (req, res) => {
    try {
        const order = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
        if (!order.rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });

        const items = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
        res.json({ ...order.rows[0], items: items.rows });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener pedido' });
    }
};
