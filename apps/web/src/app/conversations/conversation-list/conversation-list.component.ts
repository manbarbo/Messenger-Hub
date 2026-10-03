import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { isAppApiError } from '../../core/app-api.error';
import { LoggerService } from '../../core/logger.service';
import type { PaginationMeta } from '../../core/models/api.model';
import {
  CONVERSATION_STATUS_LABELS,
  CONVERSATION_STATUSES,
  type ConversationStatus,
  type ConversationSummary,
} from '../../core/models/conversation.model';
import { ErrorMessageComponent } from '../../shared/error-message/error-message.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-conversation-list',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    ErrorMessageComponent,
    PaginationComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './conversation-list.component.html',
  styleUrl: './conversation-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationListComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly logger = inject(LoggerService);

  readonly pageSize = PAGE_SIZE;
  readonly statusFilter = signal<ConversationStatus | ''>('');
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly conversations = signal<readonly ConversationSummary[]>([]);
  readonly pagination = signal<PaginationMeta>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  readonly statusOptions = CONVERSATION_STATUSES.map((status) => ({
    value: status,
    label: CONVERSATION_STATUS_LABELS[status],
  }));

  readonly skeletonRows = [0, 1, 2, 3, 4];

  constructor() {
    this.loadConversations();
  }

  onStatusFilterChange(status: ConversationStatus | ''): void {
    this.logger.info('Status filter changed', 'ConversationList', { status });
    this.statusFilter.set(status);
    this.page.set(1);
    this.loadConversations();
  }

  onPageChange(page: number): void {
    this.logger.debug('Page changed', 'ConversationList', { page });
    this.page.set(page);
    this.loadConversations();
  }

  openConversation(conversation: ConversationSummary): void {
    void this.router.navigate(['/conversations', conversation.id]);
  }

  loadConversations(): void {
    this.loading.set(true);
    this.error.set(null);

    const status = this.statusFilter();

    this.api
      .listConversations({
        ...(status ? { status } : {}),
        page: this.page(),
        limit: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.conversations.set(response.data);
          this.pagination.set(response.pagination);
          this.loading.set(false);
          this.logger.debug('Conversations loaded', 'ConversationList', {
            count: response.data.length,
            page: response.pagination.page,
            total: response.pagination.total,
          });
        },
        error: (err: unknown) => {
          this.error.set(isAppApiError(err) ? err.message : 'Failed to load conversations');
          this.loading.set(false);
          this.logger.error('Failed to load conversations', 'ConversationList', {
            message: err instanceof Error ? err.message : String(err),
          });
        },
      });
  }
}
