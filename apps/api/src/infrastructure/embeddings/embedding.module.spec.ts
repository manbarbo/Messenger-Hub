import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EMBEDDING_SERVICE } from '@domain/services';
import { GeminiEmbeddingService } from './gemini-embedding.service';
import { EmbeddingModule } from './embedding.module';

const mockConfigService = {
  get: <T>(key: string, defaultValue?: T): T | undefined => {
    const values: Record<string, string> = {
      LLM_API_KEY: 'test-key',
      LLM_BASE_URL: 'https://example.com/v1',
      EMBEDDING_MODEL: 'text-embedding-004',
      EMBEDDING_DIMENSIONS: '768',
    };
    return (values[key] as T | undefined) ?? defaultValue;
  },
};

@Global()
@Module({
  providers: [{ provide: ConfigService, useValue: mockConfigService }],
  exports: [ConfigService],
})
class MockConfigModule {}

describe('EmbeddingModule', () => {
  it('binds EMBEDDING_SERVICE to GeminiEmbeddingService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockConfigModule, EmbeddingModule],
    }).compile();

    expect(moduleRef.get(EMBEDDING_SERVICE)).toBeInstanceOf(GeminiEmbeddingService);
  });

  it('exports EMBEDDING_SERVICE for InfrastructureModule injection', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockConfigModule, EmbeddingModule],
    }).compile();

    expect(moduleRef.get(EMBEDDING_SERVICE, { strict: false })).toBeDefined();
  });
});
