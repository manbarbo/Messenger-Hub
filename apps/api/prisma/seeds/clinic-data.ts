import type { SeedClinicInput, SeedDoctorInput } from './types';

export const SEED_CLINICS: SeedClinicInput[] = [
  {
    name: 'Clínica Norte',
    address: 'Calle 10 #15-20, Cali',
    phone: '+5725551234',
    timezone: 'America/Bogota',
  },
  {
    name: 'Clínica Sur',
    address: 'Carrera 30 #45-67, Bogotá',
    phone: '+5715559876',
    timezone: 'America/Bogota',
  },
];

export const SEED_DOCTORS: SeedDoctorInput[] = [
  { name: 'Dr. García', specialty: 'Dermatología', clinicName: 'Clínica Norte' },
  { name: 'Dra. López', specialty: 'Dermatología', clinicName: 'Clínica Norte' },
  { name: 'Dr. Martínez', specialty: 'Cardiología', clinicName: 'Clínica Norte' },
  { name: 'Dra. Ramírez', specialty: 'Medicina General', clinicName: 'Clínica Norte' },
  { name: 'Dra. Rodríguez', specialty: 'Medicina General', clinicName: 'Clínica Sur' },
  { name: 'Dr. Herrera', specialty: 'Pediatría', clinicName: 'Clínica Sur' },
  { name: 'Dra. Castro', specialty: 'Cardiología', clinicName: 'Clínica Sur' },
  { name: 'Dr. Morales', specialty: 'Dermatología', clinicName: 'Clínica Sur' },
];
