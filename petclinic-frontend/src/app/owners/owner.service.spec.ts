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

  it('getOwners builds the query string from the query object', () => {
    const expectedPage: OwnerPage = { content: expectedOwners, totalElements: 2 };

    ownerService
      .getOwners({ lastName: 'Fr', sort: 'city', dir: 'desc', page: 1, size: 20 })
      .subscribe((page) => expect(page).toEqual(expectedPage), fail);

    const req = httpTestingController.expectOne(
      (r) => r.url === ownerService.entityUrl
    );
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.get('lastName')).toEqual('Fr');
    expect(req.request.params.get('sort')).toEqual('city');
    expect(req.request.params.get('dir')).toEqual('desc');
    expect(req.request.params.get('page')).toEqual('1');
    expect(req.request.params.get('size')).toEqual('20');
    req.flush(expectedPage);
  });

  it('getOwners omits an empty lastName from the query string', () => {
    const expectedPage: OwnerPage = { content: expectedOwners, totalElements: 2 };

    ownerService
      .getOwners({ lastName: '', sort: 'name', dir: 'asc', page: 0, size: 10 })
      .subscribe((page) => expect(page).toEqual(expectedPage), fail);

    const req = httpTestingController.expectOne(
      (r) => r.url === ownerService.entityUrl
    );
    expect(req.request.params.has('lastName')).toBe(false);
    expect(req.request.params.get('sort')).toEqual('name');
    expect(req.request.params.get('dir')).toEqual('asc');
    expect(req.request.params.get('page')).toEqual('0');
    expect(req.request.params.get('size')).toEqual('10');
    req.flush(expectedPage);
  });
});
