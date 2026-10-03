import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let fixture: ComponentFixture<PaginationComponent>;
  let component: PaginationComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes range label', () => {
    fixture.componentRef.setInput('page', 2);
    fixture.componentRef.setInput('limit', 10);
    fixture.componentRef.setInput('total', 25);
    fixture.detectChanges();

    expect(component.rangeLabel()).toBe('11–20 of 25');
  });

  it('emits pageChange for previous and next', () => {
    fixture.componentRef.setInput('page', 2);
    fixture.componentRef.setInput('totalPages', 3);
    const pages: number[] = [];
    component.pageChange.subscribe((page) => pages.push(page));

    component.previous();
    component.next();

    expect(pages).toEqual([1, 3]);
  });

  it('does not emit beyond bounds', () => {
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalPages', 1);
    const pages: number[] = [];
    component.pageChange.subscribe((page) => pages.push(page));

    component.previous();
    component.next();

    expect(pages).toEqual([]);
  });
});
