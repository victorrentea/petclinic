/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner, OwnerPage, OwnerPageQuery} from '../owner';
import {Observable, of, Subject, throwError} from 'rxjs';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {MatPaginator} from '@angular/material/paginator';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {PartsModule} from '../../parts/parts.module';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwnersPage(query: OwnerPageQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersPageSpy: Spy;

  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  const testPage: OwnerPage = {content: [testOwner], totalElements: 29};

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
        {provide: OwnerService, useValue: ownerService}
      ]
    })
      .compileComponents();
  }));

  function createComponent() {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersPageSpy = spyOn(ownerService, 'getOwnersPage').and.returnValue(of(testPage));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  }

  /** Every grid change goes through the URL, so it answers after the router settles. */
  function settle() {
    tick();
    fixture.detectChanges();
  }

  function lastQuery(): OwnerPageQuery {
    return getOwnersPageSpy.calls.mostRecent().args[0];
  }

  function paginator(): MatPaginator {
    return fixture.debugElement.query(By.directive(MatPaginator)).componentInstance;
  }

  it('opens on the first 10 owners sorted by name ascending', fakeAsync(() => {
    createComponent();
    expect(lastQuery()).toEqual({lastName: '', sort: 'name', dir: 'asc', page: 0, size: 10});
  }));

  it('shows the owner name last name first', fakeAsync(() => {
    createComponent();
    const cell: HTMLElement = fixture.debugElement.query(By.css('.ownerFullName')).nativeElement;
    expect(cell.innerText).toBe('Franklin, George');
  }));

  it('shows the range on screen and the total', fakeAsync(() => {
    createComponent();
    const label: HTMLElement = fixture.debugElement.query(By.css('.mat-mdc-paginator-range-label')).nativeElement;
    expect(label.textContent.trim()).toBe('1 – 10 of 29');
  }));

  it('only Name and City are sortable', fakeAsync(() => {
    createComponent();
    const sortable = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
      .map(th => th.nativeElement.textContent.trim());
    expect(sortable).toEqual(['Name', 'City']);
  }));

  it('clicking City sorts by city ascending from page 1, clicking again descending', fakeAsync(() => {
    createComponent();
    paginator().nextPage();
    settle();
    const city = fixture.debugElement.query(By.css('th[mat-sort-header="city"]')).nativeElement;

    city.click();
    settle();
    expect(lastQuery()).toEqual(jasmine.objectContaining({sort: 'city', dir: 'asc', page: 0}));

    city.click();
    settle();
    expect(lastQuery()).toEqual(jasmine.objectContaining({sort: 'city', dir: 'desc', page: 0}));
  }));

  it('next page keeps the sort and size', fakeAsync(() => {
    createComponent();
    paginator().nextPage();
    settle();

    expect(lastQuery()).toEqual({lastName: '', sort: 'name', dir: 'asc', page: 1, size: 10});
  }));

  it('a new page size returns to the first page', fakeAsync(() => {
    createComponent();
    paginator().nextPage();
    settle();

    paginator()._changePageSize(5);
    settle();

    expect(lastQuery()).toEqual(jasmine.objectContaining({page: 0, size: 5}));
  }));

  it('a search returns to the first page', fakeAsync(() => {
    createComponent();
    paginator().nextPage();
    settle();

    component.searchByLastName('Fr');
    settle();

    expect(lastQuery()).toEqual(jasmine.objectContaining({lastName: 'Fr', page: 0}));
  }));

  it('writes the grid state into the URL, leaving the defaults out', fakeAsync(() => {
    createComponent();
    fixture.debugElement.query(By.css('th[mat-sort-header="city"]')).nativeElement.click();
    settle();
    paginator().nextPage();
    settle();

    expect(TestBed.inject(Router).url).toBe('/?sort=city&page=1');
  }));

  it('a refresh lands on the page in the URL', fakeAsync(() => {
    TestBed.inject(Router).navigateByUrl('/?sort=city&dir=desc&page=2&size=5&lastName=Da');
    tick();

    createComponent();

    expect(lastQuery()).toEqual({lastName: 'Da', sort: 'city', dir: 'desc', page: 2, size: 5});
    expect(component.lastName).toBe('Da');
  }));

  it('ignores grid values in the URL it does not offer', fakeAsync(() => {
    TestBed.inject(Router).navigateByUrl('/?sort=telephone&dir=up&page=-3&size=1000');
    tick();

    createComponent();

    expect(lastQuery()).toEqual({lastName: '', sort: 'name', dir: 'asc', page: 0, size: 10});
  }));

  it('no match: a friendly message instead of the table and paginator', fakeAsync(() => {
    createComponent();
    getOwnersPageSpy.and.returnValue(of({content: [], totalElements: 0}));

    component.searchByLastName('Zzz');
    settle();

    expect(fixture.debugElement.query(By.css('.no-owners')).nativeElement.textContent).toContain('“Zzz”');
    expect(fixture.debugElement.query(By.css('#ownersTable'))).toBeNull();
    expect(fixture.debugElement.query(By.directive(MatPaginator))).toBeNull();
  }));

  it('lists the pets on one line, comma-separated, and a toggle unfolds them', fakeAsync(() => {
    createComponent();
    const owner = {...testOwner, pets: [{name: 'Liza'}, {name: 'Nana'}] as any};

    expect(component.petNames(owner)).toBe('Liza, Nana');
    component.togglePets(owner);
    expect(component.expandedPets.has(owner.id)).toBeTrue();
    component.togglePets(owner);
    expect(component.expandedPets.has(owner.id)).toBeFalse();
  }));

  it('a failed page does not stop the grid: the next search loads again', fakeAsync(() => {
    createComponent();
    getOwnersPageSpy.and.returnValue(throwError('server returned code 500'));
    component.searchByLastName('Fr');
    settle();
    expect(component.loadFailed).toBeTrue();

    getOwnersPageSpy.and.returnValue(of(testPage));
    component.searchByLastName('Franklin');
    settle();

    expect(component.loadFailed).toBeFalse();
    expect(component.owners).toEqual([testOwner]);
  }));

  it('a page past the end, from a link or a refresh, lands on the last page', fakeAsync(() => {
    TestBed.inject(Router).navigateByUrl('/?page=7');
    tick();

    createComponent();

    expect(lastQuery()).toEqual(jasmine.objectContaining({page: 2})); // 29 owners, 10 a page
    expect(TestBed.inject(Router).url).toBe('/?page=2');
  }));

  it('remembers its URL params, so an owner\'s record can send the user back to the same page', fakeAsync(() => {
    createComponent();
    paginator().nextPage();
    settle();

    expect(TestBed.inject(OwnerService).listParams).toEqual({page: 1});
  }));

  it('an earlier page answering late does not overwrite a newer one', fakeAsync(() => {
    createComponent();
    const slowAnswer = new Subject<OwnerPage>();
    getOwnersPageSpy.and.returnValues(slowAnswer, of(testPage));
    paginator().nextPage();
    settle();

    component.searchByLastName('Franklin');
    settle();
    slowAnswer.next({content: [{...testOwner, id: 2, lastName: 'Davis'}], totalElements: 29});

    expect(component.owners).toEqual([testOwner]);
  }));

});
