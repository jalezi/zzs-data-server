import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  DOCTORS,
  DOCTORS_TS,
  INSTITUTIONS,
  INSTITUTIONS_TS,
} from '../../constants/doctors';
import type { ReturnCatchErrorType } from '../../utils/catchError';
import { fetchTextFile } from '../../utils/fetchTextFile';
import { parseRawContent } from '../../utils/fileHelper';
import { logger } from '../../utils/logger';

const router = Router();

// Define schemas
const doctorsRawSchema = z.object({
  accepts: z.string(),
  availability: z.coerce.number(),
  city: z.string(),
  doctor: z.string(),
  id_inst: z.string(),
  load: z.coerce.number(),
  type: z.string(),
  accepts_overide: z.string().nullish(),
  address: z.string().nullish(),
  availability_overide: z.string().nullish(),
  date_overide: z.string().nullish(),
  email: z.string().nullish(),
  lat: z.string().nullish(),
  lon: z.string().nullish(),
  municipality: z.string().nullish(),
  note_overide: z.string().nullish(),
  phone: z.string().nullish(),
  post: z.string().nullish(),
  website: z.string().nullish(),
});

const institutionsRawSchema = z.object({
  id_inst: z.string(),
  zzzsSt: z.string(),
  name: z.string(),
  unit: z.string(),
  address: z.string(),
  post: z.string(),
  city: z.string(),
  municipality: z.string(),
  municipalityPart: z.string(),
  phone: z.string(),
  website: z.string(),
  lat: z.string().nullish(),
  lon: z.string().nullish(),
});

type Doctor = z.infer<typeof doctorsRawSchema>;
type Institution = z.infer<typeof institutionsRawSchema>;

type MergeData = z.infer<typeof doctorsRawSchema> & {
  institution: z.infer<typeof institutionsRawSchema> | null;
};

type Timestamps = {
  doctorsTs: string | null;
  institutionsTs: string | null;
};

type Meta = {
  cacheHit: boolean;
  doctorsCount: number;
  institutionsCount: number;
  mergedCount: number;
  executionTime: string;
};

type CachedData = {
  timestamps: Timestamps;
  meta: Meta;
  data: MergeData[];
};

// Caches
const mergedDataCache = new Map<string, CachedData>();
const doctorsCache = new Map<string, Doctor[]>();
const institutionsCache = new Map<string, Institution[]>();

const MAX_CACHE_SIZE = 100;

function calculateExecutionTime(startTime: number): string {
  return `${Date.now() - startTime}ms`;
}

// Cache Expiry with Typed Key Handling
const cacheExpiry = new Map<string, number>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL

function setCacheWithTTL<K extends string | number | symbol, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
): void {
  cache.set(key, value);
  cacheExpiry.set(String(key), Date.now() + CACHE_TTL_MS);

  // Enforce size limit
  if (cache.size > MAX_CACHE_SIZE) {
    const oldestKey = [...cache.keys()][0];
    cache.delete(oldestKey);
    cacheExpiry.delete(String(oldestKey));
    logger.info({ oldestKey }, 'Evicted oldest cache entry due to size limit');
  }
}

function isCachedData(data: unknown): data is CachedData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'timestamps' in data &&
    'meta' in data &&
    'data' in data
  );
}

function getCacheWithTTL<K extends string | number | symbol, V>(
  cache: Map<K, V>,
  key: K,
): V | undefined {
  const expiry = cacheExpiry.get(String(key));
  if (expiry && expiry < Date.now()) {
    cache.delete(key);
    cacheExpiry.delete(String(key));
    logger.info({ key }, 'Evicted expired cache entry');
    return undefined;
  }

  const cachedData = cache.get(key);
  if (!cachedData || !isCachedData(cachedData)) {
    logger.warn({ key }, 'Cache contains invalid data');
    return undefined;
  }

  return cachedData;
}

