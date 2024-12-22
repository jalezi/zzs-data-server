import { dataFiles } from '../database/config';
import { parseCompressedFile } from '../utils/fileHelper';

/**
 * Retrieves the parsed data of a specified file based on its file ID.
 *
 * This function searches for the file configuration in the `dataFiles` array
 * using the provided `fileId`. If the file configuration is found, it processes
 * the file using the `parseCompressedFile` utility and returns the parsed data.
 * The data is parsed into an array of objects, where each object represents a
 * row of the file, with keys derived from the file's header row and values
 * corresponding to the row's values.
 *
 * @template T - The shape of the parsed data objects (defaults to `Record<string, unknown>`).
 * @async
 * @function
 * @param {string} fileId - The unique identifier of the file to retrieve.
 * @returns {Promise<T[]>} A promise that resolves to an array of objects representing the parsed data.
 * @throws {Error} Throws an error in the following cases:
 *   - If the `fileId` does not exist in the `dataFiles` array.
 *   - If there is an error during file parsing (propagates errors from `parseCompressedFile`).
 *
 * @example
 * // Assuming `dataFiles` contains a file configuration with ID 'file1'
 * import { getFileData } from './tsvService';
 *
 * (async () => {
 *   try {
 *     const data = await getFileData<{ name: string; age: number }>('file1');
 *     console.log('Parsed Data:', data);
 *   } catch (err) {
 *     console.error('Error retrieving file data:', err);
 *   }
 * })();
 */
export const getFileData = <T>(
  fileId: string,
): ReturnType<typeof parseCompressedFile> => {
  const fileConfig = dataFiles.find((file) => file.id === fileId);
  if (!fileConfig) throw new Error('File not found');
  return parseCompressedFile<T>(fileConfig.path, fileConfig.format);
};
