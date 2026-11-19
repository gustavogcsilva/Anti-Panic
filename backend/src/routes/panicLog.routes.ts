import { Router } from 'express';
import { PanicLogController } from '../controllers/panicLog.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const panicLogRouter = Router();
const panicLogController = new PanicLogController();

panicLogRouter.use(authMiddleware);
panicLogRouter.post('/panic', (req, res, next) => panicLogController.create(req, res, next));
panicLogRouter.get('/panic', (req, res, next) => panicLogController.list(req, res, next));

export { panicLogRouter };
