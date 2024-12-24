import type { NextFunction, Request, Response } from 'express';
import { env } from '../env';
import { logger } from '../utils/logger';

const childLogger = logger.child({ name: 'apiKeyAuth' });

const API_KEYS = env.API_KEYS;
const API_KEYS_REQUIRED = env.API_KEYS_REQUIRED;

const validApiKeys = API_KEYS ? API_KEYS.split(',') : [];

export const apiKeyAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const apiKey = req.header('x-api-key');
  if (!API_KEYS_REQUIRED || (apiKey && validApiKeys.includes(apiKey))) {
    next();
  } else {
    childLogger.warn('Unauthorized request');
    res.status(401).json({ message: 'Unauthorized' });
  }
};
