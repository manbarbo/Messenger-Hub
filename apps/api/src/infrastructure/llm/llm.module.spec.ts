import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LLM_SERVICE } from '@domain/services';
import { GeminiLLMService } from './gemini-llm.service';
import { LlmModule } from './llm.module';

const mockConfigService = {
  get: <T>(key: string, defaultValue?: T): T | undefined => {
    const values: Record<string, string> = {
      LLM_API_KEY: 'test-key',
      LLM_BASE_URL: 'https://example.com/v1',
      LLM_MODEL: 'gemini-2.5-flash',
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

describe('LlmModule', () => {
  it('binds LLM_SERVICE to GeminiLLMService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockConfigModule, LlmModule],
    }).compile();

    expect(moduleRef.get(LLM_SERVICE)).toBeInstanceOf(GeminiLLMService);
  });

  it('exports LLM_SERVICE for application layers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockConfigModule, LlmModule],
    }).compile();

    expect(moduleRef.get(LLM_SERVICE, { strict: false })).toBeDefined();
  });
});
