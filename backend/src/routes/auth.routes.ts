import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const authRouter = Router();
const authController = new AuthController();

authRouter.get('/captcha', (req, res, next) => authController.getCaptcha(req, res, next));
authRouter.post('/register', (req, res, next) => authController.register(req, res, next));
authRouter.post('/login', (req, res, next) => authController.login(req, res, next));
authRouter.get('/me', authMiddleware, (req, res, next) => authController.me(req, res, next));
authRouter.post('/forgot-password', (req, res, next) =>
  authController.forgotPassword(req, res, next)
);
authRouter.post('/reset-password', (req, res, next) =>
  authController.resetPassword(req, res, next)
);

export { authRouter };
