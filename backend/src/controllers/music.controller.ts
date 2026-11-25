import { NextFunction, Request, Response } from 'express';
import { MusicService } from '../services/music.service';

const musicService = new MusicService();

export class MusicController {
  public async getRandomByArtist(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const artist = typeof req.query.artist === 'string' ? req.query.artist : undefined;
      const track = await musicService.getRandomTrackByArtist(artist);
      res.status(200).json(track);
    } catch (error) {
      next(error);
    }
  }
}
