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
export function mergeDoctorsAndInstitutions(
  doctors: DoctorRawInput[],
  institutions: InstitutionRawInput[],
  institutionsTs: number,
): MergeData[] {
  const institutionsMap = getInstitutionsMap(institutions, institutionsTs);
  return doctors.map((doctor) => {
    const institution = institutionsMap.get(doctor.id_inst);
    const parsedInstitution = institutionsRawSchema.parse(institution);
    const parsedDoctor = doctorsRawSchema.parse(doctor);
    return doctorsMergedSchema.parse({
      doctor: parsedDoctor,
      institution: parsedInstitution,
    });
  });
}
