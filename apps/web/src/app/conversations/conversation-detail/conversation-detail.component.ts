import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-conversation-detail',
  template: `
    <section class="placeholder">
      <h2>Conversation detail</h2>
      <p>Messages and AI traces will be implemented in T-6.3.</p>
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
export class ConversationDetailComponent {}
