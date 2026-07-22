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

  const expectedPage: OwnerPage = {
    content: expectedOwners,
    totalElements: 28,
    totalPages: 3,
    number: 0,
    size: 10
  };

  it('should return a page of owners with its totals', () => {
    ownerService
      .getOwners({page: 0, size: 10, sort: 'name,asc', lastName: ''})
      .subscribe((page) => {
        expect(page.content).toEqual(expectedOwners);
        expect(page.totalElements).toEqual(28);
        expect(page.totalPages).toEqual(3);
        expect(page.number).toEqual(0);
        expect(page.size).toEqual(10);
      }, fail);

    const req = httpTestingController.expectOne(
      (request) => request.url === ownerService.entityUrl
    );
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.get('page')).toEqual('0');
    expect(req.request.params.get('size')).toEqual('10');
    expect(req.request.params.get('sort')).toEqual('name,asc');
    req.flush(expectedPage);
  });

  it('should send the lastName filter only when one is set', () => {
    ownerService
      .getOwners({page: 2, size: 20, sort: 'city,desc', lastName: 'Dav'})
      .subscribe((page) => expect(page.content).toEqual(expectedOwners), fail);

    const req = httpTestingController.expectOne(
      (request) => request.url === ownerService.entityUrl
    );
    expect(req.request.params.get('lastName')).toEqual('Dav');
    expect(req.request.params.get('page')).toEqual('2');
    expect(req.request.params.get('size')).toEqual('20');
    expect(req.request.params.get('sort')).toEqual('city,desc');
    req.flush(expectedPage);
  });

  it('should surface an error rather than silently showing an empty grid', () => {
    let reportedError: string;
    ownerService
      .getOwners({page: 0, size: 10, sort: 'name,asc', lastName: ''})
      .subscribe(() => fail('expected the failure to propagate'), (error) => reportedError = error);

    const req = httpTestingController.expectOne(
      (request) => request.url === ownerService.entityUrl
    );
    req.flush('boom', {status: 500, statusText: 'Server Error'});

    expect(reportedError).toContain('500');
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

  it('search owners by last name prefix', () => {
    ownerService
      .getOwners({page: 0, size: 10, sort: 'name,asc', lastName: 'Fr'})
      .subscribe((page) => expect(page.content).toEqual(expectedOwners));

    const req = httpTestingController.expectOne(
      (request) => request.url === ownerService.entityUrl
    );
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.get('lastName')).toEqual('Fr');
    req.flush(expectedPage);
  });
});
