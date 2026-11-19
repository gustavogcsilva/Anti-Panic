import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { PanicLogService } from '../services/panicLog.service';
import { AppError } from '../utils/appError';

const panicLogService = new PanicLogService(prisma);

const createPanicLogSchema = z.object({
  triggeredAt: z.string().datetime().optional(),
  trackId: z.string().max(100).nullable().optional(),
  trackTitle: z.string().trim().min(1).max(255),
  trackArtist: z.string().trim().max(255).nullable().optional(),
  trackUrl: z.string().max(2048).nullable().optional(),
  wasOffline: z.boolean().optional().default(false),
  durationSeconds: z.number().int().nonnegative().nullable().optional(),
});

export class PanicLogController {
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const parsed = createPanicLogSchema.parse(req.body);
      const log = await panicLogService.createLog(req.user.id, parsed);
      res.status(201).json({ log });
    } catch (error) {
      next(error);
    }
  }

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const logs = await panicLogService.listRecentLogs(req.user.id);
      res.status(200).json({ logs });
    } catch (error) {
      next(error);
    }
  }
}
