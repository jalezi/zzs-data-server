import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse';
import type { ZodSchema } from 'zod';
import type { ReturnCatchErrorType } from './catchError';
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
} as const;

/**
 * Utility for creating parsers with error handling.
 */
const createParser = <T>(delimiter: string, processRow: (row: T) => void) => {
  return parse({ delimiter, columns: true }).on('data', processRow);
};

/**
 * Utility to handle stream events (data, end, error).
 */
const streamHandler = <T = unknown>(
  stream: fs.ReadStream | zlib.Gunzip | ReturnType<typeof parse>,
  onData: (chunk: T) => void,
  onComplete: () => void,
  onError: (err: Error) => void,
) => {
  stream.on('data', onData).on('end', onComplete).on('error', onError);
};

/**
 * Handles promises with error catching and logging.
 */
const handlePromise = async <T>(
  promise: Promise<T>,
  loggerContext?: Record<string, unknown>,
): Promise<ReturnCatchErrorType<T>> => {
  try {
    const result = await promise;
    return [undefined, result];
  } catch (err) {
    logger.error({ ...loggerContext, err }, 'An error occurred');
    if (err instanceof Error) return [err];
    return [new Error('An unknown error occurred', { cause: err })];
  }
};

/**
 * Parses a compressed file (gzip) and extracts its contents as an array of objects.
 */
export const parseCompressedFile = async <T>(
  filePath: string,
  format: Format,
  zodSchema: ZodSchema<T>,
): ReturnCatchErrorType<ParseResult<T>> => {
  logger.info({ filePath, format }, loggerMessages.start);

  const promise = new Promise<ParseResult<T>>((resolve, reject) => {
    const validRows: T[] = [];
    let totalRows = 0;
    let invalidRows = 0;
    let streamEnded = false;

    const input = fs.createReadStream(filePath).on('error', reject);
    const gunzip = zlib.createGunzip().on('error', reject);

    const parser = createParser<T>(DELIMITERS[format], (row) => {
      totalRows++;
      const result = zodSchema.safeParse(row);
      if (result.success) validRows.push(result.data);
      else invalidRows++;
    });

    const onStreamClose = () => {
      if (!streamEnded) {
        const error = new Error(loggerMessages.prematureEnd);
        logger.error({ filePath, err: error }, loggerMessages.parseError);
        reject(error);
      }
    };

    streamHandler(
      parser,
      () => {}, // No additional action on data
      () => {
        streamEnded = true;
        logger.info(
          { filePath, rowsCount: validRows.length },
          loggerMessages.success,
        );
        resolve({
          data: validRows,
          meta: {
            totalRows,
            validRows: validRows.length,
            invalidRows,
            allValid: invalidRows === 0,
          },
        });
      },
      reject,
    );

    input.pipe(gunzip).on('close', onStreamClose).pipe(parser);
  });

  return await handlePromise(promise, { filePath, format });
};

/**
 * Result type for parsed CSV/TSV files.
 */
export interface ParseResult<T> {
  data: T[];
  meta: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    allValid: boolean;
  };
}

/**
 * Parses CSV/TSV file content with Zod validation.
 */
export const parseCsvOrTsvFile = async <T>(
  fileContent: string,
  format: Format,
  zodSchema: ZodSchema<T>,
): ReturnCatchErrorType<ParseResult<T>> => {
  const promise = new Promise<ParseResult<T>>((resolve, reject) => {
    const validRows: T[] = [];
    let totalRows = 0;
    let invalidRows = 0;

    const parser = createParser<T>(DELIMITERS[format], (row) => {
      totalRows++;
      const result = zodSchema.safeParse(row);
      if (result.success) validRows.push(result.data);
      else invalidRows++;
    });

    streamHandler(
      parser,
      () => {}, // No additional action on data
      () => {
        resolve({
          data: validRows,
          meta: {
            totalRows,
            validRows: validRows.length,
            invalidRows,
            allValid: invalidRows === 0,
          },
        });
      },
      reject,
    );

    parser.write(fileContent);
    parser.end();
  });

  return await handlePromise(promise, { format });
};
