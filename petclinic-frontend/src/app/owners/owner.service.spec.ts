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

  it('lists the first page with the server defaults when no query is given', () => {
    ownerService
      .getOwners()
      .subscribe((page) => expect(page).toEqual(expectedPage), fail);

    const req = httpTestingController.expectOne(ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(expectedPage);
  });

  it('sends filter, page, size and sort as query parameters', () => {
    ownerService
      .getOwners({ lastName: 'Fr', page: 2, size: 20, sort: 'city,desc' })
      .subscribe((page) => expect(page).toEqual(expectedPage), fail);

    const req = httpTestingController.expectOne(
      (r) => r.url === ownerService.entityUrl);
    expect(req.request.urlWithParams).toEqual(
      ownerService.entityUrl + '?lastName=Fr&page=2&size=20&sort=city%2Cdesc');
    req.flush(expectedPage);
  });

  it('leaves out an empty last name, which matches every owner anyway', () => {
    ownerService.getOwners({ lastName: '', page: 0 }).subscribe();

    const req = httpTestingController.expectOne((r) => r.url === ownerService.entityUrl);
    expect(req.request.urlWithParams).toEqual(ownerService.entityUrl + '?page=0');
    req.flush(expectedPage);
  });

  it('encodes every reserved character of the prefix, so + is not read as a space', () => {
    ownerService.getOwners({ lastName: "O+B&n=1%_ 'x" }).subscribe();

    const req = httpTestingController.expectOne((r) => r.url === ownerService.entityUrl);
    expect(req.request.urlWithParams).toEqual(
      ownerService.entityUrl + "?lastName=O%2BB%26n%3D1%25_%20'x");
    req.flush(expectedPage);
  });

  it('rejects an array-shaped answer instead of passing it on as a page', () => {
    let error: unknown;
    ownerService.getOwners().subscribe({
      next: () => fail('an array is not a page'),
      error: (e) => (error = e),
    });

    httpTestingController.expectOne(ownerService.entityUrl).flush(expectedOwners);

    expect(error).toBeTruthy();
  });

  it('propagates a failed request to the caller', () => {
    let error: unknown;
    ownerService.getOwners({ size: 7 }).subscribe({
      next: () => fail('a 400 is not a page'),
      error: (e) => (error = e),
    });

    httpTestingController
      .expectOne((r) => r.url === ownerService.entityUrl)
      .flush('size must be one of 5, 10, 20', { status: 400, statusText: 'Bad Request' });

    expect(error).toContain('400');
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
