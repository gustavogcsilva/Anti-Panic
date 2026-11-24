import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { router } from './routes';

const app = express();

app.use(
  helmet({
    // Permite que o PWA na Vercel carregue e faça cache de áudio MP3 servido pelo proxy no Render
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Lista de origens permitidas (incluindo Vercel, Netlify e localhost para camadas gratuitas)
const configuredOrigins = env.FRONTEND_URL
  ? env.FRONTEND_URL.split(',').map((u) => u.trim().replace(/\/$/, ''))
  : [];

const defaultLocalOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

const allowedOriginsSet = new Set([...configuredOrigins, ...defaultLocalOrigins]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (como mobile apps, curl ou health check do Render)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, '');

      // Permite origens explicitamente configuradas ou localhost
      if (allowedOriginsSet.has(normalizedOrigin)) {
        return callback(null, true);
      }

      // Permite deploys no Vercel (*.vercel.app) e Netlify (*.netlify.app)
      if (
        normalizedOrigin.endsWith('.vercel.app') ||
        normalizedOrigin.endsWith('.netlify.app') ||
        env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2.5mb' }));

app.use(router);

app.use((_req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.use(errorMiddleware);

export { app };
