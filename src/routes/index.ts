import { Router } from 'express'
import catchAllRoute from './catchAllRoute'
import healthcheckRoute from './healthcheckRoute'
import v1Routes from './v1'

const apiVersioningRouter = Router()

// Define routes for each API version
apiVersioningRouter.use('/v1', v1Routes)

export { apiVersioningRouter, catchAllRoute, healthcheckRoute }
