import type { ZodSchema } from 'zod';
import type { ReturnCatchErrorType } from '../../../utils/catchError';
import { fetchTextFile } from '../../../utils/fetchTextFile';
import { parseRawContent } from '../../../utils/fileHelper';
import { logger } from '../../../utils/logger';
import { getCacheWithTTL, setCacheWithTTL } from './cacheUtils';

// Utility: Fetch and Parse with Cache
export async function fetchAndParseWithCache<T>(
  url: string,
  schema: ZodSchema<T>,
  cache: Map<string, T[]>,
  timestamp: string,
): Promise<ReturnCatchErrorType<T[]>> {
  const cachedData = getCacheWithTTL(cache, timestamp);
  if (cachedData) {
    logger.info({ timestamp, url }, 'Serving data from cache');
    return [undefined, cachedData];
  }

  const [fetchError, rawContent] = await fetchTextFile(url);
  if (fetchError || !rawContent) {
    logger.error({ url, error: fetchError }, 'Failed to fetch raw content');
    return [fetchError || new Error('Empty file')];
  }

  const [parseError, parsedData] = await parseRawContent(
    rawContent,
    'csv',
    schema,
  );
  if (parseError || !parsedData) {
    logger.error({ url, error: parseError }, 'Failed to parse raw content');
    return [parseError || new Error('Parsing error')];
  }

  const { data } = parsedData;
  setCacheWithTTL(cache, timestamp, data);

  return [undefined, data];
}
