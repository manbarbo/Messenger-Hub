export class ProcessIncomingMessageCommand {
  constructor(
    readonly messageId: string,
    readonly from: string,
    readonly text: string,
    readonly timestamp: Date,
    readonly clinicId: string,
  ) {}
}
