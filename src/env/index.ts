import { z } from 'zod';
import { logger } from '../utils/logger';

const childLogger = logger.child({ name: 'env' });

const envSchema = z.object({
  PORT: z.string().default('3000'),
  API_KEYS: z.string().default('example-key-1,example-key-2'),
  API_KEYS_REQUIRED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60_000'),
  RATE_LIMIT_MAX: z.string().default('100'),
});

export type Env = z.infer<typeof envSchema>;

childLogger.info('Validating environment variables');
try {
  envSchema.parse(process.env);
  childLogger.info('Environment variables are valid');
} catch (error) {
  if (error instanceof z.ZodError) {
    const formattedErrors = error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));
    childLogger.error(
      { issues: formattedErrors },
      'Invalid environment variables',
    );
  } else {
    childLogger.error(
      { error },
      'Unexpected error during environment validation',
    );
  }
  process.exit(1);
}

export const env = envSchema.parse(process.env);
