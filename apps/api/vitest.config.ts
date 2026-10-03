import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import viteTsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  test: {
    globals: true,
    root: import.meta.dirname,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'test/app.e2e-spec.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/worker-main.ts',
        'src/**/*.module.ts',
        'src/**/index.ts',
        'src/**/*.spec.ts',
        'src/path-aliases.spec.ts',
        'src/application/dto/conversation-view.ts',
        'src/domain/entities/ai-trace.entity.ts',
        'src/domain/entities/clinic.entity.ts',
        'src/domain/entities/doctor.entity.ts',
        'src/domain/entities/message.entity.ts',
        'src/domain/value-objects/conversation-filters.vo.ts',
        'src/domain/value-objects/llm-chat.vo.ts',
        'src/domain/value-objects/queue-job.vo.ts',
      ],
      thresholds: {
        statements: 75,
        branches: 75,
        functions: 75,
        lines: 75,
      },
    },
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
    viteTsconfigPaths(),
  ],
});
