import { logger } from './logger';

import { parse } from 'csv-parse';
import type { Options as CsvParseOptions } from 'csv-parse';
import type { ReturnType } from './types';

const childLogger = logger.child({ name: 'helpers' });

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
): Promise<ReturnType<T>> => {
  try {
    const result = await promise;
    return [undefined, result];
  } catch (err) {
    childLogger.error({ ...loggerContext, err }, 'An error occurred');
    if (err instanceof Error) return [err];
    return [new Error('Unknown error', { cause: err })];
  }
};

export function calculateExecutionTime(startTime: number): string {
  return `${Date.now() - startTime}ms`;
}

export const isError = (value: unknown): value is Error =>
  value instanceof Error;

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number';

export const createChildLogger = (name: string) => logger.child({ name });
