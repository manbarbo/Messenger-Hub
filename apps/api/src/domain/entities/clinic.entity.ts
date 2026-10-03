export interface Clinic {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly timezone: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
