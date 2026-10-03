export class LLMIterationLimitError extends Error {
  readonly maxIterations: number;

  constructor(maxIterations: number, message?: string) {
    super(message ?? `LLM tool-call iteration limit reached (${maxIterations})`);
    this.name = 'LLMIterationLimitError';
    this.maxIterations = maxIterations;
  }
}
