import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { PetTypeService } from './pettype.service';
import { PetType } from './pettype';

describe('PetTypeService', () => {
  let httpTestingController: HttpTestingController;
  let petTypeService: PetTypeService;

  const expectedPetTypes: PetType[] = [
    { id: 1, name: 'cat' },
    { id: 2, name: 'dog' }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PetTypeService, HttpErrorHandler]
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    petTypeService = TestBed.inject(PetTypeService);
  });

  afterEach(() => httpTestingController.verify());

  it('should return expected pet types', () => {
    petTypeService.getPetTypes().subscribe(pt => expect(pt).toEqual(expectedPetTypes), fail);
    const req = httpTestingController.expectOne(petTypeService.entityUrl);
    expect(req.request.method).toEqual('GET');
    req.flush(expectedPetTypes);
  });

  it('should get pet type by id', () => {
    petTypeService.getPetTypeById('1').subscribe(pt => expect(pt).toEqual(expectedPetTypes[0]), fail);
    const req = httpTestingController.expectOne(petTypeService.entityUrl + '/1');
    expect(req.request.method).toEqual('GET');
    req.flush(expectedPetTypes[0]);
  });

  it('should add pet type', () => {
    const newType: PetType = { id: 0, name: 'bird' };
    petTypeService.addPetType(newType).subscribe(pt => expect(pt).toEqual(newType), fail);
    const req = httpTestingController.expectOne(petTypeService.entityUrl);
    expect(req.request.method).toEqual('POST');
    req.event(new HttpResponse({ status: 201, statusText: 'Created', body: newType }));
  });

  it('should update pet type', () => {
    const petType: PetType = { id: 1, name: 'updated' };
    petTypeService.updatePetType('1', petType).subscribe(pt => expect(pt).toEqual(petType), fail);
    const req = httpTestingController.expectOne(petTypeService.entityUrl + '/1');
    expect(req.request.method).toEqual('PUT');
    req.event(new HttpResponse({ status: 204, statusText: 'No Content', body: petType }));
  });

  it('should delete pet type', () => {
    petTypeService.deletePetType('1').subscribe();
    const req = httpTestingController.expectOne(petTypeService.entityUrl + '/1');
    expect(req.request.method).toEqual('DELETE');
    req.flush(null);
  });
});
