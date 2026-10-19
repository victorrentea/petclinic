import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ActivatedRoute, convertToParamMap, Params, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {BehaviorSubject, Observable, of, Subject, throwError} from 'rxjs';
import {map} from 'rxjs/operators';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {OwnersModule} from '../owners.module';
import {Owner} from '../owner';
import {OwnerPage, OwnerQuery} from '../owner-page';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  listOwners(query: OwnerQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let urlQuery: BehaviorSubject<Params>;
  let listOwners: Spy;
  let navigate: Spy;

  const george: Owner = {
    id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.',
    city: 'Madison', telephone: '6085551023', pets: []
  };
  const aPage = (...owners: Owner[]): OwnerPage => ({content: owners, totalElements: 28});

  beforeEach(async () => {
    urlQuery = new BehaviorSubject<Params>({});
    await TestBed.configureTestingModule({
      imports: [OwnersModule, RouterTestingModule, NoopAnimationsModule],
      providers: [
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: ActivatedRoute, useValue: {queryParamMap: urlQuery.pipe(map(convertToParamMap))}},
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    listOwners = spyOn(TestBed.inject(OwnerService), 'listOwners').and.returnValue(of(aPage(george)));
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  function open(query: Params = {}) {
    urlQuery.next(query);
    fixture.detectChanges();
  }

  const text = (selector: string) => fixture.debugElement.query(By.css(selector))?.nativeElement.textContent.trim();
  const queryNavigatedTo = () => navigate.calls.mostRecent().args[1].queryParams;

  it('lists the owners the URL asks for', () => {
    open({page: '2', size: '5', sort: 'city,desc', lastName: 'Fr'});

    expect(listOwners).toHaveBeenCalledWith({page: 2, size: 5, sort: 'city,desc', lastName: 'Fr'});
  });

  it('shows each owner last name first, the order it sorts in', () => {
    open();

    expect(text('.ownerFullName')).toBe('Franklin, George');
  });

  it('tells the paginator how many owners there are', () => {
    open();

    expect(text('.mat-mdc-paginator-range-label')).toContain('28');
  });

  it('offers to sort by Name and City only', () => {
    open();

    const sortable = fixture.debugElement.queryAll(By.css('[mat-sort-header]'));
    expect(sortable.map(header => header.nativeElement.textContent.trim())).toEqual(['Name', 'City']);
  });

  it('offers page numbers to bisect the list, marking the current one', () => {
    open({size: '5'});

    const links = fixture.debugElement.queryAll(By.css('.owner-pages > *'));
    expect(links.map(link => link.nativeElement.textContent.trim())).toEqual(['1', '2', '…', '4', '…', '6']);
    expect(fixture.debugElement.query(By.css('[aria-current=page]')).nativeElement.textContent.trim()).toBe('1');
  });

  it('opens the page whose number is clicked', () => {
    open({size: '5', sort: 'city'});

    const buttons = fixture.debugElement.queryAll(By.css('.owner-pages button'));
    buttons.find(button => button.nativeElement.textContent.trim() === '4').nativeElement.click();

    expect(queryNavigatedTo()).toEqual({page: 3, size: 5, sort: 'city'});
  });

  it('moves to the next page keeping the sort, size and search', () => {
    open({size: '5', sort: 'city', lastName: 'Fr'});

    component.changePage({pageIndex: 1, pageSize: 5, length: 28});

    expect(queryNavigatedTo()).toEqual({page: 1, size: 5, sort: 'city', lastName: 'Fr'});
  });

  it('goes back to the first page when the page size changes', () => {
    open({page: '3'});

    component.changePage({pageIndex: 1, pageSize: 20, length: 28});

    expect(queryNavigatedTo()).toEqual({size: 20});
  });

  it('goes back to the first page when the sort changes', () => {
    open({page: '3', size: '5'});

    component.sortBy({active: 'city', direction: 'desc'});

    expect(queryNavigatedTo()).toEqual({size: 5, sort: 'city,desc'});
  });

  it('leaves the default sort out of the URL', () => {
    open({sort: 'city'});

    component.sortBy({active: 'name', direction: 'asc'});

    expect(queryNavigatedTo()).toEqual({});
  });

  it('searches from the first page, keeping the sort and size', () => {
    open({page: '2', size: '5', sort: 'city'});

    component.searchByLastName('Davis');

    expect(queryNavigatedTo()).toEqual({size: 5, sort: 'city', lastName: 'Davis'});
  });

  it('still offers Add Owner when a search finds nobody', () => {
    listOwners.and.returnValue(of(aPage()));

    open({lastName: 'Zzz'});

    expect(text('#noOwners')).toContain('Zzz');
    expect(text('#addOwner')).toBe('Add Owner');
  });

  it('shows why the listing failed instead of claiming there are no owners', () => {
    listOwners.and.returnValue(throwError('server returned code 500'));

    open();

    expect(text('.alert-danger')).toBe('server returned code 500');
    expect(text('#noOwners')).toBeUndefined();
  });

  it('ignores the answer to a query the URL has already moved past', () => {
    const late = new Subject<OwnerPage>();
    listOwners.and.returnValues(late, of(aPage(george)));
    open();
    open({lastName: 'Franklin'});

    late.next(aPage({...george, id: 2, lastName: 'Davis'}));
    fixture.detectChanges();

    expect(component.page.content).toEqual([george]);
  });
});
