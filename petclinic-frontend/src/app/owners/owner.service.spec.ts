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

  describe('listOwners', () => {
    const page: OwnerPage = {content: expectedOwners, totalElements: 26};

    it('lets the backend apply its defaults when given no query', () => {
      ownerService.listOwners().subscribe((p) => expect(p).toEqual(page), fail);

      const req = httpTestingController.expectOne(ownerService.entityUrl);
      expect(req.request.method).toEqual('GET');
      expect(req.request.params.keys()).toEqual([]);
      req.flush(page);
    });

    it('sends the filter, page, size and sort it is given', () => {
      ownerService.listOwners({lastName: 'Fr', page: 2, size: 20, sort: 'city,desc'})
        .subscribe((p) => expect(p).toEqual(page), fail);

      const req = httpTestingController.expectOne((r) => r.url === ownerService.entityUrl);
      expect(req.request.params.get('lastName')).toBe('Fr');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.get('sort')).toBe('city,desc');
      req.flush(page);
    });

    it('omits an empty last name, which already matches everyone', () => {
      ownerService.listOwners({lastName: '', page: 0}).subscribe();

      const req = httpTestingController.expectOne((r) => r.url === ownerService.entityUrl);
      expect(req.request.params.has('lastName')).toBeFalse();
      expect(req.request.params.get('page')).toBe('0');
      req.flush(page);
    });

    // Concatenated raw, '+', '&', '%', '#' or a space would change the prefix the server reads
    it('percent-encodes the prefix', () => {
      ownerService.listOwners({lastName: 'A+B &%#'}).subscribe();

      const req = httpTestingController.expectOne((r) => r.url === ownerService.entityUrl);
      expect(req.request.urlWithParams).toBe(ownerService.entityUrl + '?lastName=A%2BB%20%26%25%23');
      req.flush(page);
    });

    it('rejects an array, the pre-paging answer, instead of showing it as no owners', () => {
      let failure: unknown;
      ownerService.listOwners().subscribe(() => fail('an array is not a page'), (e) => failure = e);

      httpTestingController.expectOne(ownerService.entityUrl).flush(expectedOwners);

      expect(failure).toBeDefined();
    });

    it('propagates an HTTP failure instead of answering an empty page', () => {
      let failure: unknown;
      ownerService.listOwners({size: 7 as any}).subscribe(() => fail('no page on a 400'), (e) => failure = e);

      httpTestingController.expectOne((r) => r.url === ownerService.entityUrl)
        .flush({title: 'Validation Error'}, {status: 400, statusText: 'Bad Request'});

      expect(failure).toContain('400');
    });
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
