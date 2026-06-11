/* tslint:disable:no-unused-variable */

import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, convertToParamMap} from '@angular/router';
import {OwnerService} from '../owner.service';
import {OwnerPage} from '../owner-page';
import {Observable, of} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {PartsModule} from '../../parts/parts.module';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwnersPage(): Observable<OwnerPage> {
    return of({content: [], page: {number: 0, size: 10, totalElements: 0, totalPages: 0}});
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService: any = new OwnerServiceStub();
  let getOwnersPageSpy: Spy;

  const onePage: OwnerPage = {
    content: [{
      id: 1,
      firstName: 'George',
      lastName: 'Franklin',
      address: '110 W. Liberty St.',
      city: 'Madison',
      telephone: '6085551023',
      pets: []
    }],
    page: {number: 0, size: 10, totalElements: 1, totalPages: 1}
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, NoopAnimationsModule, PartsModule, OwnersModule,
        RouterTestingModule.withRoutes(
          [{path: 'owners', component: OwnerListComponent},
            {path: 'owners/add', component: OwnerAddComponent},
            {path: 'owners/:id', component: OwnerDetailComponent},
            {path: 'owners/:id/edit', component: OwnerEditComponent}
          ])],
      providers: [
        {provide: OwnerService, useValue: ownerService},
        {provide: ActivatedRoute, useValue: {queryParamMap: of(convertToParamMap({}))}}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersPageSpy = spyOn(ownerService, 'getOwnersPage').and.returnValue(of(onePage));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch a page of owners on init', () => {
    fixture.detectChanges();
    expect(getOwnersPageSpy.calls.any()).toBe(true);
  });

  it('should default to page 0, size 10, sorted by name ascending', () => {
    fixture.detectChanges();
    expect(component.pageIndex).toBe(0);
    expect(component.pageSize).toBe(10);
    expect(component.sortActive).toBe('name');
    expect(component.sortDirection).toBe('asc');
  });

  it('should render the name as "lastName, firstName"', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      const de: DebugElement = fixture.debugElement.query(By.css('.ownerFullName'));
      expect((de.nativeElement as HTMLElement).innerText).toContain('Franklin, George');
    });
  }));

});
