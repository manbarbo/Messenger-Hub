import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { ConversationDetail } from '../../../core/models/conversation.model';
import { StatusBadgeComponent } from '../../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-conversation-header',
  imports: [DatePipe, MatButtonModule, StatusBadgeComponent],
  templateUrl: './conversation-header.component.html',
  styleUrl: './conversation-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationHeaderComponent {
  readonly conversation = input.required<ConversationDetail>();
  readonly back = output<void>();

  onBack(): void {
    this.back.emit();
  }
}
