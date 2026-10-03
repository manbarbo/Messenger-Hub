import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LayoutComponent } from './shared/layout/layout.component';

@Component({
  selector: 'app-root',
  imports: [LayoutComponent],
  template: '<app-layout />',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
