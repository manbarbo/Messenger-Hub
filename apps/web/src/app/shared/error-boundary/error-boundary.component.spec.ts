import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorBoundaryComponent } from './error-boundary.component';

describe('ErrorBoundaryComponent', () => {
  let fixture: ComponentFixture<ErrorBoundaryComponent>;
  let component: ErrorBoundaryComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorBoundaryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorBoundaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders ng-content when no error', () => {
    const hostEl = fixture.nativeElement as HTMLElement;
    expect(hostEl.querySelector('.error-boundary')).toBeNull();
  });

  it('shows error UI when hasError is true', () => {
    component.hasError.set(true);
    component.errorMessage.set('Something broke');
    fixture.detectChanges();

    const hostEl = fixture.nativeElement as HTMLElement;
    const boundary = hostEl.querySelector('.error-boundary');
    expect(boundary).toBeTruthy();
    expect(boundary?.textContent).toContain('Something went wrong');
    expect(boundary?.textContent).toContain('Something broke');
  });

  it('shows try again button when in error state', () => {
    component.hasError.set(true);
    component.errorMessage.set('Error');
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button).toBeTruthy();
    expect(button?.textContent).toContain('Try again');
  });

  it('resets error state on retry', () => {
    component.hasError.set(true);
    component.errorMessage.set('Error');
    fixture.detectChanges();

    component.retry();
    fixture.detectChanges();

    expect(component.hasError()).toBe(false);
    expect(component.errorMessage()).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelector('.error-boundary')).toBeNull();
  });

  it('retry button triggers retry method', () => {
    component.hasError.set(true);
    component.errorMessage.set('Error');
    fixture.detectChanges();

    const spy = vi.spyOn(component, 'retry');
    const button = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
    button.click();

    expect(spy).toHaveBeenCalled();
  });
});