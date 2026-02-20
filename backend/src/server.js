import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ──
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json());

// ── Logging básico ──
app.use((req, _res, next) => {
    console.log(`${new Date().toLocaleTimeString('es-AR')} ${req.method} ${req.path}`);
    next();
});

// ── Rutas ──
app.use('/api', routes);

// ── Health check ──
app.get('/', (_req, res) => res.json({
    status: 'ok',
    app: 'Baratelli Mayorista API',
    version: '2.0.0',
    time: new Date().toISOString(),
}));

// ── Error handler global ──
app.use((err, _req, res, _next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Baratelli API corriendo en http://localhost:${PORT}`);
    console.log(`   Panel admin: http://localhost:${PORT}/api/stats`);
    console.log(`   Productos:   http://localhost:${PORT}/api/products\n`);
});
