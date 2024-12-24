import type { Response } from 'express';
import { calculateExecutionTime } from '../../../utils/helpers';

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
    meta,
    ...data,
  });
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  meta: Record<string, unknown>,
  startTime: number,
) {
  sendErrorResponse(res, status, message, {
    ...meta,
    executionTime: calculateExecutionTime(startTime),
  });
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta: Record<string, unknown>,
  startTime: number,
) {
  sendSuccessResponse(
    res,
    { data },
    {
      ...meta,
      executionTime: calculateExecutionTime(startTime),
    },
  );
}
