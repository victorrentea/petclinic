import {
  HttpClientTestingModule,
  HttpTestingController,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { OwnerPage, OwnerQuery, OwnerService } from './owner.service';
import { Owner } from './owner';

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
      petCount: 0,
      pets: []
    },
    {
      id: 2,
      firstName: 'Betty',
      lastName: 'Davis',
      address: '638 Cardinal Ave.',
      city: 'Sun Prairie',
      telephone: '6085551749',
      petCount: 0,
      pets: []
    }
  ];

  const defaultQuery: OwnerQuery = {lastName: '', page: 0, size: 10, sort: 'name,asc'};

  const expectedPage: OwnerPage = {
    content: expectedOwners,
    totalElements: 2,
    number: 0,
    size: 10
  };

  function expectListRequest(query: OwnerQuery): TestRequest {
    const req = httpTestingController.expectOne(
      request => request.url === ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.get('lastName')).toEqual(query.lastName);
    expect(req.request.params.get('page')).toEqual(String(query.page));
    expect(req.request.params.get('size')).toEqual(String(query.size));
    expect(req.request.params.get('sort')).toEqual(query.sort);
    return req;
  }

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

  it('should return the requested page of owners', () => {
    let received: OwnerPage;
    ownerService.getOwners(defaultQuery).subscribe(page => received = page, fail);

    expectListRequest(defaultQuery).flush(expectedPage);

    expect(received).toEqual(expectedPage);
  });

  it('sends the whole view state as query parameters', () => {
    const query: OwnerQuery = {lastName: 'Fr', page: 2, size: 20, sort: 'city,desc'};
    ownerService.getOwners(query).subscribe();

    expectListRequest(query).flush(expectedPage);
  });

  it('propagates a failure instead of masking it as an empty page', () => {
    let failure: unknown = null;
    ownerService.getOwners(defaultQuery).subscribe(
      () => fail('the list call must not swallow the error'),
      error => failure = error);

    httpTestingController.expectOne(request => request.url === ownerService.entityUrl)
      .flush('boom', {status: 500, statusText: 'Server Error'});

    expect(failure).toBeTruthy();
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
      petCount: 0,
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
      petCount: 0,
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
