import { ComponentFixture, fakeAsync, TestBed, tick, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { OwnerListComponent } from './owner-list.component';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { OwnerPage } from '../owner-page';
import { Observable, of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { PartsModule } from '../../parts/parts.module';
import { OwnerDetailComponent } from '../owner-detail/owner-detail.component';
import { OwnersModule } from '../owners.module';
import { DummyComponent } from '../../testing/dummy.component';
import { OwnerAddComponent } from '../owner-add/owner-add.component';
import { OwnerEditComponent } from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;

/** Mirrors the query the grid sends; declared here so the spec compiles before the service does. */
interface ListQuery {
  lastName: string;
  page: number;
  size: number;
  sort: string;
}

class OwnerServiceStub {
  listOwners(query: ListQuery): Observable<OwnerPage> {
    return of(pageOf([]));
  }
}

function ownerNamed(id: number, firstName: string, lastName: string, city = 'Madison'): Owner {
  return {
    id,
    firstName,
    lastName,
    address: '110 W. Liberty St.',
    city,
    telephone: '6085551023',
    pets: []
  };
}

function pageOf(content: Owner[], overrides: Partial<OwnerPage> = {}): OwnerPage {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 10,
    ...overrides
  };
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  const ownerService = new OwnerServiceStub();
  let listOwnersSpy: Spy;
  let router: Router;

  const harry = ownerNamed(1, 'Harry', 'Potter', 'London');
  const george = ownerNamed(2, 'George', 'Franklin');

  function lastQuery(): ListQuery {
    return listOwnersSpy.calls.mostRecent().args[0] as ListQuery;
  }

  function element(selector: string): HTMLElement {
    const found = fixture.debugElement.query(By.css(selector));
    return found ? (found.nativeElement as HTMLElement) : null;
  }

  function text(selector: string): string {
    const found = element(selector);
    return found ? found.textContent.trim() : null;
  }

  function click(selector: string): void {
    element(selector).click();
    tick();
    fixture.detectChanges();
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule,
        RouterTestingModule.withRoutes(
          [{path: '', component: DummyComponent},
            {path: 'owners', component: OwnerListComponent},
            {path: 'owners/add', component: OwnerAddComponent},
            {path: 'owners/:id', component: OwnerDetailComponent},
            {path: 'owners/:id/edit', component: OwnerEditComponent}
          ])],
      providers: [
        {provide: OwnerService, useValue: ownerService}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    listOwnersSpy = spyOn(ownerService, 'listOwners')
      .and.returnValue(of(pageOf([harry, george])));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  // ---- 5.1 default request ------------------------------------------------

  it('asks for page 0, size 10, sorted by name ascending on load', () => {
    fixture.detectChanges();

    expect(listOwnersSpy).toHaveBeenCalled();
    expect(lastQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('restores the filter, page, size and sort from the URL query params', fakeAsync(() => {
    router.navigate([], {queryParams: {lastName: 'Pot', page: '3', size: '5', sort: 'city,desc'}});
    tick();
    fixture.detectChanges();

    expect(lastQuery()).toEqual({lastName: 'Pot', page: 3, size: 5, sort: 'city,desc'});
  }));

  // ---- 5.1 paging ---------------------------------------------------------

  it('requests the next page when Next is clicked', fakeAsync(() => {
    listOwnersSpy.and.returnValue(of(pageOf([harry], {number: 0, totalPages: 3, totalElements: 3})));
    fixture.detectChanges();

    click('#pagerNext');

    expect(lastQuery().page).toBe(1);
  }));

  it('requests the previous page when Prev is clicked', fakeAsync(() => {
    listOwnersSpy.and.returnValue(of(pageOf([harry], {number: 2, totalPages: 3, totalElements: 3})));
    router.navigate([], {queryParams: {page: '2'}});
    tick();
    fixture.detectChanges();

    click('#pagerPrev');

    expect(lastQuery().page).toBe(1);
  }));

  it('labels the pager buttons with arrows that keep an accessible name', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(text('#pagerFirst')).toBe('«');
    expect(text('#pagerPrev')).toBe('‹');
    expect(text('#pagerNext')).toBe('›');
    expect(text('#pagerLast')).toBe('»');
    expect(element('#pagerFirst').getAttribute('aria-label')).toBe('First page');
    expect(element('#pagerPrev').getAttribute('aria-label')).toBe('Previous page');
    expect(element('#pagerNext').getAttribute('aria-label')).toBe('Next page');
    expect(element('#pagerLast').getAttribute('aria-label')).toBe('Last page');
  }));

  it('jumps to the last page when Last is clicked', fakeAsync(() => {
    listOwnersSpy.and.returnValue(of(pageOf([harry], {number: 0, totalPages: 6, totalElements: 28})));
    fixture.detectChanges();

    click('#pagerLast');

    expect(lastQuery().page).toBe(5);
  }));

  it('jumps back to the first page when First is clicked', fakeAsync(() => {
    listOwnersSpy.and.returnValue(of(pageOf([harry], {number: 4, totalPages: 6, totalElements: 28})));
    router.navigate([], {queryParams: {page: '4'}});
    tick();
    fixture.detectChanges();

    click('#pagerFirst');

    expect(lastQuery().page).toBe(0);
  }));

  it('disables First alongside Prev and Last alongside Next', fakeAsync(() => {
    listOwnersSpy.and.returnValue(of(pageOf([harry], {number: 0, totalPages: 6, totalElements: 28})));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect((element('#pagerFirst') as HTMLButtonElement).disabled).toBe(true);
    expect((element('#pagerLast') as HTMLButtonElement).disabled).toBe(false);
  }));

  it('disables Prev on the first page and Next on the last page', fakeAsync(() => {
    listOwnersSpy.and.returnValue(of(pageOf([harry], {number: 0, totalPages: 3, totalElements: 3})));
    fixture.detectChanges();
    expect((element('#pagerPrev') as HTMLButtonElement).disabled).toBe(true);
    expect((element('#pagerNext') as HTMLButtonElement).disabled).toBe(false);

    listOwnersSpy.and.returnValue(of(pageOf([harry], {number: 2, totalPages: 3, totalElements: 3})));
    router.navigate([], {queryParams: {page: '2'}});
    tick();
    fixture.detectChanges();

    expect((element('#pagerPrev') as HTMLButtonElement).disabled).toBe(false);
    expect((element('#pagerNext') as HTMLButtonElement).disabled).toBe(true);
  }));

  it('shows the 1-based page number, the total pages and the total owners', fakeAsync(() => {
    listOwnersSpy.and.returnValue(of(pageOf([harry], {number: 2, totalPages: 6, totalElements: 28})));
    router.navigate([], {queryParams: {page: '2'}});
    tick();
    fixture.detectChanges();

    expect(text('#pagerCurrentPage')).toBe('3');
    expect(text('#pagerTotalPages')).toBe('6');
    expect(text('#pagerTotalElements')).toBe('28');
  }));

  // ---- 5.1 page size ------------------------------------------------------

  it('offers exactly the page sizes 5, 10 and 20, defaulting to 10', () => {
    fixture.detectChanges();

    const select = element('#pageSizeSelect') as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.value);
    expect(options).toEqual(['5', '10', '20']);
    expect(select.value).toBe('10');
  });

  it('re-requests the list at the chosen page size, back on page 0', fakeAsync(() => {
    listOwnersSpy.and.returnValue(of(pageOf([harry], {number: 2, totalPages: 6, totalElements: 28})));
    router.navigate([], {queryParams: {page: '2'}});
    tick();
    fixture.detectChanges();

    const select = element('#pageSizeSelect') as HTMLSelectElement;
    select.value = '20';
    select.dispatchEvent(new Event('change'));
    tick();
    fixture.detectChanges();

    expect(lastQuery().size).toBe(20);
    expect(lastQuery().page).toBe(0);
  }));

  // ---- 5.1 sorting --------------------------------------------------------

  it('sorts by name descending when the Name header is clicked while ascending', fakeAsync(() => {
    fixture.detectChanges();

    click('th[data-sort-key="name"]');

    expect(lastQuery().sort).toBe('name,desc');
    expect(text('th[data-sort-key="name"] .sort-arrow')).toBe('▼');
  }));

  it('sorts by city ascending when the City header is clicked', fakeAsync(() => {
    fixture.detectChanges();

    click('th[data-sort-key="city"]');

    expect(lastQuery().sort).toBe('city,asc');
    expect(lastQuery().page).toBe(0);
    expect(text('th[data-sort-key="city"] .sort-arrow')).toBe('▲');
    expect(text('th[data-sort-key="name"] .sort-arrow')).toBe('▲');
    expect(element('th[data-sort-key="name"] .sort-arrow').classList).toContain('sort-arrow-idle');
  }));

  it('dims the same arrow on the unsorted column instead of showing a different glyph', () => {
    fixture.detectChanges();

    expect(text('th[data-sort-key="name"] .sort-arrow')).toBe('▲');
    expect(text('th[data-sort-key="city"] .sort-arrow')).toBe('▲');
    expect(fixture.debugElement.query(By.css('th[data-sort-key="city"] .sort-arrow'))
      .nativeElement.classList).toContain('sort-arrow-idle');
    expect(fixture.debugElement.query(By.css('th[data-sort-key="name"] .sort-arrow'))
      .nativeElement.classList).not.toContain('sort-arrow-idle');
  });

  it('offers a sort control on Name and City only', () => {
    fixture.detectChanges();

    const sortable = fixture.debugElement.queryAll(By.css('#ownersTable th.sortable'))
      .map((header) => (header.nativeElement as HTMLElement).getAttribute('data-sort-key'));
    expect(sortable).toEqual(['name', 'city']);

    const headers = fixture.debugElement.queryAll(By.css('#ownersTable thead th'));
    const unsortable = headers.filter((header) => !(header.nativeElement as HTMLElement).classList.contains('sortable'));
    expect(unsortable.length).toBe(3);
    unsortable.forEach((header) => {
      expect((header.nativeElement as HTMLElement).querySelector('.sort-arrow')).toBeNull();
    });
  });

  // ---- 5.1 search resets to page 0, keeping sort and size -----------------

  it('resets to page 0 but keeps the sort and the size when a search is submitted', fakeAsync(() => {
    listOwnersSpy.and.returnValue(of(pageOf([harry], {number: 3, totalPages: 6, totalElements: 28})));
    router.navigate([], {queryParams: {page: '3', size: '5', sort: 'city,desc'}});
    tick();
    fixture.detectChanges();

    component.searchByLastName('Pot');
    tick();
    fixture.detectChanges();

    expect(lastQuery()).toEqual({lastName: 'Pot', page: 0, size: 5, sort: 'city,desc'});
  }));

  // ---- 5.2 empty page beyond the first re-requests page 0 -----------------

  it('re-requests page 0 when a page beyond the first comes back empty', fakeAsync(() => {
    listOwnersSpy.and.returnValues(
      of(pageOf([], {number: 4, totalPages: 1, totalElements: 2})),
      of(pageOf([harry, george]))
    );
    router.navigate([], {queryParams: {page: '4'}});
    tick();
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(listOwnersSpy.calls.count()).toBe(2);
    expect(lastQuery().page).toBe(0);
    expect(fixture.debugElement.queryAll(By.css('td.ownerFullName')).length).toBe(2);
  }));

  // ---- 5.3 name rendering -------------------------------------------------

  it('renders the name as "Lastname, Firstname"', () => {
    listOwnersSpy.and.returnValue(of(pageOf([harry])));

    fixture.detectChanges();

    expect(text('#ownersTable td.ownerFullName')).toBe('Potter, Harry');
  });

  // ---- 5.4 pets rendering -------------------------------------------------

  it('renders all of an owner\'s pets on one comma-separated line', () => {
    const owner = {...ownerNamed(9, 'George', 'Darling'), pets: [
      {id: 1, name: 'Liza'} as any,
      {id: 2, name: 'Nana'} as any
    ]};
    listOwnersSpy.and.returnValue(of(pageOf([owner])));

    fixture.detectChanges();

    expect(text('#ownersTable td.owner-pets')).toBe('Liza, Nana');
  });

  it('renders an empty pets cell for an owner with no pets', () => {
    listOwnersSpy.and.returnValue(of(pageOf([harry])));

    fixture.detectChanges();

    expect(text('#ownersTable td.owner-pets')).toBe('');
  });
});
