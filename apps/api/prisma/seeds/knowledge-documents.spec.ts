import { describe, expect, it } from 'vitest';
import { SEED_KNOWLEDGE_DOCUMENTS } from './knowledge-documents';

const REQUIRED_CATEGORIES = [
  'horarios',
  'sedes',
  'preparacion_examenes',
  'politicas_cancelacion',
  'servicios',
  'contacto',
] as const;

describe('seed knowledge documents', () => {
  it('defines at least 8 documents', () => {
    expect(SEED_KNOWLEDGE_DOCUMENTS.length).toBeGreaterThanOrEqual(8);
  });

  it('covers all required knowledge categories', () => {
    const categories = new Set(SEED_KNOWLEDGE_DOCUMENTS.map((d) => d.category));
    for (const category of REQUIRED_CATEGORIES) {
      expect(categories.has(category)).toBe(true);
    }
  });

  it('covers required categories for both clinics', () => {
    for (const clinicName of ['Clínica Norte', 'Clínica Sur']) {
      const categories = new Set(
        SEED_KNOWLEDGE_DOCUMENTS.filter((d) => d.clinicName === clinicName).map(
          (d) => d.category,
        ),
      );
      for (const category of REQUIRED_CATEGORIES) {
        expect(categories.has(category)).toBe(true);
      }
    }
  });

  it('uses only seeded clinic names', () => {
    for (const doc of SEED_KNOWLEDGE_DOCUMENTS) {
      expect(['Clínica Norte', 'Clínica Sur']).toContain(doc.clinicName);
    }
  });

  it('has non-empty titles, content, and categories', () => {
    for (const doc of SEED_KNOWLEDGE_DOCUMENTS) {
      expect(doc.title.trim().length).toBeGreaterThan(0);
      expect(doc.content.trim().length).toBeGreaterThan(20);
      expect(doc.category.trim().length).toBeGreaterThan(0);
    }
  });

  it('includes unique titles', () => {
    const titles = SEED_KNOWLEDGE_DOCUMENTS.map((d) => d.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('references real clinic content (addresses or phones)', () => {
    const joined = SEED_KNOWLEDGE_DOCUMENTS.map((d) => d.content).join('\n');
    expect(joined).toContain('Calle 10 #15-20');
    expect(joined).toContain('Carrera 30 #45-67');
    expect(joined).toContain('+57 2 555 1234');
    expect(joined).toContain('+57 1 555 9876');
  });
});
