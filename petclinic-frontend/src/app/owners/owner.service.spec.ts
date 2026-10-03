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

  const expectedPage: OwnerPage = { content: expectedOwners, totalElements: 26 };

  it('without a query, leaves page, size, sort and filter to the API defaults', () => {
    let received: OwnerPage | undefined;
    ownerService.getOwners().subscribe((page) => received = page, fail);

    const req = httpTestingController.expectOne(ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(expectedPage);

    expect(received).toEqual(expectedPage);
    expect(received?.totalElements).toBe(26);
  });

  it('sends the filter, page, size and sort as query parameters', () => {
    ownerService
      .getOwners({ lastName: 'Fr', page: 2, size: 5, sort: 'city,desc' })
      .subscribe((page) => expect(page).toEqual(expectedPage), fail);

    const req = httpTestingController.expectOne(
      (r) => r.url === ownerService.entityUrl && r.method === 'GET'
    );
    expect(req.request.urlWithParams).toEqual(
      ownerService.entityUrl + '?lastName=Fr&page=2&size=5&sort=city,desc'
    );
    req.flush(expectedPage);
  });

  it('percent-encodes a prefix so it reaches the API literally', () => {
    ownerService.getOwners({ lastName: "O'B c&d%_+" }).subscribe();

    const req = httpTestingController.expectOne(() => true);
    expect(req.request.urlWithParams).toEqual(
      ownerService.entityUrl + "?lastName=O'B%20c%26d%25_%2B"
    );
    req.flush(expectedPage);
  });

  it('propagates a failed list request instead of turning it into an empty page', () => {
    let failure: unknown;
    let received: OwnerPage | undefined;
    ownerService.getOwners({ size: 7 }).subscribe((page) => received = page, (error) => failure = error);

    httpTestingController.expectOne(() => true)
      .flush({ title: 'Validation Error' }, { status: 400, statusText: 'Bad Request' });

    expect(received).toBeUndefined();
    expect(failure).toBeTruthy();
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
