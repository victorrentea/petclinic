/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';

import {VetListComponent} from './vet-list.component';
import {FormsModule} from '@angular/forms';
import {VetService} from '../vet.service';
import {ActivatedRoute, Router} from '@angular/router';
import {ActivatedRouteStub, RouterStub} from '../../testing/router-stubs';
import {Vet} from '../vet';
import {Observable, of} from 'rxjs/index';
import {ReviewService} from '../review.service';
import {ReviewStats} from '../review.model';

class VetServiceStub {
  getVets(): Observable<Vet[]> {
    return of();
  }
}

class ReviewServiceStub {
  getReviewStats(vetId: number): Observable<ReviewStats> {
    return of({
      vetId,
      averageRating: 0,
      totalReviews: 0,
      mostRecentReview: null
    });
  }
}

describe('VetListComponent', () => {
  let component: VetListComponent;
  let fixture: ComponentFixture<VetListComponent>;
  let vetService: VetService;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VetListComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule],
      providers: [
        {provide: VetService, useClass: VetServiceStub},
        {provide: ReviewService, useClass: ReviewServiceStub},
        {provide: Router, useClass: RouterStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VetListComponent);
    component = fixture.componentInstance;
    vetService = fixture.debugElement.injector.get(VetService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
