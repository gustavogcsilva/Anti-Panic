import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { PreferencesService } from '../services/preferences.service';
import { AppError } from '../utils/appError';

const preferencesService = new PreferencesService(prisma);

const upsertPreferencesSchema = z.object({
  generosMusicais: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  artistasPreferidos: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  modoAleatorio: z.boolean().default(false),
  contatoEmergenciaNome: z.string().trim().max(120).nullable().optional(),
  contatoEmergenciaTelefone: z.string().trim().max(32).nullable().optional(),
});

export class PreferencesController {
  public async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const preferences = await preferencesService.getPreferences(req.user.id);
      res.status(200).json({ preferences });
    } catch (error) {
      next(error);
    }
  }

  public async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const parsed = upsertPreferencesSchema.parse(req.body);
      const preferences = await preferencesService.upsertPreferences(req.user.id, parsed);
      res.status(200).json({ preferences });
    } catch (error) {
      next(error);
    }
  }
}
