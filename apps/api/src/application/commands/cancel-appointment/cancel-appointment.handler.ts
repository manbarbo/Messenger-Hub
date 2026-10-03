import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { Appointment } from '@domain/entities/appointment.entity';
import { cancelAppointment } from '@domain/entities/appointment.entity';
import { AppointmentStatus } from '@domain/enums/appointment-status.enum';
import { AppointmentCancelledEvent } from '@domain/events/appointment-cancelled.event';
import { AppointmentNotFoundError, ValidationError } from '@domain/errors';
import {
  APPOINTMENT_REPOSITORY,
  SLOT_REPOSITORY,
  type AppointmentRepository,
  type SlotRepository,
} from '@domain/repositories';
import { EVENT_PUBLISHER, type EventPublisher } from '@domain/services';
import { CancelAppointmentCommand } from './cancel-appointment.command';

@CommandHandler(CancelAppointmentCommand)
@Injectable()
export class CancelAppointmentHandler implements ICommandHandler<CancelAppointmentCommand> {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(SLOT_REPOSITORY) private readonly slotRepository: SlotRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CancelAppointmentCommand): Promise<Appointment> {
    const existing = await this.appointmentRepository.findById(command.appointmentId);

    if (!existing) {
      throw new AppointmentNotFoundError(command.appointmentId);
    }

    if (existing.status !== AppointmentStatus.CONFIRMED) {
      throw new ValidationError('Only CONFIRMED appointments can be cancelled', [
        { field: 'status', message: `cannot cancel appointment in status ${existing.status}` },
      ]);
    }

    const cancelled = cancelAppointment(existing);

    const updated = await this.appointmentRepository.update(cancelled);
    await this.slotRepository.markAsAvailable(updated.slotId);

    await this.eventPublisher.publish(
      new AppointmentCancelledEvent(
        updated.id,
        updated.clinicId,
        updated.doctorId,
        updated.slotId,
      ),
    );

    return updated;
  }
}
