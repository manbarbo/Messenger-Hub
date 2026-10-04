import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../../core/api.service';
import { AppApiError } from '../../core/app-api.error';
import type { PaginationMeta } from '../../core/models/api.model';
import type { Clinic } from '../../core/models/clinic.model';
import type {
  KnowledgeDocumentDetail,
  KnowledgeDocumentSummary,
} from '../../core/models/knowledge-document.model';
import { KnowledgeListComponent } from './knowledge-list.component';

describe('KnowledgeListComponent', () => {
  const documents: KnowledgeDocumentSummary[] = [
    {
      id: 'doc-1',
      clinicId: 'clinic-1',
      title: 'Horarios de Atención',
      category: 'horarios',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.000Z',
    },
    {
      id: 'doc-2',
      clinicId: 'clinic-1',
      title: 'Sedes',
      category: 'sedes',
      createdAt: '2026-10-01T11:00:00.000Z',
      updatedAt: '2026-10-03T10:00:00.000Z',
    },
  ];

  const detail: KnowledgeDocumentDetail = {
    ...documents[0],
    content: 'La Clínica Norte atiende de lunes a viernes de 8:00 AM a 6:00 PM.',
  };

  const clinics: Clinic[] = [
    { id: 'clinic-1', name: 'Clínica Norte' },
    { id: 'clinic-2', name: 'Clínica Sur' },
  ];

  const pagination: PaginationMeta = {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
  };

  const listResponse = { data: documents, pagination };

  let listKnowledgeDocuments: ReturnType<typeof vi.fn>;
  let getKnowledgeDocument: ReturnType<typeof vi.fn>;
  let listClinics: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<KnowledgeListComponent>;
  let component: KnowledgeListComponent;

  beforeEach(async () => {
    listKnowledgeDocuments = vi.fn().mockReturnValue(of(listResponse));
    getKnowledgeDocument = vi.fn().mockReturnValue(of(detail));
    listClinics = vi.fn().mockReturnValue(of(clinics));

    await TestBed.configureTestingModule({
      imports: [KnowledgeListComponent],
      providers: [
        {
          provide: ApiService,
          useValue: { listKnowledgeDocuments, getKnowledgeDocument, listClinics },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(KnowledgeListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function html(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('should create, load clinics, and auto-select the first clinic', () => {
    expect(component).toBeTruthy();
    expect(listClinics).toHaveBeenCalledTimes(1);
    expect(component.clinicFilter()).toBe('clinic-1');
    expect(listKnowledgeDocuments).toHaveBeenCalledWith({
      clinicId: 'clinic-1',
      page: 1,
      limit: 20,
    });
    expect(component.documents()).toEqual(documents);
  });

  it('renders knowledge document rows with title, category, and updated date', () => {
    const rows = html().querySelectorAll('[data-testid="knowledge-row"]');
    expect(rows.length).toBe(2);
    expect((rows[0] as HTMLElement).textContent).toContain('Horarios de Atención');
    expect((rows[0] as HTMLElement).textContent).toContain('horarios');
    expect((rows[1] as HTMLElement).textContent).toContain('Sedes');
  });

  it('shows a loading skeleton during fetch', () => {
    listKnowledgeDocuments.mockReturnValue(new Subject<typeof listResponse>());

    component.loadDocuments();
    fixture.detectChanges();

    expect(html().querySelector('[data-testid="knowledge-skeleton"]')).toBeTruthy();
  });

  it('shows empty state when no clinic is selected', () => {
    component.clinicFilter.set('');
    component.documents.set([]);
    fixture.detectChanges();

    expect(html().querySelector('[data-testid="knowledge-empty"]')?.textContent).toContain(
      'Select a clinic',
    );
    expect(listKnowledgeDocuments).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when the clinic has no documents', () => {
    listKnowledgeDocuments.mockReturnValue(
      of({ data: [], pagination: { ...pagination, total: 0, totalPages: 0 } }),
    );

    component.loadDocuments();
    fixture.detectChanges();

    expect(html().querySelector('[data-testid="knowledge-empty"]')?.textContent).toContain(
      'No knowledge documents found',
    );
  });

  it('shows error message with retry on list failure', () => {
    listKnowledgeDocuments.mockReturnValue(
      throwError(() => new AppApiError({ error: 'Error', message: 'boom', status: 500 })),
    );

    component.loadDocuments();
    fixture.detectChanges();

    const error = html().querySelector('[data-testid="knowledge-error"]');
    expect(error).toBeTruthy();
    expect(error?.textContent).toContain('boom');

    listKnowledgeDocuments.mockReturnValue(of(listResponse));
    (error?.querySelector('button') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();
    expect(component.error()).toBeNull();
    expect(component.documents()).toEqual(documents);
  });

  it('reloads documents when clinic filter changes', () => {
    listKnowledgeDocuments.mockClear();

    component.onClinicFilterChange('clinic-2');
    fixture.detectChanges();

    expect(component.clinicFilter()).toBe('clinic-2');
    expect(component.page()).toBe(1);
    expect(listKnowledgeDocuments).toHaveBeenCalledWith({
      clinicId: 'clinic-2',
      page: 1,
      limit: 20,
    });
  });

  it('reloads documents when category filter changes', () => {
    listKnowledgeDocuments.mockClear();

    component.onCategoryFilterChange('horarios');
    fixture.detectChanges();

    expect(component.categoryFilter()).toBe('horarios');
    expect(listKnowledgeDocuments).toHaveBeenCalledWith({
      clinicId: 'clinic-1',
      category: 'horarios',
      page: 1,
      limit: 20,
    });
  });

  it('derives category options from the loaded documents', () => {
    expect(component.categoryOptions()).toEqual(['horarios', 'sedes']);
  });

  it('reloads documents on page change', () => {
    listKnowledgeDocuments.mockClear();

    component.onPageChange(2);
    fixture.detectChanges();

    expect(component.page()).toBe(2);
    expect(listKnowledgeDocuments).toHaveBeenCalledWith({
      clinicId: 'clinic-1',
      page: 2,
      limit: 20,
    });
  });

  it('opens detail dialog via getKnowledgeDocument', () => {
    component.openDetail(documents[0]);
    fixture.detectChanges();

    expect(getKnowledgeDocument).toHaveBeenCalledWith('doc-1');
    expect(component.selectedDocument()).toEqual(detail);

    const overlay = html().querySelector('[data-testid="knowledge-detail-overlay"]');
    expect(overlay).toBeTruthy();
    expect(overlay?.textContent).toContain('Horarios de Atención');
    expect(overlay?.textContent).toContain(detail.content);
  });

  it('closes the detail dialog', () => {
    component.openDetail(documents[0]);
    fixture.detectChanges();

    component.closeDetail();
    fixture.detectChanges();

    expect(component.selectedDocument()).toBeNull();
    expect(html().querySelector('[data-testid="knowledge-detail-overlay"]')).toBeNull();
  });

  it('surfaces detail load errors without closing the overlay', () => {
    getKnowledgeDocument.mockReturnValue(
      throwError(() => new AppApiError({ error: 'Error', message: 'detail failed', status: 500 })),
    );

    component.openDetail(documents[0]);
    fixture.detectChanges();

    expect(component.detailError()).toBe('detail failed');
    expect(html().querySelector('[data-testid="knowledge-detail-error"]')).toBeTruthy();
  });

  it('handles clinic load failure', () => {
    listClinics.mockReturnValue(
      throwError(() => new AppApiError({ error: 'Error', message: 'clinics down', status: 500 })),
    );

    component.loadClinics();
    fixture.detectChanges();

    expect(html().querySelector('[data-testid="knowledge-clinics-error"]')?.textContent).toContain(
      'clinics down',
    );
  });
});
