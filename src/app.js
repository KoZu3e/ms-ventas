import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import ventas from './routes/ventas.js';
import { swaggerSpec } from './openapi.js';

export function crearApp() {
  const app = express();
  app.use(cors(process.env.CORS_ORIGINS ? { origin: process.env.CORS_ORIGINS.split(',') } : undefined));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/health', (_req, res) => res.json({ ok: true, servicio: 'ms-ventas' }));
  app.use('/api/ventas', ventas);
  app.use((err, _req, res, _next) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  return app;
}
