import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subscription, switchMap, timer } from 'rxjs';
import { ApiService } from '../core/api.service';
import { isAppApiError } from '../core/app-api.error';
import { LoggerService } from '../core/logger.service';
import type { Clinic } from '../core/models/clinic.model';
import type { ConversationMessage } from '../core/models/message.model';
import type { SimulatorResponse } from '../core/models/api.model';
import { MessageTimelineComponent } from '../conversations/conversation-detail/message-timeline/message-timeline.component';

interface FormErrors {
  readonly phone: string | null;
  readonly text: string | null;
}

type SimulatorMode = 'form' | 'chat';

const EMPTY_ERRORS: FormErrors = { phone: null, text: null };
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

@Component({
  selector: 'app-simulator',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MessageTimelineComponent,
  ],
  templateUrl: './simulator.component.html',
  styleUrl: './simulator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulatorComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly logger = inject(LoggerService);

  private pollSubscription: Subscription | null = null;

  readonly phone = signal('');
  readonly message = signal('');
  readonly clinicId = signal('');
  readonly clinics = signal<readonly Clinic[]>([]);
  readonly clinicsLoading = signal(false);
  readonly clinicsError = signal<string | null>(null);
  readonly loading = signal(false);
  readonly result = signal<SimulatorResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly errors = signal<FormErrors>(EMPTY_ERRORS);

  readonly mode = signal<SimulatorMode>('form');
  readonly messages = signal<readonly ConversationMessage[]>([]);
  readonly pending = signal(false);
  readonly pollTimedOut = signal(false);
  readonly conversationId = signal('');
  readonly lockedPhone = signal('');
  readonly lockedClinicId = signal('');
  readonly lockedClinicName = signal('');

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPolling());
    this.loadClinics();
  }

  onPhoneInput(event: Event): void {
    this.phone.set((event.target as HTMLInputElement).value);
  }

  onMessageInput(event: Event): void {
    this.message.set((event.target as HTMLTextAreaElement).value);
  }

  onClinicChange(clinicId: string): void {
    this.clinicId.set(clinicId);
    this.logger.debug('Clinic selected', 'Simulator', { hasClinicId: clinicId.length > 0 });
  }

  loadClinics(): void {
    this.clinicsLoading.set(true);
    this.clinicsError.set(null);

    this.api
      .listClinics()
      .subscribe({
        next: (clinics) => {
          this.clinics.set(clinics);
          this.clinicsLoading.set(false);
          this.logger.debug('Clinics loaded', 'Simulator', { count: clinics.length });
        },
        error: (err: unknown) => {
          this.clinics.set([]);
          this.clinicsLoading.set(false);
          this.clinicsError.set(
            isAppApiError(err) ? err.message : 'Failed to load clinics',
          );
          this.logger.error('Failed to load clinics', 'Simulator', {
            message: err instanceof Error ? err.message : String(err),
          });
        },
      });
  }

  send(): void {
    const isChat = this.mode() === 'chat';
    const phone = (isChat ? this.lockedPhone() : this.phone()).trim();
    const clinicId = (isChat ? this.lockedClinicId() : this.clinicId()).trim();
    const messageText = this.message().trim();

    const nextErrors: FormErrors = {
      phone: !isChat && phone.length === 0 ? 'Phone is required' : null,
      text: messageText.length === 0 ? 'Message is required' : null,
    };
    this.errors.set(nextErrors);

    if (nextErrors.phone || nextErrors.text) {
      this.logger.warn('Simulator form validation failed', 'Simulator', {
        errors: nextErrors,
        mode: this.mode(),
      });
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.pollTimedOut.set(false);

    this.logger.info('Sending simulator message', 'Simulator', {
      mode: this.mode(),
      hasClinicId: clinicId.length > 0,
    });

    this.api
      .sendSimulatorMessage({
        from: phone,
        text: messageText,
        ...(clinicId ? { clinicId } : {}),
      })
      .subscribe({
        next: (response) => {
          this.result.set(response);
          this.message.set('');
          this.loading.set(false);
          this.conversationId.set(response.conversationId);
          this.pending.set(true);

          if (!isChat) {
            this.lockedPhone.set(phone);
            this.lockedClinicId.set(clinicId);
            this.lockedClinicName.set(this.clinicNameFor(clinicId));
            this.mode.set('chat');
          }

          this.messages.set([
            ...this.messages(),
            {
              id: `local-${response.messageId}`,
              conversationId: response.conversationId,
              clinicId: clinicId || this.lockedClinicId(),
              direction: 'inbound',
              role: 'user',
              content: messageText,
              messageId: response.messageId,
              createdAt: new Date().toISOString(),
            },
          ]);

          this.snackBar.open('Message sent to the assistant', 'OK', { duration: 4000 });
          this.logger.info('Simulator message sent successfully', 'Simulator', {
            messageId: response.messageId,
            conversationId: response.conversationId,
          });

          this.startPolling(response.conversationId, response.messageId);
        },
        error: (err: unknown) => {
          const message =
            isAppApiError(err) ? err.message : 'Failed to send simulator message';
          this.errorMessage.set(message);
          this.loading.set(false);
          if (!isChat) {
            this.pending.set(false);
          }
          this.snackBar.open(message, 'Dismiss', { duration: 5000 });
          this.logger.error('Failed to send simulator message', 'Simulator', {
            message: err instanceof Error ? err.message : String(err),
          });
        },
      });
  }

  viewConversation(): void {
    const id = this.conversationId();
    if (!id) {
      return;
    }
    this.logger.debug('Navigating to conversation from simulator', 'Simulator', {
      conversationId: id,
    });
    void this.router.navigate(['/conversations', id]);
  }

  resetChat(): void {
    this.stopPolling();
    this.mode.set('form');
    this.messages.set([]);
    this.conversationId.set('');
    this.pending.set(false);
    this.pollTimedOut.set(false);
    this.result.set(null);
    this.errorMessage.set(null);
    this.message.set('');
    this.errors.set(EMPTY_ERRORS);
    this.phone.set(this.lockedPhone());
    this.clinicId.set(this.lockedClinicId());
    this.logger.info('Simulator chat reset', 'Simulator');
  }

  private clinicNameFor(clinicId: string): string {
    if (!clinicId) {
      return 'Default clinic';
    }
    return this.clinics().find((clinic) => clinic.id === clinicId)?.name ?? 'Clinic';
  }

  private startPolling(conversationId: string, inboundMessageId: string): void {
    this.stopPolling();
    this.pending.set(true);
    this.pollTimedOut.set(false);

    const expectedMessageId = `assistant:${inboundMessageId}`;
    let attempts = 0;

    this.logger.debug('Polling conversation for assistant reply', 'Simulator', {
      conversationId,
    });

    this.pollSubscription = timer(0, POLL_INTERVAL_MS)
      .pipe(switchMap(() => this.api.getConversation(conversationId)))
      .subscribe({
        next: (detail) => {
          this.messages.set(detail.messages);
          attempts += 1;

          const replied = detail.messages.some(
            (message) => message.messageId === expectedMessageId,
          );

          if (replied) {
            this.stopPolling();
            this.pending.set(false);
            this.pollTimedOut.set(false);
            this.logger.info('Assistant reply received', 'Simulator', {
              conversationId,
              messageId: inboundMessageId,
              attempts,
            });
            return;
          }

          if (attempts >= MAX_POLL_ATTEMPTS) {
            this.stopPolling();
            this.pending.set(false);
            this.pollTimedOut.set(true);
            this.logger.warn('Assistant reply poll timed out', 'Simulator', {
              conversationId,
              attempts,
            });
          }
        },
        error: (err: unknown) => {
          this.stopPolling();
          this.pending.set(false);
          this.pollTimedOut.set(true);
          this.logger.error('Failed to poll conversation for assistant reply', 'Simulator', {
            conversationId,
            message: err instanceof Error ? err.message : String(err),
          });
        },
      });
  }

  private stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
  }
}
