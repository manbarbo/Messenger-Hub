import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { isAppApiError } from '../core/app-api.error';
import { LoggerService } from '../core/logger.service';
import type { Clinic } from '../core/models/clinic.model';
import type { SimulatorResponse } from '../core/models/api.model';

interface FormErrors {
  readonly phone: string | null;
  readonly text: string | null;
}

const EMPTY_ERRORS: FormErrors = { phone: null, text: null };

@Component({
  selector: 'app-simulator',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
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

  constructor() {
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
      .pipe(takeUntilDestroyed(this.destroyRef))
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
    const phone = this.phone().trim();
    const message = this.message().trim();
    const clinicId = this.clinicId().trim();

    const nextErrors: FormErrors = {
      phone: phone.length === 0 ? 'Phone is required' : null,
      text: message.length === 0 ? 'Message is required' : null,
    };
    this.errors.set(nextErrors);

    if (nextErrors.phone || nextErrors.text) {
      this.logger.warn('Simulator form validation failed', 'Simulator', {
        errors: nextErrors,
      });
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.result.set(null);

    this.logger.info('Sending simulator message', 'Simulator', {
      phone,
      clinicId,
    });

    this.api
      .sendSimulatorMessage({
        from: phone,
        text: message,
        ...(clinicId ? { clinicId } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.result.set(response);
          this.message.set('');
          this.loading.set(false);
          this.snackBar.open('Message sent to the assistant', 'OK', { duration: 4000 });
          this.logger.info('Simulator message sent successfully', 'Simulator', {
            messageId: response.messageId,
            conversationId: response.conversationId,
          });
        },
        error: (err: unknown) => {
          const message =
            isAppApiError(err) ? err.message : 'Failed to send simulator message';
          this.errorMessage.set(message);
          this.loading.set(false);
          this.snackBar.open(message, 'Dismiss', { duration: 5000 });
          this.logger.error('Failed to send simulator message', 'Simulator', {
            message: err instanceof Error ? err.message : String(err),
          });
        },
      });
  }

  viewConversation(): void {
    const result = this.result();
    if (!result) {
      return;
    }
    void this.router.navigate(['/conversations', result.conversationId]);
  }
}
