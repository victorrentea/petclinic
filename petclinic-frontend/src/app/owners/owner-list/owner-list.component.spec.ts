import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, Subject } from 'rxjs';

import { OwnerListComponent } from './owner-list.component';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { DEFAULT_OWNER_QUERY, OwnerPage, OwnerQuery } from '../owner-page';
import { OwnersModule } from '../owners.module';

class OwnerServiceStub {
  readonly requests: { query: OwnerQuery; response: Subject<OwnerPage> }[] = [];

  listOwners(query: OwnerQuery): Observable<OwnerPage> {
    const response = new Subject<OwnerPage>();
    this.requests.push({ query, response });
    return response;
  }
}

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let service: OwnerServiceStub;

  const george: Owner = {
    id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.',
    city: 'Madison', telephone: '6085551023', pets: []
  };
  const firstPage: OwnerPage = { content: [george], totalElements: 26 };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: OwnerService, useClass: OwnerServiceStub }]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(OwnerService) as unknown as OwnerServiceStub;
  });

  const lastRequest = () => service.requests[service.requests.length - 1];
  const queries = () => service.requests.map(r => r.query);

  function answer(page: OwnerPage, request = lastRequest()) {
    request.response.next(page);
    request.response.complete();
    fixture.detectChanges();
  }

  function openOnPage(page: OwnerPage = firstPage) {
    fixture.detectChanges();
    answer(page);
  }

  function text(selector: string): string {
    const el = fixture.debugElement.query(By.css(selector));
    return el ? (el.nativeElement as HTMLElement).textContent.trim() : null;
  }

  function sortHeader(key: string): HTMLElement {
    return fixture.debugElement.query(By.css(`th[mat-sort-header="${key}"]`)).nativeElement;
  }

  function submitSearch(lastName: string) {
    component.draftLastName = lastName;
    fixture.detectChanges();
    fixture.debugElement.query(By.css('#search-owner-form button[type=submit]')).nativeElement.click();
    fixture.detectChanges();
  }

  describe('on open', () => {
    it('requests the first page with the API defaults, once', () => {
      fixture.detectChanges();

      expect(queries()).toEqual([DEFAULT_OWNER_QUERY]);
    });

    it('shows the owners, the range and the total', () => {
      openOnPage();

      expect(text('.ownerFullName')).toBe('George Franklin');
      expect(text('.mat-mdc-paginator-range-label')).toBe('1 – 10 of 26');
    });

    it('offers page sizes 5, 10 and 20', () => {
      openOnPage();

      expect(component.pageSizeOptions).toEqual([5, 10, 20]);
    });

    it('lets Name and City be sorted, and nothing else', () => {
      openOnPage();

      const sortable = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
        .map(th => (th.nativeElement as HTMLElement).textContent.trim());
      expect(sortable).toEqual(['Name', 'City']);
      const headers = fixture.debugElement.queryAll(By.css('#ownersTable th'))
        .map(th => (th.nativeElement as HTMLElement).textContent.trim());
      expect(headers).toEqual(['Name', 'Address', 'City', 'Telephone', 'Pets']);
    });

    it('keeps the owner link and Add Owner', () => {
      openOnPage();

      const link: HTMLAnchorElement = fixture.debugElement.query(By.css('.ownerFullName a')).nativeElement;
      expect(link.getAttribute('href')).toBe('/owners/1');
      expect(text('button.add-owner')).toBe('Add Owner');
    });
  });

  describe('each action sends exactly one request', () => {
    beforeEach(() => openOnPage());

    it('next page keeps the filter, size and sort', () => {
      fixture.debugElement.query(By.css('.mat-mdc-paginator-navigation-next')).nativeElement.click();

      expect(queries().slice(1)).toEqual([{ ...DEFAULT_OWNER_QUERY, page: 1 }]);
    });

    it('a page size change goes back to page 0', () => {
      component.onPage({ pageIndex: 2, pageSize: 10, length: 26 });
      answer(firstPage);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 26, previousPageIndex: 2 });

      expect(queries().slice(2)).toEqual([{ ...DEFAULT_OWNER_QUERY, size: 20, page: 0 }]);
    });

    it('a click on a sortable header goes back to page 0', () => {
      component.onPage({ pageIndex: 2, pageSize: 10, length: 26 });
      answer(firstPage);

      sortHeader('city').click();

      expect(queries().slice(2)).toEqual([{ ...DEFAULT_OWNER_QUERY, sort: 'city,asc', page: 0 }]);
    });

    it('sorting alternates between ascending and descending, never unsorted', () => {
      sortHeader('city').click();
      answer(firstPage);
      sortHeader('city').click();
      answer(firstPage);
      sortHeader('city').click();

      expect(queries().slice(1).map(q => q.sort)).toEqual(['city,asc', 'city,desc', 'city,asc']);
    });

    it('sorting works from the keyboard', () => {
      const enter = new KeyboardEvent('keydown', { key: 'Enter' });
      Object.defineProperty(enter, 'keyCode', { get: () => 13 });

      sortHeader('name').dispatchEvent(enter);

      expect(queries().slice(1)).toEqual([{ ...DEFAULT_OWNER_QUERY, sort: 'name,desc' }]);
    });

    it('a search goes back to page 0 and keeps the sort', () => {
      sortHeader('city').click();
      answer(firstPage);
      sortHeader('city').click();
      answer(firstPage);
      component.onPage({ pageIndex: 2, pageSize: 10, length: 26 });
      answer(firstPage);

      submitSearch('Fr');

      expect(queries().slice(4)).toEqual([{ lastName: 'Fr', page: 0, size: 10, sort: 'city,desc' }]);
    });

    it('paging uses the submitted filter, not unsubmitted typing', () => {
      submitSearch('Fr');
      answer(firstPage);
      component.draftLastName = 'Davis';
      fixture.detectChanges();

      fixture.debugElement.query(By.css('.mat-mdc-paginator-navigation-next')).nativeElement.click();

      expect(lastRequest().query).toEqual({ ...DEFAULT_OWNER_QUERY, lastName: 'Fr', page: 1 });
    });
  });

  describe('only the latest request answers', () => {
    it('a late initial load does not overwrite a search', () => {
      fixture.detectChanges();
      const initialLoad = lastRequest();
      submitSearch('Franklin');
      answer({ content: [george], totalElements: 1 });

      answer({ content: [{ ...george, id: 2, lastName: 'Davis' }], totalElements: 26 }, initialLoad);

      expect(component.owners).toEqual([george]);
      expect(component.totalElements).toBe(1);
    });

    it('a late failure of an older request shows no error', () => {
      fixture.detectChanges();
      const initialLoad = lastRequest();
      submitSearch('Franklin');
      answer(firstPage);

      initialLoad.response.error('boom');
      fixture.detectChanges();

      expect(component.errorMessage).toBeNull();
      expect(text('#ownersError')).toBeNull();
    });

    it('an older request completing does not end the newer one\'s loading', () => {
      fixture.detectChanges();
      const initialLoad = lastRequest();
      submitSearch('Franklin');

      initialLoad.response.complete();

      expect(component.loading).toBeTrue();
    });

    it('leaving the screen cancels the request in flight', () => {
      fixture.detectChanges();

      fixture.destroy();

      expect(lastRequest().response.observers).toHaveSize(0);
    });
  });

  describe('empty results and failures', () => {
    it('no match shows the submitted prefix and hides the paginator', () => {
      fixture.detectChanges();
      submitSearch('Zz');
      answer({ content: [], totalElements: 0 });

      expect(text('#noOwners')).toBe('No owners with last name starting with "Zz"');
      expect(fixture.debugElement.query(By.css('mat-paginator'))).toBeNull();
    });

    it('an empty page past the end does not claim there is no match', () => {
      openOnPage({ content: [], totalElements: 26 });

      expect(text('#noOwners')).toBeNull();
      expect(fixture.debugElement.query(By.css('mat-paginator'))).not.toBeNull();
    });

    it('a failure is shown as an error, not as no match', () => {
      fixture.detectChanges();
      lastRequest().response.error('server returned code 500');
      fixture.detectChanges();

      expect(text('#ownersError')).toContain('server returned code 500');
      expect(text('#noOwners')).toBeNull();
      expect(component.loading).toBeFalse();
    });

    it('a successful request clears an earlier error', () => {
      fixture.detectChanges();
      lastRequest().response.error('server returned code 500');
      submitSearch('Fr');
      answer(firstPage);

      expect(text('#ownersError')).toBeNull();
      expect(text('.ownerFullName')).toBe('George Franklin');
    });
  });

  it('one click on Find Owner sends one request', () => {
    openOnPage();

    submitSearch('Fr');

    expect(queries()).toHaveSize(2);
  });
});
