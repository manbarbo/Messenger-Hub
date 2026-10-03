import { Module } from '@nestjs/common';
import { LLM_SERVICE } from '@domain/services';
import { GeminiLLMService } from './gemini-llm.service';

@Module({
  providers: [{ provide: LLM_SERVICE, useClass: GeminiLLMService }],
  exports: [LLM_SERVICE],
})
export class LlmModule {}
