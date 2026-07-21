/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement, NO_ERRORS_SCHEMA } from '@angular/core';

import { OwnerListComponent } from './owner-list.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OwnerListQuery, OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { OwnerPage } from '../owner-page';
import { Observable, of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { PartsModule } from '../../parts/parts.module';
import { OwnerDetailComponent } from '../owner-detail/owner-detail.component';
import { OwnersModule } from '../owners.module';
import { DummyComponent } from '../../testing/dummy.component';
import { OwnerAddComponent } from '../owner-add/owner-add.component';
import { OwnerEditComponent } from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  listOwners(query: OwnerListQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let listOwnersSpy: Spy;
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
  let testPage: OwnerPage;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule, NoopAnimationsModule,
        RouterTestingModule.withRoutes(
          [{path: 'owners', component: OwnerListComponent},
            {path: 'owners/add', component: OwnerAddComponent},
            {path: 'owners/:id', component: OwnerDetailComponent},
            {path: 'owners/:id/edit', component: OwnerEditComponent}
          ])],
      providers: [
        {provide: OwnerService, useValue: ownerService},
        {provide: ActivatedRoute, useValue: {queryParams: of({})}}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    testPage = {
      content: [testOwner],
      totalElements: 1,
      page: 0,
      size: 10,
      totalPages: 1,
    };

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    listOwnersSpy = spyOn(ownerService, 'listOwners').and.returnValue(of(testPage));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should load a page of owners on init', () => {
    fixture.detectChanges();
    expect(listOwnersSpy).toHaveBeenCalled();
    expect(component.owners).toEqual([testOwner]);
    expect(component.totalElements).toBe(1);
  });

  it('should default to page 0, size 10, sort name,asc', () => {
    fixture.detectChanges();
    expect(listOwnersSpy).toHaveBeenCalledWith({
      page: 0, size: 10, sort: 'name,asc', lastName: ''
    });
  });

  it('should show the name as "Last, First"', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText.trim()).toBe('Franklin, George');
    });
  }));

  it('search navigates to page 0 with the last-name filter merged in', () => {
    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate');
    component.lastName = 'Fr';

    component.search();

    expect(navSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: {lastName: 'Fr', page: 0},
      queryParamsHandling: 'merge'
    }));
  });

  it('sort change navigates to page 0 with the single sort param', () => {
    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate');

    component.onSortChange({active: 'city', direction: 'desc'});

    expect(navSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: {sort: 'city,desc', page: 0},
      queryParamsHandling: 'merge'
    }));
  });

  it('paging navigates with merged page/size', () => {
    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate');

    component.onPage({pageIndex: 2, pageSize: 20, length: 100});

    expect(navSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: {page: 2, size: 20},
      queryParamsHandling: 'merge'
    }));
  });

  it('petNames joins pet names with commas', () => {
    const owner = {...testOwner, pets: [{name: 'Pongo'}, {name: 'Perdita'}]} as Owner;
    expect(component.petNames(owner)).toBe('Pongo, Perdita');
  });
});
