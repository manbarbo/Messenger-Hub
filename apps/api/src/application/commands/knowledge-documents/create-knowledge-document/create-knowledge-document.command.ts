export class CreateKnowledgeDocumentCommand {
  constructor(
    readonly clinicId: string,
    readonly title: string,
    readonly content: string,
    readonly category: string,
  ) {}
}
