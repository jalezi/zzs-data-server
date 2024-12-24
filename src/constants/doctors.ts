const ORIGIN = 'https://raw.githubusercontent.com' as const;
const BASE_URL = new URL(ORIGIN);

const BASE_PATH = '/sledilnik/zdravniki-data/main/csv' as const;

const INSTITUTIONS_CSV_PATH = `${BASE_PATH}/institutions.csv` as const;
const DOCTORS_CSV_PATH = `${BASE_PATH}/doctors.csv` as const;

const DOCTORS_TS_PATH = `${BASE_PATH}/doctors.csv.timestamp` as const;
const INSTITUTIONS_TS_PATH = `${BASE_PATH}/institutions.csv.timestamp` as const;

export const INSTITUTIONS = new URL(INSTITUTIONS_CSV_PATH, BASE_URL);
export const DOCTORS = new URL(DOCTORS_CSV_PATH, BASE_URL);
export const DOCTORS_TS = new URL(DOCTORS_TS_PATH, BASE_URL);
export const INSTITUTIONS_TS = new URL(INSTITUTIONS_TS_PATH, BASE_URL);
