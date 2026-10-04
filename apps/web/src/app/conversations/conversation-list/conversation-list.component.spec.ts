import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../../core/api.service';
import { AppApiError } from '../../core/app-api.error';
import type { PaginationMeta } from '../../core/models/api.model';
import type { Clinic } from '../../core/models/clinic.model';
import type { ConversationSummary } from '../../core/models/conversation.model';
import { ConversationListComponent } from './conversation-list.component';

describe('ConversationListComponent', () => {
  const conversations: ConversationSummary[] = [
    {
      id: 'conv-1',
      clinicId: 'clinic-1',
      clinicName: 'Clínica Norte',
      patientPhone: '+573001112233',
      status: 'active',
      messageCount: 4,
      createdAt: '2026-10-06T03:40:00.000Z',
      updatedAt: '2026-10-06T03:45:00.000Z',
      lastMessageAt: '2026-10-06T03:45:00.000Z',
    },
    {
      id: 'conv-2',
      clinicId: 'clinic-1',
      clinicName: null,
      patientPhone: '+573009998877',
      status: 'escalated',
      createdAt: '2026-10-06T04:00:00.000Z',
      updatedAt: '2026-10-06T04:05:00.000Z',
      lastMessageAt: '2026-10-06T04:05:00.000Z',
    },
  ];

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

  const listResponse = { data: conversations, pagination };

  let listConversations: ReturnType<typeof vi.fn>;
  let listClinics: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<ConversationListComponent>;
  let component: ConversationListComponent;

  beforeEach(async () => {
    listConversations = vi.fn().mockReturnValue(of(listResponse));
    listClinics = vi.fn().mockReturnValue(of(clinics));
    navigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ConversationListComponent],
      providers: [
        { provide: ApiService, useValue: { listConversations, listClinics } },
        { provide: Router, useValue: { navigate } },
        provideRouter([]),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConversationListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function html(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('should create and load conversations on init', () => {
    expect(component).toBeTruthy();
    expect(listConversations).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(component.conversations()).toEqual(conversations);
    expect(component.loading()).toBe(false);
  });

  it('loads clinics on init for the clinic filter', () => {
    expect(listClinics).toHaveBeenCalledTimes(1);
    expect(component.clinics()).toEqual(clinics);
    expect(component.clinicsError()).toBeNull();
    expect(html().querySelector('[data-testid="clinic-filter"]')).toBeTruthy();
  });

  it('renders conversation rows with phone, clinic, status badge, messages, and activity', () => {
    const rows = html().querySelectorAll('[data-testid="conversation-row"]');
    expect(rows.length).toBe(2);

    const firstRow = rows[0] as HTMLElement;
    expect(firstRow.textContent).toContain('+573001112233');
    expect(firstRow.textContent).toContain('Clínica Norte');
    expect(firstRow.textContent).toContain('Active');
    expect(firstRow.textContent).toContain('4');

    const secondRow = rows[1] as HTMLElement;
    expect(secondRow.textContent).toContain('—');
    expect(secondRow.textContent).toContain('Escalated');
  });

  it('shows a loading skeleton during fetch', () => {
    listConversations.mockReturnValue(new Subject<typeof listResponse>());

    component.loadConversations();
    fixture.detectChanges();

    expect(html().querySelector('[data-testid="conversation-skeleton"]')).toBeTruthy();
    expect(html().querySelector('[data-testid="conversation-table"]')).toBeNull();
  });

  it('shows empty state when there are no results', () => {
    listConversations.mockReturnValue(of({ data: [], pagination: { ...pagination, total: 0, totalPages: 0 } }));

    component.loadConversations();
    fixture.detectChanges();

    expect(html().querySelector('[data-testid="conversation-empty"]')?.textContent).toContain(
      'No conversations found',
    );
  });

  it('shows error message with retry on fetch failure', () => {
    listConversations.mockReturnValue(
      throwError(
        () =>
          new AppApiError({
            error: 'InternalServerError',
            message: 'Internal server error',
            status: 500,
          }),
      ),
    );

    component.loadConversations();
    fixture.detectChanges();

    const errorEl = html().querySelector('[data-testid="conversation-error"]');
    expect(errorEl).toBeTruthy();
    expect(errorEl?.textContent).toContain('Internal server error');

    listConversations.mockReturnValue(of(listResponse));
    const retryButton = errorEl?.querySelector('button') as HTMLButtonElement;
    retryButton.click();
    fixture.detectChanges();

    expect(component.error()).toBeNull();
    expect(component.conversations()).toEqual(conversations);
  });

  it('refetches with status filter and resets to page 1', () => {
    listConversations.mockClear();

    component.onStatusFilterChange('escalated');
    fixture.detectChanges();

    expect(listConversations).toHaveBeenCalledWith({
      status: 'escalated',
      page: 1,
      limit: 20,
    });
    expect(component.statusFilter()).toBe('escalated');
    expect(component.page()).toBe(1);
  });

  it('refetches with clinic filter and resets to page 1', () => {
    listConversations.mockClear();

    component.onClinicFilterChange('clinic-2');
    fixture.detectChanges();

    expect(listConversations).toHaveBeenCalledWith({
      clinicId: 'clinic-2',
      page: 1,
      limit: 20,
    });
    expect(component.clinicFilter()).toBe('clinic-2');
    expect(component.page()).toBe(1);
  });

  it('includes both status and clinic filters when both are set', () => {
    listConversations.mockClear();

    component.onClinicFilterChange('clinic-1');
    component.onStatusFilterChange('escalated');
    fixture.detectChanges();

    expect(listConversations).toHaveBeenLastCalledWith({
      status: 'escalated',
      clinicId: 'clinic-1',
      page: 1,
      limit: 20,
    });
  });

  it('shows clinic filter load error without blocking conversation loading', () => {
    listClinics.mockReturnValue(
      throwError(
        () =>
          new AppApiError({
            error: 'InternalServerError',
            message: 'Internal server error',
            status: 500,
          }),
      ),
    );

    component.loadClinics();
    fixture.detectChanges();

    expect(component.clinicsError()).toBe('Internal server error');
    expect(html().querySelector('[data-testid="conversation-clinics-error"]')?.textContent).toContain(
      'Internal server error',
    );
    expect(component.conversations()).toEqual(conversations);
  });

  it('refetches when page changes', () => {
    listConversations.mockReturnValue(
      of({
        data: conversations,
        pagination: { page: 2, limit: 20, total: 40, totalPages: 2 },
      }),
    );

    component.onPageChange(2);
    fixture.detectChanges();

    expect(listConversations).toHaveBeenLastCalledWith({
      page: 2,
      limit: 20,
    });
    expect(component.page()).toBe(2);
  });

  it('navigates to conversation detail when a row is activated', () => {
    const row = html().querySelector('[data-testid="conversation-row"]') as HTMLElement;
    row.click();

    expect(navigate).toHaveBeenCalledWith(['/conversations', 'conv-1']);
  });

  it('renders status filter options', () => {
    const filter = html().querySelector('[data-testid="status-filter"]');
    expect(filter).toBeTruthy();
    expect(component.statusOptions.map((option) => option.value)).toEqual([
      'active',
      'resolved_by_ai',
      'appointment_booked',
      'escalated',
    ]);
  });
});
