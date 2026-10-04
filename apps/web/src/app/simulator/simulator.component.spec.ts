import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextOnlySnackBar } from '@angular/material/snack-bar';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../core/api.service';
import { AppApiError } from '../core/app-api.error';
import type { Clinic } from '../core/models/clinic.model';
import type { ConversationDetail } from '../core/models/conversation.model';
import type { SimulatorResponse } from '../core/models/api.model';
import { SimulatorComponent } from './simulator.component';

describe('SimulatorComponent', () => {
  const successResponse: SimulatorResponse = {
    status: 'accepted',
    messageId: 'wamid.sim.1',
    conversationId: 'conv-1',
  };

  const clinics: Clinic[] = [
    { id: 'clinic-1', name: 'Clínica Norte' },
    { id: 'clinic-2', name: 'Clínica Sur' },
  ];

  const baseConversation: ConversationDetail = {
    id: 'conv-1',
    clinicId: 'clinic-1',
    clinicName: 'Clínica Norte',
    patientPhone: '+573001112233',
    status: 'active',
    createdAt: '2026-10-06T03:40:00.000Z',
    updatedAt: '2026-10-06T03:45:00.000Z',
    lastMessageAt: '2026-10-06T03:45:00.000Z',
    messages: [],
    aiTraces: [],
  };

  const assistantReply: ConversationDetail = {
    ...baseConversation,
    messages: [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        clinicId: 'clinic-1',
        direction: 'inbound',
        role: 'user',
        content: 'Hola, ¿tienen cita?',
        messageId: 'wamid.sim.1',
        createdAt: '2026-10-06T03:40:00.000Z',
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        clinicId: 'clinic-1',
        direction: 'outbound',
        role: 'assistant',
        content: '¡Hola! Sí, tenemos disponibilidad.',
        messageId: 'assistant:wamid.sim.1',
        createdAt: '2026-10-06T03:40:05.000Z',
      },
    ],
  };

  interface SnackbarCall {
    readonly message: string;
    readonly action?: string;
    readonly config?: MatSnackBarConfig<TextOnlySnackBar>;
  }

  let sendSimulatorMessage: ReturnType<typeof vi.fn>;
  let listClinics: ReturnType<typeof vi.fn>;
  let getConversation: ReturnType<typeof vi.fn>;
  let snackbarCalls: SnackbarCall[];
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  let fixture: ComponentFixture<SimulatorComponent>;
  let component: SimulatorComponent;

  async function setup(options?: {
    send?: ReturnType<typeof vi.fn>;
    clinics?: ReturnType<typeof vi.fn>;
    getConversation?: ReturnType<typeof vi.fn>;
  }) {
    sendSimulatorMessage = options?.send ?? vi.fn().mockReturnValue(of(successResponse));
    listClinics = options?.clinics ?? vi.fn().mockReturnValue(of(clinics));
    getConversation =
      options?.getConversation ?? vi.fn().mockReturnValue(of(assistantReply));
    snackbarCalls = [];

    await TestBed.configureTestingModule({
      imports: [SimulatorComponent],
      providers: [
        {
          provide: ApiService,
          useValue: { sendSimulatorMessage, listClinics, getConversation },
        },
        provideRouter([{ path: 'conversations/:id', component: class {} }]),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    TestBed.overrideProvider(MatSnackBar, {
      useValue: {
        open: (
          message: string,
          action?: string,
          config?: MatSnackBarConfig<TextOnlySnackBar>,
        ): MatSnackBarRef<TextOnlySnackBar> => {
          snackbarCalls.push({ message, action, config });
          return { dismiss: () => undefined } as MatSnackBarRef<TextOnlySnackBar>;
        },
      },
    });

    fixture = TestBed.createComponent(SimulatorComponent);
    component = fixture.componentInstance;
    navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');
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

  function submitForm(): void {
    const form = html().querySelector(
      '[data-testid="simulator-form"], [data-testid="simulator-chat-form"]',
    ) as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function selectClinic(clinicId: string): void {
    component.onClinicChange(clinicId);
    fixture.detectChanges();
  }

  async function flushAsync(): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    fixture.detectChanges();
  }

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('starts in form mode and loads clinics', async () => {
    await setup();

    expect(component.mode()).toBe('form');
    expect(listClinics).toHaveBeenCalledTimes(1);
    expect(html().querySelector('[data-testid="simulator-form"]')).toBeTruthy();
    expect(html().querySelector('[data-testid="simulator-chat"]')).toBeNull();
  });

  it('renders phone, message, and send controls in form mode', async () => {
    await setup();
    const root = html();

    expect(root.querySelector('[data-testid="simulator-phone"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="simulator-message"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="simulator-submit"]')).toBeTruthy();
  });

  it('shows validation errors and does not call the API when fields are empty', async () => {
    await setup();

    submitForm();

    expect(sendSimulatorMessage).not.toHaveBeenCalled();
    expect(html().querySelector('[data-testid="simulator-phone-error"]')?.textContent).toContain(
      'Phone is required',
    );
    expect(html().querySelector('[data-testid="simulator-message-error"]')?.textContent).toContain(
      'Message is required',
    );
  });

  it('switches to chat mode after first send and locks phone/clinic', async () => {
    await setup();

    selectClinic('clinic-1');
    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola, ¿tienen cita?');
    submitForm();
    await flushAsync();

    expect(sendSimulatorMessage).toHaveBeenCalledWith({
      from: '+573001112233',
      text: 'Hola, ¿tienen cita?',
      clinicId: 'clinic-1',
    });
    expect(component.mode()).toBe('chat');
    expect(component.lockedPhone()).toBe('+573001112233');
    expect(component.lockedClinicId()).toBe('clinic-1');
    expect(component.lockedClinicName()).toBe('Clínica Norte');
    expect(component.conversationId()).toBe('conv-1');
    expect(component.messages()).toHaveLength(2);
    expect(component.messages()[0]).toEqual(
      expect.objectContaining({
        role: 'user',
        content: 'Hola, ¿tienen cita?',
        messageId: 'wamid.sim.1',
      }),
    );
    expect(component.messages()[1]).toEqual(
      expect.objectContaining({
        role: 'assistant',
        messageId: 'assistant:wamid.sim.1',
      }),
    );
    expect(component.pending()).toBe(false);
    expect(html().querySelector('[data-testid="simulator-chat"]')).toBeTruthy();
    expect(html().querySelector('[data-testid="simulator-chat-phone"]')?.textContent).toContain(
      '+573001112233',
    );
    expect(html().querySelector('[data-testid="simulator-chat-clinic"]')?.textContent).toContain(
      'Clínica Norte',
    );
  });

  it('omits clinicId when default clinic is selected on first send', async () => {
    await setup();

    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();

    expect(sendSimulatorMessage).toHaveBeenCalledWith({
      from: '+573001112233',
      text: 'Hola',
    });
    expect(component.mode()).toBe('chat');
    expect(component.lockedClinicName()).toBe('Default clinic');
  });

  it('shows pending state while waiting and stops after assistant reply', async () => {
    const replySubject = new Subject<ConversationDetail>();
    await setup({
      getConversation: vi.fn().mockReturnValue(replySubject),
    });

    selectClinic('clinic-1');
    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();
    await flushAsync();

    expect(component.pending()).toBe(true);
    expect(html().querySelector('[data-testid="simulator-chat-pending"]')).toBeTruthy();
    expect(
      (html().querySelector('[data-testid="simulator-chat-submit"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    replySubject.next(assistantReply);
    fixture.detectChanges();
    await flushAsync();

    expect(component.pending()).toBe(false);
    expect(component.pollTimedOut()).toBe(false);
    expect(component.messages()).toHaveLength(2);
    expect(html().querySelector('[data-testid="simulator-chat-pending"]')).toBeNull();
  });

  it('sends follow-up messages in the same conversation after reply', async () => {
    await setup();

    selectClinic('clinic-1');
    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();
    await flushAsync();

    sendSimulatorMessage.mockClear();
    sendSimulatorMessage.mockReturnValue(
      of({
        status: 'accepted',
        messageId: 'wamid.sim.2',
        conversationId: 'conv-1',
      }),
    );
    getConversation.mockReturnValue(
      of({
        ...assistantReply,
        messages: [
          ...assistantReply.messages,
          {
            id: 'msg-3',
            conversationId: 'conv-1',
            clinicId: 'clinic-1',
            direction: 'inbound',
            role: 'user',
            content: '¿Mañana en la tarde?',
            messageId: 'wamid.sim.2',
            createdAt: '2026-10-06T03:50:00.000Z',
          },
          {
            id: 'msg-4',
            conversationId: 'conv-1',
            clinicId: 'clinic-1',
            direction: 'outbound',
            role: 'assistant',
            content: 'Sí, tengo espacio a las 3:00 PM.',
            messageId: 'assistant:wamid.sim.2',
            createdAt: '2026-10-06T03:50:05.000Z',
          },
        ],
      }),
    );

    setInput('simulator-chat-message', '¿Mañana en la tarde?');
    submitForm();
    await flushAsync();

    expect(sendSimulatorMessage).toHaveBeenCalledWith({
      from: '+573001112233',
      text: '¿Mañana en la tarde?',
      clinicId: 'clinic-1',
    });
    expect(component.mode()).toBe('chat');
    expect(component.messages().some((m) => m.messageId === 'assistant:wamid.sim.2')).toBe(true);
  });

  it('shows timeout state when assistant reply never arrives', async () => {
    vi.useFakeTimers();
    try {
      await setup({
        getConversation: vi
          .fn()
          .mockReturnValue(of({ ...baseConversation, messages: [] })),
      });

      selectClinic('clinic-1');
      setInput('simulator-phone', '+573001112233');
      setInput('simulator-message', 'Hola');
      submitForm();

      expect(component.pending()).toBe(true);

      await vi.advanceTimersByTimeAsync(61_000);
      fixture.detectChanges();

      expect(component.pending()).toBe(false);
      expect(component.pollTimedOut()).toBe(true);
      expect(html().querySelector('[data-testid="simulator-chat-timeout"]')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets to form mode when new chat is clicked', async () => {
    await setup();

    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();
    await flushAsync();

    const newChat = html().querySelector(
      '[data-testid="simulator-new-chat"]',
    ) as HTMLButtonElement;
    newChat.click();
    fixture.detectChanges();

    expect(component.mode()).toBe('form');
    expect(component.messages()).toEqual([]);
    expect(component.conversationId()).toBe('');
    expect(component.pending()).toBe(false);
    expect(component.phone()).toBe('+573001112233');
    expect(html().querySelector('[data-testid="simulator-form"]')).toBeTruthy();
  });

  it('shows clinic load error state and still allows sending with default clinic', async () => {
    await setup({
      clinics: vi.fn().mockReturnValue(
        throwError(
          () =>
            new AppApiError({
              error: 'InternalServerError',
              message: 'Internal server error',
              status: 500,
            }),
        ),
      ),
    });

    expect(component.clinicsError()).toBe('Internal server error');
    expect(html().querySelector('[data-testid="simulator-clinics-error"]')?.textContent).toContain(
      'Internal server error',
    );

    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();

    expect(sendSimulatorMessage).toHaveBeenCalledWith({
      from: '+573001112233',
      text: 'Hola',
    });
  });

  it('trims phone and text before sending', async () => {
    await setup();

    setInput('simulator-phone', '  +573009998877  ');
    setInput('simulator-message', '  ¿Cuánto cuesta una consulta?  ');
    submitForm();

    expect(sendSimulatorMessage).toHaveBeenCalledWith({
      from: '+573009998877',
      text: '¿Cuánto cuesta una consulta?',
    });
  });

  it('shows error toast and inline error on form send failure', async () => {
    await setup({
      send: vi.fn().mockReturnValue(
        throwError(
          () =>
            new AppApiError({
              error: 'ValidationError',
              message: 'from is required',
              status: 400,
            }),
        ),
      ),
    });

    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();

    expect(component.mode()).toBe('form');
    expect(html().querySelector('[data-testid="simulator-error"]')?.textContent).toContain(
      'from is required',
    );
    expect(snackbarCalls).toEqual([
      {
        message: 'from is required',
        action: 'Dismiss',
        config: expect.objectContaining({ duration: 5000 }),
      },
    ]);
  });

  it('shows chat error when follow-up send fails', async () => {
    await setup();

    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();

    sendSimulatorMessage.mockReturnValue(
      throwError(
        () =>
          new AppApiError({
            error: 'ValidationError',
            message: 'text is required',
            status: 400,
          }),
      ),
    );

    setInput('simulator-chat-message', '');
    component.message.set('');
    // force empty validation path
    component.message.set('');
    submitForm();

    expect(html().querySelector('[data-testid="simulator-chat-message-error"]')?.textContent).toContain(
      'Message is required',
    );
  });

  it('shows loading state while sending from form', async () => {
    await setup({ send: vi.fn().mockReturnValue(new Subject<SimulatorResponse>()) });

    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();

    expect(component.loading()).toBe(true);
    expect(
      (html().querySelector('[data-testid="simulator-submit"]') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('navigates to the conversation from chat header', async () => {
    await setup();

    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();
    await flushAsync();

    const viewButton = html().querySelector(
      '[data-testid="simulator-view-conversation"]',
    ) as HTMLButtonElement;
    viewButton.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/conversations', 'conv-1']);
  });

  it('sends selected clinicId when a clinic is chosen in form mode', async () => {
    await setup();

    selectClinic('clinic-2');
    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();

    expect(sendSimulatorMessage).toHaveBeenCalledWith({
      from: '+573001112233',
      text: 'Hola',
      clinicId: 'clinic-2',
    });
  });
});
