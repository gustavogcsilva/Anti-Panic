import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createRateLimiter } from '../middlewares/rateLimit.middleware';

const chatRouter = Router();
const chatController = new ChatController();

const chatMessageLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 40,
  message: 'Você enviou muitas mensagens em 1 minuto. Respire fundo e aguarde alguns instantes.',
});

chatRouter.use(authMiddleware);

chatRouter.get('/history', (req, res, next) => chatController.getHistory(req, res, next));
chatRouter.delete('/history', (req, res, next) => chatController.clearHistory(req, res, next));
chatRouter.post('/', chatMessageLimiter, (req, res, next) =>
  chatController.sendMessage(req, res, next)
);
chatRouter.post('/welcome', chatMessageLimiter, (req, res, next) =>
  chatController.createCrisisWelcome(req, res, next)
);
chatRouter.post('/message', chatMessageLimiter, (req, res, next) =>
  chatController.sendMessage(req, res, next)
);
chatRouter.post('/sync', chatMessageLimiter, (req, res, next) =>
  chatController.syncOffline(req, res, next)
);
chatRouter.get('/report-data', (req, res, next) => chatController.getReportData(req, res, next));

export { chatRouter };
