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

  const expectedPage: OwnerPage = {content: expectedOwners, totalElements: 26};

  it('getOwners without a query asks for the API defaults and returns the page', () => {
    ownerService
      .getOwners()
      .subscribe((page) => expect(page).toEqual(expectedPage), fail);

    const req = httpTestingController.expectOne(ownerService.entityUrl);
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(expectedPage);
  });

  it('getOwners sends the filter, page, size and sort as query parameters', () => {
    ownerService
      .getOwners({lastName: 'Fr', page: 2, size: 20, sort: 'city,desc'})
      .subscribe((page) => {
        expect(page.content).toEqual(expectedOwners);
        expect(page.totalElements).toBe(26);
      }, fail);

    const req = httpTestingController.expectOne(
      (r) => r.url === ownerService.entityUrl && r.method === 'GET');
    expect(req.request.urlWithParams)
      .toBe(ownerService.entityUrl + '?lastName=Fr&page=2&size=20&sort=city,desc');
    req.flush(expectedPage);
  });

  it('getOwners leaves out an empty last name', () => {
    ownerService.getOwners({lastName: '', page: 0, size: 10, sort: 'name,asc'}).subscribe();

    const req = httpTestingController.expectOne((r) => r.url === ownerService.entityUrl);
    expect(req.request.params.has('lastName')).toBe(false);
    req.flush(expectedPage);
  });

  it('getOwners encodes the last name instead of pasting it into the URL', () => {
    ownerService.getOwners({lastName: "O'Br & Co%+#"}).subscribe();

    const req = httpTestingController.expectOne((r) => r.url === ownerService.entityUrl);
    expect(req.request.urlWithParams)
      .toBe(ownerService.entityUrl + "?lastName=O'Br%20%26%20Co%25%2B%23");
    req.flush(expectedPage);
  });

  it('getOwners propagates a failure instead of answering an empty page', () => {
    const outcome = jasmine.createSpyObj('outcome', ['next', 'error']);
    ownerService.getOwners().subscribe(outcome);

    httpTestingController.expectOne(ownerService.entityUrl)
      .flush('boom', {status: 500, statusText: 'Server Error'});

    expect(outcome.next).not.toHaveBeenCalled();
    expect(outcome.error).toHaveBeenCalled();
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
