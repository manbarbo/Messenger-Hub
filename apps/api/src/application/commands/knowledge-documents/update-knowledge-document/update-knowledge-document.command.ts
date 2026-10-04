export class UpdateKnowledgeDocumentCommand {
  constructor(
    readonly id: string,
    readonly title?: string,
    readonly content?: string,
    readonly category?: string,
  ) {}
}
