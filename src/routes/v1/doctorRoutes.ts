import { Router } from 'express';
import type { Request, Response } from 'express';
import { DOCTORS, INSTITUTIONS } from '../../constants/doctors';
import { calculateExecutionTime } from '../../utils/helpers';
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
import { sendError, sendSuccess } from './helpers/responseUtils';
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

// Main Route
router.get('/', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  const [timestampError, ts] = await fetchTimestamps();
  if (timestampError || !ts?.doctorsTs || !ts?.institutionsTs) {
    childLogger.error({ error: timestampError }, 'Failed to fetch timestamps');
    sendError(
      res,
      500,
      'Failed to fetch timestamps',
      { timestamps: ts },
      startTime,
    );
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
      childLogger.info({ cacheKey }, 'Serving merged data from cache');
      sendSuccess(
        res,
        cachedData.data,
        { ...cachedData.meta, cacheHit: true },
        startTime,
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
    sendError(
      res,
      500,
      'Failed to fetch or parse data',
      {
        timestamps: ts,
        cacheHit: false,
      },
      startTime,
    );
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

  sendSuccess(
    res,
    responseData.data,
    { ...responseData.meta, cacheHit: false },
    startTime,
  );
});

export default router;
