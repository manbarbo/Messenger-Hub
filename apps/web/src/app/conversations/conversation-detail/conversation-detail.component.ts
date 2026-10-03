import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { isAppApiError } from '../../core/app-api.error';
import type { ConversationDetail } from '../../core/models/conversation.model';
import { ErrorMessageComponent } from '../../shared/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { AITracePanelComponent } from './ai-trace-panel/ai-trace-panel.component';
import { ConversationHeaderComponent } from './conversation-header/conversation-header.component';
import { MessageTimelineComponent } from './message-timeline/message-timeline.component';

@Component({
  selector: 'app-conversation-detail',
  imports: [
    AITracePanelComponent,
    ConversationHeaderComponent,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    MessageTimelineComponent,
  ],
  templateUrl: './conversation-detail.component.html',
  styleUrl: './conversation-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationDetailComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly conversation = signal<ConversationDetail | null>(null);
  readonly conversationId = signal<string | null>(null);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.conversationId.set(id);
      if (id) {
        this.loadConversation(id);
      }
    });
  }

  goBack(): void {
    void this.router.navigate(['/conversations']);
  }

  loadConversation(id: string = this.conversationId() ?? ''): void {
    if (!id) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api
      .getConversation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (conversation) => {
          this.conversation.set(conversation);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(isAppApiError(err) ? err.message : 'Failed to load conversation');
          this.loading.set(false);
        },
      });
  }
}
