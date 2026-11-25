import { Router } from 'express';
import { MusicController } from '../controllers/music.controller';

const musicRouter = Router();
const musicController = new MusicController();

musicRouter.get('/random', (req, res, next) =>
  musicController.getRandomByArtist(req, res, next)
);

export { musicRouter };
