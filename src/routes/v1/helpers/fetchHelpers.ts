import type { ZodSchema } from 'zod';
import { DOCTORS_TS, INSTITUTIONS_TS } from '../../../constants/doctors';
import { fetchTextFile } from '../../../utils/fetchTextFile';
import { parseRawContent } from '../../../utils/fileHelper';
import {
  calculateExecutionTime,
  createChildLogger,
  isNumber,
} from '../../../utils/helpers';
import { getCacheWithTTL, setCacheWithTTL } from './cacheUtils';
import type { Timestamps } from './schemas/doctorRoutes';

const childLogger = createChildLogger('fetchHelpers');

// Utility: Fetch and Parse with Cache
export async function fetchAndParseWithCache<T>(
  url: string,
  schema: ZodSchema<T>,
  cache: Map<string, T[]>,
  timestamp: number,
): Promise<T[]> {
  const cachedData = getCacheWithTTL(cache, timestamp.toString());
  if (cachedData) {
    childLogger.info({ timestamp, url }, 'Serving data from cache');
    return cachedData;
  }

  const rawContent = await fetchTextFile(url);

  if (!rawContent) {
    const emptyFileError = new Error('Empty file');
    childLogger.error({ url, error: emptyFileError }, emptyFileError.message);
    throw emptyFileError;
  }

  const [parseError, parsedData] = await parseRawContent(
    rawContent,
    'csv',
    schema,
  );

  if (parseError) {
    childLogger.error(
      { url, error: parseError },
      'Failed to parse raw content',
    );
    throw new Error('Failed to parse raw content', { cause: parseError });
  }

  const { data } = parsedData;
  setCacheWithTTL(cache, timestamp.toString(), data);

  return data;
}

// Utility: Fetch Timestamps
export async function fetchTimestamps(): Promise<Timestamps> {
  const startTime = Date.now();
  const [doctorsTsRaw, institutionsTsRaw] = await Promise.all([
    fetchTextFile(DOCTORS_TS.href),
    fetchTextFile(INSTITUTIONS_TS.href),
  ]);

  const doctorsTs = doctorsTsRaw
    ? Number(doctorsTsRaw.replace('\n', ''))
    : null;
  const institutionsTs = institutionsTsRaw
    ? Number(institutionsTsRaw.replace('\n', ''))
    : null;

  if (!isNumber(doctorsTs) || !isNumber(institutionsTs)) {
    throw new Error('Invalid timestamp format', {
      cause: { doctorsTs, institutionsTs },
    });
  }

  childLogger.info(
    {
      doctorsTs,
      institutionsTs,
      executionTime: calculateExecutionTime(startTime),
    },
    'Successfully fetched timestamps',
  );
  return { doctorsTs, institutionsTs };
}
