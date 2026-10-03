import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EmbeddingModule } from '@infrastructure/embeddings/embedding.module';
import { LlmModule } from '@infrastructure/llm/llm.module';
import { AIOrchestratorService } from './ai-orchestrator.service';
import { PromptBuilder } from './prompt-builder';
import { ToolValidator } from './tool-validator';

@Module({
  imports: [CqrsModule, LlmModule, EmbeddingModule],
  providers: [PromptBuilder, ToolValidator, AIOrchestratorService],
  exports: [AIOrchestratorService, ToolValidator, PromptBuilder],
})
export class AIModule {}
