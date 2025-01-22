import redisClient from '../../../services/redisClient';
import { logger } from '../../../utils/logger';
import {
  type CachedData,
  type InstitutionRawInput,
  type InstitutionRawOutput,
  institutionsRawSchema,
} from './schemas/doctorRoutes';

const childLogger = logger.child({ name: 'cacheUtils' });

const CACHE_TTL_SECONDS = 600; // 10 minutes TTL

export async function setCacheWithTTL<V>(key: string, value: V): Promise<void> {
  try {
    const valueString = JSON.stringify(value);
    await redisClient.set(key, valueString, 'EX', CACHE_TTL_SECONDS);
  } catch (error) {
    childLogger.error({ key, error }, 'Failed to set cache in Redis');
    throw error; // Propagate error
  }
}

export function isCachedData(data: unknown): data is CachedData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'meta' in data &&
    'data' in data
  );
}

export async function getCacheWithTTL<V>(key: string): Promise<V | undefined> {
  try {
    const cachedValue = await redisClient.get(key);
    logger.debug({ key }, 'Got cache from Redis');
    if (!cachedValue) {
      return undefined;
    }
    return JSON.parse(cachedValue) as V;
  } catch (error) {
    childLogger.error({ key, error }, 'Failed to get cache from Redis');
    throw error; // Propagate error
  }
}

export async function getInstitutionsMap(
  institutions: InstitutionRawInput[],
  institutionsTs: number,
): Promise<Map<string, InstitutionRawOutput>> {
  const cacheKey = `institutions-map-${institutionsTs}`;
  const cachedData =
    await getCacheWithTTL<Map<string, InstitutionRawOutput>>(cacheKey);

  if (cachedData && cachedData instanceof Map) {
    return cachedData;
  }

  const institutionsMap = new Map(
    institutions.map((inst) => [
      inst.id_inst,
      institutionsRawSchema.parse(inst),
    ]),
  );

  await setCacheWithTTL(cacheKey, institutionsMap);
  return institutionsMap;
}
