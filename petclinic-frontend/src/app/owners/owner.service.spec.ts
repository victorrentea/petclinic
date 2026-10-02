import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { OwnerService } from './owner.service';
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

  it('should return expected owners (called once)', () => {
    ownerService
      .getOwners()
      .subscribe((page) => expect(page).toEqual(jasmine.objectContaining({
        content: expectedOwners, totalElements: 26
      })), fail);

    const req = httpTestingController.expectOne(request => request.url === ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('sort')).toBe('name,asc');
    req.flush({content: expectedOwners, totalElements: 26});
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
    ownerService.searchOwners('Fr').subscribe((page) => {
      expect(page).toEqual(jasmine.objectContaining({content: expectedOwners, totalElements: 2}));
    });

    const req = httpTestingController.expectOne(request => request.url === ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.get('lastName')).toBe('Fr');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('sort')).toBe('name,asc');
    req.flush({content: expectedOwners, totalElements: 2});
  });

  it('encodes special characters as one literal search parameter', () => {
    ownerService.searchOwners('A&B +%_').subscribe();
    const req = httpTestingController.expectOne(request => request.url === ownerService.entityUrl);
    expect(req.request.params.get('lastName')).toBe('A&B +%_');
    expect(req.request.urlWithParams).toContain('A%26B%20%2B%25_');
    req.flush({content: [], totalElements: 0});
  });

  it('passes an explicit page, size and business sort for both list entry points', () => {
    ownerService.searchOwners('Pot', 2, 5, 'city,desc').subscribe();
    const search = httpTestingController.expectOne(request => request.url === ownerService.entityUrl);
    expect(search.request.params.get('lastName')).toBe('Pot');
    expect(search.request.params.get('page')).toBe('2');
    expect(search.request.params.get('size')).toBe('5');
    expect(search.request.params.get('sort')).toBe('city,desc');
    search.flush({content: [], totalElements: 0});
    ownerService.getOwners(1, 20, 'name,desc').subscribe();
    const list = httpTestingController.expectOne(request => request.url === ownerService.entityUrl);
    expect(list.request.params.get('lastName')).toBe('');
    expect(list.request.params.get('page')).toBe('1');
    expect(list.request.params.get('size')).toBe('20');
    expect(list.request.params.get('sort')).toBe('name,desc');
    list.flush({content: [], totalElements: 0});
  });

  it('reports list failures rather than returning an empty page', () => {
    spyOn(console, 'error');
    const failure = jasmine.createSpy('failure');
    ownerService.getOwners().subscribe({next: fail, error: failure});
    const req = httpTestingController.expectOne(request => request.url === ownerService.entityUrl);
    req.flush('Unavailable', {status: 503, statusText: 'Service Unavailable'});
    expect(failure).toHaveBeenCalled();
  });
});
