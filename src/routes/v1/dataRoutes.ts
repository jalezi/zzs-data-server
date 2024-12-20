import { type Request, type Response, Router } from 'express'
import { dataFiles } from '../../database/config'
import { parseCompressedFile } from '../../utils/fileHelper'

const router = Router()

router.get('/:fileId', async (req: Request, res: Response) => {
  const { fileId } = req.params
  const fileConfig = dataFiles.find((file) => file.id === fileId)

  if (!fileConfig) {
    res.status(404).json({ error: 'File not found' })
    return
  }

  try {
    const data = await parseCompressedFile(fileConfig.path, fileConfig.format)
    res.json({ success: true, data })
  } catch (err) {
    res
      .status(500)
      .json({ error: 'Failed to parse file', details: (err as Error).message })
  }
})

export default router
