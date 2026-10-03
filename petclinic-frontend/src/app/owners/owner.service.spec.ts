import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { OwnerService } from './owner.service';
import { Owner } from './owner';
import { FIRST_OWNER_PAGE, OwnerPage } from './owner-page';

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

  const page: OwnerPage = {content: expectedOwners, totalElements: 26};

  const listRequest = (req: HttpRequest<unknown>) => req.method === 'GET' && req.url === ownerService.entityUrl;

  it('requests the first page, sorted by name, by default', () => {
    let received: OwnerPage | undefined;
    ownerService.getOwnerPage().subscribe((p) => received = p, fail);

    const req = httpTestingController.expectOne(listRequest);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('sort')).toBe('name,asc');
    expect(req.request.params.has('lastName')).toBeFalse();
    req.flush(page);

    expect(received?.content).toEqual(expectedOwners);
    expect(received?.totalElements).toBe(26);
  });

  it('sends the filter, page, size and sort it is given', () => {
    ownerService.getOwnerPage({lastName: 'Fr', page: 2, size: 5, sort: 'city,desc'}).subscribe();

    const req = httpTestingController.expectOne(listRequest);
    expect(req.request.params.get('lastName')).toBe('Fr');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('5');
    expect(req.request.params.get('sort')).toBe('city,desc');
    req.flush(page);
  });

  it('encodes the last-name prefix so it reaches the API literally', () => {
    ownerService.getOwnerPage({...FIRST_OWNER_PAGE, lastName: 'Pe%_ &+#'}).subscribe();

    const req = httpTestingController.expectOne(listRequest);
    expect(req.request.urlWithParams).toContain('lastName=Pe%25_%20%26%2B%23');
    req.flush(page);
  });

  it('propagates a failed request instead of answering an empty page', () => {
    const next = jasmine.createSpy('next');
    const error = jasmine.createSpy('error');
    ownerService.getOwnerPage().subscribe({next, error});

    httpTestingController.expectOne(listRequest)
      .flush('boom', {status: 500, statusText: 'Server Error'});

    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
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
