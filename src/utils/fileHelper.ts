import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse';
import { logger } from './logger';

/**
 * Parses a compressed `.gz` file containing tab-separated (TSV) or
 * comma-separated (CSV) data into an array of objects.
 *
 * @param {string} filePath - The path to the compressed `.gz` file.
 * @param {'tsv' | 'csv'} format - Specifies the file's format:
 *   - `'tsv'` for tab-separated values.
 *   - `'csv'` for comma-separated values.
 * @returns {Promise<any[]>} A promise that resolves to an array of objects,
 * where each object represents a parsed row of the file.
 *
 * @example
 * import { parseCompressedFile } from './fileHelper';
 *
 * (async () => {
 *   try {
 *     const rows = await parseCompressedFile('./data-file.tsv.gz', 'tsv');
 *     console.log('Parsed Rows:', rows);
 *   } catch (err) {
 *     console.error('Error during file parsing:', err);
 *   }
 * })();
 *
 * @throws Will reject the promise with an error in the following scenarios:
 *   - File reading fails (e.g., non-existent or inaccessible file).
 *   - Decompression fails (e.g., corrupted `.gz` file).
 *   - Parsing fails (e.g., invalid format or malformed rows).
 *   - Premature or unexpected stream closure occurs.
 *
 * Features:
 * - Handles `.gz` compressed files seamlessly.
 * - Processes files using streams for memory efficiency.
 * - Supports both TSV (`\t` delimited) and CSV (`,` delimited) files.
 * - Explicitly uses `columns: true` in the parser, which automatically maps
 *   each row's values to keys derived from the file's header row. This
 *   ensures that the output is an array of objects where the keys are column
 *   names and the values are the corresponding row values.
 * - Provides detailed logging for progress and errors.
 *
 * Dependencies:
 * - Node.js Core Modules:
 *   - `fs`: For reading the file.
 *   - `zlib`: For decompressing the `.gz` file.
 * - Third-Party Libraries:
 *   - `csv-parse`: For parsing CSV/TSV content.
 */
export const parseCompressedFile = async (
  filePath: string,
  format: 'tsv' | 'csv',
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
): Promise<any[]> => {
  const delimiter = format === 'tsv' ? '\t' : ',';
  logger.info({ filePath, format }, 'Starting file parsing');

  return new Promise((resolve, reject) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const rows: any[] = [];
    let streamEnded = false;

    const input = fs.createReadStream(filePath).on('error', (err) => {
      logger.error({ err, filePath }, 'File reading failed');
      reject(err);
    });

    const gunzip = zlib.createGunzip().on('error', (err) => {
      logger.error({ err, filePath }, 'Decompression failed');
      reject(err);
    });

    const parser = parse({ delimiter, columns: true })
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        streamEnded = true;
        logger.info(
          { filePath, rowsCount: rows.length },
          'File parsing completed',
        );
        resolve(rows);
      })
      .on('error', (err) => {
        logger.error({ err, filePath }, 'File parsing failed');
        reject(err);
      });

    input
      .pipe(gunzip)
      .on('close', () => {
        logger.debug({ filePath, streamEnded }, 'Stream closed');
        if (!streamEnded) {
          const error = new Error('Premature stream closure or unexpected end');
          logger.error({ err: error, filePath }, 'File parsing failed');
          reject(error);
        }
      })
      .pipe(parser);
  });
};
