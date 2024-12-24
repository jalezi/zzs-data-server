import { logger } from '../../../utils/logger';
import type { CachedData, Institution } from './schemas/doctorRoutes';

// Cache Expiry with Typed Key Handling
const cacheExpiry = new Map<string, number>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL
const MAX_CACHE_SIZE = 100;

export function setCacheWithTTL<K extends string | number | symbol, V>(
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

export function isCachedData(data: unknown): data is CachedData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'timestamps' in data &&
    'meta' in data &&
    'data' in data
  );
}

export function getCacheWithTTL<K extends string | number | symbol, V>(
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

let cachedInstitutionsMap: Map<string, Institution> | null = null;
let cachedInstitutionsTs: string | null = null;

export function getInstitutionsMap(
  institutions: Institution[],
  institutionsTs: string,
): Map<string, Institution> {
  if (cachedInstitutionsMap && cachedInstitutionsTs === institutionsTs) {
    return cachedInstitutionsMap;
  }

  cachedInstitutionsMap = new Map(
    institutions.map((inst) => [inst.id_inst, inst]),
  );
  cachedInstitutionsTs = institutionsTs;
  return cachedInstitutionsMap;
}
