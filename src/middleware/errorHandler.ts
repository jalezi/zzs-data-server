import type { NextFunction, Request, Response } from 'express'
import { logger } from '../utils/logger'

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error')
  res.status(500).json({ success: false, message: 'Something went wrong.' })
}
