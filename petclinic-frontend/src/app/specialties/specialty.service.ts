import {Injectable} from '@angular/core';
import {environment} from '../../environments/environment';
import {Observable} from 'rxjs';
import {Specialty} from './specialty';
import {catchError} from 'rxjs/operators';
import {HandleError, HttpErrorHandler} from '../error.service';
import {HttpClient} from '@angular/common/http';

@Injectable()
export class SpecialtyService {

  private entityUrl = environment.REST_API_URL + 'specialties';

  private handlerError: HandleError;

  constructor(private http: HttpClient, private httpErrorHandler: HttpErrorHandler) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  getSpecialties(): Observable<Specialty[]> {
    return this.http.get<Specialty[]>(this.entityUrl)
      .pipe(
        catchError(this.handlerError('getSpecialties', []))
      );
  }

  getSpecialtyById(specId: string): Observable<Specialty> {
    return this.http.get<Specialty>((this.entityUrl + '/' + specId))
      .pipe(
        catchError(this.handlerError('getSpecialtyById', {} as Specialty))
      );
  }

  addSpecialty(specialty: Specialty): Observable<Specialty> {
    return this.http.post<Specialty>(this.entityUrl, specialty)
      .pipe(
        catchError(this.handlerError('addSpecialty', specialty))
      );
  }

  updateSpecialty(specId: string, specialty: Specialty): Observable<Specialty> {
    return this.http.put<Specialty>((this.entityUrl + '/' + specId), specialty)
      .pipe(
        catchError(this.handlerError('updateSpecialty', specialty))
      );
  }

  deleteSpecialty(specId: string): Observable<number> {
    return this.http.delete<number>((this.entityUrl + '/' + specId))
      .pipe(
        catchError(this.handlerError('deleteSpecialty', 0))
      );
  }

}
