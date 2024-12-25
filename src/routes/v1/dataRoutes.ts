import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { dataFiles } from '../../database/config';
import { parseFile } from '../../utils/fileHelper';

const router = Router();

router.get(
  '/:fileId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const fileConfig = dataFiles.find((file) => file.id === fileId);

      if (!fileConfig) {
        throw new Error('File not found');
      }

      const [error, result] = await parseFile(
        fileConfig.path,
        fileConfig.format,
        fileConfig.schema,
        true,
      );

      if (error) {
        throw error;
      }

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
