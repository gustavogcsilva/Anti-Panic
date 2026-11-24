import { NextFunction, Request, Response } from 'express';
import { Readable } from 'stream';
import { prisma } from '../config/prisma';
import { BotCuradorService } from '../services/botCurador.service';
import { AppError } from '../utils/appError';
import { verifyAuthToken } from '../utils/jwt';

const botCuradorService = new BotCuradorService(prisma);

/**
 * Valida estritamente se a URL de áudio pertence aos servidores oficiais do Jamendo
 * (proteção contra SSRF no endpoint proxy de streaming/cache).
 */
function isAllowedJamendoAudioUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'jamendo.com' || host.endsWith('.jamendo.com');
  } catch {
    return false;
  }
}

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

  /**
   * Proxy seguro de streaming/download de MP3 do Jamendo com suporte completo a:
   * - CORS (permite baixar para Cache API / IndexedDB sem bloqueio cross-origin)
   * - HTTP Range Requests (Range: bytes=0-) para seeking fluido no iOS Safari e Chrome Android
   */
  public async proxyAudio(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Aceita autenticação por Header Authorization OU query param ?token= (para tags <audio src>)
      const headerAuth = req.headers.authorization;
      const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
      const rawToken =
        headerAuth && headerAuth.startsWith('Bearer ')
          ? headerAuth.slice(7).trim()
          : queryToken;

      if (!rawToken) {
        throw new AppError('Token de autenticação obrigatório para reproduzir áudio.', 401);
      }

      try {
        verifyAuthToken(rawToken);
      } catch {
        throw new AppError('Sessão inválida ou expirada.', 401);
      }

      const targetUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
      if (!targetUrl || !isAllowedJamendoAudioUrl(targetUrl)) {
        throw new AppError('URL de áudio inválida ou fora do domínio autorizado Jamendo.', 400);
      }

      const forwardHeaders: Record<string, string> = {
        Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.5',
      };

      if (typeof req.headers.range === 'string' && req.headers.range.startsWith('bytes=')) {
        forwardHeaders.Range = req.headers.range;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);

      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: forwardHeaders,
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!upstream.ok && upstream.status !== 206) {
        throw new AppError(
          `Não foi possível carregar o áudio no servidor Jamendo (HTTP ${upstream.status}).`,
          502
        );
      }

      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
      res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      const contentRange = upstream.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }

      if (!upstream.body) {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
      nodeStream.on('error', () => {
        if (!res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      });
      nodeStream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
}
