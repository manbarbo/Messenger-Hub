import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment } from '@domain/entities/appointment.entity';
import { AppointmentStatus } from '@domain/enums/appointment-status.enum';
import { AppointmentCancelledEvent } from '@domain/events/appointment-cancelled.event';
import { AppointmentNotFoundError, ValidationError } from '@domain/errors';
import type { AppointmentRepository, SlotRepository } from '@domain/repositories';
import type { EventPublisher, Logger } from '@domain/services';
import { CancelAppointmentCommand } from './cancel-appointment.command';
import { CancelAppointmentHandler } from './cancel-appointment.handler';

function createMockLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function buildAppointment(status: AppointmentStatus = AppointmentStatus.CONFIRMED): Appointment {
  return {
    id: 'apt-1',
    clinicId: 'clinic-1',
    doctorId: 'doc-1',
    slotId: 'slot-1',
    patientPhone: '+573001112233',
    patientName: 'Ana Pérez',
    status,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-01T10:00:00Z'),
  };
}

describe('CancelAppointmentHandler', () => {
  let appointmentRepository: {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let slotRepository: { markAsAvailable: ReturnType<typeof vi.fn> };
  let eventPublisher: { publish: ReturnType<typeof vi.fn> };
  let handler: CancelAppointmentHandler;

  beforeEach(() => {
    appointmentRepository = { findById: vi.fn(), update: vi.fn() };
    slotRepository = { markAsAvailable: vi.fn() };
    eventPublisher = { publish: vi.fn() };
    handler = new CancelAppointmentHandler(
      createMockLogger(),
      appointmentRepository as unknown as AppointmentRepository,
      slotRepository as unknown as SlotRepository,
      eventPublisher as EventPublisher,
    );
  });

  it('cancels confirmed appointment, frees slot, and publishes event', async () => {
    const existing = buildAppointment(AppointmentStatus.CONFIRMED);
    appointmentRepository.findById.mockResolvedValue(existing);
    const cancelled: Appointment = {
      ...existing,
      status: AppointmentStatus.CANCELLED,
      updatedAt: new Date('2026-10-02T12:00:00Z'),
    };
    appointmentRepository.update.mockResolvedValue(cancelled);

    const result = await handler.execute(new CancelAppointmentCommand('apt-1'));

    expect(appointmentRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'apt-1',
        status: AppointmentStatus.CANCELLED,
      }),
    );
    expect(slotRepository.markAsAvailable).toHaveBeenCalledWith('slot-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.any(AppointmentCancelledEvent));
    const event = eventPublisher.publish.mock.calls[0][0] as AppointmentCancelledEvent;
    expect(event.eventName).toBe('appointment.cancelled');
    expect(event.aggregateId).toBe('apt-1');
    expect(event.slotId).toBe('slot-1');
    expect(result.status).toBe(AppointmentStatus.CANCELLED);
  });

  it('throws AppointmentNotFoundError when appointment does not exist', async () => {
    appointmentRepository.findById.mockResolvedValue(null);

    await expect(handler.execute(new CancelAppointmentCommand('missing'))).rejects.toThrow(
      AppointmentNotFoundError,
    );
    expect(appointmentRepository.update).not.toHaveBeenCalled();
    expect(slotRepository.markAsAvailable).not.toHaveBeenCalled();
  });

  it('throws ValidationError when appointment is already cancelled', async () => {
    appointmentRepository.findById.mockResolvedValue(
      buildAppointment(AppointmentStatus.CANCELLED),
    );

    await expect(handler.execute(new CancelAppointmentCommand('apt-1'))).rejects.toThrow(
      ValidationError,
    );
    expect(appointmentRepository.update).not.toHaveBeenCalled();
    expect(slotRepository.markAsAvailable).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });
});
