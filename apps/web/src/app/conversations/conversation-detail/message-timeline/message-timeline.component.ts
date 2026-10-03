import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ConversationMessage } from '../../../core/models/message.model';

@Component({
  selector: 'app-message-timeline',
  imports: [DatePipe],
  templateUrl: './message-timeline.component.html',
  styleUrl: './message-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageTimelineComponent {
  readonly messages = input.required<readonly ConversationMessage[]>();

  isUser(message: ConversationMessage): boolean {
    return message.role === 'user' || message.direction === 'inbound';
  }

  labelFor(message: ConversationMessage): string {
    if (message.role === 'user' || message.direction === 'inbound') {
      return 'Patient';
    }
    if (message.role === 'assistant' || message.direction === 'outbound') {
      return 'Assistant';
    }
    return 'System';
  }
}
