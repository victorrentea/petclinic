/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import * as fc from 'fast-check';

import { PaginationControlComponent } from './pagination-control.component';
import { OwnerListComponent } from '../owner-list/owner-list.component';
import { OwnerService } from '../owner.service';
import { OwnerPage } from '../owner-page';
import { Observable, of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { OwnersModule } from '../owners.module';
import { ActivatedRoute } from '@angular/router';
import { ActivatedRouteStub } from '../../testing/router-stubs';
import { OwnerListComponent as OwnerListComp } from '../owner-list/owner-list.component';
import { OwnerDetailComponent } from '../owner-detail/owner-detail.component';
import { OwnerAddComponent } from '../owner-add/owner-add.component';
import { OwnerEditComponent } from '../owner-edit/owner-edit.component';
import { DummyComponent } from '../../testing/dummy.component';
import { PartsModule } from '../../parts/parts.module';

// ---------------------------------------------------------------------------
// PaginationControlComponent unit tests (sub-task 11.2)
// ---------------------------------------------------------------------------

describe('PaginationControlComponent', () => {
  let component: PaginationControlComponent;
  let fixture: ComponentFixture<PaginationControlComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [PaginationControlComponent],
      imports: [CommonModule],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PaginationControlComponent);
    component = fixture.componentInstance;
  });

  // 11.2 — "Previous" button is disabled on page 0
  it('"Previous" button is disabled on page 0', () => {
    component.currentPage = 0;
    component.totalPages = 3;
    fixture.detectChanges();

    const prevBtn = fixture.debugElement.query(By.css('button.page-link:first-of-type'));
    expect(prevBtn.nativeElement.disabled).toBe(true);
  });

  // 11.2 — "Next" button is disabled on last page
  it('"Next" button is disabled on last page', () => {
    component.currentPage = 2;
    component.totalPages = 3;
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button.page-link'));
    const nextBtn = buttons[buttons.length - 1];
    expect(nextBtn.nativeElement.disabled).toBe(true);
  });

  // 11.2 — numbered buttons emit correct page index
  it('numbered buttons emit correct page index', () => {
    component.totalPages = 3;
    component.currentPage = 0;
    fixture.detectChanges();

    const emitted: number[] = [];
    component.pageChange.subscribe((p: number) => emitted.push(p));

    // buttons: [Prev, 1, 2, 3, Next] — index 2 is page button for page index 1
    const buttons = fixture.debugElement.queryAll(By.css('button.page-link'));
    buttons[2].nativeElement.click();

    expect(emitted).toEqual([1]);
  });

  // 11.2 — page-size selector emits new size
  it('page-size selector emits new size', () => {
    component.totalPages = 1;
    component.currentPage = 0;
    fixture.detectChanges();

    const emitted: number[] = [];
    component.pageSizeChange.subscribe((s: number) => emitted.push(s));

    const select = fixture.debugElement.query(By.css('select'));
    select.nativeElement.value = '20';
    select.nativeElement.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([20]);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests (sub-task 11.3) — fast-check
// ---------------------------------------------------------------------------

class OwnerServiceStub {
  private _response: OwnerPage = { owners: [], totalElements: 0, totalPages: 0, currentPage: 0 };

  setResponse(r: OwnerPage) { this._response = r; }

  getOwnersPaged(_page: number, _size: number, _lastName?: string): Observable<OwnerPage> {
    return of(this._response);
  }
}

describe('OwnerListComponent — property-based tests', () => {
  let component: OwnerListComp;
  let fixture: ComponentFixture<OwnerListComp>;
  let stub: OwnerServiceStub;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [
        CommonModule, FormsModule, PartsModule, OwnersModule,
        RouterTestingModule.withRoutes([
          { path: 'owners', component: OwnerListComp },
          { path: 'owners/add', component: OwnerAddComponent },
          { path: 'owners/:id', component: OwnerDetailComponent },
          { path: 'owners/:id/edit', component: OwnerEditComponent },
        ]),
      ],
      providers: [
        { provide: OwnerService, useClass: OwnerServiceStub },
        { provide: ActivatedRoute, useClass: ActivatedRouteStub },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComp);
    component = fixture.componentInstance;
    stub = fixture.debugElement.injector.get(OwnerService) as unknown as OwnerServiceStub;
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  /**
   * Feature: owners-pagination, Property 8: page-size change resets to page 0 and covers all owners
   * Validates: Requirements 3.7
   *
   * For any valid page size from [10, 20, 50], when onPageSizeChange is called,
   * currentPage is always reset to 0 and getOwnersPaged is called with page=0.
   */
  it('Property 8: page-size change always resets to page 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(10, 20, 50),
        fc.integer({ min: 1, max: 10 }),
        (newSize: number, startPage: number) => {
          // Arrange: start on some non-zero page
          component.currentPage = startPage;
          const calls: Array<[number, number, string | undefined]> = [];
          stub.getOwnersPaged = (p, s, l) => {
            calls.push([p, s, l]);
            return of({ owners: [], totalElements: 0, totalPages: 0, currentPage: 0 });
          };

          // Act
          component.onPageSizeChange(newSize);

          // Assert: currentPage reset to 0 and service called with page=0
          expect(component.currentPage).toBe(0);
          expect(calls.length).toBeGreaterThan(0);
          expect(calls[calls.length - 1][0]).toBe(0);
          expect(calls[calls.length - 1][1]).toBe(newSize);
        }
      )
    );
  });

  /**
   * Feature: owners-pagination, Property 9: search filter change resets to page 0
   * Validates: Requirements 4.1, 4.2
   *
   * For any non-empty search term, when onSearchBlur is called,
   * getOwnersPaged is always called with page=0.
   */
  it('Property 9: search filter change always resets to page 0', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }),
        (term: string, startPage: number) => {
          // Arrange
          component.currentPage = startPage;
          component.lastName = term;
          const calls: Array<[number, number, string | undefined]> = [];
          stub.getOwnersPaged = (p, s, l) => {
            calls.push([p, s, l]);
            return of({ owners: [], totalElements: 0, totalPages: 0, currentPage: 0 });
          };

          // Act
          component.onSearchBlur();

          // Assert: always called with page=0
          expect(calls.length).toBeGreaterThan(0);
          expect(calls[calls.length - 1][0]).toBe(0);
        }
      )
    );
  });
});
