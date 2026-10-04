import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import type { Clinic } from '../../core/models/clinic.model';
import type { KnowledgeDocumentDetail } from '../../core/models/knowledge-document.model';
import { KnowledgeFormComponent, type KnowledgeFormSubmit } from './knowledge-form.component';

describe('KnowledgeFormComponent', () => {
  const clinics: Clinic[] = [
    { id: 'clinic-1', name: 'Clínica Norte' },
    { id: 'clinic-2', name: 'Clínica Sur' },
  ];

  const initial: KnowledgeDocumentDetail = {
    id: 'doc-1',
    clinicId: 'clinic-1',
    title: 'Horarios',
    content: 'Lunes a viernes',
    category: 'horarios',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
  };

  let fixture: ComponentFixture<KnowledgeFormComponent>;
  let component: KnowledgeFormComponent;
  let submitted: ReturnType<typeof vi.fn<(value: KnowledgeFormSubmit) => void>>;
  let cancelled: ReturnType<typeof vi.fn<() => void>>;

  async function createComponent(
    options: {
      mode?: 'create' | 'edit';
      initial?: KnowledgeDocumentDetail | null;
      defaultClinicId?: string;
    } = {},
  ): Promise<void> {
    submitted = vi.fn<(value: KnowledgeFormSubmit) => void>();
    cancelled = vi.fn<() => void>();

    await TestBed.configureTestingModule({
      imports: [KnowledgeFormComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(KnowledgeFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('clinics', clinics);
    fixture.componentRef.setInput('mode', options.mode ?? 'create');
    fixture.componentRef.setInput('initial', options.initial ?? null);
    fixture.componentRef.setInput('defaultClinicId', options.defaultClinicId ?? '');
    component.submitted.subscribe((value) => submitted(value));
    component.cancelled.subscribe(() => cancelled());
    fixture.detectChanges();
  }

  function html(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function setInput(testId: string, value: string): void {
    const input = html().querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('creates create mode form with default clinic and empty fields', async () => {
    await createComponent({ defaultClinicId: 'clinic-1' });

    expect(component.isEdit()).toBe(false);
    expect(component.clinicId()).toBe('clinic-1');
    expect(component.title()).toBe('');
    expect(html().querySelector('[data-testid="knowledge-form-title"]')?.textContent).toContain(
      'New document',
    );
  });

  it('loads initial values in edit mode and disables clinic select', async () => {
    await createComponent({ mode: 'edit', initial });

    expect(component.isEdit()).toBe(true);
    expect(component.clinicId()).toBe('clinic-1');
    expect(component.title()).toBe('Horarios');
    expect(component.category()).toBe('horarios');
    expect(component.content()).toBe('Lunes a viernes');
    expect(html().querySelector('[data-testid="knowledge-form-title"]')?.textContent).toContain(
      'Edit document',
    );
  });

  it('shows validation errors and does not submit when fields are empty', async () => {
    await createComponent({ defaultClinicId: '' });

    component.onSubmit();
    fixture.detectChanges();

    expect(submitted).not.toHaveBeenCalled();
    expect(html().querySelector('[data-testid="knowledge-form-title-error"]')).toBeTruthy();
    expect(html().querySelector('[data-testid="knowledge-form-category-error"]')).toBeTruthy();
    expect(html().querySelector('[data-testid="knowledge-form-content-error"]')).toBeTruthy();
    expect(html().querySelector('[data-testid="knowledge-form-clinic-error"]')).toBeTruthy();
  });

  it('emits create payload with trimmed values', async () => {
    await createComponent({ defaultClinicId: 'clinic-1' });

    setInput('knowledge-form-title-input', '  Politicas  ');
    setInput('knowledge-form-category', ' politicas ');
    setInput('knowledge-form-content', '  Contenido util  ');

    component.onSubmit();

    expect(submitted).toHaveBeenCalledWith({
      mode: 'create',
      clinicId: 'clinic-1',
      title: 'Politicas',
      content: 'Contenido util',
      category: 'politicas',
    });
  });

  it('emits edit payload with document id', async () => {
    await createComponent({ mode: 'edit', initial });

    setInput('knowledge-form-title-input', 'Horarios actualizados');
    component.onSubmit();

    expect(submitted).toHaveBeenCalledWith({
      mode: 'edit',
      id: 'doc-1',
      title: 'Horarios actualizados',
      content: 'Lunes a viernes',
      category: 'horarios',
    });
  });

  it('emits cancelled from cancel button and header close', async () => {
    await createComponent();

    (html().querySelector('[data-testid="knowledge-form-cancel"]') as HTMLButtonElement).click();
    (html().querySelector('[data-testid="knowledge-form-close"]') as HTMLButtonElement).click();

    expect(cancelled).toHaveBeenCalledTimes(2);
  });

  it('submits via form ngSubmit', async () => {
    await createComponent({ defaultClinicId: 'clinic-1' });
    setInput('knowledge-form-title-input', 'Title');
    setInput('knowledge-form-category', 'cat');
    setInput('knowledge-form-content', 'Body');

    const form = html().querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(submitted).toHaveBeenCalledTimes(1);
  });
});
