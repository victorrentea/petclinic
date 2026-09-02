import {Injectable} from '@angular/core';
import {environment} from '../../environments/environment';
import {Observable} from 'rxjs';
import {PetType} from './pettype';
import {HttpClient} from '@angular/common/http';
import {catchError} from 'rxjs/operators';
import {HandleError, HttpErrorHandler} from '../error.service';

@Injectable()
export class PetTypeService {

  entityUrl = environment.REST_API_URL + 'pettypes';

  private readonly handlerError: HandleError;

  constructor(private http: HttpClient, private httpErrorHandler: HttpErrorHandler) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  getPetTypes(): Observable<PetType[]> {
    return this.http.get<PetType[]>(this.entityUrl)
      .pipe(
        catchError(this.handlerError('getPetTypes', []))
      );
  }

  getPetTypeById(typeId: string): Observable<PetType> {
    return this.http.get<PetType>((this.entityUrl + '/' + typeId))
      .pipe(
        catchError(this.handlerError('getPetTypeById', {} as PetType))
      );
  }

  updatePetType(typeId: string, petType: PetType): Observable<PetType> {
    return this.http.put<PetType>(this.entityUrl + '/' + typeId, petType)
      .pipe(
        catchError(this.handlerError('updatePetType', petType))
      );
  }

  addPetType(petType: PetType): Observable<PetType> {
    return this.http.post<PetType>(this.entityUrl, petType)
      .pipe(
        catchError(this.handlerError('addPetType', petType))
      );
  }

  deletePetType(typeId: string): Observable<number> {
    return this.http.delete<number>(this.entityUrl + '/' + typeId)
      .pipe(
        catchError(this.handlerError('deletePetType', 0))
      );
  }

}
