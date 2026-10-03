export class CreateAppointmentCommand {
  constructor(
    readonly clinicId: string,
    readonly doctorId: string,
    readonly slotId: string,
    readonly patientPhone: string,
    readonly patientName?: string,
  ) {}
}
