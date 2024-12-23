import fs from 'node:fs';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import type { ZodSchema } from 'zod';
import { DELIMITERS } from '../constants/rawFiles';
import type { ReturnCatchErrorType } from './catchError';
import { createParser, handlePromise, streamHandler } from './helpers';

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
 * Processes a file stream with Zod validation.
 */
const processStream = <T>(
  stream: NodeJS.ReadableStream,
  delimiter: string,
  zodSchema: ZodSchema<T>,
): Promise<ParseResult<T>> => {
  return new Promise((resolve, reject) => {
    const validRows: T[] = [];
    let totalRows = 0;
    let invalidRows = 0;
    let streamEnded = false;

    const parser = createParser<T>(delimiter, (row) => {
      totalRows++;
      const result = zodSchema.safeParse(row);
      if (result.success) validRows.push(result.data);
      else invalidRows++;
    });

    parser.on('end', () => {
      streamEnded = true;
    });

    const onStreamClose = () => {
      if (!streamEnded) {
        const error = new Error('Premature stream closure or unexpected end');
        reject(error);
      }
    };

    streamHandler(
      parser,
      () => {}, // No action on data
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

    stream.on('close', onStreamClose).pipe(parser);
  });
};

/**
 * Parses a file or raw content (optionally compressed) and validates with Zod schema.
 */
export const parseFile = async <T>(
  source: string | Buffer,
  format: keyof typeof DELIMITERS,
  zodSchema: ZodSchema<T>,
  isCompressed = false,
): ReturnCatchErrorType<ParseResult<T>> => {
  const promise = new Promise<ParseResult<T>>((resolve, reject) => {
    const stream =
      typeof source === 'string'
        ? fs.createReadStream(source).on('error', reject)
        : Readable.from(source);

    const finalStream = isCompressed
      ? stream.pipe(zlib.createGunzip().on('error', reject))
      : stream;

    processStream(finalStream, DELIMITERS[format], zodSchema)
      .then(resolve)
      .catch(reject);
  });

  return await handlePromise(promise, { source, format });
};

/**
 * Parses raw CSV/TSV content directly.
 */
export const parseRawContent = async <T>(
  content: string,
  format: keyof typeof DELIMITERS,
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
      () => {}, // No action on data
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

    parser.write(content);
    parser.end();
  });

  return await handlePromise(promise, { format });
};
