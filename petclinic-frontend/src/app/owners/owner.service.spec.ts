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

  it('getOwners() sends no paging parameters, leaving the defaults to the server', () => {
    const page: OwnerPage = {content: expectedOwners, totalElements: 26};

    ownerService.getOwners().subscribe(
      (received) => expect(received).toEqual(page), fail);

    const req = httpTestingController.expectOne(ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(page);
  });

  it('getOwners() returns the page envelope, not the owners array', () => {
    let received: OwnerPage | undefined;
    ownerService.getOwners().subscribe((page) => received = page, fail);

    httpTestingController.expectOne(ownerService.entityUrl)
      .flush({content: expectedOwners, totalElements: 2});

    expect(Array.isArray(received)).toBe(false);
    expect(received?.content).toEqual(expectedOwners);
    expect(received?.totalElements).toBe(2);
  });

  it('getOwners(query) sends the filter, page, size and sort', () => {
    ownerService.getOwners({lastName: 'Fr', page: 2, size: 20, sort: 'city,desc'}).subscribe();

    const req = httpTestingController.expectOne(
      (r) => r.url === ownerService.entityUrl);
    expect(req.request.params.get('lastName')).toBe('Fr');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.get('sort')).toBe('city,desc');
    req.flush({content: [], totalElements: 0});
  });

  it('getOwners(query) omits an empty last name', () => {
    ownerService.getOwners({lastName: '', page: 0}).subscribe();

    const req = httpTestingController.expectOne((r) => r.url === ownerService.entityUrl);
    expect(req.request.params.has('lastName')).toBe(false);
    expect(req.request.params.get('page')).toBe('0');
    req.flush({content: [], totalElements: 0});
  });

  it('getOwners(query) encodes the last name prefix', () => {
    ownerService.getOwners({lastName: 'O&Ne il%#'}).subscribe();

    const req = httpTestingController.expectOne((r) => r.url === ownerService.entityUrl);
    expect(req.request.urlWithParams).toBe(ownerService.entityUrl + '?lastName=O%26Ne%20il%25%23');
    req.flush({content: [], totalElements: 0});
  });

  it('getOwners() propagates a failure instead of answering an empty page', () => {
    let failure: unknown;
    ownerService.getOwners().subscribe(
      () => fail('a failed request must not emit a page'),
      (error) => failure = error);

    httpTestingController.expectOne(ownerService.entityUrl)
      .flush('boom', {status: 500, statusText: 'Server Error'});

    expect(failure).toContain('500');
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
