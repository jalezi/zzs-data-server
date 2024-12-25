import { handlePromise } from './helpers';
import { logger } from './logger';
import type { ReturnType } from './types';

const childLogger = logger.child({
  name: 'fetchTextFile',
});

/**
 * Fetches a text file from a given URL.
 */
export const fetchTextFile = async (
  url: string,
): Promise<ReturnType<string>> => {
  const response = await fetch(url);

  if (!response.ok) {
    childLogger.error(
      `Failed to fetch file from ${url}: ${response.statusText}`,
    );
    const failedToFetchError = new Error(
      `Failed to fetch file from ${url}: ${response.statusText}`,
    );
    return [failedToFetchError];
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/plain')) {
    childLogger.error(`Invalid content type: ${contentType}`);
    const invalidContentTypeError = new Error(
      `Invalid content type: ${contentType}`,
    );
    return [invalidContentTypeError];
  }

  const contentLength = response.headers.get('content-length');
  if (!contentLength) {
    childLogger.error('Content length is missing');
    const contentLengthError = new Error('Content length is missing');
    return [contentLengthError];
  }

  const [textError, content] = await handlePromise(response.text());
  if (textError) {
    childLogger.error({ error: textError }, 'Failed to read content');
    return [textError];
  }
  return [undefined, content];
};
