import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../../core/api.service';
import { AppApiError } from '../../core/app-api.error';
import type { AITrace } from '../../core/models/ai-trace.model';
import type { ConversationMessage } from '../../core/models/message.model';
import type { ConversationDetail } from '../../core/models/conversation.model';
import { ConversationDetailComponent } from './conversation-detail.component';

describe('ConversationDetailComponent', () => {
  const messages: ConversationMessage[] = [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      clinicId: 'clinic-1',
      direction: 'inbound',
      role: 'user',
      content: 'Hola, ¿tienen cita con dermatología?',
      createdAt: '2026-10-06T03:40:00.000Z',
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      clinicId: 'clinic-1',
      direction: 'outbound',
      role: 'assistant',
      content: 'Sí, tengo disponibilidad mañana.',
      createdAt: '2026-10-06T03:40:05.000Z',
    },
  ];

  const aiTraces: AITrace[] = [
    {
      id: 'trace-1',
      conversationId: 'conv-1',
      clinicId: 'clinic-1',
      turnIndex: 1,
      model: 'gemini-2.5-flash',
      inputTokens: 1250,
      outputTokens: 180,
      latencyMs: 2300,
      costUsd: 0.0004,
      toolsCalled: [
        {
          name: 'consultar_disponibilidad',
          arguments: { especialidad: 'dermatología', fecha: '2026-10-07' },
          result: [{ doctorName: 'Dr. García' }],
          success: true,
        },
      ],
      finalStatus: 'appointment_booked',
      createdAt: '2026-10-06T03:40:05.000Z',
    },
  ];

  const conversation: ConversationDetail = {
    id: 'conv-1',
    clinicId: 'clinic-1',
    clinicName: 'Clínica Norte',
    patientPhone: '+573001112233',
    status: 'appointment_booked',
    createdAt: '2026-10-06T03:40:00.000Z',
    updatedAt: '2026-10-06T03:45:00.000Z',
    lastMessageAt: '2026-10-06T03:45:00.000Z',
    messages,
    aiTraces,
  };

  let getConversation: ReturnType<typeof vi.fn>;
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  let fixture: ComponentFixture<ConversationDetailComponent>;
  let component: ConversationDetailComponent;

  async function setup(options?: {
    paramMapId?: string | null;
    getConversation?: ReturnType<typeof vi.fn>;
  }) {
    const paramMapId = options?.paramMapId === undefined ? 'conv-1' : options.paramMapId;
    getConversation = options?.getConversation ?? vi.fn().mockReturnValue(of(conversation));

    await TestBed.configureTestingModule({
      imports: [ConversationDetailComponent],
      providers: [
        { provide: ApiService, useValue: { getConversation } },
        provideRouter([{ path: 'conversations', component: class {} }]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(paramMapId === null ? {} : { id: paramMapId })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConversationDetailComponent);
    component = fixture.componentInstance;
    navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');
    fixture.detectChanges();
  }

  function html(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('should create and load conversation from route params', async () => {
    await setup();

    expect(component).toBeTruthy();
    expect(getConversation).toHaveBeenCalledWith('conv-1');
    expect(component.conversation()?.patientPhone).toBe('+573001112233');
  });

  it('renders header with phone, clinic, status, and created date', async () => {
    await setup();

    const header = html().querySelector('[data-testid="conversation-header"]');
    expect(header?.textContent).toContain('+573001112233');
    expect(header?.textContent).toContain('Clínica Norte');
    expect(header?.textContent).toContain('Appointment booked');
    expect(header?.textContent).toContain('Created');
  });

  it('renders user and assistant messages with different styling', async () => {
    await setup();

    const items = html().querySelectorAll('[data-testid="message-item"]');
    expect(items.length).toBe(2);

    const userMsg = items[0] as HTMLElement;
    const assistantMsg = items[1] as HTMLElement;

    expect(userMsg.className).toContain('message--user');
    expect(userMsg.textContent).toContain('Hola, ¿tienen cita con dermatología?');
    expect(userMsg.textContent).toContain('Patient');

    expect(assistantMsg.className).toContain('message--assistant');
    expect(assistantMsg.textContent).toContain('Sí, tengo disponibilidad mañana.');
    expect(assistantMsg.textContent).toContain('Assistant');
  });

  it('shows AI traces collapsed by default and expands on toggle', async () => {
    await setup();

    const panel = html().querySelector('[data-testid="ai-trace-panel"]');
    expect(panel?.textContent).toContain('Turn 1');
    expect(panel?.textContent).toContain('gemini-2.5-flash');
    expect(html().querySelector('[data-testid="ai-trace-body"]')).toBeNull();

    const toggle = html().querySelector('[data-testid="ai-trace-toggle"]') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(html().querySelector('[data-testid="ai-trace-body"]')).toBeTruthy();
    expect(html().querySelector('[data-testid="ai-trace-body"]')?.textContent).toContain(
      '1250 in / 180 out',
    );
  });

  it('expands tool calls to show arguments and result JSON', async () => {
    await setup();

    const traceToggle = html().querySelector(
      '[data-testid="ai-trace-toggle"]',
    ) as HTMLButtonElement;
    traceToggle.click();
    fixture.detectChanges();

    expect(html().querySelector('[data-testid="tool-call"]')).toBeTruthy();
    expect(html().querySelector('[data-testid="tool-call-details"]')).toBeNull();

    const toolToggle = html().querySelector(
      '[data-testid="tool-call-toggle"]',
    ) as HTMLButtonElement;
    toolToggle.click();
    fixture.detectChanges();

    const details = html().querySelector('[data-testid="tool-call-details"]');
    const toolCall = html().querySelector('[data-testid="tool-call"]');
    expect(toolCall?.textContent).toContain('consultar_disponibilidad');
    expect(details?.textContent).toContain('dermatología');
    expect(html().querySelector('[data-testid="tool-call-arguments"]')?.textContent).toContain(
      'especialidad',
    );
    expect(html().querySelector('[data-testid="tool-call-result"]')?.textContent).toContain(
      'Dr. García',
    );
  });

  it('collapses an expanded AI trace when toggled again', async () => {
    await setup();

    const toggle = html().querySelector('[data-testid="ai-trace-toggle"]') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    expect(html().querySelector('[data-testid="ai-trace-body"]')).toBeTruthy();

    toggle.click();
    fixture.detectChanges();
    expect(html().querySelector('[data-testid="ai-trace-body"]')).toBeNull();
  });

  it('shows loading state during fetch', async () => {
    await setup({ getConversation: vi.fn().mockReturnValue(new Subject<ConversationDetail>()) });

    expect(html().querySelector('app-loading-spinner')).toBeTruthy();
  });

  it('shows error state with retry', async () => {
    const failing = vi
      .fn()
      .mockReturnValueOnce(
        throwError(
          () =>
            new AppApiError({
              error: 'ConversationNotFoundError',
              message: 'Conversation not found',
              status: 404,
            }),
        ),
      )
      .mockReturnValue(of(conversation));

    await setup({ getConversation: failing });

    const errorEl = html().querySelector('[data-testid="conversation-detail-error"]');
    expect(errorEl?.textContent).toContain('Conversation not found');

    const retryButton = errorEl?.querySelector('button') as HTMLButtonElement;
    retryButton.click();
    fixture.detectChanges();

    expect(component.error()).toBeNull();
    expect(component.conversation()?.id).toBe('conv-1');
  });

  it('navigates back to the inbox', async () => {
    await setup();

    const backButton = html().querySelector(
      '[data-testid="conversation-back"]',
    ) as HTMLButtonElement;
    backButton.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/conversations']);
  });
});
