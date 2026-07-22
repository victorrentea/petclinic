import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { SpecialtyService } from './specialty.service';
import { Specialty } from './specialty';

describe('SpecialtyService', () => {
  let httpTestingController: HttpTestingController;
  let specialtyService: SpecialtyService;
  const baseUrl = 'http://localhost:8080/api/specialties';

  const expectedSpecialties: Specialty[] = [
    { id: 1, name: 'radiology' },
    { id: 2, name: 'surgery' }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SpecialtyService, HttpErrorHandler]
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    specialtyService = TestBed.inject(SpecialtyService);
  });

  afterEach(() => httpTestingController.verify());

  it('should return expected specialties', () => {
    specialtyService.getSpecialties().subscribe(s => expect(s).toEqual(expectedSpecialties), fail);
    const req = httpTestingController.expectOne(baseUrl);
    expect(req.request.method).toEqual('GET');
    req.flush(expectedSpecialties);
  });

  it('should get specialty by id', () => {
    specialtyService.getSpecialtyById('1').subscribe(s => expect(s).toEqual(expectedSpecialties[0]), fail);
    const req = httpTestingController.expectOne(baseUrl + '/1');
    expect(req.request.method).toEqual('GET');
    req.flush(expectedSpecialties[0]);
  });

  it('should add specialty', () => {
    const newSpec: Specialty = { id: 0, name: 'dentistry' };
    specialtyService.addSpecialty(newSpec).subscribe(s => expect(s).toEqual(newSpec), fail);
    const req = httpTestingController.expectOne(baseUrl);
    expect(req.request.method).toEqual('POST');
    req.event(new HttpResponse({ status: 201, statusText: 'Created', body: newSpec }));
  });

  it('should update specialty', () => {
    const spec: Specialty = { id: 1, name: 'updated' };
    specialtyService.updateSpecialty('1', spec).subscribe(s => expect(s).toEqual(spec), fail);
    const req = httpTestingController.expectOne(baseUrl + '/1');
    expect(req.request.method).toEqual('PUT');
    req.event(new HttpResponse({ status: 204, statusText: 'No Content', body: spec }));
  });

  it('should delete specialty', () => {
    specialtyService.deleteSpecialty('1').subscribe();
    const req = httpTestingController.expectOne(baseUrl + '/1');
    expect(req.request.method).toEqual('DELETE');
    req.flush(null);
  });
});
