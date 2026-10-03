import { ValidationError } from '../errors/validation.error';

export interface Slot {
  readonly id: string;
  readonly clinicId: string;
  readonly doctorId: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly isBooked: boolean;
  readonly createdAt: Date;
}

export function isValidSlotRange(startTime: Date, endTime: Date): boolean {
  return endTime.getTime() > startTime.getTime();
}

export function assertValidSlotRange(startTime: Date, endTime: Date): void {
  if (!isValidSlotRange(startTime, endTime)) {
    throw new ValidationError('Slot endTime must be after startTime', [
      { field: 'endTime', message: 'must be after startTime' },
    ]);
  }
}

export function isAvailableSlot(slot: Pick<Slot, 'isBooked' | 'startTime'>, now: Date): boolean {
  return !slot.isBooked && slot.startTime.getTime() > now.getTime();
}
