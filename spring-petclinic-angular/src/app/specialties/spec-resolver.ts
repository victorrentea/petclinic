import {Injectable} from '@angular/core';
import {Specialty} from './specialty';

import {SpecialtyService} from './specialty.service';
import {Observable} from 'rxjs';

@Injectable()
export class SpecResolver  {

  constructor(private specialtyService: SpecialtyService) { }

  resolve(): Observable<Specialty[]> | Promise<Specialty[]> | Specialty[] {
    return this.specialtyService.getSpecialties();
  }

}
