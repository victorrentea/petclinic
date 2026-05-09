import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationToolbarComponent, PageSlot, computeSlots } from './pagination-toolbar.component';

describe('PaginationToolbarComponent', () => {
  let component: PaginationToolbarComponent;
  let fixture: ComponentFixture<PaginationToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaginationToolbarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationToolbarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('computeSlots - worked examples with 10 total pages', () => {

    it('current=1: should produce slots [1,2,3,10]', () => {
      const slots = computeSlots(1, 10);
      expect(slots.map(s => s.page)).toEqual([1, 2, 3, 10]);
    });

    it('current=2: should produce slots [1,2,3,4,10]', () => {
      const slots = computeSlots(2, 10);
      expect(slots.map(s => s.page)).toEqual([1, 2, 3, 4, 10]);
    });

    it('current=3: should produce slots [1,2,3,4,5,10]', () => {
      const slots = computeSlots(3, 10);
      expect(slots.map(s => s.page)).toEqual([1, 2, 3, 4, 5, 10]);
    });

    it('current=4: should produce slots [1,2,3,4,5,6,10]', () => {
      const slots = computeSlots(4, 10);
      expect(slots.map(s => s.page)).toEqual([1, 2, 3, 4, 5, 6, 10]);
    });

    it('current=7: should produce slots [1,5,6,7,8,9,10]', () => {
      const slots = computeSlots(7, 10);
      expect(slots.map(s => s.page)).toEqual([1, 5, 6, 7, 8, 9, 10]);
    });

    it('current=8: should produce slots [1,6,7,8,9,10]', () => {
      const slots = computeSlots(8, 10);
      expect(slots.map(s => s.page)).toEqual([1, 6, 7, 8, 9, 10]);
    });

    it('current=9: should produce slots [1,7,8,9,10]', () => {
      const slots = computeSlots(9, 10);
      expect(slots.map(s => s.page)).toEqual([1, 7, 8, 9, 10]);
    });

    it('current=10: should produce slots [1,8,9,10]', () => {
      const slots = computeSlots(10, 10);
      expect(slots.map(s => s.page)).toEqual([1, 8, 9, 10]);
    });
  });

  describe('slot invariants', () => {

    it('slots length should be ≤ 7', () => {
      for (let current = 1; current <= 10; current++) {
        const slots = computeSlots(current, 10);
        expect(slots.length).toBeLessThanOrEqual(7);
      }
    });

    it('all slot page numbers should be unique', () => {
      for (let current = 1; current <= 10; current++) {
        const slots = computeSlots(current, 10);
        const pages = slots.map(s => s.page);
        expect(pages.length).toBe(new Set(pages).size);
      }
    });

    it('all slot page numbers should be in [1, totalPages]', () => {
      for (let current = 1; current <= 10; current++) {
        const slots = computeSlots(current, 10);
        for (const slot of slots) {
          expect(slot.page).toBeGreaterThanOrEqual(1);
          expect(slot.page).toBeLessThanOrEqual(10);
        }
      }
    });

    it('slots should be sorted in ascending order', () => {
      for (let current = 1; current <= 10; current++) {
        const slots = computeSlots(current, 10);
        for (let i = 1; i < slots.length; i++) {
          expect(slots[i].page).toBeGreaterThan(slots[i - 1].page);
        }
      }
    });
  });

  describe('isCurrent marking', () => {

    it('exactly one slot should be marked isCurrent', () => {
      for (let current = 1; current <= 10; current++) {
        const slots = computeSlots(current, 10);
        const currentSlots = slots.filter(s => s.isCurrent);
        expect(currentSlots.length).toBe(1);
      }
    });

    it('the isCurrent slot should have the correct page number', () => {
      for (let current = 1; current <= 10; current++) {
        const slots = computeSlots(current, 10);
        const currentSlot = slots.find(s => s.isCurrent)!;
        expect(currentSlot.page).toBe(current);
      }
    });
  });

  describe('label formatting', () => {

    it('first slot should have « prefix in its label', () => {
      const slots = computeSlots(5, 10);
      expect(slots[0].label).toContain('«');
      expect(slots[0].page).toBe(1);
    });

    it('last slot should have » suffix in its label', () => {
      const slots = computeSlots(5, 10);
      const lastSlot = slots[slots.length - 1];
      expect(lastSlot.label).toContain('»');
      expect(lastSlot.page).toBe(10);
    });

    it('middle slots should have plain cardinal number labels', () => {
      const slots = computeSlots(5, 10);
      // Middle slots (not first, not last)
      const middleSlots = slots.slice(1, -1);
      for (const slot of middleSlots) {
        expect(slot.label).toBe(slot.page.toString());
      }
    });

    it('when totalPages=1, single slot has both « and »', () => {
      const slots = computeSlots(1, 1);
      expect(slots.length).toBe(1);
      expect(slots[0].label).toContain('«');
      expect(slots[0].label).toContain('»');
    });
  });

  describe('hidden when totalPages=0', () => {

    it('should be hidden when totalPages is 0', () => {
      component.currentPage = 1;
      component.totalPages = 0;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.pagination-toolbar')).toBeNull();
    });
  });

  describe('pageChange output', () => {

    it('should emit pageChange when a slot is clicked', () => {
      component.currentPage = 5;
      component.totalPages = 10;
      fixture.detectChanges();

      const emitted: number[] = [];
      component.pageChange.subscribe(p => emitted.push(p));

      const buttons = fixture.nativeElement.querySelectorAll('.pagination-toolbar button');
      // Click the first button (page 1)
      if (buttons.length > 0) {
        buttons[0].click();
        expect(emitted.length).toBe(1);
        expect(emitted[0]).toBe(1);
      }
    });
  });
});
