import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-conversation-list',
  template: `
    <section class="placeholder">
      <h2>Conversations</h2>
      <p>Conversation inbox will be implemented in T-6.2.</p>
    </section>
  `,
  styles: [
    `
      .placeholder {
        padding: 1rem 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationListComponent {}
