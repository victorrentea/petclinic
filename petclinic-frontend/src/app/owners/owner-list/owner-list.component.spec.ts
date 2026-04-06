/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner} from '../owner';
import {Observable, of, Subject} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {PartsModule} from '../../parts/parts.module';
import {ActivatedRouteStub} from '../../testing/router-stubs';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwners(): Observable<Owner[]> {
    return of();
  }

  searchOwners(query: string): Observable<Owner[]> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersSpy: Spy;
  let searchOwnersSpy: Spy;
  let de: DebugElement;
  let el: HTMLElement;


  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  let testOwners: Owner[];

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule,
        RouterTestingModule.withRoutes(
          [{path: 'owners', component: OwnerListComponent},
            {path: 'owners/add', component: OwnerAddComponent},
            {path: 'owners/:id', component: OwnerDetailComponent},
            {path: 'owners/:id/edit', component: OwnerEditComponent}
          ])],
      providers: [
        {provide: OwnerService, useValue: ownerService},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    testOwners = [testOwner];

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(testOwners));
    searchOwnersSpy = spyOn(ownerService, 'searchOwners')
      .and.returnValue(of(testOwners));

  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call ngOnInit() method', () => {
    fixture.detectChanges();
    expect(getOwnersSpy.calls.any()).toBe(true, 'getOwners called');
  });


  it(' should show full name after getOwners observable (async) ', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => { // wait for async getOwners
      fixture.detectChanges();        // update view with name
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText).toBe((testOwner.firstName.toString() + ' ' + testOwner.lastName.toString()));
    });
  }));

  it('should render search input with placeholder and no visible search button', () => {
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('#owners-search')).nativeElement as HTMLInputElement;
    const label = fixture.debugElement.query(By.css('label'));
    const button = fixture.debugElement.query(By.css('button[type="submit"]'));

    expect(input.placeholder).toBe('Search...');
    expect(label).toBeNull();
    expect(button).toBeNull();
  });

  it('should debounce typing for 500ms before searching', fakeAsync(() => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.onSearchTermChange('Fr');

    tick(499);
    expect(searchOwnersSpy).not.toHaveBeenCalled();

    tick(1);

    expect(searchOwnersSpy).toHaveBeenCalledWith('Fr');
    expect(getOwnersSpy).not.toHaveBeenCalled();
  }));

  it('should search immediately on blur and avoid duplicate request when debounce later completes', fakeAsync(() => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.onSearchTermChange('Fr');
    tick(200);

    component.onSearchBlur('Fr');

    expect(searchOwnersSpy).toHaveBeenCalledTimes(1);
    expect(searchOwnersSpy).toHaveBeenCalledWith('Fr');

    tick(300);

    expect(searchOwnersSpy).toHaveBeenCalledTimes(1);
  }));

  it('should reload all owners for empty term', fakeAsync(() => {
    fixture.detectChanges();
    component.onSearchTermChange('Fr');
    tick(500);

    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.onSearchTermChange('');
    tick(500);

    expect(getOwnersSpy).toHaveBeenCalled();
    expect(searchOwnersSpy).not.toHaveBeenCalled();
  }));

  it('should ignore stale search responses', fakeAsync(() => {
    const franklinOwners = [testOwner];
    const davisOwners: Owner[] = [{
      id: 2,
      firstName: 'Betty',
      lastName: 'Davis',
      address: '638 Cardinal Ave.',
      city: 'Sun Prairie',
      telephone: '6085551749',
      pets: []
    }];
    const responses: {[key: string]: Subject<Owner[]>} = {
      Fr: new Subject<Owner[]>(),
      Dav: new Subject<Owner[]>()
    };

    getOwnersSpy.and.returnValue(of([]));
    searchOwnersSpy.and.callFake((term: string) => responses[term].asObservable());

    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.onSearchTermChange('Fr');
    tick(500);
    component.onSearchTermChange('Dav');
    tick(500);

    responses.Fr.next(franklinOwners);
    fixture.detectChanges();
    expect(component.owners).toEqual([]);

    responses.Dav.next(davisOwners);
    fixture.detectChanges();

    expect(searchOwnersSpy.calls.allArgs()).toEqual([['Fr'], ['Dav']]);
    expect(component.owners).toEqual(davisOwners);
  }));

});
