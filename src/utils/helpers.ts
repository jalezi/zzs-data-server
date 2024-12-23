import { logger } from './logger';

import { parse } from 'csv-parse';
import type { Options as CsvParseOptions } from 'csv-parse';
import type { ReturnCatchErrorType } from './catchError';

/**
 * Utility for creating parsers with error handling.
 */
export const createParser = <T>(
  delimiter: string,
  processRow: (row: T) => void,
) => {
  const options: CsvParseOptions = { delimiter, columns: true };
  return parse(options).on('data', processRow);
};

/**
 * Utility to handle stream events (data, end, error).
 */
export const streamHandler = <T = unknown>(
  stream: NodeJS.ReadableStream,
  onData: (chunk: T) => void,
  onComplete: () => void,
  onError: (err: Error) => void,
) => {
  stream.on('data', onData).on('end', onComplete).on('error', onError);
};

/**
 * Handles promises with error catching and logging.
 */
export const handlePromise = async <T>(
  promise: Promise<T>,
  loggerContext?: Record<string, unknown>,
): Promise<ReturnCatchErrorType<T>> => {
  try {
    const result = await promise;
    return [undefined, result];
  } catch (err) {
    logger.error({ ...loggerContext, err }, 'An error occurred');
    if (err instanceof Error) return [err];
    return [new Error('Unknown error', { cause: err })];
  }
};
