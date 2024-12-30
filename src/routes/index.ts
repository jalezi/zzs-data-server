import { Router } from 'express';
import v1Routes from './v1';

export { default as catchAllRoute } from './catchAllRoute';
export { default as healthcheckRouter } from './healthcheckRouter';

const apiVersioningRouter = Router();

// Define routes for each API version
apiVersioningRouter.use('/v1', v1Routes);

export { apiVersioningRouter };
