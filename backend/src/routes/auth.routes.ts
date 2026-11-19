import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createRateLimiter } from '../middlewares/rateLimit.middleware';

const authRouter = Router();
const authController = new AuthController();

const authAttemptLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 25,
  message: 'Muitas tentativas seguidas. Aguarde um minuto antes de tentar novamente.',
});

authRouter.get('/captcha', (req, res, next) => authController.getCaptcha(req, res, next));
authRouter.post('/register', authAttemptLimiter, (req, res, next) =>
  authController.register(req, res, next)
);
authRouter.post('/login', authAttemptLimiter, (req, res, next) =>
  authController.login(req, res, next)
);
authRouter.get('/me', authMiddleware, (req, res, next) => authController.me(req, res, next));
authRouter.post('/forgot-password', authAttemptLimiter, (req, res, next) =>
  authController.forgotPassword(req, res, next)
);
authRouter.post('/reset-password', authAttemptLimiter, (req, res, next) =>
  authController.resetPassword(req, res, next)
);

export { authRouter };
