import crypto from 'node:crypto';
import { z } from 'zod';

function generateDoctorId(val: DoctorRawInput) {
  const { type, id_inst, doctor } = val; // Extract properties in order
  const dataString = `${type}|${id_inst}|${doctor}`; // Concatenate with delimiter
  return crypto.createHash('sha256').update(dataString).digest('hex'); // Generate hash
}

export const overideRawSchema = z.object({
  accepts_overide: z.string().nullish().default(null),
  availability_overide: z.string().nullish().default(null),
  date_overide: z.date().nullish().default(null),
  note_overide: z.string().nullish().default(null),
});

export const addressRawSchema = z.object({
  address: z.string(),
  city: z.string(),
  municipality: z.string(),
  municipalityPart: z.string(),
  post: z.string(),
});

export const locationRawSchema = z.object({
  lat: z.string().nullish().default(null),
  lon: z.string().nullish().default(null),
});

export const doctorsRawSchema = z
  .object({
    accepts: z.string(),
    availability: z.coerce.number(),
    doctor: z.string(),
    id_inst: z.coerce.string(),
    load: z.coerce.number(),
    type: z.string(),
    email: z.string(),
    phone: z.string(),
    website: z.string(),
  })
  .merge(overideRawSchema)
  .merge(addressRawSchema)
  .merge(locationRawSchema);

export const institutionsRawSchema = z
  .object({
    id_inst: z.coerce.string(),
    zzzsSt: z.string(),
    name: z.string(),
    unit: z.string(),
    phone: z.string(),
    website: z.string(),
  })
  .merge(addressRawSchema)
  .merge(locationRawSchema);

const transformCommaSeparatedValues = (v: string) =>
  v === '' ? null : v.split(',').map((x) => x.trim());

export const doctorsMergedSchema = z
  .object({
    doctor: doctorsRawSchema,
    institution: institutionsRawSchema,
  })
  .transform((data) => {
    const { doctor, institution } = data;

    // doctors location overides institution location
    const location = {
      lat: !doctor.lat ? Number(institution.lat) : Number(doctor.lat),
      lon: !doctor.lon ? Number(institution.lon) : Number(doctor.lon),
    };

    // doctors address overides institution address
    const post = doctor.post ? doctor.post : institution.post;
    const [postalCode, ...postalName] = post.split(' ');

    const address = {
      street: doctor.address ? doctor.address : institution.address,
      city: doctor.city ? doctor.city : institution.city,
      municipality: doctor.municipality
        ? doctor.municipality
        : institution.municipality,
      municipalityPart: doctor.municipalityPart
        ? doctor.municipalityPart
        : institution.municipalityPart,
      postalCode,
      postalName: postalName.join(' '),
    };

    const contact = {
      phone: transformCommaSeparatedValues(doctor.phone),
      email: transformCommaSeparatedValues(doctor.email),
      website: transformCommaSeparatedValues(doctor.website),
    };

    return {
      id: generateDoctorId(doctor),
      fullName: doctor.doctor,
      type: doctor.type,
      institution: {
        id: institution.id_inst,
        name: institution.name,
        unit: institution.unit,
        zzzsSt: institution.zzzsSt,
      },
      data: {
        accepts: doctor.accepts_overide ?? doctor.accepts,
        availability: doctor.availability_overide ?? doctor.availability,
        load: doctor.load,
        note: doctor.note_overide,
      },
      location,
      address,
      contact,
      meta: {
        dateOverride: doctor.date_overide,
        formatLoad:
          doctor.type.startsWith('den') || doctor.type.startsWith('gyn')
            ? 'percentage'
            : 'decimal',
        processedwAt: Date.now(),
        version: '1.0',
      },
    };
  });

// Types
export type DoctorRawInput = z.input<typeof doctorsRawSchema>;
export type DoctorRawOutput = z.output<typeof doctorsRawSchema>; // same as if used z.infer

export type InstitutionRawInput = z.input<typeof institutionsRawSchema>;
export type InstitutionRawOutput = z.output<typeof institutionsRawSchema>;

export type DoctorsMergedInput = z.input<typeof doctorsMergedSchema>;
export type DoctorsMergedOutput = z.output<typeof doctorsMergedSchema>;

export type MergeData = DoctorsMergedOutput;

export type Timestamps = {
  doctorsTs: number;
  institutionsTs: number;
};

export type Meta = {
  doctorsCount: number;
  institutionsCount: number;
  mergedCount: number;
  executionTime: string;
  timestamps: Timestamps;
};

export type CachedData = {
  meta: Meta;
  data: MergeData[];
};
