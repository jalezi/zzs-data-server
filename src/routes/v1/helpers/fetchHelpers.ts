import type { ZodSchema } from 'zod';
import { DOCTORS_TS, INSTITUTIONS_TS } from '../../../constants/doctors';
import type { ReturnCatchErrorType } from '../../../utils/catchError';
import { fetchTextFile } from '../../../utils/fetchTextFile';
import { parseRawContent } from '../../../utils/fileHelper';
import { logger } from '../../../utils/logger';
import { getCacheWithTTL, setCacheWithTTL } from './cacheUtils';
import type { Timestamps } from './schemas/doctorRoutes';

const childLogger = logger.child({
  name: 'fetchHelpers',
});

// Utility: Fetch and Parse with Cache
export async function fetchAndParseWithCache<T>(
  url: string,
  schema: ZodSchema<T>,
  cache: Map<string, T[]>,
  timestamp: string,
): Promise<ReturnCatchErrorType<T[]>> {
  const cachedData = getCacheWithTTL(cache, timestamp);
  if (cachedData) {
    childLogger.info({ timestamp, url }, 'Serving data from cache');
    return [undefined, cachedData];
  }

  const [fetchError, rawContent] = await fetchTextFile(url);
  if (fetchError || !rawContent) {
    childLogger.error(
      { url, error: fetchError },
      'Failed to fetch raw content',
    );
    return [fetchError || new Error('Empty file')];
  }

  const [parseError, parsedData] = await parseRawContent(
    rawContent,
    'csv',
    schema,
  );
  if (parseError || !parsedData) {
    childLogger.error(
      { url, error: parseError },
      'Failed to parse raw content',
    );
    return [parseError || new Error('Parsing error')];
  }

  const { data } = parsedData;
  setCacheWithTTL(cache, timestamp, data);

  return [undefined, data];
}

// Utility: Fetch Timestamps
export async function fetchTimestamps(): Promise<
  ReturnCatchErrorType<Timestamps>
> {
  const [doctorsTsResult, institutionsTsResult] = await Promise.all([
    fetchTextFile(DOCTORS_TS.href),
    fetchTextFile(INSTITUTIONS_TS.href),
  ]);

  const [doctorsTsError, doctorsTsRaw] = doctorsTsResult;
  const [institutionsTsError, institutionsTsRaw] = institutionsTsResult;

  if (doctorsTsError || institutionsTsError) {
    childLogger.error(
      {
        doctorsTsError,
        institutionsTsError,
        urls: {
          doctorsTsUrl: DOCTORS_TS.href,
          institutionsTsUrl: INSTITUTIONS_TS.href,
        },
      },
      'Failed to fetch timestamps',
    );
    return [doctorsTsError || institutionsTsError];
  }

  const doctorsTs = doctorsTsRaw?.trim() || null;
  const institutionsTs = institutionsTsRaw?.trim() || null;

  childLogger.info(
    { doctorsTs, institutionsTs },
    'Successfully fetched timestamps',
  );
  return [undefined, { doctorsTs, institutionsTs }];
}
