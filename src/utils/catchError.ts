/**
 * Catches errors from a promise and logs them using the provided logger.
 *
 * @template T - The type of the resolved value of the promise.
 * @template E - The type of the errors to catch, extending the Error constructor.
 *
 * @param {Promise<T>} promise - The promise to handle errors for.
 * @param {E[] | undefined} [errorsToCatch] - An optional array of specific error types to catch.
 *
 * @returns {ReturnCatchErrorType<T>} A promise that resolves to a tuple. The first element is either `undefined` if no error occurred, or an error object if an error was caught. The second element is the resolved value of the promise if no error occurred.
 *
 * @throws Will rethrow the error if it is not in the `errorsToCatch` array.
 */
import type { Level } from 'pino';
import { logger } from './logger';

const childLogger = logger.child({
  name: 'catchError',
});

export const loggerMessages = {
  success: 'Promise resolved successfully',
  unknown: 'Error occurred (no specific error types to catch)',
  specific: 'Caught a specific error',
  unhandled: 'Unhandled error occurred',
} as const;

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

export type ReturnCatchErrorType<T> = Promise<
  [unknown] | [Error] | [undefined, T]
>;

export const catchError = async <T, E extends new (message?: string) => Error>(
  promise: Promise<T>,
  errorsToCatch?: E[] | undefined,
): ReturnCatchErrorType<T> => {
  try {
    const data = await promise;
    childLogger.info(loggerMessages.success, { data });
    return [undefined, data] as [undefined, T];
  } catch (error) {
    if (!errorsToCatch) {
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
