import express from 'express';
import { login }                           from '../controllers/auth.controller.js';
import { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getCategories }
    from '../controllers/products.controller.js';
import { createOrder, confirmOrder, getOrders, getOrder, updateOrderStatus, deleteOrder }
    from '../controllers/orders.controller.js';
import { getCustomers, getCustomer, updateCustomer, getMonthlyRanking, getStats }
    from '../controllers/customers.controller.js';
import { requireAuth }                     from '../middlewares/auth.middleware.js';

const router = express.Router();

// ── Auth ──────────────────────────────────────────────
router.post('/auth/login', login);

// ── Productos (GET público, resto protegido) ──────────
router.get ('/products',           getProducts);
router.get ('/products/categories',getCategories);
router.get ('/products/:id',       getProduct);
router.post('/products',           requireAuth, createProduct);
router.put ('/products/:id',       requireAuth, updateProduct);
router.delete('/products/:id',     requireAuth, deleteProduct);

// ── Pedidos ───────────────────────────────────────────
// El frontend crea el pedido sin auth (cliente público)
router.post('/orders',             createOrder);
// Confirmar y cambiar estado requieren auth (admin)
router.post('/orders/:id/confirm', requireAuth, confirmOrder);
router.put ('/orders/:id/status',  requireAuth, updateOrderStatus);
router.get ('/orders',             requireAuth, getOrders);
router.get ('/orders/:id',         requireAuth, getOrder);
router.delete('/orders/:id',       requireAuth, deleteOrder);

// ── Clientes y Ranking ────────────────────────────────
router.get('/customers',           requireAuth, getCustomers);
router.get('/customers/:id',       requireAuth, getCustomer);
router.put('/customers/:id',       requireAuth, updateCustomer);
router.get('/ranking',             requireAuth, getMonthlyRanking);

// ── Stats dashboard ───────────────────────────────────
router.get('/stats',               requireAuth, getStats);

export default router;
