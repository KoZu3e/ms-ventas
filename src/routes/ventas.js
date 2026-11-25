import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { crearVenta, obtenerVenta, listarVentasUsuario, listarTodasVentas, cambiarEstado } from '../services/ventas.js';
import { armarComprobante, generarPDF, numeroFormateado } from '../services/comprobante.js';

const r = Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

// Listar todas las ventas (solo admin/owner)
r.get('/', requireAuth, requireAdmin, wrap(async (_req, res) => {
  res.json(await listarTodasVentas());
}));

// Crear venta desde el carrito del usuario autenticado
r.post('/', requireAuth, wrap(async (req, res) => {
  const venta = await crearVenta(req.user.uid, req.body || {});
  res.status(201).json({ id: venta.id, numeroComprobante: numeroFormateado(venta.numeroComprobante), total: venta.total, comprobante: armarComprobante(venta) });
}));

// Mis ventas
r.get('/mias', requireAuth, wrap(async (req, res) => {
  res.json(await listarVentasUsuario(req.user.uid));
}));

r.get('/:id', requireAuth, wrap(async (req, res) => {
  res.json(await obtenerVenta(req.params.id, req.user));
}));

r.get('/:id/comprobante', requireAuth, wrap(async (req, res) => {
  res.json(armarComprobante(await obtenerVenta(req.params.id, req.user)));
}));

r.get('/:id/comprobante.pdf', requireAuth, wrap(async (req, res) => {
  const venta = await obtenerVenta(req.params.id, req.user);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="comprobante-${numeroFormateado(venta.numeroComprobante)}.pdf"`);
  generarPDF(venta, res);
}));

// Solo admin/owner
r.patch('/:id/estado', requireAuth, requireAdmin, wrap(async (req, res) => {
  res.json(await cambiarEstado(req.params.id, req.body?.estado));
}));

export default r;
