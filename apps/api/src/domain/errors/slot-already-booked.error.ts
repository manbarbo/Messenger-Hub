export class SlotAlreadyBookedError extends Error {
  readonly slotId?: string;

  constructor(slotId?: string, message?: string) {
    super(message ?? `Slot ${slotId ?? '(unknown)'} is already booked`);
    this.name = 'SlotAlreadyBookedError';
    this.slotId = slotId;
  }
}
