import { PrismaClient } from '@prisma/client';

export interface CreatePanicLogInput {
  triggeredAt?: string;
  trackId?: string | null;
  trackTitle: string;
  trackArtist?: string | null;
  trackUrl?: string | null;
  wasOffline?: boolean;
  durationSeconds?: number | null;
}

export class PanicLogService {
  constructor(private readonly prisma: PrismaClient) {}

  public async createLog(userId: string, input: CreatePanicLogInput) {
    const triggeredAtDate = input.triggeredAt ? new Date(input.triggeredAt) : new Date();

    return this.prisma.panicLog.create({
      data: {
        userId,
        triggeredAt: Number.isNaN(triggeredAtDate.getTime()) ? new Date() : triggeredAtDate,
        trackId: input.trackId ?? null,
        trackTitle: input.trackTitle.trim(),
        trackArtist: input.trackArtist?.trim() || null,
        trackUrl: input.trackUrl ?? null,
        wasOffline: Boolean(input.wasOffline),
        durationSeconds: input.durationSeconds ?? null,
      },
    });
  }

  public async listRecentLogs(userId: string, limit = 20) {
    return this.prisma.panicLog.findMany({
      where: { userId },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    });
  }
}
