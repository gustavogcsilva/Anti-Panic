import { NextFunction, Request, Response } from 'express';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const buckets = new Map<string, RateLimitBucket>();

  // Limpeza periódica para evitar vazamento de memória
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now > bucket.resetAt) {
        buckets.delete(key);
      }
    }
  }, Math.max(options.windowMs, 30_000));

  cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userKey = req.user?.id ? `user:${req.user.id}` : `ip:${clientIp}`;

    const existing = buckets.get(userKey);

    if (!existing || now > existing.resetAt) {
      buckets.set(userKey, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      next();
      return;
    }

    existing.count += 1;

    if (existing.count > options.maxRequests) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        message:
          options.message ??
          'Muitas solicitações em pouco tempo. Respire fundo e aguarde alguns segundos antes de tentar novamente.',
      });
      return;
    }

    next();
  };
}
