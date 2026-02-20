import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// POST /api/auth/login — solo para el admin del panel
export const login = (req, res) => {
    const { password } = req.body;
    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    const token = jwt.sign(
        { role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
    );
    res.json({ token, expires_in: '12h' });
};
