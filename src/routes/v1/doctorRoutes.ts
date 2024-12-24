import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  DOCTORS,
  DOCTORS_TS,
  INSTITUTIONS,
  INSTITUTIONS_TS,
} from '../../constants/doctors';
import type { ReturnCatchErrorType } from '../../utils/catchError';
import { fetchTextFile } from '../../utils/fetchTextFile';
import { logger } from '../../utils/logger';
import {
  getCacheWithTTL,
  isCachedData,
  setCacheWithTTL,
} from './helpers/cacheUtils';
import { fetchAndParseWithCache } from './helpers/fetchHelpers';
import { mergeDoctorsAndInstitutions } from './helpers/mergeHelper';
import {
  sendErrorResponse,
  sendSuccessResponse,
} from './helpers/responseUtils';
import {
  type CachedData,
  type Doctor,
  type Institution,
  type Timestamps,
  doctorsRawSchema,
  institutionsRawSchema,
} from './helpers/schemas/doctorRoutes';

const childLogger = logger.child({
  name: 'doctorRoutes',
});
const router = Router();

// Caches
const mergedDataCache = new Map<string, CachedData>();
const doctorsCache = new Map<string, Doctor[]>();
const institutionsCache = new Map<string, Institution[]>();

function calculateExecutionTime(startTime: number): string {
  return `${Date.now() - startTime}ms`;
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

// Main Route
router.get('/', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  const [timestampError, ts] = await fetchTimestamps();
  if (timestampError || !ts?.doctorsTs || !ts?.institutionsTs) {
    childLogger.error({ error: timestampError }, 'Failed to fetch timestamps');
    sendErrorResponse(res, 500, 'Failed to fetch timestamps', {
      timestamps: ts,
      cacheHit: false,
      executionTime: calculateExecutionTime(startTime),
    });
    return;
  }

  const cacheKey = `${ts.doctorsTs}-${ts.institutionsTs}`;
  const cachedData = getCacheWithTTL(mergedDataCache, cacheKey);
  childLogger.debug(
    { cacheKey, cachedData: !!cachedData },
    'Cached data exists',
  );
  if (cachedData) {
    if (!isCachedData(cachedData)) {
      childLogger.warn(
        { cacheKey },
        'Invalid cached data format, ignoring cache',
      );
    } else {
      childLogger.info(
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

      sendSuccessResponse(
        res,
        { data: cachedData.data },
        {
          ...cachedData.meta,
          cacheHit: true, // Override cacheHit to true
          executionTime: calculateExecutionTime(startTime),
        },
      );
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
    childLogger.error(
      {
        doctorsError,
        institutionsError,
        doctorsUrl: DOCTORS.href,
        institutionsUrl: INSTITUTIONS.href,
      },
      'Failed to fetch or parse doctors or institutions',
    );

    sendErrorResponse(res, 500, 'Failed to fetch or parse data', {
      timestamps: ts,
      cacheHit: false,
      executionTime: calculateExecutionTime(startTime),
    });
    return;
  }

  const mergedData = mergeDoctorsAndInstitutions(
    doctors,
    institutions,
    ts.institutionsTs,
  );

  const responseData: CachedData = {
    data: mergedData,
    meta: {
      timestamps: ts,
      cacheHit: false,
      doctorsCount: doctors.length,
      institutionsCount: institutions.length,
      mergedCount: mergedData.length,
      executionTime: calculateExecutionTime(startTime),
    },
  };

  childLogger.info(
    responseData.meta,
    'Successfully merged and cached new data',
  );
  setCacheWithTTL(mergedDataCache, cacheKey, responseData);

  sendSuccessResponse(
    res,
    { data: mergedData },
    {
      ...responseData.meta,
      executionTime: calculateExecutionTime(startTime),
    },
  );
});

export default router;
