import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { Appointment } from '@domain/entities/appointment.entity';
import { AppointmentStatus } from '@domain/enums/appointment-status.enum';
import { AppointmentCreatedEvent } from '@domain/events/appointment-created.event';
import {
  ClinicNotFoundError,
  PastDateError,
  SlotAlreadyBookedError,
  SlotNotFoundError,
  ValidationError,
} from '@domain/errors';
import {
  APPOINTMENT_REPOSITORY,
  SLOT_REPOSITORY,
  type AppointmentRepository,
  type SlotRepository,
} from '@domain/repositories';
import { EVENT_PUBLISHER, type EventPublisher } from '@domain/services';
import { CreateAppointmentCommand } from './create-appointment.command';

@CommandHandler(CreateAppointmentCommand)
@Injectable()
export class CreateAppointmentHandler implements ICommandHandler<CreateAppointmentCommand> {
  constructor(
    @Inject(SLOT_REPOSITORY) private readonly slotRepository: SlotRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateAppointmentCommand): Promise<Appointment> {
    const slot = await this.slotRepository.findById(command.slotId);

    if (!slot) {
      throw new SlotNotFoundError(command.slotId);
    }

    if (slot.clinicId !== command.clinicId) {
      throw new ClinicNotFoundError(command.clinicId);
    }

    if (slot.doctorId !== command.doctorId) {
      throw new ValidationError('Slot does not belong to the specified doctor', [
        {
          field: 'doctorId',
          message: `slot ${command.slotId} belongs to ${slot.doctorId}`,
        },
      ]);
    }

    if (slot.isBooked) {
      throw new SlotAlreadyBookedError(command.slotId);
    }

    const now = new Date();
    if (slot.startTime.getTime() <= now.getTime()) {
      throw new PastDateError(slot.startTime);
    }

    const appointment: Appointment = {
      id: randomUUID(),
      clinicId: command.clinicId,
      doctorId: command.doctorId,
      slotId: command.slotId,
      patientPhone: command.patientPhone,
      patientName: command.patientName ?? null,
      status: AppointmentStatus.CONFIRMED,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.appointmentRepository.create(appointment);

    await this.eventPublisher.publish(
      new AppointmentCreatedEvent(
        created.id,
        created.clinicId,
        created.doctorId,
        created.slotId,
        created.patientPhone,
      ),
    );

    return created;
  }
}
