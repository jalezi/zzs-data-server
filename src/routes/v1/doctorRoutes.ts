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
import type { ParseResult } from '../../utils/fileHelper';
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

type MergeData = z.infer<typeof doctorsRawSchema> & {
  institution: z.infer<typeof institutionsRawSchema> | null;
};

type CachedData = {
  timestamps: Timestamps;
  meta: {
    cacheHit: boolean;
    doctorsCount: number;
    institutionsCount: number;
    mergedCount: number;
    executionTime: string;
  };
  data: MergeData[];
};

// Global caches
const mergedDataCache = new Map<string, CachedData>();

// Utility Functions

// Fetch and parse a file
async function fetchAndParse<T>(
  url: string,
  schema: z.ZodSchema<T>,
): Promise<ReturnCatchErrorType<ParseResult<T>>> {
  const [fetchError, rawContent] = await fetchTextFile(url);
  if (fetchError || !rawContent) return [fetchError || new Error('Empty file')];

  const [parseError, parsedData] = await parseRawContent(
    rawContent,
    'csv',
    schema,
  );
  if (parseError || !parsedData)
    return [parseError || new Error('Parsing error')];

  return [undefined, parsedData];
}

type Timestamps = {
  doctorsTs: string | null;
  institutionsTs: string | null;
};

// Handle timestamps
async function fetchTimestamps(): Promise<ReturnCatchErrorType<Timestamps>> {
  const [doctorsTsResult, institutionsTsResult] = await Promise.all([
    fetchTextFile(DOCTORS_TS.href),
    fetchTextFile(INSTITUTIONS_TS.href),
  ]);

  const [doctorsTsError, doctorsTsRaw] = doctorsTsResult;
  const [institutionsTsError, institutionsTsRaw] = institutionsTsResult;

  const doctorsTs = doctorsTsRaw?.replace('\n', '') || null;
  const institutionsTs = institutionsTsRaw?.replace('\n', '') || null;

  if (doctorsTsError || institutionsTsError) {
    return [
      doctorsTsError ||
        institutionsTsError ||
        new Error('Failed to fetch timestamps'),
    ];
  }

  return [undefined, { doctorsTs, institutionsTs }];
}

// Main Route
router.get('/', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  // Fetch timestamps
  const [timestampError, ts] = await fetchTimestamps();
  if (timestampError || !ts?.doctorsTs || !ts?.institutionsTs) {
    logger.error('Failed to fetch timestamps', { timestampError });
    res.status(500).json({
      success: false,
      timestamps: ts,
      mergeData: [],
      meta: {
        cacheHit: false,
        doctorsCount: 0,
        institutionsCount: 0,
        mergedCount: 0,
        executionTime: `${Date.now() - startTime}ms`,
      },
    });
    return;
  }

  const cacheKey = `${ts.doctorsTs}-${ts.institutionsTs}`;
  const cacheHit = mergedDataCache.has(cacheKey);
  if (cacheHit) {
    const cachedData = mergedDataCache.get(cacheKey) as CachedData; // ts does not recognize cacheHit
    res.json({ success: true, ...cachedData });
    return;
  }

  // Fetch and parse doctors and institutions
  const [doctorsError, doctors] = await fetchAndParse(
    DOCTORS.href,
    doctorsRawSchema,
  );
  const [institutionsError, institutions] = await fetchAndParse(
    INSTITUTIONS.href,
    institutionsRawSchema,
  );

  if (doctorsError || institutionsError || !doctors || !institutions) {
    logger.error('Failed to fetch or parse data files', {
      doctorsError,
      institutionsError,
    });
    res.status(500).json({
      success: false,
      timestamps: ts,
      mergeData: [],
      meta: {
        cacheHit: false,
        doctorsCount: 0,
        institutionsCount: 0,
        mergedCount: 0,
        executionTime: `${Date.now() - startTime}ms`,
      },
    });
    return;
  }

  // Merge doctors with institutions
  const institutionsMap = new Map(
    institutions.data.map((inst) => [inst.id_inst, inst]),
  );

  const mergedData = doctors.data.map((doctor) => ({
    ...doctor,
    institution: institutionsMap.get(doctor.id_inst) || null,
  }));

  const responseData: CachedData = {
    timestamps: ts,
    data: mergedData,
    meta: {
      cacheHit: false,
      doctorsCount: doctors.data.length,
      institutionsCount: institutions.data.length,
      mergedCount: mergedData.length,
      executionTime: `${Date.now() - startTime}ms`,
    },
  };

  mergedDataCache.clear(); // we only need the latest data
  mergedDataCache.set(cacheKey, responseData);

  res.json({ success: true, ...responseData });
});

export default router;
