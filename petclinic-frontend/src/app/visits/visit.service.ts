import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {Visit} from './visit';
import {VisitPage} from './visit-page';
import {environment} from '../../environments/environment';
import {HandleError, HttpErrorHandler} from '../error.service';
import {HttpClient, HttpParams} from '@angular/common/http';
import {catchError} from 'rxjs/operators';

export interface VisitQuery {
  page?: number;
  size?: number;
  sort?: string;
}

@Injectable()
export class VisitService {

  private entityUrl = environment.REST_API_URL + 'visits';

  private readonly handlerError: HandleError;

  constructor(private http: HttpClient, private httpErrorHandler: HttpErrorHandler) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  // Only the parameters given are sent: the server owns the defaults (page 0, size 10, date,desc).
  getVisitsPage(query: VisitQuery = {}): Observable<VisitPage> {
    let params = new HttpParams();
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) {
        params = params.set(name, String(value));
      }
    }
    return this.http.get<VisitPage>(this.entityUrl, {params})
      .pipe(
        catchError(this.handlerError('getVisitsPage', {} as VisitPage))
      );
  }

  getVisitById(visitId: string): Observable<Visit> {
    return this.http.get<Visit>(this.entityUrl + '/' + visitId)
      .pipe(
        catchError(this.handlerError('getVisitById', {} as Visit))
      );
  }

  addVisit(visit: Visit): Observable<Visit> {
    const ownerId = visit.pet.ownerId;
    const petId = visit.pet.id;
    const visitsUrl = environment.REST_API_URL + `owners/${ownerId}/pets/${petId}/visits`;
    return this.http.post<Visit>(visitsUrl, visit)
      .pipe(
        catchError(this.handlerError('addVisit', visit))
      );
  }

  updateVisit(visitId: string, visit: Visit): Observable<Visit> {
    return this.http.put<Visit>(this.entityUrl + '/' + visitId, visit)
      .pipe(
        catchError(this.handlerError('updateVisit', visit))
      );
  }

  deleteVisit(visitId: string): Observable<number> {
    return this.http.delete<number>(this.entityUrl + '/' + visitId)
      .pipe(
        catchError(this.handlerError('deleteVisit', 0))
      );

  }


}
