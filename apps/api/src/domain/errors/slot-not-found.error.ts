export class SlotNotFoundError extends Error {
  readonly slotId?: string;

  constructor(slotId?: string, message?: string) {
    super(message ?? `Slot ${slotId ?? '(unknown)'} was not found`);
    this.name = 'SlotNotFoundError';
    this.slotId = slotId;
  }
}
