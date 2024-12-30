import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { dataFiles } from '../../database/config';
import { parseFile } from '../../utils/fileHelper';
import { logger } from '../../utils/logger';

const childLogger = logger.child({ name: 'dataRoutes' });

const router = Router();

router.get(
  '/:fileId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const fileConfig = dataFiles.find((file) => file.id === fileId);

      if (!fileConfig) {
        res.status(404).json({ success: false, message: 'File not found' });
        return;
      }

      const [error, result] = await parseFile(
        fileConfig.path,
        fileConfig.format,
        fileConfig.schema,
        true,
      );

      if (error) {
        childLogger.error({ error, fileId }, 'Failed to parse file');
        res.status(500).json({ success: false, message: 'Failed to parse' });
        return;
      }

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
