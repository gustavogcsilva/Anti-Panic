import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { router } from './routes';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.use(router);

app.use((_req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.use(errorMiddleware);

export { app };
