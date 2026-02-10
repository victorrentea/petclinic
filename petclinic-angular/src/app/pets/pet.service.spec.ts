/* tslint:disable:no-unused-variable */

import { inject, TestBed, waitForAsync } from '@angular/core/testing';
import {PetService} from './pet.service';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {HttpClient} from '@angular/common/http';

describe('PetService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      // Import the HttpClient mocking services
      imports: [HttpClientTestingModule],
      providers: [PetService]
    });
  });

  it('should ...', waitForAsync(inject([HttpTestingController], (petService: PetService, http: HttpClient) => {
    expect(petService).toBeTruthy();
  })));
});
