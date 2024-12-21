import { type Request, type Response, Router } from 'express';

const router = Router();

router.get(/healthcheck/, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
  });
});

export default router;
