import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { OwnerService } from './owner.service';
import { Owner, OwnerPage } from './owner';
import { DEFAULT_OWNER_QUERY } from './owner-query';

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

  const onePage: OwnerPage = {
    content: [{id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.',
      city: 'Madison', telephone: '6085551023', petNames: ['Leo']}],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 10
  };

  it('lists owners with no parameters for the default query', () => {
    ownerService.listOwners(DEFAULT_OWNER_QUERY)
      .subscribe((page) => expect(page).toEqual(onePage), fail);

    const req = httpTestingController.expectOne(ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(onePage);
  });

  it('sends only the parameters that differ from their default', () => {
    ownerService.listOwners({...DEFAULT_OWNER_QUERY, lastName: 'Pot', page: 2, sort: 'city'}).subscribe();

    const req = httpTestingController.expectOne(
      ownerService.entityUrl + '?lastName=Pot&page=2&sort=city');
    expect(req.request.method).toEqual('GET');
    req.flush(onePage);
  });

  it('sends every parameter when none is at its default', () => {
    ownerService.listOwners({lastName: 'Pot', page: 1, size: 5, sort: 'city', direction: 'desc'}).subscribe();

    const req = httpTestingController.expectOne(
      ownerService.entityUrl + '?lastName=Pot&page=1&size=5&sort=city&direction=desc');
    expect(req.request.method).toEqual('GET');
    req.flush(onePage);
  });

  it('lets a failed load reach the subscriber instead of answering an empty list', () => {
    let failure: any;
    ownerService.listOwners(DEFAULT_OWNER_QUERY).subscribe({
      next: () => fail('expected an error'),
      error: (error) => failure = error
    });

    httpTestingController.expectOne(ownerService.entityUrl)
      .flush('boom', {status: 500, statusText: 'Server Error'});

    expect(failure.status).toBe(500);
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
