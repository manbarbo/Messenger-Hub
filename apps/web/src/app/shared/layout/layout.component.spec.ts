import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { LayoutComponent } from './layout.component';

describe('LayoutComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [provideRouter([]), provideNoopAnimations()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render brand and navigation links', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('MessengerHub');
    expect(compiled.querySelector('a[routerlink="/conversations"]')).toBeTruthy();
    expect(compiled.querySelector('a[routerlink="/simulator"]')).toBeTruthy();
  });

  it('should toggle the sidenav', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    const component = fixture.componentInstance;
    expect(component.sidenavOpen()).toBe(false);

    component.toggleSidenav();
    expect(component.sidenavOpen()).toBe(true);

    component.toggleSidenav();
    expect(component.sidenavOpen()).toBe(false);
  });
});
