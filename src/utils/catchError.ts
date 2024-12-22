import type { Level } from 'pino';
import { logger } from './logger';

export const loggerMessages = {
  success: 'Promise resolved successfully',
  unknown: 'Error occurred (no specific error types to catch)',
  specific: 'Caught a specific error',
  unhandled: 'Unhandled error occurred',
};

const logError = (
  level: Level,
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
) => {
  logger[level](message, {
    ...context,
    errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
};

/**
 * Handles a promise and catches specific error types, logging the process.
 *
 * This utility ensures that errors are either caught and handled or rethrown.
 * It logs successful resolutions, caught errors, and unexpected errors.
 *
 * @template T - The type of the resolved value from the promise.
 * @template E - The types of errors to catch (must extend `Error`).
 * @param {Promise<T>} promise - The promise to handle.
 * @param {E[]} errorsToCatch - An array of error classes to catch and handle.
 * @returns {Promise<[undefined, T] | [E | unknown]>}
 *   A tuple where the first element is `undefined` for successful resolutions or the caught error,
 *   and the second element is the resolved value or `undefined` in case of an error.
 */
export const catchError = async <T, E extends new (message?: string) => Error>(
  promise: Promise<T>,
  errorsToCatch: E[],
): Promise<[undefined, T] | [E] | [unknown]> => {
  try {
    const data = await promise;
    logger.info(loggerMessages.success, { data });
    return [undefined, data] as [undefined, T];
  } catch (error) {
    if (
      errorsToCatch === undefined ||
      errorsToCatch.length === 0 ||
      !(error instanceof Error)
    ) {
      logError('error', loggerMessages.unknown, error);
      return [error];
    }

    if (errorsToCatch.some((errorType) => error instanceof errorType)) {
      logError('warn', loggerMessages.specific, error);
      return [error];
    }

    logError('error', loggerMessages.unhandled, error);
    throw error;
  }
};
