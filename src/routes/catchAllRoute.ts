import { type Request, type Response, Router } from 'express'

const router = Router()

router.all('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  })
})

export default router
