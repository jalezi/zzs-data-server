import { Router } from 'express';
import type { Request, Response } from 'express';
import { DOCTORS, INSTITUTIONS } from '../../constants/doctors';
import { logger } from '../../utils/logger';
import {
  getCacheWithTTL,
  isCachedData,
  setCacheWithTTL,
} from './helpers/cacheUtils';
import {
  fetchAndParseWithCache,
  fetchTimestamps,
} from './helpers/fetchHelpers';
import { mergeDoctorsAndInstitutions } from './helpers/mergeHelper';
import {
  sendErrorResponse,
  sendSuccessResponse,
} from './helpers/responseUtils';
import {
  type CachedData,
  type Doctor,
  type Institution,
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
      mergedDataCache.delete(cacheKey);
    } else {
      childLogger.info(
        {
          cacheKey,
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
      cacheHit: false,
      executionTime: calculateExecutionTime(startTime),
    },
  );
});

export default router;
