import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError';
import { verifyAuthToken } from '../utils/jwt';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Token de autenticação não informado.', 401));
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    next(new AppError('Token de autenticação inválido.', 401));
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    next();
  } catch {
    next(new AppError('Sessão expirada ou token inválido. Faça login novamente.', 401));
  }
}
