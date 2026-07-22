import {Injectable} from '@angular/core';
import {environment} from '../../environments/environment';
import {Observable} from 'rxjs';
import {Vet} from './vet';
import {HttpClient} from '@angular/common/http';
import {HandleError, HttpErrorHandler} from '../error.service';
import {catchError} from 'rxjs/operators';


@Injectable()
export class VetService {

  entityUrl = environment.REST_API_URL + 'vets';

  private readonly handlerError: HandleError;

  constructor(private http: HttpClient, private httpErrorHandler: HttpErrorHandler) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  getVets(): Observable<Vet[]> {
    return this.http.get<Vet[]>(this.entityUrl)
      .pipe(
        catchError(this.handlerError('getVets', []))
      );
  }

  getVetById(vetId: string): Observable<Vet> {
    return this.http.get<Vet>((this.entityUrl + '/' + vetId))
      .pipe(
        catchError(this.handlerError('getVetById', {} as Vet))
      );
  }

  updateVet(vetId: string, vet: Vet): Observable<Vet> {
    return this.http.put<Vet>(this.entityUrl + '/' + vetId, vet)
      .pipe(
        catchError(this.handlerError('updateVet', vet))
      );
  }

  addVet(vet: Vet): Observable<Vet> {
    return this.http.post<Vet>(this.entityUrl, vet)
      .pipe(
        catchError(this.handlerError('addVet', vet))
      );
  }

  deleteVet(vetId: string): Observable<number> {
    return this.http.delete<number>(this.entityUrl + '/' + vetId)
      .pipe(
        catchError(this.handlerError('deleteVet', 0))
      );
  }

}
