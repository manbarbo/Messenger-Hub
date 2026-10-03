export interface QueueJob {
  readonly conversationId: string;
  readonly messageId: string;
  readonly from: string;
  readonly text: string;
  readonly clinicId: string;
}
