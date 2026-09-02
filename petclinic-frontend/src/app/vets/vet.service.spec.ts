import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { VetService } from './vet.service';
import { Vet } from './vet';

describe('VetService', () => {
  let httpTestingController: HttpTestingController;
  let vetService: VetService;

  const expectedVets: Vet[] = [
    { id: 1, firstName: 'James', lastName: 'Carter', specialties: [] },
    { id: 2, firstName: 'Helen', lastName: 'Leary', specialties: [{ id: 1, name: 'radiology' }] }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VetService, HttpErrorHandler]
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    vetService = TestBed.inject(VetService);
  });

  afterEach(() => httpTestingController.verify());

  it('should return expected vets', () => {
    vetService.getVets().subscribe(vets => expect(vets).toEqual(expectedVets), fail);
    const req = httpTestingController.expectOne(vetService.entityUrl);
    expect(req.request.method).toEqual('GET');
    req.flush(expectedVets);
  });

  it('should get vet by id', () => {
    vetService.getVetById('1').subscribe(vet => expect(vet).toEqual(expectedVets[0]), fail);
    const req = httpTestingController.expectOne(vetService.entityUrl + '/1');
    expect(req.request.method).toEqual('GET');
    req.flush(expectedVets[0]);
  });

  it('should add vet', () => {
    const newVet: Vet = { id: 0, firstName: 'John', lastName: 'Doe', specialties: [] };
    vetService.addVet(newVet).subscribe(v => expect(v).toEqual(newVet), fail);
    const req = httpTestingController.expectOne(vetService.entityUrl);
    expect(req.request.method).toEqual('POST');
    expect(req.request.body).toEqual(newVet);
    req.event(new HttpResponse({ status: 201, statusText: 'Created', body: newVet }));
  });

  it('should update vet', () => {
    const vet: Vet = { id: 1, firstName: 'James', lastName: 'Updated', specialties: [] };
    vetService.updateVet('1', vet).subscribe(v => expect(v).toEqual(vet), fail);
    const req = httpTestingController.expectOne(vetService.entityUrl + '/1');
    expect(req.request.method).toEqual('PUT');
    expect(req.request.body).toEqual(vet);
    req.event(new HttpResponse({ status: 204, statusText: 'No Content', body: vet }));
  });

  it('should delete vet', () => {
    vetService.deleteVet('1').subscribe();
    const req = httpTestingController.expectOne(vetService.entityUrl + '/1');
    expect(req.request.method).toEqual('DELETE');
    req.flush(null);
  });
});
