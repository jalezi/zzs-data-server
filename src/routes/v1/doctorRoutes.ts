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
import {
  type CachedData,
  type Doctor,
  type Institution,
  type Timestamps,
  doctorsRawSchema,
  institutionsRawSchema,
} from './helpers/schemas/doctorRoutes';

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
