import pool from '../config/db.js';

// GET /api/customers — lista de clientes (admin)
export const getCustomers = async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT c.*,
                COUNT(o.id)     AS total_orders,
                COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('confirmado','entregado')), 0) AS total_spent
            FROM customers c
            LEFT JOIN orders o ON o.customer_id = c.id
        `;
        const params = [];
        if (search) {
            params.push(`%${search}%`);
            query += ` WHERE c.name ILIKE $1 OR c.phone ILIKE $1`;
        }
        query += ` GROUP BY c.id ORDER BY total_spent DESC`;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
};

// GET /api/customers/:id — detalle + historial de pedidos
export const getCustomer = async (req, res) => {
    try {
        const customer = await pool.query('SELECT * FROM customers WHERE id=$1', [req.params.id]);
        if (!customer.rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });

        const orders = await pool.query(
            `SELECT o.*, json_agg(json_build_object(
                 'product_name', oi.product_name,
                 'quantity',     oi.quantity,
                 'unit_price',   oi.unit_price,
                 'subtotal',     oi.subtotal
             )) as items
             FROM orders o
             LEFT JOIN order_items oi ON oi.order_id = o.id
             WHERE o.customer_id = $1
             GROUP BY o.id
             ORDER BY o.created_at DESC`,
            [req.params.id]
        );

        res.json({ ...customer.rows[0], orders: orders.rows });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
};

// PUT /api/customers/:id — actualizar datos
export const updateCustomer = async (req, res) => {
    try {
        const { name, phone, address, email, notes } = req.body;
        const { rows } = await pool.query(
            `UPDATE customers SET
                name    = COALESCE($1, name),
                phone   = COALESCE($2, phone),
                address = COALESCE($3, address),
                email   = COALESCE($4, email),
                notes   = COALESCE($5, notes)
             WHERE id=$6 RETURNING *`,
            [name, phone, address, email, notes, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
};

// GET /api/ranking?month=2025-01 — ranking mensual de clientes
// Si no se pasa mes, usa el mes actual
export const getMonthlyRanking = async (req, res) => {
    try {
        // Parsear mes: "2025-01" o usar mes actual
        let year, month;
        if (req.query.month) {
            [year, month] = req.query.month.split('-').map(Number);
        } else {
            const now = new Date();
            year  = now.getFullYear();
            month = now.getMonth() + 1;
        }

        const { rows } = await pool.query(`
            SELECT
                c.id,
                c.name,
                c.phone,
                COUNT(DISTINCT o.id)                             AS orders_count,
                COALESCE(SUM(oi.quantity), 0)                   AS items_bought,
                COALESCE(SUM(o.total), 0)                       AS total_spent,
                RANK() OVER (ORDER BY SUM(o.total) DESC NULLS LAST) AS rank
            FROM customers c
            JOIN orders o ON o.customer_id = c.id
                AND o.status IN ('confirmado', 'entregado')
                AND EXTRACT(YEAR  FROM o.confirmed_at) = $1
                AND EXTRACT(MONTH FROM o.confirmed_at) = $2
            LEFT JOIN order_items oi ON oi.order_id = o.id
            GROUP BY c.id
            ORDER BY total_spent DESC
            LIMIT 20
        `, [year, month]);

        // Datos del mes anterior para comparar
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear  = month === 1 ? year - 1 : year;

        const { rows: prevRows } = await pool.query(`
            SELECT c.id, COALESCE(SUM(o.total),0) AS total_spent
            FROM customers c
            JOIN orders o ON o.customer_id = c.id
                AND o.status IN ('confirmado','entregado')
                AND EXTRACT(YEAR  FROM o.confirmed_at) = $1
                AND EXTRACT(MONTH FROM o.confirmed_at) = $2
            GROUP BY c.id
        `, [prevYear, prevMonth]);

        const prevMap = {};
        prevRows.forEach(r => prevMap[r.id] = parseFloat(r.total_spent));

        const ranking = rows.map(r => ({
            ...r,
            total_spent:    parseFloat(r.total_spent),
            prev_month:     prevMap[r.id] || 0,
            trend:          (parseFloat(r.total_spent) - (prevMap[r.id] || 0)),
        }));

        res.json({
            month: `${year}-${String(month).padStart(2,'0')}`,
            ranking,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener ranking' });
    }
};

// GET /api/stats — estadísticas generales para el dashboard admin
export const getStats = async (req, res) => {
    try {
        const [products, orders, customers, revenue] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM products WHERE active=TRUE`),
            pool.query(`SELECT COUNT(*) FILTER (WHERE status='pendiente') as pendientes,
                               COUNT(*) FILTER (WHERE status='confirmado') as confirmados,
                               COUNT(*) as total FROM orders`),
            pool.query(`SELECT COUNT(*) FROM customers`),
            pool.query(`SELECT
                COALESCE(SUM(total) FILTER (WHERE status IN ('confirmado','entregado')
                    AND confirmed_at >= date_trunc('month', NOW())), 0) AS mes_actual,
                COALESCE(SUM(total) FILTER (WHERE status IN ('confirmado','entregado')
                    AND confirmed_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
                    AND confirmed_at < date_trunc('month', NOW())), 0) AS mes_anterior
                FROM orders`),
        ]);

        const rev = revenue.rows[0];
        const mesActual   = parseFloat(rev.mes_actual);
        const mesAnterior = parseFloat(rev.mes_anterior);

        res.json({
            products:    parseInt(products.rows[0].count),
            orders:      orders.rows[0],
            customers:   parseInt(customers.rows[0].count),
            revenue: {
                this_month:  mesActual,
                last_month:  mesAnterior,
                growth_pct:  mesAnterior > 0
                    ? Math.round(((mesActual - mesAnterior) / mesAnterior) * 100)
                    : null,
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};
