import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import type { AppointmentRepository, SlotRepository } from '@domain/repositories';
import type { EventPublisher, Logger } from '@domain/services';
import { CreateAppointmentCommand } from './create-appointment.command';
import { CreateAppointmentHandler } from './create-appointment.handler';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

function buildSlot(overrides: Partial<{ id: string; clinicId: string; doctorId: string; isBooked: boolean; startTime: Date }> = {}) {
  return {
    id: overrides.id ?? 'slot-1',
    clinicId: overrides.clinicId ?? 'clinic-1',
    doctorId: overrides.doctorId ?? 'doc-1',
    startTime: overrides.startTime ?? futureDate,
    endTime: new Date((overrides.startTime ?? futureDate).getTime() + 30 * 60 * 1000),
    isBooked: overrides.isBooked ?? false,
    createdAt: new Date('2026-10-01T10:00:00Z'),
  };
}

function buildCreatedAppointment(partial: Partial<Appointment> = {}): Appointment {
  return {
    id: partial.id ?? 'apt-1',
    clinicId: partial.clinicId ?? 'clinic-1',
    doctorId: partial.doctorId ?? 'doc-1',
    slotId: partial.slotId ?? 'slot-1',
    patientPhone: partial.patientPhone ?? '+573001112233',
    patientName:
      partial.patientName !== undefined ? partial.patientName : ('Ana Pérez' as string | null),
    status: partial.status ?? AppointmentStatus.CONFIRMED,
    createdAt: partial.createdAt ?? new Date('2026-10-02T15:00:00Z'),
    updatedAt: partial.updatedAt ?? new Date('2026-10-02T15:00:00Z'),
  };
}

describe('CreateAppointmentHandler', () => {
  let slotRepository: { findById: ReturnType<typeof vi.fn> };
  let appointmentRepository: { create: ReturnType<typeof vi.fn> };
  let eventPublisher: { publish: ReturnType<typeof vi.fn> };
  let logger: Logger;
  let handler: CreateAppointmentHandler;
  let command: CreateAppointmentCommand;

  beforeEach(() => {
    slotRepository = { findById: vi.fn() };
    appointmentRepository = { create: vi.fn() };
    eventPublisher = { publish: vi.fn() };
    logger = createMockLogger();
    handler = new CreateAppointmentHandler(
      logger,
      slotRepository as unknown as SlotRepository,
      appointmentRepository as unknown as AppointmentRepository,
      eventPublisher as EventPublisher,
    );
    command = new CreateAppointmentCommand(
      'clinic-1',
      'doc-1',
      'slot-1',
      '+573001112233',
      'Ana Pérez',
    );
  });

  it('creates appointment, publishes AppointmentCreatedEvent, and returns result', async () => {
    slotRepository.findById.mockResolvedValue(buildSlot());
    const created = buildCreatedAppointment();
    appointmentRepository.create.mockResolvedValue(created);

    const result = await handler.execute(command);

    expect(appointmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-1',
        doctorId: 'doc-1',
        slotId: 'slot-1',
        patientPhone: '+573001112233',
        patientName: 'Ana Pérez',
        status: AppointmentStatus.CONFIRMED,
      }),
    );
    expect(result).toEqual(created);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.any(AppointmentCreatedEvent),
    );
    const event = eventPublisher.publish.mock.calls[0][0] as AppointmentCreatedEvent;
    expect(event.eventName).toBe('appointment.created');
    expect(event.aggregateId).toBe(created.id);
    expect(event.clinicId).toBe(created.clinicId);
    expect(event.slotId).toBe(created.slotId);
  });

  it('sets patientName to null when omitted', async () => {
    slotRepository.findById.mockResolvedValue(buildSlot());
    appointmentRepository.create.mockResolvedValue(
      buildCreatedAppointment({ patientName: null }),
    );

    const result = await handler.execute(
      new CreateAppointmentCommand('clinic-1', 'doc-1', 'slot-1', '+573001112233'),
    );

    expect(appointmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ patientName: null }),
    );
    expect(result.patientName).toBeNull();
  });

  it('throws SlotNotFoundError when slot does not exist', async () => {
    slotRepository.findById.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(SlotNotFoundError);
    expect(appointmentRepository.create).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('throws ClinicNotFoundError when slot belongs to another clinic', async () => {
    slotRepository.findById.mockResolvedValue(buildSlot({ clinicId: 'clinic-2' }));

    await expect(handler.execute(command)).rejects.toThrow(ClinicNotFoundError);
    expect(appointmentRepository.create).not.toHaveBeenCalled();
  });

  it('throws ValidationError when slot belongs to another doctor', async () => {
    slotRepository.findById.mockResolvedValue(buildSlot({ doctorId: 'doc-2' }));

    await expect(handler.execute(command)).rejects.toThrow(ValidationError);
    expect(appointmentRepository.create).not.toHaveBeenCalled();
  });

  it('throws SlotAlreadyBookedError when slot is booked', async () => {
    slotRepository.findById.mockResolvedValue(buildSlot({ isBooked: true }));

    await expect(handler.execute(command)).rejects.toThrow(SlotAlreadyBookedError);
    expect(appointmentRepository.create).not.toHaveBeenCalled();
  });

  it('throws PastDateError when slot start time is in the past', async () => {
    slotRepository.findById.mockResolvedValue(
      buildSlot({ startTime: new Date(Date.now() - 60 * 60 * 1000) }),
    );

    await expect(handler.execute(command)).rejects.toThrow(PastDateError);
    expect(appointmentRepository.create).not.toHaveBeenCalled();
  });
});
