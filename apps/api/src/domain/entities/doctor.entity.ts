export interface Doctor {
  readonly id: string;
  readonly clinicId: string;
  readonly name: string;
  readonly specialty: string;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
