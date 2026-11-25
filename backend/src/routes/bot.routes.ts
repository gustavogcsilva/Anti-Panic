import { Router } from 'express';
import { BotController } from '../controllers/bot.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const botRouter = Router();
const botController = new BotController();

botRouter.get('/tracks', authMiddleware, (req, res, next) =>
  botController.getTracks(req, res, next)
);
botRouter.get('/search', authMiddleware, (req, res, next) =>
  botController.searchTracks(req, res, next)
);

export { botRouter };
