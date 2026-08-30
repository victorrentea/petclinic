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

  it('should add visit via the visits URL, carrying the pet id in the body', () => {
    const newVisit: Visit = { id: 0, date: '2023-05-01', description: 'checkup', pet };
    visitService.addVisit(newVisit).subscribe(v => expect(v).toEqual(newVisit), fail);
    const req = httpTestingController.expectOne(baseUrl);
    expect(req.request.method).toEqual('POST');
    expect(req.request.body.petId).toEqual(1);
    req.event(new HttpResponse({ status: 201, statusText: 'Created', body: newVisit }));
  });

  it('should book a visit into a slot', () => {
    const booking: Visit = { id: 0, date: '2023-05-01', description: 'checkup', pet, vetId: 2, timeSlotId: 9 };
    visitService.addVisit(booking).subscribe(v => expect(v).toEqual(booking), fail);
    const req = httpTestingController.expectOne(baseUrl);
    expect(req.request.body.timeSlotId).toEqual(9);
    req.event(new HttpResponse({ status: 201, statusText: 'Created', body: booking }));
  });

  it('should return the free slots of a vet on a day', () => {
    const slots = [{ id: 9, vetId: 2, date: '2026-09-01', startTime: '09:00:00', endTime: '09:30:00' }];
    visitService.getFreeSlots(2, '2026-09-01').subscribe(s => expect(s).toEqual(slots), fail);
    const req = httpTestingController.expectOne(
      'http://localhost:8080/api/vets/2/slots?date=2026-09-01');
    expect(req.request.method).toEqual('GET');
    req.flush(slots);
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
