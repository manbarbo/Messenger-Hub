import { Global, Module } from '@nestjs/common';
import { EMBEDDING_SERVICE } from '@domain/services';
import { GeminiEmbeddingService } from './gemini-embedding.service';

@Global()
@Module({
  providers: [{ provide: EMBEDDING_SERVICE, useClass: GeminiEmbeddingService }],
  exports: [EMBEDDING_SERVICE],
})
export class EmbeddingModule {}
