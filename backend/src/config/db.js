import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'baratelli',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
});

// Verificar conexión al arrancar
pool.query('SELECT NOW()')
    .then(() => console.log('✅ PostgreSQL conectado'))
    .catch(err => {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
        console.error('   Verificá tus credenciales en el archivo .env');
    });

export default pool;
