import { logger } from '../../../utils/logger';
import { getInstitutionsMap } from './cacheUtils';

import {
  doctorsMergedSchema,
  doctorsRawSchema,
  institutionsRawSchema,
} from './schemas/doctorRoutes';
import type {
  DoctorRawInput,
  InstitutionRawInput,
  MergeData,
} from './schemas/doctorRoutes';

const childLogger = logger.child({ name: 'mergeHelper' });

const unknownInstitution = {
  id_inst: '',
  zzzsSt: '',
  name: '',
  unit: '',
  phone: '',
  website: '',
  address: '',
  city: '',
  municipality: '',
  municipalityPart: '',
  post: '',
  lat: '',
  lon: '',
};
export async function mergeDoctorsAndInstitutions(
  doctors: DoctorRawInput[],
  institutions: InstitutionRawInput[],
  institutionsTs: number,
): Promise<MergeData[]> {
  childLogger.info('Merging doctors and institutions');
  const institutionsMap = await getInstitutionsMap(
    institutions,
    institutionsTs,
  );
  return doctors.map((doctor) => {
    const institution =
      institutionsMap.get(doctor.id_inst) ?? unknownInstitution;
    const parsedInstitution = institutionsRawSchema.parse(institution);
    const parsedDoctor = doctorsRawSchema.parse(doctor);
    return doctorsMergedSchema.parse({
      doctor: parsedDoctor,
      institution: parsedInstitution,
    });
  });
}
