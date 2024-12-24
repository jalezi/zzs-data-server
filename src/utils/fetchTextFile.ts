import type { ReturnCatchErrorType } from './catchError';
import { logger } from './logger';

const childLogger = logger.child({
  name: 'fetchTextFile',
});

/**
 * Fetches a text file from a given URL.
 */
export const fetchTextFile = async (
  url: string,
): Promise<ReturnCatchErrorType<string>> => {
  const response = await fetch(url);

  if (!response.ok) {
    childLogger.error(
      `Failed to fetch file from ${url}: ${response.statusText}`,
    );
    const error = new Error(
      `Failed to fetch file from ${url}: ${response.statusText}`,
    );
    return [error];
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/plain')) {
    childLogger.error(`Invalid content type: ${contentType}`);
    const error = new Error(`Invalid content type: ${contentType}`);
    return [error];
  }

  const contentLength = response.headers.get('content-length');
  if (!contentLength) {
    childLogger.error('Content length is missing');
    const error = new Error('Content length is missing');
    return [error];
  }

  const content = await response.text();
  return [undefined, content];
};
