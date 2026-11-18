import { auth, db } from '../lib/firebase.js';

export async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Falta el token de autenticación' });
  try {
    const decoded = await auth.verifyIdToken(token);
    const snap = await db.collection('usuarios').doc(decoded.uid).get();
    req.user = { uid: decoded.uid, email: decoded.email, rol: snap.data()?.rol || 'cliente' };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireAdmin(req, res, next) {
  if (!['admin', 'owner'].includes(req.user?.rol)) return res.status(403).json({ error: 'Sin permisos' });
  next();
}
