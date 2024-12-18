import { z } from 'zod'
import { logger } from './utils/logger'

type DataFile = {
  id: string
  path: `./database/${string}.tsv.gz` | `./database/${string}.csv.gz`
  format: 'tsv' | 'csv'
}

export const dataFiles = [
  { id: 'users', path: './database/users.tsv.gz', format: 'tsv' },
  { id: 'products', path: './database/products.csv.gz', format: 'csv' },
] satisfies DataFile[]

const envSchema = z.object({
  PORT: z.string().default('3000'),
  API_KEYS: z.string(),
  API_KEYS_REQUIRED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60_000'),
  RATE_LIMIT_MAX: z.string().default('100'),
})

logger.info('Validating environment variables')
try {
  envSchema.parse(process.env)
  logger.info('Environment variables are valid')
} catch (error) {
  if (error instanceof z.ZodError) {
    const formattedErrors = error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }))
    logger.error({ issues: formattedErrors }, 'Invalid environment variables')
  } else {
    logger.error({ error }, 'Unexpected error during environment validation')
  }
  process.exit(1)
}

const env = envSchema.parse(process.env)
export { env }
