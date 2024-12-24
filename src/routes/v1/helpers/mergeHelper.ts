import { getInstitutionsMap } from './cacheUtils';
import type { Doctor, Institution, MergeData } from './schemas/doctorRoutes';

export function mergeDoctorsAndInstitutions(
  doctors: Doctor[],
  institutions: Institution[],
  institutionsTs: string,
): MergeData[] {
  const institutionsMap = getInstitutionsMap(institutions, institutionsTs);
  return doctors.map((doctor) => ({
    ...doctor,
    institution: institutionsMap.get(doctor.id_inst) || null,
  }));
}
