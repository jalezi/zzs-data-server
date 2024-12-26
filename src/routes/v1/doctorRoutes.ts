import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
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
import { sendSuccess } from './helpers/responseUtils';
import {
  type CachedData,
  type DoctorRawOutput,
  type InstitutionRawOutput,
  doctorsRawSchema,
  institutionsRawSchema,
} from './helpers/schemas/doctorRoutes';

const childLogger = logger.child({
  name: 'doctorRoutes',
});
const router = Router();

// Caches
const mergedDataCache = new Map<string, CachedData>();
const doctorsCache = new Map<string, DoctorRawOutput[]>();
const institutionsCache = new Map<string, InstitutionRawOutput[]>();

// Main Route
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const startTime = Date.now();
    const ts = await fetchTimestamps();

    const cacheKey = `${ts.doctorsTs}-${ts.institutionsTs}`;
    const cachedData = getCacheWithTTL(mergedDataCache, cacheKey);

    if (cachedData && isCachedData(cachedData)) {
      childLogger.info({ cacheKey }, 'Serving merged data from cache');
      sendSuccess(
        res,
        cachedData.data,
        { ...cachedData.meta, cacheHit: true },
        startTime,
      );
      return;
    }

    if (cachedData && !isCachedData(cachedData)) {
      childLogger.warn(
        { cacheKey },
        'Invalid cached data format, ignoring cache, deleting entry',
      );
      mergedDataCache.delete(cacheKey);
    }

    const [doctors, institutinons] = await Promise.all([
      fetchAndParseWithCache(
        DOCTORS.href,
        doctorsRawSchema,
        doctorsCache,
        ts.doctorsTs,
      ),
      fetchAndParseWithCache(
        INSTITUTIONS.href,
        institutionsRawSchema,
        institutionsCache,
        ts.institutionsTs,
      ),
    ]);

    const mergedData = mergeDoctorsAndInstitutions(
      doctors,
      institutinons,
      ts.institutionsTs,
    );

    const responseData: CachedData = {
      data: mergedData,
      meta: {
        timestamps: ts,
        doctorsCount: doctors.length,
        institutionsCount: institutinons.length,
        mergedCount: mergedData.length,
        executionTime: calculateExecutionTime(startTime),
      },
    };

    setCacheWithTTL(mergedDataCache, cacheKey, responseData);
    childLogger.info(
      responseData.meta,
      'Successfully merged and cached new data',
    );
    sendSuccess(res, responseData.data, responseData.meta, startTime);
  } catch (err) {
    childLogger.error(err);
    next(err);
  }
});

export default router;
