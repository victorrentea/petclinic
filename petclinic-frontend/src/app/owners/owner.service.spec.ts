import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { OwnerService } from './owner.service';
import { Owner, OwnerPage } from './owner';

describe('OwnerService', () => {
  let httpTestingController: HttpTestingController;
  let ownerService: OwnerService;

  const owners: Owner[] = [
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

  const expectedPage: OwnerPage = {
    content: owners,
    totalElements: 2,
    totalPages: 1,
    number: 0,
    size: 20
  };

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

  it('should return expected owners page (called once)', () => {
    ownerService
      .getOwners()
      .subscribe((page) => expect(page).toEqual(expectedPage), fail);

    const req = httpTestingController.expectOne(r => r.url === ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.get('page')).toEqual('0');
    expect(req.request.params.get('size')).toEqual('20');
    req.flush(expectedPage);
  });

  it('getOwners passes page, size, and multiple sort params', () => {
    ownerService.getOwners(1, 10, ['lastName,asc', 'firstName,asc']).subscribe();

    const req = httpTestingController.expectOne(r => r.url === ownerService.entityUrl);
    expect(req.request.params.get('page')).toEqual('1');
    expect(req.request.params.get('size')).toEqual('10');
    expect(req.request.params.getAll('sort')).toEqual(['lastName,asc', 'firstName,asc']);
    req.flush(expectedPage);
  });

  it('search the owner by id', () => {
    ownerService.getOwnerById(1).subscribe((owner) => {
      expect(owner).toEqual(owners[0]);
    });

    const req = httpTestingController.expectOne(ownerService.entityUrl + '/1');
    expect(req.request.method).toEqual('GET');
    req.flush(owners[0]);
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

  it('search owners by last name prefix with pagination', () => {
    ownerService.searchOwners('Fr', 0, 20).subscribe((page) => {
      expect(page).toEqual(expectedPage);
    });

    const req = httpTestingController.expectOne(r => r.url === ownerService.entityUrl);
    expect(req.request.params.get('lastName')).toEqual('Fr');
    expect(req.request.params.get('page')).toEqual('0');
    expect(req.request.method).toEqual('GET');
    req.flush(expectedPage);
  });
});
