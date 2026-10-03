import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-error-message',
  imports: [MatButtonModule],
  templateUrl: './error-message.component.html',
  styleUrl: './error-message.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorMessageComponent {
  readonly title = input('Something went wrong');
  readonly message = input('An unexpected error occurred');
  readonly canRetry = input(false);
  readonly retry = output<void>();

  onRetry(): void {
    this.retry.emit();
  }
}
