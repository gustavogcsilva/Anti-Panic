import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { BotCuradorError } from '../services/botCurador.service';
import { AppError } from '../utils/appError';

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Dados inválidos na requisição.',
      errors: error.flatten().fieldErrors,
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  if (error instanceof BotCuradorError) {
    res.status(error.statusCode).json({
      message: error.message,
    });
    return;
  }

  console.error('❌ Erro interno não tratado:', error);

  res.status(500).json({
    message:
      env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Erro interno do servidor. Tente novamente em instantes.',
  });
}
