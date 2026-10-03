import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {RouterTestingModule} from '@angular/router/testing';
import {ENTER} from '@angular/cdk/keycodes';
import {MatPaginator} from '@angular/material/paginator';
import {Subject} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnersModule} from '../owners.module';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerQuery} from '../owner-page';
import {DummyComponent} from '../../testing/dummy.component';

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let requests: { query: OwnerQuery; response: Subject<OwnerPage> }[];

  const owner = (id: number): Owner => ({
    id, firstName: 'George', lastName: 'Franklin' + id, address: '110 W. Liberty St.',
    city: 'Madison', telephone: '6085551023', pets: []
  });
  const pageOf = (count: number, totalElements: number): OwnerPage =>
    ({content: Array.from({length: count}, (_, i) => owner(i + 1)), totalElements});

  beforeEach(waitForAsync(() => {
    requests = [];
    const ownerService = {
      getOwners: (query: OwnerQuery) => {
        const response = new Subject<OwnerPage>();
        requests.push({query, response});
        return response;
      }
    };
    TestBed.configureTestingModule({
      imports: [OwnersModule, NoopAnimationsModule,
        RouterTestingModule.withRoutes([{path: '**', component: DummyComponent}])],
      providers: [{provide: OwnerService, useValue: ownerService}]
    }).compileComponents();
  }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(OwnerListComponent);
    fixture.detectChanges();
    await fixture.whenStable(); // ngModel inside a form registers asynchronously
  });

  function answerLatest(page: OwnerPage) {
    const latest = requests[requests.length - 1].response;
    latest.next(page);
    latest.complete();
    fixture.detectChanges();
  }

  function lastQuery(): OwnerQuery {
    return requests[requests.length - 1].query;
  }

  function el(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function click(selector: string) {
    el(selector)!.click();
    fixture.detectChanges();
  }

  function typeLastName(value: string) {
    const input = el('#lastName') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function sortHeader(key: string) {
    return fixture.debugElement.query(By.css(`th[mat-sort-header="${key}"]`));
  }

  const NEXT = 'button[aria-label="Next page"]';
  const PREVIOUS = 'button[aria-label="Previous page"]';
  const NO_OWNERS = '#noOwners';

  describe('on open', () => {
    it('requests page 0 of 10 owners by Name ascending, unfiltered', () => {
      expect(requests).toHaveSize(1);
      expect(requests[0].query).toEqual({lastName: '', page: 0, size: 10, sort: 'name,asc'});
    });

    it('renders the rows, the range and the total, offering sizes 5, 10 and 20', () => {
      answerLatest(pageOf(10, 26));

      expect(fixture.nativeElement.querySelectorAll('.ownerFullName')).toHaveSize(10);
      expect(text()).toContain('1 – 10 of 26');
      const paginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance as MatPaginator;
      expect(paginator.pageSizeOptions).toEqual([5, 10, 20]);
    });

    it('links every owner to its detail page', () => {
      answerLatest(pageOf(1, 1));

      expect(el('.ownerFullName a')!.getAttribute('href')).toBe('/owners/1');
    });

    it('offers Add Owner while loading, after loading and after a failure', () => {
      expect(el('#addOwner')).toBeTruthy();
      answerLatest(pageOf(1, 1));
      expect(el('#addOwner')).toBeTruthy();
      typeLastName('X');
      click('#findOwner');
      requests[1].response.error('server returned code 500');
      fixture.detectChanges();
      expect(el('#addOwner')).toBeTruthy();
    });
  });

  describe('paging', () => {
    beforeEach(() => answerLatest(pageOf(10, 26)));

    it('next and previous each send exactly one request, keeping filter, size and sort', () => {
      click(NEXT);
      expect(requests).toHaveSize(2);
      expect(lastQuery()).toEqual({lastName: '', page: 1, size: 10, sort: 'name,asc'});
      answerLatest(pageOf(10, 26));

      click(PREVIOUS);
      expect(requests).toHaveSize(3);
      expect(lastQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'name,asc'});
    });

    it('a page-size change sends one request for page 0', () => {
      click(NEXT);
      answerLatest(pageOf(10, 26));
      click(NEXT);
      answerLatest(pageOf(6, 26));
      const before = requests.length;

      const paginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance as MatPaginator;
      paginator._changePageSize(20);
      fixture.detectChanges();

      expect(requests).toHaveSize(before + 1);
      expect(lastQuery()).toEqual({lastName: '', page: 0, size: 20, sort: 'name,asc'});
    });
  });

  describe('sorting', () => {
    beforeEach(() => {
      answerLatest(pageOf(10, 26));
      click(NEXT);
      answerLatest(pageOf(10, 26));
    });

    it('City toggles ascending, descending, ascending — never unsorted — each time from page 0', () => {
      for (const sort of ['city,asc', 'city,desc', 'city,asc']) {
        const before = requests.length;
        sortHeader('city').nativeElement.click();
        fixture.detectChanges();

        expect(requests).toHaveSize(before + 1);
        expect(lastQuery()).toEqual({lastName: '', page: 0, size: 10, sort: sort as OwnerQuery['sort']});
        answerLatest(pageOf(10, 26));
      }
    });

    it('works from the keyboard', () => {
      sortHeader('name').triggerEventHandler('keydown', {keyCode: ENTER, preventDefault: () => undefined});
      fixture.detectChanges();

      expect(lastQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'name,desc'});
    });

    it('is offered on Name and City only', () => {
      const sortable = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
        .map(th => th.nativeElement.textContent.trim());
      const all = fixture.debugElement.queryAll(By.css('th')).map(th => th.nativeElement.textContent.trim());

      expect(sortable).toEqual(['Name', 'City']);
      expect(all).toEqual(['Name', 'Address', 'City', 'Telephone', 'Pets']);
    });
  });

  describe('searching', () => {
    beforeEach(() => answerLatest(pageOf(10, 26)));

    it('sends exactly one request per Find Owner press', () => {
      typeLastName('Pot');
      click('#findOwner');

      expect(requests).toHaveSize(2);
      expect(lastQuery()).toEqual({lastName: 'Pot', page: 0, size: 10, sort: 'name,asc'});
    });

    it('starts again from page 0, keeping the chosen sort', () => {
      sortHeader('city').nativeElement.click();
      answerLatest(pageOf(10, 26));
      sortHeader('city').nativeElement.click();
      answerLatest(pageOf(10, 26));
      click(NEXT);
      answerLatest(pageOf(10, 26));
      const before = requests.length;

      typeLastName('Pot');
      click('#findOwner');

      expect(requests).toHaveSize(before + 1);
      expect(lastQuery()).toEqual({lastName: 'Pot', page: 0, size: 10, sort: 'city,desc'});
    });

    it('paging keeps the submitted prefix, not text typed since', () => {
      typeLastName('Pot');
      click('#findOwner');
      answerLatest(pageOf(10, 12));
      typeLastName('Zzz');

      click(NEXT);

      expect(lastQuery()).toEqual({lastName: 'Pot', page: 1, size: 10, sort: 'name,asc'});
    });
  });

  describe('only the latest request answers', () => {
    it('a late page of an earlier request does not overwrite the latest one', () => {
      typeLastName('Pot');
      click('#findOwner');

      requests[0].response.next(pageOf(10, 26));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.ownerFullName')).toHaveSize(0);

      answerLatest(pageOf(2, 2));
      requests[0].response.next(pageOf(10, 26));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.ownerFullName')).toHaveSize(2);
      expect(text()).toContain('1 – 2 of 2');
    });

    it('a late failure or completion of an earlier request is ignored', () => {
      typeLastName('Pot');
      click('#findOwner');

      requests[0].response.error('server returned code 500');
      requests[0].response.complete();
      fixture.detectChanges();

      expect(el('#loadError')).toBeNull();
      expect(fixture.componentInstance.loading).toBe(true);
    });

    it('leaving the screen cancels the outstanding request', () => {
      fixture.destroy();

      expect(requests[0].response.observers).toHaveSize(0);
    });
  });

  describe('empty results and failures', () => {
    it('no match names the submitted prefix and hides the paginator', () => {
      answerLatest(pageOf(10, 26));
      typeLastName('Zz');
      click('#findOwner');
      answerLatest(pageOf(0, 0));
      typeLastName('Abc');

      expect(el(NO_OWNERS)!.textContent).toContain('No owners with LastName starting with "Zz"');
      expect(el('mat-paginator')).toBeNull();
    });

    it('an empty page with matches elsewhere keeps the navigation and claims no empty match', () => {
      answerLatest(pageOf(0, 26));

      expect(el(NO_OWNERS)).toBeNull();
      expect(el('mat-paginator')).toBeTruthy();
    });

    it('a failure is shown as an error, not as no matching owners', () => {
      requests[0].response.error('server returned code 500');
      fixture.detectChanges();

      expect(el('#loadError')!.textContent).toContain('server returned code 500');
      expect(el(NO_OWNERS)).toBeNull();
      expect(fixture.componentInstance.loading).toBe(false);
    });

    it('a failed page keeps the paginator, so that page can be asked for again', () => {
      answerLatest(pageOf(10, 26));
      click(NEXT);
      requests[1].response.error('server returned code 500');
      fixture.detectChanges();

      expect(el('#loadError')).toBeTruthy();
      expect(el(NO_OWNERS)).toBeNull();
      click(PREVIOUS);
      expect(requests).toHaveSize(3);
      expect(lastQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'name,asc'});
    });

    it('a failure after an empty search shows only the error', () => {
      typeLastName('Zz');
      click('#findOwner');
      answerLatest(pageOf(0, 0));
      click('#findOwner');
      requests[requests.length - 1].response.error('server returned code 500');
      fixture.detectChanges();

      expect(el('#loadError')).toBeTruthy();
      expect(el(NO_OWNERS)).toBeNull();
    });
  });
});
