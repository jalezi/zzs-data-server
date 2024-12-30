import { uptime } from 'node:process';
import { type Request, type Response, Router } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    uptime: uptime(),
  });
});

export default router;
