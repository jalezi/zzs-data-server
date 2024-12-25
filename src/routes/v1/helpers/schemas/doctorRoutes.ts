import { z } from 'zod';

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
    const address = {
      street: doctor.address ? doctor.address : institution.address,
      city: doctor.city ? doctor.city : institution.city,
      municipality: doctor.municipality
        ? doctor.municipality
        : institution.municipality,
      municipalityPart: doctor.municipalityPart
        ? doctor.municipalityPart
        : institution.municipalityPart,
      post: doctor.post ? doctor.post : institution.post,
    };

    const contact = {
      phone: transformCommaSeparatedValues(doctor.phone),
      email: transformCommaSeparatedValues(doctor.email),
      website: transformCommaSeparatedValues(doctor.website),
    };

    return {
      doctor: doctor.doctor,
      institution: institution.name,
      id_inst: doctor.id_inst,
      type: doctor.type,
      data: {
        accepts: doctor.accepts_overide ?? doctor.accepts,
        availability: doctor.availability_overide ?? doctor.availability,
        load: doctor.load,
        note: doctor.note_overide,
        date: doctor.date_overide,
        loadStyle:
          doctor.type.startsWith('den') || doctor.type.startsWith('gyn')
            ? 'percentage'
            : 'decimal',
      },
      location,
      address,
      contact,
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
