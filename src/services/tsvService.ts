import { dataFiles } from '../database/config';
import { parseCompressedFile } from '../utils/fileHelper';

/**
 * Retrieves and parses data from a specified file.
 *
 * @template T - The type of data expected in the file.
 * @param {string} fileId - The unique identifier of the file to retrieve.
 * @returns {Promise<T>} - A promise that resolves to the parsed data of type T.
 * @throws {Error} - Throws an error if the file with the specified ID is not found.
 */
export const getFileData = async <T>(fileId: string) => {
  const fileConfig = dataFiles.find((file) => file.id === fileId);
  if (!fileConfig) throw new Error('File not found');
  return await parseCompressedFile<T>(fileConfig.path, fileConfig.format);
};
