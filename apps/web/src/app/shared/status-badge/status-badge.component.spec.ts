import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  let fixture: ComponentFixture<StatusBadgeComponent>;
  let component: StatusBadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusBadgeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('status', 'active');
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it.each([
    ['active', 'Active', 'status-badge--active'],
    ['resolved_by_ai', 'Resolved by AI', 'status-badge--resolved-by-ai'],
    ['appointment_booked', 'Appointment booked', 'status-badge--appointment-booked'],
    ['escalated', 'Escalated', 'status-badge--escalated'],
  ] as const)('renders label and color for %s', (status, label, className) => {
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('[data-testid="status-badge"]');
    expect(badge?.textContent?.trim()).toBe(label);
    expect(badge?.className).toContain(className);
  });
});
