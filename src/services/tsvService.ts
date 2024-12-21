import { dataFiles } from '../database/config';
import { parseCompressedFile } from '../utils/fileHelper';

export const getFileData = async (fileId: string) => {
  const fileConfig = dataFiles.find((file) => file.id === fileId);
  if (!fileConfig) throw new Error('File not found');
  return parseCompressedFile(fileConfig.path, fileConfig.format);
};
