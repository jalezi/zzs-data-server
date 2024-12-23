import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse';
import type { ZodSchema } from 'zod';
import { type ReturnCatchErrorType, catchError } from './catchError';
import { logger } from './logger';

const DELIMITERS = {
  tsv: '\t',
  csv: ',',
} as const;

type Format = keyof typeof DELIMITERS;

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
  format: Format,
): ReturnCatchErrorType<T[]> => {
  const delimiter = DELIMITERS[format];
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

export interface ParseResult<T> {
  data: T[];
  meta: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    allValid: boolean;
  };
}

export const parseCsvOrTsvFile = async <T>(
  fileContent: string,
  format: Format,
  zodSchema: ZodSchema<T>,
) => {
  const delimiter = DELIMITERS[format];

  const promise = new Promise<ParseResult<T>>((resolve, reject) => {
    const validRows: T[] = [];
    let totalRows = 0;
    let invalidRows = 0;

    const parser = parse({ delimiter, columns: true })
      .on('data', (row) => {
        totalRows++;
        const parsedRow = zodSchema.safeParse(row);
        if (parsedRow.success) {
          validRows.push(parsedRow.data);
        } else {
          invalidRows++;
        }
      })
      .on('end', () =>
        resolve({
          data: validRows,
          meta: {
            totalRows,
            validRows: validRows.length,
            invalidRows,
            allValid: invalidRows === 0,
          },
        }),
      )
      .on('error', (err) => reject(err));

    parser.write(fileContent);
    parser.end();
  });

  return await catchError<ParseResult<T>, new (message?: string) => Error>(
    promise,
  );
};
