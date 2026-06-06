import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { VisitService } from './visit.service';
import { Visit } from './visit';

describe('VisitService', () => {
  let httpTestingController: HttpTestingController;
  let visitService: VisitService;
  const baseUrl = 'http://localhost:8080/api/visits';

  const owner = { id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.', city: 'Madison', telephone: '6085551023', pets: [] };
  const pet = { id: 1, name: 'Leo', birthDate: '2010-09-07', type: { id: 1, name: 'cat' }, ownerId: 1, visits: [], owner };
  const expectedVisits: Visit[] = [
    { id: 1, date: '2013-01-01', description: 'rabies shot', vetId: 1, pet }
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

  it('should return expected visits', () => {
    visitService.getVisits().subscribe(v => expect(v).toEqual(expectedVisits), fail);
    const req = httpTestingController.expectOne(baseUrl);
    expect(req.request.method).toEqual('GET');
    req.flush(expectedVisits);
  });

  it('should get visit by id', () => {
    visitService.getVisitById('1').subscribe(v => expect(v).toEqual(expectedVisits[0]), fail);
    const req = httpTestingController.expectOne(baseUrl + '/1');
    expect(req.request.method).toEqual('GET');
    req.flush(expectedVisits[0]);
  });

  it('should add visit via owner/pet URL', () => {
    const newVisit: Visit = { id: 0, date: '2023-05-01', description: 'checkup', vetId: 1, pet };
    visitService.addVisit(newVisit).subscribe(v => expect(v).toEqual(newVisit), fail);
    const req = httpTestingController.expectOne('http://localhost:8080/api/owners/1/pets/1/visits');
    expect(req.request.method).toEqual('POST');
    req.event(new HttpResponse({ status: 201, statusText: 'Created', body: newVisit }));
  });

  it('should update visit', () => {
    const visit: Visit = { id: 1, date: '2013-01-01', description: 'updated', vetId: 1, pet };
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
