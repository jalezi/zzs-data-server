import { type Request, type Response, Router } from 'express';
import { dataFiles } from '../../database/config';
import { parseFile } from '../../utils/fileHelper';

const router = Router();

router.get('/:fileId', async (req: Request, res: Response) => {
  const { fileId } = req.params;
  const fileConfig = dataFiles.find((file) => file.id === fileId);

  if (!fileConfig) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  try {
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
    res
      .status(500)
      .json({ error: 'Failed to parse file', details: (err as Error).message });
  }
});

export default router;
