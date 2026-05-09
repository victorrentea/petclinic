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
import { OwnerSummary } from './owner-summary';

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
      .subscribe((owners) => expect(owners).toEqual(expectedOwners), fail);

    const req = httpTestingController.expectOne(ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ content: expectedOwners });
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

  it('search owners with q parameter', () => {
    ownerService.getOwners('Fr').subscribe((owners) => {
      expect(owners).toEqual(expectedOwners);
    });

    const req = httpTestingController.expectOne(
      ownerService.entityUrl + '?q=Fr'
    );
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.has('q')).toBe(true);
    expect(req.request.params.get('q')).toBe('Fr');
    req.flush({ content: expectedOwners });
  });

  it('getOwners without q parameter should not include q in request', () => {
    ownerService.getOwners().subscribe((owners) => {
      expect(owners).toEqual(expectedOwners);
    });

    const req = httpTestingController.expectOne(ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ content: expectedOwners });
  });

  it('getOwners with empty string should not include q in request', () => {
    ownerService.getOwners('').subscribe((owners) => {
      expect(owners).toEqual(expectedOwners);
    });

    const req = httpTestingController.expectOne(ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ content: expectedOwners });
  });

  describe('getOwnerPage', () => {
    const mockOwnerPage: OwnerPage = {
      content: [
        {
          id: 1,
          displayName: 'George Franklin',
          address: '110 W. Liberty St.',
          city: 'Madison',
          telephone: '6085551023',
          pets: [{ id: 1, name: 'Leo' }],
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
    };

    it('should call GET /api/owners with page, size, and sort params', () => {
      ownerService
        .getOwnerPage({ page: 0, size: 10, sort: 'name,asc' })
        .subscribe((page) => {
          expect(page).toEqual(mockOwnerPage);
        });

      const req = httpTestingController.expectOne(
        (r) => r.url === ownerService.entityUrl
      );
      expect(req.request.method).toEqual('GET');
      expect(req.request.params.get('page')).toBe('0');
      expect(req.request.params.get('size')).toBe('10');
      expect(req.request.params.get('sort')).toBe('name,asc');
      expect(req.request.params.has('q')).toBe(false);
      req.flush(mockOwnerPage);
    });

    it('should include q param when provided', () => {
      ownerService
        .getOwnerPage({ page: 1, size: 25, sort: 'city,desc', q: 'Frank' })
        .subscribe((page) => {
          expect(page).toEqual(mockOwnerPage);
        });

      const req = httpTestingController.expectOne(
        (r) => r.url === ownerService.entityUrl
      );
      expect(req.request.method).toEqual('GET');
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('25');
      expect(req.request.params.get('sort')).toBe('city,desc');
      expect(req.request.params.get('q')).toBe('Frank');
      req.flush(mockOwnerPage);
    });

    it('should not include q param when q is empty string', () => {
      ownerService
        .getOwnerPage({ page: 0, size: 10, sort: 'name,asc', q: '' })
        .subscribe((page) => {
          expect(page).toEqual(mockOwnerPage);
        });

      const req = httpTestingController.expectOne(
        (r) => r.url === ownerService.entityUrl
      );
      expect(req.request.params.has('q')).toBe(false);
      req.flush(mockOwnerPage);
    });
  });
});
