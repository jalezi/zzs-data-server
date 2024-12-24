import type { Response } from 'express';

export function sendErrorResponse(
  res: Response,
  status: number,
  message: string,
  meta?: Record<string, unknown>,
) {
  res.status(status).json({
    success: false,
    error: message,
    ...meta,
  });
}

export function sendSuccessResponse<T>(
  res: Response,
  data: T,
  meta?: Record<string, unknown>,
) {
  res.json({
    success: true,
    ...data,
    meta,
  });
}
