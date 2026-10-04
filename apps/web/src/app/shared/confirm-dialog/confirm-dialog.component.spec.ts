import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let component: ConfirmDialogComponent;
  let confirmed: ReturnType<typeof vi.fn<() => void>>;
  let cancelled: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(async () => {
    confirmed = vi.fn<() => void>();
    cancelled = vi.fn<() => void>();

    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Delete document');
    fixture.componentRef.setInput('message', 'Delete this document?');
    fixture.componentRef.setInput('confirmLabel', 'Delete');
    fixture.componentRef.setInput('danger', true);
    component.confirmed.subscribe(() => confirmed());
    component.cancelled.subscribe(() => cancelled());
    fixture.detectChanges();
  });

  function html(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders title and message', () => {
    expect(html().querySelector('[data-testid="confirm-dialog-title"]')?.textContent).toContain(
      'Delete document',
    );
    expect(
      html().querySelector('[data-testid="confirm-dialog-message"]')?.textContent,
    ).toContain('Delete this document?');
  });

  it('emits confirmed on confirm click', () => {
    (html().querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement).click();
    expect(confirmed).toHaveBeenCalledTimes(1);
  });

  it('emits cancelled on cancel click', () => {
    (html().querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLButtonElement).click();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('does not emit while busy', () => {
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();

    (html().querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement).click();
    (html().querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLButtonElement).click();

    expect(confirmed).not.toHaveBeenCalled();
    expect(cancelled).not.toHaveBeenCalled();
    expect(
      (html().querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
