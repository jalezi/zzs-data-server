import { handlePromise } from './helpers';
import { logger } from './logger';

const childLogger = logger.child({
  name: 'fetchTextFile',
});

/**
 * Fetches a text file from a given URL.
 */
export const fetchTextFile = async (url: string): Promise<string> => {
  const response = await fetch(url);

  if (!response.ok) {
    childLogger.error(
      `Failed to fetch file from ${url}: ${response.statusText}`,
    );
    throw new Error(`Failed to fetch file from ${url}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/plain')) {
    childLogger.error(`Invalid content type: ${contentType}`);
    throw new Error(`Invalid content type: ${contentType}`);
  }

  const contentLength = response.headers.get('content-length');
  if (!contentLength) {
    childLogger.error('Content length is missing');
    throw new Error('Content length is missing');
  }

  const [textError, content] = await handlePromise(response.text());
  if (textError) {
    childLogger.error({ error: textError }, 'Failed to read content');
    throw textError;
  }
  return content;
};
