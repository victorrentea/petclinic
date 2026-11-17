import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { OwnerService } from './owner.service';
import { Owner } from './owner';
import { OwnerPage, OwnerQuery } from './owner-page';

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

  const expectedPage: OwnerPage = {
    content: expectedOwners, totalElements: 2, totalPages: 1, number: 0, size: 10
  };
  const query: OwnerQuery = {page: 0, size: 10, sortField: 'lastName', sortDirection: 'asc', lastName: ''};

  it('requests a page with every criterion and returns the envelope', () => {
    let received: OwnerPage | undefined;
    ownerService.getOwnerPage({page: 2, size: 5, sortField: 'city', sortDirection: 'desc', lastName: 'Dav'})
      .subscribe((page) => received = page, fail);

    const req = httpTestingController.expectOne(r => r.url === ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('5');
    expect(req.request.params.get('sort')).toBe('city,desc');
    expect(req.request.params.get('lastName')).toBe('Dav');
    req.flush(expectedPage);
    expect(received).toEqual(expectedPage);
  });

  it('sends the default criteria explicitly', () => {
    ownerService.getOwnerPage(query).subscribe();

    const req = httpTestingController.expectOne(r => r.url === ownerService.entityUrl);
    expect(req.request.urlWithParams)
      .toBe(ownerService.entityUrl + '?page=0&size=10&sort=lastName%2Casc&lastName=');
    req.flush(expectedPage);
  });

  it('encodes characters that would otherwise change the filter', () => {
    ownerService.getOwnerPage({...query, lastName: 'a+b&c=d%'}).subscribe();

    const req = httpTestingController.expectOne(r => r.url === ownerService.entityUrl);
    expect(req.request.urlWithParams).toContain('lastName=a%2Bb%26c%3Dd%25');
    req.flush(expectedPage);
  });

  it('logs and rethrows a failed page request', () => {
    spyOn(console, 'error');
    let error: unknown;
    ownerService.getOwnerPage(query).subscribe({error: (e) => error = e});

    httpTestingController.expectOne(r => r.url === ownerService.entityUrl)
      .flush('boom', {status: 500, statusText: 'Server Error'});

    expect(error).toContain('server returned code 500');
    expect(console.error).toHaveBeenCalled();
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