// Utility: Fetch and Parse with Cache
async function fetchAndParseWithCache<T>(
  url: string,
  schema: z.ZodSchema<T>,
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

// Utility: Fetch Timestamps
async function fetchTimestamps(): Promise<ReturnCatchErrorType<Timestamps>> {
  const [doctorsTsResult, institutionsTsResult] = await Promise.all([
    fetchTextFile(DOCTORS_TS.href),
    fetchTextFile(INSTITUTIONS_TS.href),
  ]);

  const [doctorsTsError, doctorsTsRaw] = doctorsTsResult;
  const [institutionsTsError, institutionsTsRaw] = institutionsTsResult;

  if (doctorsTsError || institutionsTsError) {
    logger.error(
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

  logger.info({ doctorsTs, institutionsTs }, 'Successfully fetched timestamps');
  return [undefined, { doctorsTs, institutionsTs }];
}

// Main Route
router.get('/', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  const [timestampError, ts] = await fetchTimestamps();
  if (timestampError || !ts?.doctorsTs || !ts?.institutionsTs) {
    logger.error({ error: timestampError }, 'Failed to fetch timestamps');

    res.status(500).json({
      success: false,
      error: 'Failed to fetch timestamps',
      timestamps: ts || {},
      mergeData: [],
      meta: {
        cacheHit: false,
        doctorsCount: 0,
        institutionsCount: 0,
        mergedCount: 0,
        executionTime: calculateExecutionTime(startTime),
      },
    });
    return;
  }

  const cacheKey = `${ts.doctorsTs}-${ts.institutionsTs}`;
  const cachedData = getCacheWithTTL(mergedDataCache, cacheKey);
  if (cachedData) {
    if (!isCachedData(cachedData)) {
      logger.warn({ cacheKey }, 'Invalid cached data format, ignoring cache');
    } else {
      logger.info(
        {
          cacheKey,
          timestamps: ts,
          doctorsCount: cachedData.meta.doctorsCount,
          institutionsCount: cachedData.meta.institutionsCount,
          mergedCount: cachedData.meta.mergedCount,
          executionTime: calculateExecutionTime(startTime),
        },
        'Serving merged data from cache',
      );

      res.json({
        success: true,
        ...cachedData,
        meta: {
          ...cachedData.meta,
          executionTime: calculateExecutionTime(startTime),
        },
      });
      return;
    }
  }

  const [doctorsError, doctors] = await fetchAndParseWithCache(
    DOCTORS.href,
    doctorsRawSchema,
    doctorsCache,
    ts.doctorsTs,
  );

  const [institutionsError, institutions] = await fetchAndParseWithCache(
    INSTITUTIONS.href,
    institutionsRawSchema,
    institutionsCache,
    ts.institutionsTs,
  );

  if (doctorsError || institutionsError || !doctors || !institutions) {
    logger.error(
      {
        doctorsError,
        institutionsError,
        doctorsUrl: DOCTORS.href,
        institutionsUrl: INSTITUTIONS.href,
      },
      'Failed to fetch or parse doctors or institutions',
    );

    res.status(500).json({
      success: false,
      error: 'Failed to fetch or parse data',
      timestamps: ts,
      mergeData: [],
      meta: {
        cacheHit: false,
        doctorsCount: doctors?.length || 0,
        institutionsCount: institutions?.length || 0,
        mergedCount: 0,
        executionTime: calculateExecutionTime(startTime),
      },
    });
    return;
  }

  const institutionsMap = new Map(
    institutions.map((inst) => [inst.id_inst, inst]),
  );

  const mergedData = doctors.map((doctor) => ({
    ...doctor,
    institution: institutionsMap.get(doctor.id_inst) || null,
  }));

  const responseData: CachedData = {
    timestamps: ts,
    data: mergedData,
    meta: {
      cacheHit: false,
      doctorsCount: doctors.length,
      institutionsCount: institutions.length,
      mergedCount: mergedData.length,
      executionTime: calculateExecutionTime(startTime),
    },
  };

  logger.info(
    {
      cacheKey,
      timestamps: ts,
      doctorsCount: doctors.length,
      institutionsCount: institutions.length,
      mergedCount: mergedData.length,
      executionTime: calculateExecutionTime(startTime),
    },
    'Successfully merged and cached new data',
  );
  setCacheWithTTL(mergedDataCache, cacheKey, responseData);

  res.json({ success: true, ...responseData });
});

export default router;
