import { z } from 'zod';

// Schemas
export const doctorsRawSchema = z.object({
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

export const institutionsRawSchema = z.object({
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

// Types
export type Doctor = z.infer<typeof doctorsRawSchema>;
export type Institution = z.infer<typeof institutionsRawSchema>;

export type MergeData = z.infer<typeof doctorsRawSchema> & {
  institution: z.infer<typeof institutionsRawSchema> | null;
};

export type Timestamps = {
  doctorsTs: string | null;
  institutionsTs: string | null;
};

export type Meta = {
  cacheHit: boolean;
  doctorsCount: number;
  institutionsCount: number;
  mergedCount: number;
  executionTime: string;
};

export type CachedData = {
  timestamps: Timestamps;
  meta: Meta;
  data: MergeData[];
};
