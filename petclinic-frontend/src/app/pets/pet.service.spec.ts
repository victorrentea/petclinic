import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';

import { HttpErrorHandler } from '../error.service';
import { PetService } from './pet.service';
import { Pet } from './pet';

describe('PetService', () => {
  let httpTestingController: HttpTestingController;
  let petService: PetService;
  const baseUrl = 'http://localhost:8080/api/pets';

  const owner = { id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.', city: 'Madison', telephone: '6085551023', pets: [] };
  const expectedPets: Pet[] = [
    { id: 1, name: 'Leo', birthDate: '2010-09-07', type: { id: 1, name: 'cat' }, ownerId: 1, visits: [], owner }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PetService, HttpErrorHandler]
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    petService = TestBed.inject(PetService);
  });

  afterEach(() => httpTestingController.verify());

  it('should return expected pets', () => {
    petService.getPets().subscribe(pets => expect(pets).toEqual(expectedPets), fail);
    const req = httpTestingController.expectOne(baseUrl);
    expect(req.request.method).toEqual('GET');
    req.flush(expectedPets);
  });

  it('should get pet by id', () => {
    petService.getPetById(1).subscribe(pet => expect(pet).toEqual(expectedPets[0]), fail);
    const req = httpTestingController.expectOne(baseUrl + '/1');
    expect(req.request.method).toEqual('GET');
    req.flush(expectedPets[0]);
  });

  it('should add pet via owner URL', () => {
    const newPet: Pet = { id: 0, name: 'Basil', birthDate: '2012-08-06', type: { id: 2, name: 'dog' }, ownerId: 1, visits: [], owner };
    petService.addPet(newPet).subscribe(p => expect(p).toEqual(newPet), fail);
    const req = httpTestingController.expectOne('http://localhost:8080/api/owners/1/pets');
    expect(req.request.method).toEqual('POST');
    req.event(new HttpResponse({ status: 201, statusText: 'Created', body: newPet }));
  });

  it('should update pet', () => {
    const pet: Pet = { id: 1, name: 'Updated', birthDate: '2010-09-07', type: { id: 1, name: 'cat' }, ownerId: 1, visits: [], owner };
    petService.updatePet('1', pet).subscribe(p => expect(p).toEqual(pet), fail);
    const req = httpTestingController.expectOne(baseUrl + '/1');
    expect(req.request.method).toEqual('PUT');
    req.event(new HttpResponse({ status: 204, statusText: 'No Content', body: pet }));
  });

  it('should delete pet', () => {
    petService.deletePet('1').subscribe();
    const req = httpTestingController.expectOne(baseUrl + '/1');
    expect(req.request.method).toEqual('DELETE');
    req.flush(null);
  });
});
