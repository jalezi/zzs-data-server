import fs from 'node:fs';
import zlib from 'node:zlib';
import type { ZodSchema } from 'zod';
import { DELIMITERS } from '../constants/rawFiles';
import type { ReturnCatchErrorType } from './catchError';
import { createParser, handlePromise, streamHandler } from './helpers';

type Format = keyof typeof DELIMITERS;

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
 * Parses a compressed file (gzip) and extracts its contents as an array of objects.
 */
export const parseCompressedFile = async <T>(
  filePath: string,
  format: Format,
  zodSchema: ZodSchema<T>,
): ReturnCatchErrorType<ParseResult<T>> => {
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
        const error = new Error('Premature stream closure or unexpected end');
        reject(error);
      }
    };

    streamHandler(
      parser,
      () => {}, // No additional action on data
      () => {
        streamEnded = true;
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
