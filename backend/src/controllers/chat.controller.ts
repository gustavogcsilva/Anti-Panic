import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ChatService } from '../services/chat.service';
import { AppError } from '../utils/appError';

const chatService = new ChatService(prisma);

const sendMessageSchema = z.object({
  tipo: z.enum(['TEXT', 'AUDIO']).default('TEXT'),
  conteudoTexto: z.string().max(4000).optional(),
  audioUrl: z.string().max(2_300_000).nullable().optional(),
  audioDuration: z.number().min(0).max(600).nullable().optional(),
  criseRelacionada: z.boolean().optional().default(false),
});

const syncMessagesSchema = z.object({
  messages: z.array(sendMessageSchema).min(1).max(25),
});

export class ChatController {
  public async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const isCrisisPopup = req.query.crisis === 'true';
      const result = await chatService.getHistory(req.user.id, { isCrisisPopup });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async createCrisisWelcome(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const result = await chatService.createCrisisWelcomeMessage(req.user.id);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const parsed = sendMessageSchema.parse(req.body);
      const result = await chatService.sendMessage(req.user.id, parsed);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async syncOffline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const parsed = syncMessagesSchema.parse(req.body);
      const result = await chatService.syncOfflineMessages(req.user.id, parsed.messages);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async getReportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const startDate =
        typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined;
      const endDate =
        typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined;

      const report = await chatService.getReportData(req.user.id, {
        startDate,
        endDate,
      });
      res.status(200).json({ report });
    } catch (error) {
      next(error);
    }
  }

  public async clearHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const result = await chatService.clearHistory(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
