import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CONVERSATION_STATUS_LABELS,
  type ConversationStatus,
} from '../../core/models/conversation.model';

interface StatusMeta {
  readonly className: string;
}

const STATUS_META: Readonly<Record<ConversationStatus, StatusMeta>> = {
  active: { className: 'status-badge--active' },
  resolved_by_ai: { className: 'status-badge--resolved-by-ai' },
  appointment_booked: { className: 'status-badge--appointment-booked' },
  escalated: { className: 'status-badge--escalated' },
};

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  readonly status = input.required<ConversationStatus>();

  readonly label = computed(() => CONVERSATION_STATUS_LABELS[this.status()] ?? this.status());
  readonly className = computed(
    () => STATUS_META[this.status()]?.className ?? 'status-badge--unknown',
  );
}
