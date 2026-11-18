import express from 'express';
import cors from 'cors';
import ventas from './routes/ventas.js';

export function crearApp() {
  const app = express();
  app.use(cors({ origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',') }));
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (_req, res) => res.json({ ok: true, servicio: 'ms-ventas' }));
  app.use('/api/ventas', ventas);
  app.use((err, _req, res, _next) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  return app;
}
