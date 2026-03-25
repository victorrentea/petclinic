import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { OwnerService } from './owner.service';
import { Owner } from './owner';
import { OwnerPage } from './owner-page';

describe('OwnerService', () => {
  let httpTestingController: HttpTestingController;
  let ownerService: OwnerService;

  const expectedOwners: Owner[] = [
    {
      id: 1,
      firstName: 'George',
      lastName: 'Franklin',
      address: '110 W. Liberty St.',
      city: 'Madison',
      telephone: '6085551023',
      pets: []
    },
    {
      id: 2,
      firstName: 'Betty',
      lastName: 'Davis',
      address: '638 Cardinal Ave.',
      city: 'Sun Prairie',
      telephone: '6085551749',
      pets: []
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OwnerService, HttpErrorHandler],
    });

    httpTestingController = TestBed.inject(HttpTestingController);
    ownerService = TestBed.inject(OwnerService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('getOwnersPaged(0, 10) — no lastName — builds URL with page and size only', () => {
    const mockPage: OwnerPage = {
      owners: expectedOwners,
      totalElements: 2,
      totalPages: 1,
      currentPage: 0,
    };

    ownerService.getOwnersPaged(0, 10).subscribe((page) => {
      expect(page).toEqual(mockPage);
    });

    const req = httpTestingController.expectOne(
      ownerService.entityUrl + '?page=0&size=10'
    );
    expect(req.request.method).toEqual('GET');
    req.flush(mockPage);
  });

  it('getOwnersPaged(1, 20) — no lastName — builds URL with page=1 and size=20', () => {
    const mockPage: OwnerPage = {
      owners: [],
      totalElements: 2,
      totalPages: 1,
      currentPage: 1,
    };

    ownerService.getOwnersPaged(1, 20).subscribe((page) => {
      expect(page).toEqual(mockPage);
    });

    const req = httpTestingController.expectOne(
      ownerService.entityUrl + '?page=1&size=20'
    );
    expect(req.request.method).toEqual('GET');
    req.flush(mockPage);
  });

  it('getOwnersPaged(0, 10, "Franklin") — with lastName — appends lastName param', () => {
    const mockPage: OwnerPage = {
      owners: [expectedOwners[0]],
      totalElements: 1,
      totalPages: 1,
      currentPage: 0,
    };

    ownerService.getOwnersPaged(0, 10, 'Franklin').subscribe((page) => {
      expect(page).toEqual(mockPage);
    });

    const req = httpTestingController.expectOne(
      ownerService.entityUrl + '?page=0&size=10&lastName=Franklin'
    );
    expect(req.request.method).toEqual('GET');
    req.flush(mockPage);
  });

  it('getOwnersPaged(0, 10, "") — empty lastName — does not append lastName param', () => {
    const mockPage: OwnerPage = {
      owners: expectedOwners,
      totalElements: 2,
      totalPages: 1,
      currentPage: 0,
    };

    ownerService.getOwnersPaged(0, 10, '').subscribe((page) => {
      expect(page).toEqual(mockPage);
    });

    const req = httpTestingController.expectOne(
      ownerService.entityUrl + '?page=0&size=10'
    );
    expect(req.request.method).toEqual('GET');
    req.flush(mockPage);
  });

  it('search the owner by id', () => {
    ownerService.getOwnerById(1).subscribe((owner) => {
      expect(owner).toEqual(expectedOwners[0]);
    });

    const req = httpTestingController.expectOne(ownerService.entityUrl + '/1');
    expect(req.request.method).toEqual('GET');
    req.flush(expectedOwners[0]);
  });

  it('add owner', () => {
    const owner: Owner = {
      id: 0,
      firstName: 'Mary',
      lastName: 'John',
      address: '110 W. Church St.',
      city: 'Madison',
      telephone: '6085551023',
      pets: []
    };

    ownerService
      .addOwner(owner)
      .subscribe((data) => expect(data).toEqual(owner, 'should return new owner'), fail);

    const req = httpTestingController.expectOne(ownerService.entityUrl);
    expect(req.request.method).toEqual('POST');
    expect(req.request.body).toEqual(owner);

    const expectedResponse = new HttpResponse({
      status: 201,
      statusText: 'Created',
      body: owner,
    });
    req.event(expectedResponse);
  });

  it('updateOwner', () => {
    const owner: Owner = {
      id: 1,
      firstName: 'George',
      lastName: 'Franklin',
      address: '110 W. Church St.',
      city: 'Madison',
      telephone: '6085551023',
      pets: []
    };

    ownerService
      .updateOwner(owner.id.toString(), owner)
      .subscribe((data) => expect(data).toEqual(owner, 'updated owner'), fail);

    const req = httpTestingController.expectOne(ownerService.entityUrl + '/'+owner.id);
    expect(req.request.method).toEqual('PUT');
    expect(req.request.body).toEqual(owner);

    const expectedResponse = new HttpResponse({
      status: 204,
      statusText: 'No Content',
      body: owner,
    });
    req.event(expectedResponse);
  });

  it('delete Owner', () => {
    ownerService.deleteOwner('1').subscribe();

    const req = httpTestingController.expectOne(ownerService.entityUrl + '/1');
    expect(req.request.method).toEqual('DELETE');
    expect(req.request.body).toEqual(null);
    req.flush(null);
  });
});
