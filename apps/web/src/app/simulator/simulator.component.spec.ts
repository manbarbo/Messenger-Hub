import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextOnlySnackBar } from '@angular/material/snack-bar';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../core/api.service';
import { AppApiError } from '../core/app-api.error';
import type { SimulatorResponse } from '../core/models/api.model';
import { SimulatorComponent } from './simulator.component';

describe('SimulatorComponent', () => {
  const successResponse: SimulatorResponse = {
    status: 'accepted',
    messageId: 'wamid.sim.1',
    conversationId: 'conv-1',
  };

  interface SnackbarCall {
    readonly message: string;
    readonly action?: string;
    readonly config?: MatSnackBarConfig<TextOnlySnackBar>;
  }

  let sendSimulatorMessage: ReturnType<typeof vi.fn>;
  let snackbarCalls: SnackbarCall[];
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  let fixture: ComponentFixture<SimulatorComponent>;
  let component: SimulatorComponent;

  async function setup(options?: { send?: ReturnType<typeof vi.fn> }) {
    sendSimulatorMessage = options?.send ?? vi.fn().mockReturnValue(of(successResponse));
    snackbarCalls = [];

    await TestBed.configureTestingModule({
      imports: [SimulatorComponent],
      providers: [
        { provide: ApiService, useValue: { sendSimulatorMessage } },
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
    const form = html().querySelector('[data-testid="simulator-form"]') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('renders phone, message, and send controls', async () => {
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

  it('sends the message and shows success state with toast', async () => {
    await setup();

    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola, ¿tienen cita?');
    submitForm();

    expect(sendSimulatorMessage).toHaveBeenCalledWith({
      from: '+573001112233',
      text: 'Hola, ¿tienen cita?',
    });
    expect(component.result()?.conversationId).toBe('conv-1');
    expect(component.loading()).toBe(false);

    const success = html().querySelector('[data-testid="simulator-success"]');
    expect(success?.textContent).toContain('conv-1');
    expect(snackbarCalls).toEqual([
      {
        message: 'Message sent to the assistant',
        action: 'OK',
        config: expect.objectContaining({ duration: 4000 }),
      },
    ]);
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

  it('shows error toast and inline error on failure', async () => {
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

    expect(component.result()).toBeNull();
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

  it('shows loading state while sending', async () => {
    await setup({ send: vi.fn().mockReturnValue(new Subject<SimulatorResponse>()) });

    setInput('simulator-phone', '+573001112233');
    setInput('simulator-message', 'Hola');
    submitForm();

    expect(component.loading()).toBe(true);
    expect(
      (html().querySelector('[data-testid="simulator-submit"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(html().querySelector('[data-testid="simulator-submit"]')?.textContent).toContain(
      'Sending',
    );
  });

  it('navigates to the conversation after view conversation is clicked', async () => {
    await setup();

    component.result.set(successResponse);
    fixture.detectChanges();

    const viewButton = html().querySelector(
      '[data-testid="simulator-view-conversation"]',
    ) as HTMLButtonElement;
    viewButton.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/conversations', 'conv-1']);
  });
});
