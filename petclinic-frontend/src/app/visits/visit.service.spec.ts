import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { VisitService } from './visit.service';
import { Visit, VisitPage } from './visit';

describe('VisitService', () => {
  let httpTestingController: HttpTestingController;
  let visitService: VisitService;
  const baseUrl = 'http://localhost:8080/api/visits';

  const owner = { id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.', city: 'Madison', telephone: '6085551023', pets: [] };
  const pet = { id: 1, name: 'Leo', birthDate: '2010-09-07', type: { id: 1, name: 'cat' }, ownerId: 1, visits: [], owner };
  const expectedVisits: Visit[] = [
    { id: 1, date: '2013-01-01', description: 'rabies shot', pet }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VisitService, HttpErrorHandler]
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    visitService = TestBed.inject(VisitService);
  });

  afterEach(() => httpTestingController.verify());

  const visitPage: VisitPage = {
    content: [{id: 1, date: '2013-01-01', description: 'rabies shot', petName: 'Leo',
      ownerId: 1, ownerFirstName: 'George', ownerLastName: 'Franklin'}],
    page: {number: 0, size: 10, totalElements: 1, totalPages: 1},
  };

  it('asks for a page in the server\'s default order when no sort is chosen', () => {
    visitService.getVisitPage(0, 10).subscribe(p => expect(p).toEqual(visitPage), fail);
    const req = httpTestingController.expectOne(baseUrl + '?page=0&size=10');
    expect(req.request.method).toEqual('GET');
    req.flush(visitPage);
  });

  it('asks for a sorted page', () => {
    visitService.getVisitPage(2, 5, 'owner', 'desc').subscribe(p => expect(p).toEqual(visitPage), fail);
    httpTestingController.expectOne(baseUrl + '?page=2&size=5&sort=owner&direction=desc').flush(visitPage);
  });

  it('should get visit by id', () => {
    visitService.getVisitById('1').subscribe(v => expect(v).toEqual(expectedVisits[0]), fail);
    const req = httpTestingController.expectOne(baseUrl + '/1');
    expect(req.request.method).toEqual('GET');
    req.flush(expectedVisits[0]);
  });

  it('should add visit via owner/pet URL', () => {
    const newVisit: Visit = { id: 0, date: '2023-05-01', description: 'checkup', pet };
    visitService.addVisit(newVisit).subscribe(v => expect(v).toEqual(newVisit), fail);
    const req = httpTestingController.expectOne('http://localhost:8080/api/owners/1/pets/1/visits');
    expect(req.request.method).toEqual('POST');
    req.event(new HttpResponse({ status: 201, statusText: 'Created', body: newVisit }));
  });

  it('should update visit', () => {
    const visit: Visit = { id: 1, date: '2013-01-01', description: 'updated', pet };
    visitService.updateVisit('1', visit).subscribe(v => expect(v).toEqual(visit), fail);
    const req = httpTestingController.expectOne(baseUrl + '/1');
    expect(req.request.method).toEqual('PUT');
    req.event(new HttpResponse({ status: 204, statusText: 'No Content', body: visit }));
  });

  it('should delete visit', () => {
    visitService.deleteVisit('1').subscribe();
    const req = httpTestingController.expectOne(baseUrl + '/1');
    expect(req.request.method).toEqual('DELETE');
    req.flush(null);
  });
});
