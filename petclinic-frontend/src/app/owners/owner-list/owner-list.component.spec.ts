/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { DebugElement, NO_ERRORS_SCHEMA } from '@angular/core';

import { OwnerListComponent } from './owner-list.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OwnerService } from '../owner.service';
import { Page } from '../owner';
import { of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { PartsModule } from '../../parts/parts.module';
import { ActivatedRouteStub } from '../../testing/router-stubs';
import { OwnersModule } from '../owners.module';


const emptyPage: Page<any> = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 };

class OwnerServiceStub {
  searchOwnersPaged() {
    return of(emptyPage);
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let activatedRouteStub: ActivatedRouteStub;
  let router: Router;

  beforeEach(waitForAsync(() => {
    activatedRouteStub = new ActivatedRouteStub();

    TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule, RouterTestingModule],
      providers: [
        { provide: OwnerService, useClass: OwnerServiceStub },
        { provide: ActivatedRoute, useValue: activatedRouteStub }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // Task 7.1 — sort change navigates with sort param and page reset to 0
  it('onSortChange should navigate with sort and page=0', () => {
    fixture.detectChanges();
    spyOn(router, 'navigate');

    component.onSortChange({ active: 'city', direction: 'desc' });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({ sort: 'city,desc', page: 0 })
      })
    );
  });

  // Task 7.2 — page change navigates with new page and size
  it('onPageChange should navigate with page and size', () => {
    fixture.detectChanges();
    spyOn(router, 'navigate');

    component.onPageChange({ pageIndex: 2, pageSize: 5, length: 50 });

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({ page: 2, size: 5 })
      })
    );
  });

});
