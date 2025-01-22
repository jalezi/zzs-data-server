import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import { z } from 'zod';

import { DOCTORS, INSTITUTIONS } from '../../constants/doctors';
import { calculateExecutionTime, normalizeString } from '../../utils/helpers';
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
  doctorsRawSchema,
  institutionsRawSchema,
} from './helpers/schemas/doctorRoutes';
import type {
  CachedData,
  MergeData,
  Timestamps,
} from './helpers/schemas/doctorRoutes';

const childLogger = logger.child({
  name: 'doctorRoutes',
});
const router = Router();

const mergedDataCacheKey = (ts: Timestamps): string =>
  `merged-data-${ts.doctorsTs}-${ts.institutionsTs}`;

// Main Route
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const startTime = Date.now();
    const ts = await fetchTimestamps();

    const cacheKey = mergedDataCacheKey(ts);

    const cachedData = await getCacheWithTTL<CachedData>(cacheKey);

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
        'Invalid cached data format, ignoring cache',
      );
    }

    const [doctors, institutinons] = await Promise.all([
      fetchAndParseWithCache(
        DOCTORS.href,
        doctorsRawSchema,
        ts.doctorsTs.toString(),
      ),
      fetchAndParseWithCache(
        INSTITUTIONS.href,
        institutionsRawSchema,
        ts.institutionsTs.toString(),
      ),
    ]);

    const mergedData = await mergeDoctorsAndInstitutions(
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

    await setCacheWithTTL(cacheKey, responseData);
    childLogger.info(
      responseData.meta,
      'Successfully merged and cached new data',
    );
    sendSuccess(
      res,
      responseData.data,
      { ...responseData.meta, cacheHit: false },
      startTime,
    );
  } catch (err) {
    childLogger.error(err);
    next(err);
  }
});

// Search Route

const searchQuerySchema = z.object({
  type: z.string().nonempty("'type' is required"),
  q: z.string().default(''),
});

type SearchQuery = z.infer<typeof searchQuerySchema>;

function validateSearch(req: Request, _res: Response, next: NextFunction) {
  try {
    req.query = searchQuerySchema.parse(req.query);
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new Error(err.flatten().formErrors.join(', ')));
    }
    if (err instanceof Error) {
      next(err);
    }
    next(new Error('Failed to validate search query', { cause: err }));
  }
}

function normalizeDataForFuse(data: MergeData[]): MergeData[] {
  return data.map((entry) => ({
    ...entry,
    doctor: normalizeString(entry.fullName),
    institution: {
      ...entry.institution,
      name: normalizeString(entry.institution.name),
      unit: normalizeString(entry.institution.unit),
    },
    address: {
      ...entry.address,
      street: normalizeString(entry.address.street),
      city: normalizeString(entry.address.city),
      municipality: normalizeString(entry.address.municipality),
      municipalityPart: normalizeString(entry.address.municipalityPart),
      postalName: normalizeString(entry.address.postalName),
    },
  }));
}

type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends object
    ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
    : `${K}`;
}[keyof T & string];

type FuseKey = NestedKeyOf<MergeData>;
function initializeFuse(data: MergeData[]): Fuse<MergeData> {
  const fuseOptions: IFuseOptions<MergeData> = {
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'fullName', weight: 1 },
      { name: 'institution.name', weight: 0.7 },
      { name: 'institution.unit', weight: 0.3 },
      { name: 'address.street', weight: 0.5 },
      { name: 'address.city', weight: 0.5 },
      { name: 'address.municipality', weight: 0.5 },
      { name: 'address.municipalityPart', weight: 0.5 },
      { name: 'address.postalCode', weight: 0.5 },
      { name: 'address.postalName', weight: 0.5 },
    ] satisfies { name: FuseKey; weight: number }[],
    threshold: 0.3, // Adjust for sensitivity
  };

  return new Fuse(data, fuseOptions);
}

async function fetchOrUseCache(
  baseUrl: string,
): Promise<CachedData & { meta: { cacheHit: boolean } }> {
  const ts = await fetchTimestamps();
  const cacheKey = mergedDataCacheKey(ts);
  const cachedData = await getCacheWithTTL<CachedData>(cacheKey);

  if (!cachedData || !isCachedData(cachedData)) {
    childLogger.warn(
      { cacheKey },
      'No cached data found. Fetching from home route...',
    );

    const response = await fetch(`${baseUrl}/api/v1/doctors`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch data from home route: ${response.statusText}`,
      );
    }

    const homeRouteData = await response.json();
    return {
      data: homeRouteData.data,
      meta: { ...homeRouteData.meta, cacheHit: false },
    };
  }

  return Object.assign(cachedData, { meta: { cacheHit: true } });
}

router.get(
  '/search',
  validateSearch,
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    try {
      const { type, q } = req.query as SearchQuery; // because we are using validateSearch middleware and we know the query is valid

      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;

      const cachedData = await fetchOrUseCache(baseUrl);

      let filteredData = cachedData.data;
      filteredData = filteredData.filter((entry) => entry.type === type);
      if (filteredData.length === 0) {
        throw new Error(`No results found for type '${type}'`);
      }

      if (q === '') {
        sendSuccess(
          res,
          filteredData,
          { length: filteredData.length },
          startTime,
        );
        return;
      }

      const normalizedQuery = normalizeString(q);
      const normalizedData = normalizeDataForFuse(filteredData);

      const fuse = initializeFuse(normalizedData);
      const results = fuse.search(normalizedQuery);

      console.log(results);

      if (results.length === 0) {
        res.status(404).json({ error: `No results found for query '${q}'` });
        return;
      }

      const resultsData = results.map((result) => {
        const { item, matches, score } = result;
        const notNormalizedItem = filteredData.find(
          (entry) => entry.id === item.id,
        );
        return {
          item: notNormalizedItem,
          matches,
          score,
        };
      });

      sendSuccess(
        res,
        resultsData,
        { length: resultsData.length, cacheHit: cachedData.meta.cacheHit },
        startTime,
      );
    } catch (err) {
      childLogger.error(err);
      next(err);
    }
  },
);

export default router;
