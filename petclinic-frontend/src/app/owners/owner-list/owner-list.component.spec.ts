import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ActivatedRoute, convertToParamMap, ParamMap, Params, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {PageEvent} from '@angular/material/paginator';
import {BehaviorSubject, of, Subject} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {Owner, OwnerPage} from '../owner';
import {OwnersModule} from '../owners.module';
import Spy = jasmine.Spy;

describe('OwnerListComponent', () => {
  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  const davis: Owner = {...testOwner, id: 2, lastName: 'Davis'};

  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let queryParamMap: BehaviorSubject<ParamMap>;
  let getOwnersSpy: Spy;
  let navigateSpy: Spy;

  beforeEach(() => {
    queryParamMap = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        {provide: OwnerService, useValue: jasmine.createSpyObj('OwnerService', ['getOwners'])},
        {provide: ActivatedRoute, useValue: {queryParamMap}}
      ]
    });
    getOwnersSpy = TestBed.inject(OwnerService).getOwners as Spy;
    getOwnersSpy.and.returnValue(of(pageOf([testOwner], 1)));
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
  });

  function pageOf(content: Owner[], totalElements: number): OwnerPage {
    return {content, totalElements};
  }

  function openWith(params: Params) {
    queryParamMap.next(convertToParamMap(params));
    fixture.detectChanges();
  }

  function expectNavigationTo(queryParams: Params, replaceUrl = false) {
    const [commands, extras] = navigateSpy.calls.mostRecent().args;
    expect(commands).toEqual([]);
    expect(extras.relativeTo).toBe(TestBed.inject(ActivatedRoute));
    expect(extras.queryParams).toEqual(queryParams);
    expect(!!extras.replaceUrl).toBe(replaceUrl);
  }

  function text(selector: string): string {
    return fixture.debugElement.query(By.css(selector)).nativeElement.textContent.trim();
  }

  function ariaSortOf(header: string): string {
    return fixture.debugElement.queryAll(By.css('th'))
      .find((th) => th.nativeElement.textContent.trim() === header)
      .nativeElement.getAttribute('aria-sort');
  }

  describe('fetches what the URL says', () => {
    it('page 0 of 10 owners by name, ascending, when the URL has no query params', () => {
      openWith({});

      expect(getOwnersSpy).toHaveBeenCalledWith({page: 0, size: 10, sort: 'name,asc', lastName: ''});
    });

    it('the page, size, sort and last name named in the URL, shown in the search box too', () => {
      openWith({page: '2', size: '5', sort: 'city,desc', lastName: 'Fr'});

      expect(getOwnersSpy).toHaveBeenCalledWith({page: 2, size: 5, sort: 'city,desc', lastName: 'Fr'});
      expect(component.lastName).toBe('Fr');
    });

    // Only the latest query may answer: a search sent while the initial load is still in
    // flight must not be overwritten by the full list when it lands afterwards.
    it('a search is not overwritten by the initial load answering late', () => {
      const initialLoad = new Subject<OwnerPage>();
      getOwnersSpy.and.returnValue(initialLoad);
      openWith({});

      getOwnersSpy.and.returnValue(of(pageOf([testOwner], 1)));
      openWith({lastName: 'Franklin'});
      initialLoad.next(pageOf([testOwner, davis], 2));

      expect(component.owners).toEqual([testOwner]);
    });
  });

  describe('user actions only navigate, leaving defaults out of the URL', () => {
    it('a page change', () => {
      openWith({});

      component.onPage({pageIndex: 1, pageSize: 10, length: 26} as PageEvent);

      expectNavigationTo({page: 1});
    });

    it('a size change keeps the sort', () => {
      openWith({sort: 'city,asc'});

      component.onPage({pageIndex: 0, pageSize: 5, length: 26} as PageEvent);

      expectNavigationTo({size: 5, sort: 'city,asc'});
    });

    it('a header click sorts from the first page', () => {
      openWith({page: '3'});

      component.onSort({active: 'city', direction: 'desc'});

      expectNavigationTo({sort: 'city,desc'});
    });

    it('a search goes back to the first page and keeps the sort', () => {
      openWith({page: '3', sort: 'city,desc'});

      component.searchByLastName('Fr');

      expectNavigationTo({sort: 'city,desc', lastName: 'Fr'});
    });

    it('an empty search drops the last name', () => {
      openWith({lastName: 'Fr', size: '20'});

      component.searchByLastName('');

      expectNavigationTo({size: 20});
    });
  });

  it('a page past the end replaces the URL with the last page', () => {
    getOwnersSpy.and.returnValue(of(pageOf([], 26)));

    openWith({page: '9', size: '5'});

    expectNavigationTo({page: 5, size: 5}, true);
  });

  describe('the grid', () => {
    it('lists the full name of each owner', () => {
      openWith({});

      expect(text('.ownerFullName')).toBe('George Franklin');
    });

    it('sorts by Name and City only, with the arrow on Name ascending by default', () => {
      openWith({});

      const sortable = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'));
      expect(sortable.map((th) => th.nativeElement.textContent.trim())).toEqual(['Name', 'City']);
      expect(ariaSortOf('Name')).toBe('ascending');
      expect(ariaSortOf('City')).toBe('none');
    });

    it('shows the arrow on the sort named in the URL', () => {
      openWith({sort: 'city,desc'});

      expect(ariaSortOf('City')).toBe('descending');
      expect(ariaSortOf('Name')).toBe('none');
    });

    it('pages with the page and size from the URL and the total from the answer', () => {
      getOwnersSpy.and.returnValue(of(pageOf([testOwner], 26)));

      openWith({page: '1', size: '5'});

      expect(text('#ownersTable .mat-mdc-paginator-range-label')).toBe('6 – 10 of 26');
    });

    it('lists each pet of an owner, and a dash for an owner without pets', () => {
      const withPets = {...davis, pets: [{name: 'Leo'}, {name: 'Max'}]} as Owner;
      getOwnersSpy.and.returnValue(of(pageOf([withPets, testOwner], 2)));

      openWith({});

      const petCells = fixture.debugElement.queryAll(By.css('#ownersTable tbody td:last-child'));
      expect(petCells.map((td) => td.nativeElement.innerText.trim())).toEqual(['Leo\nMax', '—']);
    });

    it('says no owner matched, and still offers Add Owner', () => {
      getOwnersSpy.and.returnValue(of(pageOf([], 0)));

      openWith({lastName: 'Zzzz'});

      expect(fixture.nativeElement.textContent).toContain('No owners with LastName starting with "Zzzz"');
      expect(fixture.debugElement.query(By.css('#ownersTable table'))).toBeNull();
    expect(fixture.debugElement.query(By.css('#ownersTable mat-paginator'))).toBeNull();
      const buttons = fixture.debugElement.queryAll(By.css('button'));
      expect(buttons.map((b) => b.nativeElement.textContent.trim())).toContain('Add Owner');
    });
  });
});
