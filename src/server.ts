import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './env';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import { errorHandler } from './middleware/errorHandler';
import { globalRateLimiter } from './middleware/rateLimiter';
import { apiVersioningRouter, catchAllRoute, healthcheckRoute } from './routes';
import { httpLogger, logger } from './utils/logger';

const app = express();
const PORT = env.PORT || 3000;

app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader(
    'Set-Cookie',
    'globalToken=secure-value; HttpOnly; Secure; SameSite=Strict',
  );
  next();
});
app.use(httpLogger);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalRateLimiter);
app.use(healthcheckRoute);
app.use(apiKeyAuth);
app.use('/api', apiVersioningRouter);
app.use(catchAllRoute);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}
