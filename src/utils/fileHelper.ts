import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse';
import { catchError } from './catchError';
import { logger } from './logger';

export const loggerMessages = {
  start: 'Starting file parsing',
  readError: 'File reading failed',
  decompressionError: 'Decompression failed',
  parseError: 'File parsing failed',
  streamClosed: 'Stream closed',
  success: 'File parsing completed',
  prematureEnd: 'Premature stream closure or unexpected end',
};

/**
 * Parses a compressed `.gz` file containing tab-separated (TSV) or
 * comma-separated (CSV) data into an array of objects.
 *
 * @template T - The type of the parsed row objects.
 * @param {string} filePath - The path to the compressed `.gz` file.
 * @param {'tsv' | 'csv'} format - Specifies the file's format:
 *   - `'tsv'` for tab-separated values.
 *   - `'csv'` for comma-separated values.
 * @returns {Promise<T[]>} A promise that resolves to an array of objects,
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
export const parseCompressedFile = async <T = Record<string, unknown>>(
  filePath: string,
  format: 'tsv' | 'csv',
): Promise<ReturnType<typeof catchError>> => {
  const delimiter = format === 'tsv' ? '\t' : ',';
  logger.info({ filePath, format }, loggerMessages.start);

  const promise = new Promise<T[]>((resolve, reject) => {
    const rows: T[] = [];
    let streamEnded = false;

    const input = fs.createReadStream(filePath).on('error', (err) => {
      logger.error({ err, filePath }, loggerMessages.readError);
      reject(err);
    });

    const gunzip = zlib.createGunzip().on('error', (err) => {
      logger.error({ err, filePath }, loggerMessages.decompressionError);
      reject(err);
    });

    const parser = parse({ delimiter, columns: true })
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        streamEnded = true;
        logger.info(
          { filePath, rowsCount: rows.length },
          loggerMessages.success,
        );
        resolve(rows);
      })
      .on('error', (err) => {
        logger.error({ err, filePath }, loggerMessages.parseError);
        reject(err);
      });

    input
      .pipe(gunzip)
      .on('close', () => {
        logger.debug({ filePath, streamEnded }, loggerMessages.streamClosed);
        if (!streamEnded) {
          const error = new Error(loggerMessages.prematureEnd);
          logger.error({ err: error, filePath }, loggerMessages.parseError);
          reject(error);
        }
      })
      .pipe(parser);
  });

  return await catchError<T[], new (message?: string) => Error>(promise, [
    Error,
  ]);
};
