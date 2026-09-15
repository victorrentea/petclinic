import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { OwnerListComponent } from './owner-list.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OwnerService } from '../owner.service';
import { OwnerPage } from '../owner-page';
import { Observable, Subject } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { ActivatedRouteStub } from '../../testing/router-stubs';
import { OwnersModule } from '../owners.module';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  requests: Subject<OwnerPage>[] = [];

  getOwnersPage(): Observable<OwnerPage> {
    const subject = new Subject<OwnerPage>();
    this.requests.push(subject);
    return subject.asObservable();
  }
}

function aPage(overrides: Partial<OwnerPage> = {}): OwnerPage {
  return {
    content: [
      { id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.',
        city: 'Madison', telephone: '6085551023', petNames: ['Leo'] }
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 10,
    ...overrides
  };
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService: OwnerServiceStub;
  let route: ActivatedRouteStub;
  let router: Router;
  let navigateSpy: Spy;
  let de: DebugElement;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, NoopAnimationsModule, OwnersModule,
        RouterTestingModule.withRoutes([])],
      providers: [
        { provide: OwnerService, useClass: OwnerServiceStub },
        { provide: ActivatedRoute, useClass: ActivatedRouteStub }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService) as any;
    route = fixture.debugElement.injector.get(ActivatedRoute) as any;
    router = fixture.debugElement.injector.get(Router);
    navigateSpy = spyOn(router, 'navigate');
    route.testQueryParams = {};
  });

  function resolveFirstRequest(page: OwnerPage) {
    fixture.detectChanges();
    ownerService.requests[ownerService.requests.length - 1].next(page);
    fixture.detectChanges();
    fixture.detectChanges();
  }

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('renders the content rows of the page it receives', () => {
    resolveFirstRequest(aPage());

    de = fixture.debugElement.query(By.css('.ownerFullName'));
    expect(de.nativeElement.textContent).toContain('Franklin, George');
  });

  it('reads page/size/sort/dir/lastName from the URL, defaulting the rest', () => {
    route.testQueryParams = { sort: 'CITY', dir: 'desc' };
    fixture.detectChanges();

    expect(component.page).toBe(0);
    expect(component.size).toBe(10);
    expect(component.sort).toBe('CITY');
    expect(component.dir).toBe('desc');
    expect(component.lastName).toBe('');
  });

  it('clicking a sort header navigates with replaceUrl and merges the query params', () => {
    fixture.detectChanges();

    component.onSortChange({ active: 'CITY', direction: 'desc' } as any);

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({ sort: 'CITY', dir: 'desc' }),
      queryParamsHandling: 'merge',
      replaceUrl: true
    }));
  });

  it('changing the page navigates with replaceUrl and merges the query params', () => {
    fixture.detectChanges();

    component.onPageChange({ pageIndex: 2, pageSize: 20 } as any);

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({ page: 2, size: 20 }),
      queryParamsHandling: 'merge',
      replaceUrl: true
    }));
  });

  it('searching navigates back to page 0 and keeps sort/size via merge', () => {
    fixture.detectChanges();

    component.lastName = 'Pot';
    component.search();

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({ lastName: 'Pot', page: 0 }),
      queryParamsHandling: 'merge',
      replaceUrl: true
    }));
  });

  it('never lets a slower first response overwrite a later one (switchMap)', () => {
    fixture.detectChanges(); // fires the first request for the initial query params
    const firstRequest = ownerService.requests[0];

    route.testQueryParams = { sort: 'CITY' }; // fires a second request, switchMap should cancel the first
    fixture.detectChanges();
    const secondRequest = ownerService.requests[1];

    secondRequest.next(aPage({ number: 1 }));
    firstRequest.next(aPage({ number: 99 })); // arrives late — must be ignored

    expect(component.ownerPage.number).toBe(1);
  });

  it('shows "No owners" only when totalElements is 0, never while a page is still loading', () => {
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.no-owners'))).toBeNull();

    resolveFirstRequest(aPage({ content: [], totalElements: 0 }));
    expect(fixture.debugElement.query(By.css('.no-owners'))).not.toBeNull();
  });
});
