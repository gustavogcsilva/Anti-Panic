import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { AuthService } from '../services/auth.service';
import { AppError } from '../utils/appError';
import { createCaptchaChallenge } from '../utils/captcha';

const authService = new AuthService(prisma);

const registerSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome completo.').max(120),
  email: z.string().trim().email('Informe um e-mail válido.').max(255),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.').max(100),
  dataNascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de nascimento no formato AAAA-MM-DD.'),
  captchaToken: z.string().min(1, 'Complete a verificação anti-robô.'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe sua senha.'),
  captchaToken: z.string().min(1, 'Complete a verificação anti-robô.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(16, 'Token de recuperação inválido.'),
  novaSenha: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres.').max(100),
});

export class AuthController {
  public async getCaptcha(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const challenge = createCaptchaChallenge();
      res.status(200).json(challenge);
    } catch (error) {
      next(error);
    }
  }

  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.parse(req.body);
      const result = await authService.register(parsed);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.parse(req.body);
      const result = await authService.login(parsed);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const user = await authService.getAuthenticatedUser(req.user.id);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }

  public async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      await authService.forgotPassword(email);

      res.status(200).json({
        message:
          'Se existir uma conta com este e-mail, enviaremos um link de recuperação válido por 1 hora.',
      });
    } catch (error) {
      next(error);
    }
  }

  public async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = resetPasswordSchema.parse(req.body);
      await authService.resetPassword(parsed);

      res.status(200).json({
        message: 'Senha atualizada com sucesso! Agora você já pode fazer login.',
      });
    } catch (error) {
      next(error);
    }
  }
}
