import type { ZodSchema } from 'zod';
import { DOCTORS_TS, INSTITUTIONS_TS } from '../../../constants/doctors';
import { fetchTextFile } from '../../../utils/fetchTextFile';
import { parseRawContent } from '../../../utils/fileHelper';
import { createChildLogger, isNumber } from '../../../utils/helpers';
import type { ReturnType } from '../../../utils/types';
import { getCacheWithTTL, setCacheWithTTL } from './cacheUtils';
import type { Timestamps } from './schemas/doctorRoutes';

const childLogger = createChildLogger('fetchHelpers');

// Utility: Fetch and Parse with Cache
export async function fetchAndParseWithCache<T>(
  url: string,
  schema: ZodSchema<T>,
  cache: Map<string, T[]>,
  timestamp: number,
): Promise<ReturnType<T[]>> {
  const cachedData = getCacheWithTTL(cache, timestamp.toString());
  if (cachedData) {
    childLogger.info({ timestamp, url }, 'Serving data from cache');
    return [undefined, cachedData];
  }

  const [fetchError, rawContent] = await fetchTextFile(url);
  if (fetchError) {
    childLogger.error(
      { url, error: fetchError },
      'Failed to fetch raw content',
    );
    return [fetchError];
  }

  if (!rawContent) {
    const emptyFileError = new Error('Empty file');
    childLogger.error({ url, error: emptyFileError }, emptyFileError.message);
    return [emptyFileError];
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
    return [parseError];
  }

  const { data } = parsedData;
  setCacheWithTTL(cache, timestamp.toString(), data);

  return [undefined, data];
}

const createTimestampError = (
  doctorsError?: Error,
  institutionsError?: Error,
): Error | undefined => {
  if (doctorsError && institutionsError) {
    return new Error('Failed to fetch timestamps', {
      cause: [doctorsError, institutionsError],
    });
  }
  if (doctorsError) {
    return new Error('Failed to fetch doctors timestamp', {
      cause: doctorsError,
    });
  }
  if (institutionsError) {
    return new Error('Failed to fetch institutions timestamp', {
      cause: institutionsError,
    });
  }
  return undefined;
};

// Utility: Fetch Timestamps
export async function fetchTimestamps(): Promise<ReturnType<Timestamps>> {
  const [doctorsTsResult, institutionsTsResult] = await Promise.all([
    fetchTextFile(DOCTORS_TS.href),
    fetchTextFile(INSTITUTIONS_TS.href),
  ]);

  const [doctorsTsError, doctorsTsRaw] = doctorsTsResult;
  const [institutionsTsError, institutionsTsRaw] = institutionsTsResult;

  const error = createTimestampError(doctorsTsError, institutionsTsError);

  if (error) {
    childLogger.error({ error }, error.message);
    return [error];
  }

  const doctorsTs = doctorsTsRaw
    ? Number(doctorsTsRaw.replace('\n', ''))
    : null;
  const institutionsTs = institutionsTsRaw
    ? Number(institutionsTsRaw.replace('\n', ''))
    : null;

  if (!isNumber(doctorsTs) || !isNumber(institutionsTs)) {
    const formatError = new Error('Invalid timestamp format');
    childLogger.error(
      {
        formatError,
        raw: { doctorsTsRaw, institutionsTsRaw },
        ts: { doctorsTs, institutionsTs },
      },
      formatError.message,
    );
    return [formatError];
  }

  childLogger.info(
    { doctorsTs, institutionsTs },
    'Successfully fetched timestamps',
  );
  return [undefined, { doctorsTs, institutionsTs }];
}
