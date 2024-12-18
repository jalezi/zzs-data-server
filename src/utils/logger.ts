import pino from 'pino'
import pinoHttp from 'pino-http'

const logger = pino({
  transport: {
    target: 'pino-pretty', // Pretty logs for development
    options: {
      colorize: true, // Colorize output
    },
  },
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
})

// HTTP logging middleware using Pino
const httpLogger = pinoHttp({
  logger, // Use the same logger instance
  customLogLevel: (_req, res, _err) => {
    if (res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} - ${res.statusCode}`,
  customErrorMessage: (req, _res, err) =>
    `Error on ${req.method} ${req.url}: ${err.message}`,
})

export { logger, httpLogger }
