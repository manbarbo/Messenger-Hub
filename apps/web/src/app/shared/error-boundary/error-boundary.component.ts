import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-error-boundary',
  imports: [MatButtonModule],
  template: `
    @if (hasError()) {
      <div class="error-boundary">
        <h2>Something went wrong</h2>
        <p>{{ errorMessage() }}</p>
        <button mat-raised-button color="primary" (click)="retry()">Try again</button>
      </div>
    } @else {
      <ng-content />
    }
  `,
  styles: `
    .error-boundary {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
      gap: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorBoundaryComponent {
  readonly hasError = signal(false);
  readonly errorMessage = signal('');

  retry(): void {
    this.hasError.set(false);
    this.errorMessage.set('');
  }
}