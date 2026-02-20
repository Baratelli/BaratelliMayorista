import pool from '../config/db.js';

// GET /api/products — público, para el catálogo
export const getProducts = async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = `SELECT * FROM products WHERE active = TRUE`;
        const params = [];

        if (category && category !== 'Todos') {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
        }

        query += ` ORDER BY category, name ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
};

// GET /api/products/:id
export const getProduct = async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM products WHERE id = $1 AND active = TRUE',
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener producto' });
    }
};

// POST /api/products — admin
export const createProduct = async (req, res) => {
    try {
        const { name, description, price, price_bulk, category, stock, image } = req.body;
        if (!name || !price || !category) {
            return res.status(400).json({ error: 'Nombre, precio y categoría son obligatorios' });
        }
        const { rows } = await pool.query(
            `INSERT INTO products (name, description, price, price_bulk, category, stock, image)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [name, description || null, price, price_bulk || null, category, stock || 0, image || null]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al crear producto' });
    }
};

// PUT /api/products/:id — admin
export const updateProduct = async (req, res) => {
    try {
        const { name, description, price, price_bulk, category, stock, image, active } = req.body;
        const { rows } = await pool.query(
            `UPDATE products SET
                name        = COALESCE($1, name),
                description = COALESCE($2, description),
                price       = COALESCE($3, price),
                price_bulk  = $4,
                category    = COALESCE($5, category),
                stock       = COALESCE($6, stock),
                image       = COALESCE($7, image),
                active      = COALESCE($8, active)
             WHERE id = $9 RETURNING *`,
            [name, description, price, price_bulk ?? null, category, stock, image, active, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
};

// DELETE /api/products/:id — admin (soft delete)
export const deleteProduct = async (req, res) => {
    try {
        await pool.query('UPDATE products SET active = FALSE WHERE id = $1', [req.params.id]);
        res.json({ message: 'Producto eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
};

// GET /api/products/categories — lista de categorías
export const getCategories = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT DISTINCT category FROM products WHERE active = TRUE ORDER BY category`
        );
        res.json(rows.map(r => r.category));
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};
