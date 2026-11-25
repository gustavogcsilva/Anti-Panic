import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { BotCuradorService } from '../services/botCurador.service';
import { AppError } from '../utils/appError';

const botCuradorService = new BotCuradorService(prisma);

export class BotController {
  public async getTracks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const tracks = query
        ? await botCuradorService.searchRelaxingTracks(query)
        : await botCuradorService.getCuratedTracksForUser(req.user.id);

      res.status(200).json({ tracks });
    } catch (error) {
      next(error);
    }
  }

  public async searchTracks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const limit =
        typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 10;

      const tracks = await botCuradorService.searchRelaxingTracks(
        query,
        Number.isFinite(limit) ? limit : 10
      );

      res.status(200).json({ tracks });
    } catch (error) {
      next(error);
    }
  }
}
