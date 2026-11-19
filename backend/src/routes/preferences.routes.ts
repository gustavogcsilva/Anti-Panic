import { Router } from 'express';
import { PreferencesController } from '../controllers/preferences.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const preferencesRouter = Router();
const preferencesController = new PreferencesController();

preferencesRouter.use(authMiddleware);
preferencesRouter.get('/', (req, res, next) => preferencesController.get(req, res, next));
preferencesRouter.put('/', (req, res, next) => preferencesController.upsert(req, res, next));
preferencesRouter.patch('/friend-name', (req, res, next) =>
  preferencesController.updateFriendName(req, res, next)
);
preferencesRouter.patch('/theme', (req, res, next) =>
  preferencesController.updateTheme(req, res, next)
);

export { preferencesRouter };
