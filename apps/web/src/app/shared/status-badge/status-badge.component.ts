import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ConversationStatus } from '../../core/models/conversation.model';

interface StatusMeta {
  readonly label: string;
  readonly className: string;
}

const STATUS_META: Readonly<Record<ConversationStatus, StatusMeta>> = {
  active: { label: 'Active', className: 'status-badge--active' },
  resolved_by_ai: { label: 'Resolved by AI', className: 'status-badge--resolved-by-ai' },
  appointment_booked: { label: 'Appointment booked', className: 'status-badge--appointment-booked' },
  escalated: { label: 'Escalated', className: 'status-badge--escalated' },
};

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  readonly status = input.required<ConversationStatus>();

  readonly label = computed(() => STATUS_META[this.status()]?.label ?? this.status());
  readonly className = computed(
    () => STATUS_META[this.status()]?.className ?? 'status-badge--unknown',
  );
}
