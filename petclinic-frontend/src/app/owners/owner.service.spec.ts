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

  describe('getOwnerPage', () => {
    const page: OwnerPage = {content: expectedOwners, totalElements: 26};

    it('sends the defaults explicitly and returns the typed page', () => {
      let received: OwnerPage;
      ownerService.getOwnerPage().subscribe(p => received = p, fail);

      const req = httpTestingController.expectOne(r => r.url === ownerService.entityUrl);
      expect(req.request.method).toEqual('GET');
      expect(req.request.urlWithParams).toEqual(ownerService.entityUrl + '?page=0&size=10&sort=name,asc');
      req.flush(page);

      expect(received).toEqual(page);
    });

    it('sends filter, page, size and sort', () => {
      ownerService.getOwnerPage({lastName: 'Fr', page: 2, size: 20, sort: 'city,desc'}).subscribe();

      const req = httpTestingController.expectOne(r => r.url === ownerService.entityUrl);
      expect(req.request.urlWithParams)
        .toEqual(ownerService.entityUrl + '?lastName=Fr&page=2&size=20&sort=city,desc');
      req.flush(page);
    });

    it('encodes the prefix so it reaches the API literally', () => {
      ownerService.getOwnerPage({lastName: 'O+B&C %_#'}).subscribe();

      const req = httpTestingController.expectOne(r => r.url === ownerService.entityUrl);
      expect(req.request.params.get('lastName')).toEqual('O+B&C %_#');
      expect(req.request.urlWithParams).toContain('?lastName=O%2BB%26C%20%25_%23&page=0');
      req.flush(page);
    });

    it('rejects an array-shaped response', () => {
      let error: unknown;
      ownerService.getOwnerPage().subscribe(() => fail('an array is not a page'), e => error = e);

      httpTestingController.expectOne(r => r.url === ownerService.entityUrl).flush(expectedOwners);

      expect(error).toBeTruthy();
    });

    it('propagates a failed request', () => {
      let error: unknown;
      ownerService.getOwnerPage().subscribe(() => fail('no page on failure'), e => error = e);

      httpTestingController.expectOne(r => r.url === ownerService.entityUrl)
        .flush('boom', {status: 500, statusText: 'Server Error'});

      expect(error).toBeTruthy();
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
