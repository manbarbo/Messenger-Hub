import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorMessageComponent } from './error-message.component';

describe('ErrorMessageComponent', () => {
  let fixture: ComponentFixture<ErrorMessageComponent>;
  let component: ErrorMessageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorMessageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders title and message', () => {
    fixture.componentRef.setInput('title', 'Failed to load');
    fixture.componentRef.setInput('message', 'Network unavailable');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.error-message__title')?.textContent).toContain(
      'Failed to load',
    );
    expect(el.querySelector('.error-message__body')?.textContent).toContain(
      'Network unavailable',
    );
  });

  it('emits retry when enabled and clicked', () => {
    fixture.componentRef.setInput('canRetry', true);
    fixture.detectChanges();

    let retried = false;
    component.retry.subscribe(() => (retried = true));

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button.error-message__retry',
    ) as HTMLButtonElement;
    button.click();

    expect(retried).toBe(true);
  });
});
