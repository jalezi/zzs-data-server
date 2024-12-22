import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse';
import { type ReturnCatchErrorType, catchError } from './catchError';
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
 * Parses a compressed file (gzip) and extracts its contents as an array of objects.
 *
 * @template T - The type of the objects in the resulting array. Defaults to `Record<string, unknown>`.
 *
 * @param {string} filePath - The path to the compressed file.
 * @param {'tsv' | 'csv'} format - The format of the file, either 'tsv' (tab-separated values) or 'csv' (comma-separated values).
 *
 * @returns {ReturnCatchErrorType<T[]>} A promise that resolves to an array of objects of type T, or rejects with an error.
 *
 * @throws Will throw an error if there is an issue reading the file, decompressing it, or parsing its contents.
 *
 * @example
 * ```typescript
 * const data = await parseCompressedFile<MyType>('/path/to/file.gz', 'csv');
 * console.log(data);
 * ```
 */
export const parseCompressedFile = async <T = Record<string, unknown>>(
  filePath: string,
  format: 'tsv' | 'csv',
): ReturnCatchErrorType<T[]> => {
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

  return await catchError<T[], new (message?: string) => Error>(promise);
};
