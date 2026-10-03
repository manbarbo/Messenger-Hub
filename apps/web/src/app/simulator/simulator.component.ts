import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-simulator',
  template: `
    <section class="placeholder">
      <h2>Patient simulator</h2>
      <p>Simulator form will be implemented in T-6.4.</p>
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
export class SimulatorComponent {}
