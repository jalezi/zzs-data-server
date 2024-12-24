import { Router } from 'express';
import dataRoutes from './dataRoutes';
import doctorRoutes from './doctorRoutes';

const router = Router();

router.use('/data', dataRoutes);
router.use('/doctors', doctorRoutes);

export default router;
