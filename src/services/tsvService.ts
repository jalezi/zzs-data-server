import { dataFiles } from '../database/config';
import { parseCompressedFile } from '../utils/fileHelper';

/**
 * Retrieves the parsed data of a specified file based on its file ID.
 *
 * This function searches for the file configuration in the `dataFiles` array
 * using the provided `fileId`. If the file configuration is found, it processes
 * the file using the `parseCompressedFile` utility and returns the parsed data.
 * The parsed data is an array of objects, where each object represents a row
 * of the file, with keys derived from the file's header row and values
 * corresponding to the row's values.
 *
 * @template T - The shape of the parsed data objects. Defaults to `Record<string, unknown>`.
 * @async
 * @function
 * @param {string} fileId - The unique identifier of the file to retrieve.
 * @returns {Promise<T[]>} A promise that resolves to an array of objects representing the parsed data.
 * @throws {Error} Throws an error in the following cases:
 *   - If the `fileId` is not found in the `dataFiles` array.
 *   - If there is an error during file parsing (propagates errors from `parseCompressedFile`).
 *
 * @example
 * // Example usage of `getFileData`
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
export const getFileData = async <T>(
  fileId: string,
): ReturnType<typeof parseCompressedFile<T>> => {
  const fileConfig = dataFiles.find((file) => file.id === fileId);
  if (!fileConfig) throw new Error('File not found');
  return await parseCompressedFile<T>(fileConfig.path, fileConfig.format);
};
