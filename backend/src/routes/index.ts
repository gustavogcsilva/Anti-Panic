import { Router } from 'express';
import { authRouter } from './auth.routes';
import { botRouter } from './bot.routes';
import { chatRouter } from './chat.routes';
import { panicLogRouter } from './panicLog.routes';
import { preferencesRouter } from './preferences.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRouter);
router.use('/preferences', preferencesRouter);
router.use('/bot', botRouter);
router.use('/logs', panicLogRouter);
router.use('/chat', chatRouter);
router.use('/api/chat', chatRouter);

export { router };
