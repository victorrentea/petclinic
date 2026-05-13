/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner} from '../owner';
import {Observable, of} from 'rxjs';
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
import { Subject } from 'rxjs';


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
  let searchOwnersSpy: Spy;
  let de: DebugElement;
  let el: HTMLElement;
  let searchOwnersSubject: Subject<Owner[]>;
  let secondSearchOwnersSubject: Subject<Owner[]>;


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
    searchOwnersSubject = new Subject<Owner[]>();
    secondSearchOwnersSubject = new Subject<Owner[]>();

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    searchOwnersSpy = spyOn(ownerService, 'searchOwners')
      .and.callFake((query: string) => {
        if (query === '') {
          return of(testOwners);
        }
        return query === 'Geo'
          ? searchOwnersSubject.asObservable()
          : secondSearchOwnersSubject.asObservable();
      });

  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call ngOnInit() method', () => {
    fixture.detectChanges();
    expect(searchOwnersSpy).toHaveBeenCalledWith('');
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

  it('onSearchTermChange should call searchOwners for each typed term', () => {
    fixture.detectChanges();
    searchOwnersSpy.calls.reset();

    component.onSearchTermChange('Fr');

    expect(searchOwnersSpy).toHaveBeenCalledWith('Fr');
  });

  it('should keep only the latest in-flight search result', () => {
    fixture.detectChanges();
    component.onSearchTermChange('Geo');
    component.onSearchTermChange('Geor');

    secondSearchOwnersSubject.next([{
      ...testOwner,
      firstName: 'Georgette'
    }]);
    secondSearchOwnersSubject.complete();
    searchOwnersSubject.next([testOwner]);
    searchOwnersSubject.complete();

    expect(component.owners.map(owner => owner.firstName)).toEqual(['Georgette']);
  });

});
