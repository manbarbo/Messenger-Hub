import { describe, expect, it } from 'vitest';
import { APP_LAYER } from '@presentation/index';

describe('path aliases', () => {
  it('resolves @presentation/* imports', () => {
    expect(APP_LAYER).toBe('presentation');
  });
});
