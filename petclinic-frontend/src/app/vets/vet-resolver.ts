import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import {Observable} from 'rxjs';
import {Injectable} from '@angular/core';
import {VetService} from './vet.service';
import {Vet} from './vet';
@Injectable()
export class VetResolver  {

  constructor(private vetService: VetService) { }

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<Vet> | Promise<Vet> | Vet {
    return this.vetService.getVetById(route.paramMap.get('id'));
  }

}
